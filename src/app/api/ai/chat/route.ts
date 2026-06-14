import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/engine/config';
import { CerebrasProvider } from '@/engine/providers/cerebras';
import { OGPrivateComputerProvider, isSupportedModel as isOgPcModel } from '@/engine/providers/ogpc';
import { ZyvaProvider, ZYVA_MODEL_ID } from '@/engine/providers/zyva';
import { runAgent } from '@/engine/orchestrator/runAgent';
import { runGraph } from '@/engine/orchestrator/graph';
import { retrieve } from '@/engine/retrieval';
import { getTeeRuntimeState } from '@/engine/tee/attestation';
import { Trace } from '@/engine/observability/trace';
import { requireAuth } from '@/lib/auth-guard';
import { chargeTokens } from '@/lib/billing';

// ZYVA (DO Inference Router) — internal model ids. Locked in user-facing UI.
const ZYVA_MODEL_IDS = new Set(['zyva', 'zyva-v1', ZYVA_MODEL_ID]);

// ── Model routing ───────────────────────────────────────────────────────────
// GLM models → Cerebras (free for testing). Others → 0G Router (BYO key).
const CEREBRAS_GLM_MODELS: Record<string, string> = {
  'glm-5.1': 'zai-glm-4.7',
  'glm-5': 'zai-glm-4.7',
  'glm-4.7': 'zai-glm-4.7',
  'zai-glm-4.7': 'zai-glm-4.7',
};
const OG_ROUTER_MODELS = new Set([
  '0GM-1.0-35B-A3B', 'deepseek-v4-pro', 'deepseek/deepseek-chat-v3-0324',
  'qwen3.7-max', 'qwen3.6-plus', 'zai-org/GLM-5.1-FP8', 'zai-org/GLM-5-FP8',
]);
const OG_ROUTER_BASE = 'https://router-api.0g.ai/v1/chat/completions';

