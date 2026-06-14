import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side 0G storage node health check.
 *
 * The browser cannot ping the node directly (CORS blocks cross-origin pings to
 * https://mainnet.0g.ai), which made the status indicator show a false "Offline".
 * We probe the node from the server instead — no CORS — and return a real result.
 */

export const dynamic = 'force-dynamic';

const DEFAULT_NODE = 'https://0g-rpc.publicnode.com';

function isAllowedNode(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    // Allow 0G hosts + the official 0G public RPC (avoids SSRF to arbitrary hosts).
    return (
      u.hostname === 'localhost' ||
      u.hostname === '0g.ai' ||
      u.hostname.endsWith('.0g.ai') ||
      u.hostname.endsWith('.publicnode.com')
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const nodeUrl = (req.nextUrl.searchParams.get('url') || DEFAULT_NODE).replace(/\/+$/, '');
  if (!isAllowedNode(nodeUrl)) {
    return NextResponse.json({ online: false, error: 'Node URL not allowed' }, { status: 400 });
  }

  // Probe a couple of common health endpoints; the node is "online" if any responds.
  const targets = [`${nodeUrl}/`, `${nodeUrl}/health`, `${nodeUrl}/status`];
  for (const target of targets) {
    try {
      const res = await fetch(target, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (res.status < 500) {
        return NextResponse.json({ online: true, node: nodeUrl, status: res.status });
      }
    } catch {
      // try next target
    }
  }
  return NextResponse.json({ online: false, node: nodeUrl });
}
