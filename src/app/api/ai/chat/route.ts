import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/engine/config';
import { CerebrasProvider } from '@/engine/providers/cerebras';
import { runAgent } from '@/engine/orchestrator/runAgent';
import { runGraph } from '@/engine/orchestrator/graph';
import { retrieve } from '@/engine/retrieval';
import { getTeeRuntimeState } from '@/engine/tee/attestation';
import { Trace } from '@/engine/observability/trace';
import { generateMockResponse } from '../lib/mock';

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
2. Do NOT use plain markdown code blocks for code you want applied. Wrap code in ZYVA tags:

Create or rewrite a file (preferred):
[ZYVA_FILE: src/App.tsx]
\`\`\`tsx
// complete code from imports to export default
\`\`\`
[/ZYVA_FILE]

Edit part of a file (scoped patch, preferred for existing files):
[ZYVA_EDIT: src/App.tsx]
<<<<<<< SEARCH
// exact original lines
=======
// replacement lines
>>>>>>> REPLACE
[/ZYVA_EDIT]

New project (only if none is open):
[ZYVA_PROJECT: project-name, react]

The main workspace entry file is src/App.tsx. Prefer scoped [ZYVA_EDIT] over full rewrites for existing files.
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
  try {
    const body = await req.json();
    const {
      message, ogApiKey, apiKey, model, activeFile, activeFileContent,
      projectName, projectPath, fileTreeStr, history = [], agentMode,
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

    // ── 1. 0G Router (BYO key) — real decentralized inference ─────────────────
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

    // ── 2. Cerebras GLM via bounded orchestrator (retrieval + trace + retry) ──
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

    // ── 3. Demo fallback (no keys configured) ─────────────────────────────────
    return NextResponse.json({
      success: true,
      reply: generateMockResponse(message, projectPath),
      source: 'Demo Mode',
      teeRuntime,
    });
  } catch (err) {
    console.error('ZYVA chat route error:', err);
    return NextResponse.json({ success: false, error: (err as Error).message || 'Internal server error' }, { status: 500 });
  }
}
