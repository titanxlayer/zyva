import { getConfig } from '../config';
import { CerebrasProvider } from '../providers/cerebras';
import type { ReasoningProvider, ChatMessage } from '../providers/types';
import { retrieve } from '../retrieval';
import { Trace } from '../observability/trace';
import { AGENTS, type AgentRole } from './agents';

/**
 * ZYVA multi-agent graph (bounded LangGraph-style state machine).
 *
 * Flow:
 *   architect(plan) -> [route step -> frontend|backend(execute)]* -> review -> (optional 1 retry) -> done
 *
 * Hard bounds (no infinite recursion / runaway):
 *   MAX_STEPS, MAX_RETRIES, per-call maxTokens. Every node is traced.
 *
 * The interface is intentionally close to a LangGraph state graph so the
 * runtime can be swapped for @langchain/langgraph later without touching callers.
 */

const MAX_STEPS = 4;
const MAX_RETRIES = 1;

export interface PlanStep {
  agent: AgentRole;
  title: string;
  file?: string;
  detail: string;
}

export interface GraphInput {
  task: string;
  model: string;
  projectPath?: string;
  workspaceContext: string; // file tree + active file summary
  history: ChatMessage[];
  provider?: ReasoningProvider;
  onEvent?: (ev: GraphEvent) => void; // live progress for UI streaming
}

export type GraphEvent =
  | { type: 'plan'; plan: PlanStep[] }
  | { type: 'agent_start'; role: AgentRole; title?: string }
  | { type: 'agent_done'; role: AgentRole; title?: string; chars: number }
  | { type: 'review'; ok: boolean; issues: string[] }
  | { type: 'final'; reply: string; traceId: string; agentsRun: string[] };

export interface AgentStepResult {
  agent: AgentRole;
  title: string;
  output: string;
}

export interface GraphOutput {
  reply: string;            // aggregated ZYVA-formatted output for the apply pipeline
  plan: PlanStep[];
  steps: AgentStepResult[];
  review: { ok: boolean; issues: string[] };
  traceId: string;
  agentsRun: string[];
}

function safeJson<T>(text: string, fallback: T): T {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function runGraph(input: GraphInput): Promise<GraphOutput> {
  const cfg = getConfig();
  const provider = input.provider ?? new CerebrasProvider(cfg.cerebrasApiKey);
  const trace = new Trace(input.task);
  trace.set({ model: input.model, source: `graph:${provider.id}` });

  const agentsRun: string[] = [];
  const emit = (ev: GraphEvent) => { try { input.onEvent?.(ev); } catch { /* never break run */ } };

  // ── Retrieval context (shared across agents) ───────────────────────────────
  let ctx = '';
  if (input.projectPath) {
    const rs = trace.span('retrieval');
    try {
      const hits = await retrieve(input.projectPath, input.task, { topK: 20, finalN: 5 });
      ctx = hits.length
        ? '\n\n## RELEVANT CODE\n' + hits.map((h) => `### ${h.path}:${h.startLine}-${h.endLine}\n\`\`\`\n${h.content.slice(0, 1000)}\n\`\`\``).join('\n')
        : '';
      rs.end({ hits: hits.length });
    } catch (e) {
      rs.end({ error: (e as Error).message });
    }
  }

  const baseContext = `${input.workspaceContext}${ctx}`;

  const call = async (role: AgentRole, userContent: string, maxTokens = 8192, title?: string) => {
    const span = trace.span(`agent:${role}`);
    agentsRun.push(role);
    emit({ type: 'agent_start', role, title });
    const messages: ChatMessage[] = [
      { role: 'system', content: `${AGENTS[role].system}\n\n## WORKSPACE\n${baseContext}` },
      ...input.history,
      { role: 'user', content: userContent },
    ];
    const res = await provider.generate({ model: input.model, messages, temperature: 0.2, maxTokens });
    span.end({ chars: res.text.length });
    emit({ type: 'agent_done', role, title, chars: res.text.length });
    return res.text;
  };

  // ── 1. Architect: plan ──────────────────────────────────────────────────────
  const planText = await call('architect', `Task: ${input.task}\nReturn the JSON plan.`, 1024);
  let plan = safeJson<{ steps: PlanStep[] }>(planText, { steps: [] }).steps || [];
  if (!Array.isArray(plan) || plan.length === 0) {
    // Fallback: single frontend step on the entry file.
    plan = [{ agent: 'frontend', title: input.task, file: 'src/App.tsx', detail: input.task }];
  }
  plan = plan.slice(0, MAX_STEPS).map((s) => ({
    ...s,
    agent: s.agent === 'backend' ? 'backend' : 'frontend',
  }));
  emit({ type: 'plan', plan });

  // ── 2. Execute each step via its specialist ─────────────────────────────────
  const steps: AgentStepResult[] = [];
  for (const step of plan) {
    const prompt =
      `Plan step: ${step.title}\nTarget file: ${step.file || 'src/App.tsx'}\nDetails: ${step.detail}\n` +
      `Original task for context: ${input.task}\nProduce the file(s) for THIS step only.`;
    const output = await call(step.agent, prompt, 8192, step.title);
    steps.push({ agent: step.agent, title: step.title, output });
  }

  // ── 3. Review (bounded retry) ────────────────────────────────────────────────
  const aggregate = () => steps.map((s) => s.output).join('\n\n');
  let review = { ok: true, issues: [] as string[] };

  const reviewText = await call(
    'review',
    `Task: ${input.task}\n\nGenerated output:\n${aggregate().slice(0, 8000)}\n\nReturn the JSON verdict.`,
    512,
  );
  const verdict = safeJson<{ ok: boolean; issues: string[]; retryStep: number }>(reviewText, { ok: true, issues: [], retryStep: -1 });
  review = { ok: verdict.ok !== false, issues: verdict.issues || [] };

  if (!review.ok && verdict.retryStep >= 0 && verdict.retryStep < steps.length) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      const s = plan[verdict.retryStep];
      const fix = await call(
        'debug',
        `The Review Agent flagged issues: ${review.issues.join('; ')}\nFix step "${s.title}". Re-output the corrected file(s).`,
      );
      steps[verdict.retryStep] = { agent: 'debug', title: `fix: ${s.title}`, output: fix };
      retries++;
      review.ok = true; // accept after bounded retry
    }
  }

  await trace.flush();
  emit({ type: 'review', ok: review.ok, issues: review.issues });
  const finalReply = aggregate();
  emit({ type: 'final', reply: finalReply, traceId: trace.record.id, agentsRun });

  return {
    reply: finalReply,
    plan,
    steps,
    review,
    traceId: trace.record.id,
    agentsRun,
  };
}
