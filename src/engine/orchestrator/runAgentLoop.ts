/**
 * ZYVA Iterative Agent Loop — ReAct-style: Reason → Act → Observe, repeat.
 *
 * The model reasons, emits a JSON tool call, we execute it and feed the result
 * back as a new user message, then call the model again — until it emits
 * {"done":true,...} or we hit the step limit.
 *
 * Hard bounds:
 *   MAX_STEPS   — maximum tool-call iterations (default 20)
 *   MAX_TOKENS  — per-call output cap
 *   Timeout     — each provider.generate call has AbortSignal.timeout
 *
 * Streaming:
 *   Every step emits events via onEvent for live UI updates.
 */

import { getConfig } from '../config';
import { ZyvaProvider, ZYVA_MODEL_ID } from '../providers/zyva';
import { OGPrivateComputerProvider, isSupportedModel } from '../providers/ogpc';
import type { ReasoningProvider, ChatMessage } from '../providers/types';
import { Trace } from '../observability/trace';
import { retrieve } from '../retrieval';
import { buildRepoMap } from '../repomap/buildRepoMap';
import { buildToolSystemBlock } from '../tools/types';
import { executeTool, parseToolCalls, parseDoneSignal, parseZyvaBlocks } from '../tools/executor';
import type { ToolCall, ToolResult } from '../tools/types';

export const MAX_STEPS = 20;
const STEP_TIMEOUT = 120_000; // 120s per step

export type LoopEvent =
  | { type: 'step_start'; step: number; maxSteps: number }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; step: number; call: ToolCall }
  | { type: 'tool_result'; step: number; result: ToolResult }
  | { type: 'step_done'; step: number; summary?: string }
  | { type: 'done'; summary: string; steps: number; traceId: string }
  | { type: 'error'; error: string };

export interface LoopInput {
  task: string;
  model: string;
  projectPath: string;
  terminalLogs?: string[];
  history?: ChatMessage[];
  onEvent?: (ev: LoopEvent) => void;
  maxSteps?: number;
}

export interface LoopOutput {
  summary: string;
  steps: number;
  traceId: string;
  filesChanged: string[];
}

function getProvider(model: string, cfg: ReturnType<typeof getConfig>): { provider: ReasoningProvider; resolvedModel: string } {
  if (model === 'zyva' && cfg.zyva.apiKey) return { provider: new ZyvaProvider(cfg.zyva.apiKey), resolvedModel: ZYVA_MODEL_ID };
  if (cfg.ogpc.apiKey) {
    const m = isSupportedModel(model) ? model : cfg.ogpc.model;
    return { provider: new OGPrivateComputerProvider(cfg.ogpc.apiKey, cfg.ogpc.baseUrl), resolvedModel: m };
  }
  throw new Error('No inference provider configured. Set OG_PC_API_KEY or ZYVA_DO_API_KEY in .env.local');
}

function buildSystemPrompt(projectPath: string, repoMap: string, retrieval: string): string {
  return [
    'You are ZYVA Agent — an autonomous coding assistant with tool access.',
    'You can read files, write files, run commands, search code, and query the project database.',
    'Think step by step. Use tools to gather context before writing code.',
    'Always verify your changes work (run tsc, npm run build, or tests after significant edits).',
    '',
    repoMap,
    '',
    retrieval,
    '',
    buildToolSystemBlock(),
    '',
    `Project root: ${projectPath}`,
  ].filter(Boolean).join('\n');
}

