import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getConfig } from '../config';

/**
 * Observability. Every agent run is traced: reasoning, tool calls, retries,
 * token usage, retrieval hits. Stored locally (always on) and optionally
 * forwarded to Langfuse when configured.
 */

export interface TraceSpan {
  name: string;
  startedAt: number;
  endedAt?: number;
  data?: Record<string, unknown>;
}

export interface TraceRecord {
  id: string;
  createdAt: number;
  input: string;
  model?: string;
  source?: string;
  spans: TraceSpan[];
  tokens?: { prompt?: number; completion?: number };
  error?: string;
}

const TRACE_DIR = path.join(os.homedir(), '.zyva-data', 'traces');

export class Trace {
  readonly record: TraceRecord;
  constructor(input: string) {
    this.record = { id: crypto.randomUUID(), createdAt: Date.now(), input, spans: [] };
  }

  span(name: string, data?: Record<string, unknown>) {
    const span: TraceSpan = { name, startedAt: Date.now(), data };
    this.record.spans.push(span);
    return {
      end: (extra?: Record<string, unknown>) => {
        span.endedAt = Date.now();
        if (extra) span.data = { ...span.data, ...extra };
      },
    };
  }

  set(patch: Partial<TraceRecord>) {
    Object.assign(this.record, patch);
  }

  async flush() {
    try {
      fs.mkdirSync(TRACE_DIR, { recursive: true });
      const file = path.join(TRACE_DIR, `${this.record.id}.json`);
      fs.writeFileSync(file, JSON.stringify(this.record, null, 2), 'utf-8');
    } catch {
      /* tracing must never break the request */
    }
    await this.forwardToLangfuse().catch(() => {});
  }

  private async forwardToLangfuse() {
    const { langfuse } = getConfig();
    if (!langfuse.publicKey || !langfuse.secretKey || !langfuse.baseUrl) return;
    const auth = Buffer.from(`${langfuse.publicKey}:${langfuse.secretKey}`).toString('base64');
    await fetch(`${langfuse.baseUrl.replace(/\/$/, '')}/api/public/ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        batch: [{
          id: this.record.id,
          type: 'trace-create',
          timestamp: new Date(this.record.createdAt).toISOString(),
          body: {
            id: this.record.id,
            name: 'zyva-agent-run',
            input: this.record.input,
            metadata: { model: this.record.model, source: this.record.source, spans: this.record.spans },
          },
        }],
      }),
      signal: AbortSignal.timeout(5000),
    });
  }
}

export function listTraces(limit = 50): TraceRecord[] {
  try {
    if (!fs.existsSync(TRACE_DIR)) return [];
    return fs.readdirSync(TRACE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(TRACE_DIR, f), 'utf-8')) as TraceRecord)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  } catch {
    return [];
  }
}
