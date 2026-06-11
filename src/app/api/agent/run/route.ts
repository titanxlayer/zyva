import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/engine/config';
import { CerebrasProvider } from '@/engine/providers/cerebras';
import { runGraph } from '@/engine/orchestrator/graph';
import { getTeeRuntimeState } from '@/engine/tee/attestation';

/**
 * Multi-agent graph endpoint.
 * POST { message, model?, projectName?, projectPath?, activeFile?, fileTreeStr?, history? }
 * Runs Architect -> specialists -> Review and returns aggregated ZYVA output
 * plus the plan, per-agent steps, and trace id.
 */
const GLM_MAP: Record<string, string> = {
  'glm-5.1': 'zai-glm-4.7', 'glm-5': 'zai-glm-4.7', 'glm-4.7': 'zai-glm-4.7', 'zai-glm-4.7': 'zai-glm-4.7',
};

export async function POST(req: NextRequest) {
  const cfg = getConfig();
  try {
    const body = await req.json();
    const { message, model, projectName, projectPath, activeFile, fileTreeStr, history = [] } = body;
    if (!message) return NextResponse.json({ success: false, error: 'No message specified' }, { status: 400 });

    const glm = GLM_MAP[model || 'glm-5.1'] || 'zai-glm-4.7';
    const workspaceContext = `Project: ${projectName || 'none'}\nPath: ${projectPath || 'N/A'}\nActive file: ${activeFile || 'none'}\nFile tree:\n${fileTreeStr || '(no project)'}`;

    const normalizedHistory = (history as { sender?: string; role?: string; text?: string; content?: string }[])
      .slice(-4)
      .map((h) => ({
        role: (h.role === 'agent' || h.sender === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: (h.content || h.text || '').substring(0, 400),
      }))
      .filter((m) => m.content);

    const out = await runGraph({
      task: message,
      model: glm,
      projectPath: projectPath || undefined,
      workspaceContext,
      history: normalizedHistory,
      provider: new CerebrasProvider(cfg.cerebrasApiKey),
    });

    return NextResponse.json({
      success: true,
      reply: out.reply,
      source: `Multi-Agent Graph (${model || 'glm-5.1'})`,
      plan: out.plan,
      agentsRun: out.agentsRun,
      review: out.review,
      traceId: out.traceId,
      teeRuntime: getTeeRuntimeState(),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
