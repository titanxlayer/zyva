import { NextRequest, NextResponse } from 'next/server';
import { listTraces } from '@/engine/observability/trace';

/** Observability: list recent agent execution traces. */
export async function GET(req: NextRequest) {
  const limit = parseInt(new URL(req.url).searchParams.get('limit') || '50', 10);
  return NextResponse.json({ success: true, traces: listTraces(limit) });
}