// ── ZYVA format rescue: convert bare code blocks → [ZYVA_FILE] tags ──────────
function rescueFormat(text: string, fallbackPath: string): string {
  if (text.includes('[ZYVA_FILE:')) return text;
  const blockRe = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let result = '';
  let last = 0;
  while ((match = blockRe.exec(text)) !== null) {
    const prefixWindow = text.substring(Math.max(0, match.index - 150), match.index);
    const pathMatch = prefixWindow.match(/\b(?:src\/[a-zA-Z0-9_\-\/.]+|[a-zA-Z0-9_\-\/.]+\.(?:tsx|ts|js|jsx|css|html|rs|py|toml|json|md))\b/);
    const filePath = (pathMatch?.[0] ?? fallbackPath).replace(/[`'"]/g, '').trim();
    const lang = match[1] || 'tsx';
    result += text.substring(last, match.index);
    result += `[ZYVA_FILE: ${filePath}]\n\`\`\`${lang}\n${match[2]}\`\`\`\n[/ZYVA_FILE]`;
    last = blockRe.lastIndex;
  }
  result += text.substring(last);
  return result !== text ? result : text;
}

function buildSystemPrompt(opts: {
  model: string;
  projectName?: string;
  projectPath?: string;
  activeFile?: string;
  activeFileContent?: string;
  fileTreeStr?: string;
}): string {
  return `You are ZYVA Agent — an autonomous AI coding assistant inside the ZYVA IDE (model: ${opts.model}).

You work like Cursor or GitHub Copilot Workspace. Relevant code is retrieved semantically and injected below when available.

=== OUTPUT RULES (MANDATORY) ===
1. Code must be COMPLETE and runnable — no truncation, no placeholders.
2. Do NOT use plain markdown code blocks for code you want applied. Wrap code in ZYVA tags.

PRIMARY METHOD — full file write/rewrite (ALWAYS prefer this):
[ZYVA_FILE: src/App.tsx]
\`\`\`tsx
// the ENTIRE file, complete from imports to export default
\`\`\`
[/ZYVA_FILE]

RARE METHOD — scoped patch (only for a tiny surgical change):
[ZYVA_EDIT: src/App.tsx]
<<<<<<< SEARCH
// exact original lines, copied character-for-character from "Active file content" below
=======
// replacement lines
>>>>>>> REPLACE
[/ZYVA_EDIT]

New project (only if none is open):
[ZYVA_PROJECT: project-name, react]

CRITICAL RULES:
- The main workspace entry file is src/App.tsx. When the user asks to build, create, redesign, or replace a page/UI, ALWAYS rewrite the whole file with [ZYVA_FILE]. Never patch it.
- Only use [ZYVA_EDIT] for a small, localized change AND only when the SEARCH block is copied verbatim (including exact whitespace/indentation) from the "Active file content" shown below. If you are not 100% certain it matches byte-for-byte, use a full [ZYVA_FILE] rewrite instead — a failed patch produces NO result for the user.
- A landing page, hero, dashboard, or any new screen is a full-file rewrite of src/App.tsx, not an edit.
- SELF-CONTAINED: keep the whole UI inside src/App.tsx. Do NOT import CSS files (e.g. './styles.css'), images, or local component modules unless you ALSO output each of them as its own [ZYVA_FILE] block in the same response. Importing a file that does not exist breaks the preview (blank screen). Prefer inline styles or a single <style> tag inside the component.
================================

## WORKSPACE
Project: ${opts.projectName || 'none'}
Path: ${opts.projectPath || 'N/A'}
Active file: ${opts.activeFile || 'none'}

File tree:
${opts.fileTreeStr || '(no project)'}

Active file content:
${opts.activeFileContent ? '```\n' + opts.activeFileContent.substring(0, 2500) + '\n```' : '(none)'}

Always answer in the same language as the user.`;
}

export async function POST(req: NextRequest) {
  const cfg = getConfig();
  const { userId } = await requireAuth();
  // Estimate + meter ZYVA credit usage (managed model only). Non-fatal.
  const meter = (systemLen: number, userLen: number, replyLen: number) => {
    if (!userId) return;
    const tokens = Math.round((systemLen + userLen + replyLen) / 4);
    chargeTokens(userId, tokens).catch(() => {});
  };
  try {
    const body = await req.json();
    const {
      message, ogApiKey, apiKey, model, activeFile, activeFileContent,
      projectName, projectPath, fileTreeStr, history = [], agentMode, stream,
    } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: 'No message specified' }, { status: 400 });
    }

    const targetModel = model || 'glm-5.1';
    const fallbackPath = projectPath ? 'src/App.tsx' : 'App.tsx';
    const teeRuntime = getTeeRuntimeState();
    const systemPrompt = buildSystemPrompt({ model: targetModel, projectName, projectPath, activeFile, activeFileContent, fileTreeStr });

    const normalizedHistory = (history as { sender?: string; role?: string; text?: string; content?: string }[])
      .slice(-6)
      .map((h) => ({
        role: (h.role === 'agent' || h.sender === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: (h.content || h.text || '').substring(0, 500),
      }))
      .filter((m) => m.content);

    // ── Multi-agent graph mode (Architect -> specialists -> Review) ───────────
    if (agentMode && CEREBRAS_GLM_MODELS[targetModel] && cfg.cerebrasApiKey) {
      try {
        const out = await runGraph({
          task: message,
          model: CEREBRAS_GLM_MODELS[targetModel],
          projectPath: projectPath || undefined,
          workspaceContext: `Project: ${projectName || 'none'}\nActive file: ${activeFile || 'none'}\nFile tree:\n${fileTreeStr || '(no project)'}`,
          history: normalizedHistory,
        });
        const planNote = out.plan.length
          ? `\n\n> 🧭 Plan (${out.agentsRun.join(' → ')}): ` + out.plan.map((p) => p.title).join('; ')
          : '';
        return NextResponse.json({
          success: true,
          reply: rescueFormat(out.reply, fallbackPath) + planNote,
          source: `Multi-Agent Graph (${targetModel})`,
          teeRuntime, traceId: out.traceId, plan: out.plan, agentsRun: out.agentsRun, review: out.review,
        });
      } catch (err) {
        console.warn('Graph mode failed, falling back:', (err as Error).message);
      }
    }

    // Shared retrieval context builder for direct (non-orchestrated) calls.
    const buildContext = async (): Promise<string> => {
      if (!projectPath) return '';
      const hits = await retrieve(projectPath, message).catch(() => []);
      return hits.length
        ? '\n\n## RELEVANT CODE\n' + hits.map((r) => `### ${r.path}\n\`\`\`\n${r.content.slice(0, 1000)}\n\`\`\``).join('\n')
        : '';
    };

    // ── Streaming path (ZYVA / 0G PC) — token-by-token SSE, no timeout wall ───
    const canZyva = ZYVA_MODEL_IDS.has(targetModel) && !!cfg.zyva.apiKey;
    const canOgPc = isOgPcModel(targetModel) && !!cfg.ogpc.apiKey;
    if (stream && (canZyva || canOgPc)) {
      const provider = canZyva
        ? new ZyvaProvider(cfg.zyva.apiKey)
        : new OGPrivateComputerProvider(cfg.ogpc.apiKey, cfg.ogpc.baseUrl);
      const sourceLabel = canZyva ? 'ZYVA' : `0G Private Computer (${targetModel})`;
      const ctx = await buildContext();
      const msgs = [
        { role: 'system' as const, content: systemPrompt + ctx },
        ...normalizedHistory,
        { role: 'user' as const, content: message },
      ];
      const encoder = new TextEncoder();
      const trace = new Trace(message);
      trace.set({ model: canZyva ? 'zyva-v1' : targetModel, source: canZyva ? 'zyva-stream' : '0gpc-stream' });

      const readable = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          try {
            const out = await provider.generate({
              model: canZyva ? ZYVA_MODEL_ID : targetModel,
              messages: msgs,
              temperature: 0.3,
              signal: AbortSignal.timeout(180_000),
              onToken: (t) => send({ type: 'token', text: t }),
            });
            if (canZyva) meter(systemPrompt.length + ctx.length, message.length, out.text.length);
            send({
              type: 'done',
              reply: rescueFormat(out.text, fallbackPath),
              source: sourceLabel,
              teeRuntime,
              traceId: trace.record.id,
              rateLimit: canZyva ? (provider as ZyvaProvider).lastRateLimit : undefined,
              teeAttestation: out.teeAttestation,
            });
          } catch (err) {
            send({ type: 'error', error: (err as Error).message || 'inference failed' });
          } finally {
            await trace.flush();
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ── 0. ZYVA (DO Inference Router) — INTERNAL ONLY (stress testing) ─────────
    if (ZYVA_MODEL_IDS.has(targetModel) && cfg.zyva.apiKey) {
      const trace = new Trace(message);
      trace.set({ model: 'zyva-v1', source: 'zyva-do-router' });
      const ctx = await buildContext();
      const provider = new ZyvaProvider(cfg.zyva.apiKey);
      const msgs = [{ role: 'system' as const, content: systemPrompt + ctx }, ...normalizedHistory, { role: 'user' as const, content: message }];
      // The DO router occasionally times out under load — retry once.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const out = await provider.generate({ model: ZYVA_MODEL_ID, messages: msgs, temperature: 0.3, signal: AbortSignal.timeout(115000) });
          if (out.text) {
            await trace.flush();
            meter(systemPrompt.length + ctx.length, message.length, out.text.length);
            return NextResponse.json({
              success: true, reply: rescueFormat(out.text, fallbackPath),
              source: 'ZYVA', teeRuntime, traceId: trace.record.id,
              rateLimit: provider.lastRateLimit,
            });
          }
        } catch (err) {
          console.warn(`ZYVA path attempt ${attempt} failed:`, (err as Error).message);
          if (attempt === 2) {
            await trace.flush();
            return NextResponse.json({
              success: true,
              reply: `⚠️ ZYVA inference timed out (the model took too long to respond). Please send your message again.`,
              source: 'ZYVA (timeout)', teeRuntime,
            });
          }
        }
      }
      await trace.flush();
    }

    // ── 1. 0G Private Computer — primary ZYVA inference (TEE-attested) ─────────
    if (isOgPcModel(targetModel) && cfg.ogpc.apiKey) {
      const trace = new Trace(message);
      trace.set({ model: targetModel, source: '0g-private-computer' });
      try {
        const ctx = await buildContext();
        const provider = new OGPrivateComputerProvider(cfg.ogpc.apiKey, cfg.ogpc.baseUrl);
        const out = await provider.generate({
          model: targetModel,
          messages: [{ role: 'system', content: systemPrompt + ctx }, ...normalizedHistory, { role: 'user', content: message }],
          temperature: 0.3,
        });
        await trace.flush();
        if (out.text) {
          return NextResponse.json({
            success: true, reply: rescueFormat(out.text, fallbackPath),
            source: `0G Private Computer (${targetModel})`, teeRuntime, traceId: trace.record.id,
            teeAttestation: out.teeAttestation,
          });
        }
      } catch (err) {
        await trace.flush();
        console.warn('0G PC path failed:', (err as Error).message);
      }
    }

    // ── 2. 0G Router (BYO key) — real decentralized inference ─────────────────
    if (ogApiKey && OG_ROUTER_MODELS.has(targetModel)) {
      const trace = new Trace(message);
      trace.set({ model: targetModel, source: '0g-router' });
      let retrieval: Awaited<ReturnType<typeof retrieve>> = [];
      if (projectPath) retrieval = await retrieve(projectPath, message).catch(() => []);
      const ctx = retrieval.length
        ? '\n\n## RELEVANT CODE\n' + retrieval.map((r) => `### ${r.path}\n\`\`\`\n${r.content.slice(0, 1000)}\n\`\`\``).join('\n')
        : '';
      try {
        const ogRes = await fetch(OG_ROUTER_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ogApiKey}` },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'system', content: systemPrompt + ctx }, ...normalizedHistory, { role: 'user', content: message }],
            temperature: 0.3, max_tokens: 16384,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (ogRes.ok) {
          const reply = (await ogRes.json()).choices?.[0]?.message?.content || '';
          await trace.flush();
          if (reply) {
            return NextResponse.json({
              success: true, reply: rescueFormat(reply, fallbackPath),
              source: `0G Router (${targetModel})`, teeRuntime, traceId: trace.record.id,
              retrieval: retrieval.map((r) => ({ path: r.path, score: r.score })),
            });
          }
        }
      } catch { /* fall through */ }
      await trace.flush();
    }

    if (OG_ROUTER_MODELS.has(targetModel) && !ogApiKey) {
      return NextResponse.json({
        success: true,
        reply: `⚠️ Model **${targetModel}** needs a **0G Router API key** from [router.0g.ai](https://router.0g.ai). Add it in Settings → 0G Router Key.\n\nFree alternative: pick **GLM-5.1** (no key required).`,
        source: '0G Router (no key)', teeRuntime,
      });
    }

    // ── 3. Cerebras GLM via bounded orchestrator (retrieval + trace + retry) ──
    const cerebrasModel = CEREBRAS_GLM_MODELS[targetModel];
    if (cerebrasModel && cfg.cerebrasApiKey) {
      try {
        const out = await runAgent({
          message,
          model: cerebrasModel,
          systemPrompt,
          history: normalizedHistory,
          projectPath: projectPath || undefined,
          reasoningProvider: new CerebrasProvider(cfg.cerebrasApiKey),
        });
        if (out.text) {
          return NextResponse.json({
            success: true,
            reply: rescueFormat(out.text, fallbackPath),
            source: `Cerebras (${targetModel})`,
            teeRuntime,
            traceId: out.traceId,
            retrieval: out.retrieval.map((r) => ({ path: r.path, score: r.score, reranked: r.reranked })),
          });
        }
      } catch (err) {
        console.warn('Cerebras path failed:', (err as Error).message);
      }
    }

    // ── 4. No 0G PC key → DO NOT fall back to mock. Force a real key. ─────────
    return NextResponse.json({
      success: true,
      reply: `🔒 **0G Private Computer key required**\n\nZYVA runs all inference on the **0G Private Computer** (TEE-attested, decentralized). No demo or mock responses — every result is real.\n\nTo start coding with **${targetModel}**, add your key:\n\n1. Get a key at **[pc.0g.ai](https://pc.0g.ai)**\n2. Open **Settings → 0G Private Computer Key**\n3. Paste your key and retry\n\n> ZYVA never fakes output. Real models only.`,
      source: '0G Private Computer (no key)',
      teeRuntime,
    });
  } catch (err) {
    console.error('ZYVA chat route error:', err);
    return NextResponse.json({ success: false, error: (err as Error).message || 'Internal server error' }, { status: 500 });
  }
}