export async function runAgentLoop(input: LoopInput): Promise<LoopOutput> {
  const cfg   = getConfig();
  const trace = new Trace(input.task);
  const emit  = (ev: LoopEvent) => { try { input.onEvent?.(ev); } catch { /* ignore */ } };
  const maxSteps = input.maxSteps ?? MAX_STEPS;
  const filesChanged: string[] = [];

  // ── Context ──────────────────────────────────────────────────────────────────
  const repoMap = buildRepoMap(input.projectPath);
  let retrievalCtx = '';
  try {
    const hits = await retrieve(input.projectPath, input.task, { topK: 20, finalN: 6 });
    if (hits.length > 0) {
      retrievalCtx = '## SEMANTIC RETRIEVAL\n' + hits
        .map((h) => `### ${h.path}:${h.startLine}-${h.endLine}\n\`\`\`\n${h.content.slice(0, 800)}\n\`\`\``)
        .join('\n');
    }
  } catch { /* retrieval optional */ }

  const { provider, resolvedModel } = getProvider(input.model, cfg);
  trace.set({ model: resolvedModel, source: `loop:${provider.id}` });

  const systemPrompt = buildSystemPrompt(input.projectPath, repoMap, retrievalCtx);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(input.history ?? []).slice(-4),
    { role: 'user', content: input.task },
  ];

  let step = 0;
  let summary = '';

  // ── Main loop ─────────────────────────────────────────────────────────────────
  while (step < maxSteps) {
    emit({ type: 'step_start', step: step + 1, maxSteps });
    const span = trace.span(`loop:step:${step}`);

    let fullText = '';
    try {
      const res = await provider.generate({
        model: resolvedModel,
        messages,
        temperature: 0.2,
        maxTokens: 8192,
        signal: AbortSignal.timeout(STEP_TIMEOUT),
        onToken: (t) => {
          fullText += t;
          emit({ type: 'thinking', text: t });
        },
      });
      fullText = res.text; // use complete text (onToken may have accumulated it already)
    } catch (e) {
      span.end({ error: (e as Error).message });
      emit({ type: 'error', error: (e as Error).message });
      throw e;
    }
    span.end({ chars: fullText.length });

    // Check done signal first
    const { done, summary: doneSummary } = parseDoneSignal(fullText);
    if (done) {
      summary = doneSummary;
      emit({ type: 'step_done', step: step + 1, summary });
      break;
    }

    // Check for tool calls
    const { calls, rest } = parseToolCalls(fullText);

    // Fallback: model emitted [ZYVA_FILE]/[ZYVA_EDIT] instead of JSON tool calls
    const zyvaCalls = calls.length === 0 ? parseZyvaBlocks(fullText) : [];
    const allCalls = calls.length > 0 ? calls : zyvaCalls;

    if (allCalls.length === 0) {
      // Model responded with plain text + no tool call + no done signal
      // Accept it as the final answer / summary
      summary = rest.slice(0, 500);
      emit({ type: 'step_done', step: step + 1, summary });
      break;
    }

    // Add the model's response to the conversation
    messages.push({ role: 'assistant', content: fullText });

    // Execute each tool call and accumulate results
    const results: ToolResult[] = [];
    for (const call of allCalls) {
      emit({ type: 'tool_call', step: step + 1, call });
      const result = await executeTool(call, input.projectPath, {
        terminalLogs: input.terminalLogs,
      });
      emit({ type: 'tool_result', step: step + 1, result });
      results.push(result);
      // Track files changed via write_file / apply_edit
      if ((call.name === 'write_file' || call.name === 'apply_edit') && !result.error) {
        const p = String(call.args.path ?? '');
        if (p && !filesChanged.includes(p)) filesChanged.push(p);
      }
    }

    // If the model used ZYVA blocks (not tools), nudge it to confirm completion.
    if (zyvaCalls.length > 0) {
      const wrote = zyvaCalls.map((c) => String(c.args.path)).join(', ');
      messages.push({ role: 'user', content: `Applied changes to: ${wrote}. If the task is complete, emit {"done":true,"summary":"..."}; otherwise continue with tool calls.` });
      step++;
      continue;
    }

    // Inject tool results as a new user message
    const toolResultBlock = results
      .map((r) => r.error
        ? `[tool_result id="${r.id}" name="${r.name}" error="${r.error}"]\n`
        : `[tool_result id="${r.id}" name="${r.name}"]\n${r.output}\n[/tool_result]`)
      .join('\n\n');
    messages.push({ role: 'user', content: toolResultBlock });

    step++;
  }

  if (step >= maxSteps && !summary) {
    summary = `Reached max steps (${maxSteps}). Task may be partially complete.`;
  }

  await trace.flush();
  emit({ type: 'done', summary, steps: step + 1, traceId: trace.record.id });

  return { summary, steps: step + 1, traceId: trace.record.id, filesChanged };
}
