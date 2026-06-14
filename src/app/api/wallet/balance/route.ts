import { NextRequest, NextResponse } from 'next/server';

/**
 * On-chain native balance for a 0G address.
 *
 * Queried server-side (no browser CORS) against the 0G public RPC via a plain
 * JSON-RPC eth_getBalance call. Returns the balance in whole tokens (18 dec).
 */

export const dynamic = 'force-dynamic';

const RPC_URL = process.env.OG_RPC_URL || 'https://0g-rpc.publicnode.com';

function isAddress(a: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

// Convert a wei hex string → human token amount (18 decimals) without float loss.
function weiHexToTokens(hex: string): number {
  try {
    const wei = BigInt(hex);
    const ONE = BigInt('1000000000000000000'); // 1e18
    const whole = wei / ONE;
    const frac = wei % ONE;
    // keep 4 decimal places
    const frac4 = Number((frac * BigInt(10000)) / ONE) / 10000;
    return Number(whole) + frac4;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get('address') || '').trim();
  if (!isAddress(address)) {
    return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
  }
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => null);
    const hex = data?.result;
    if (typeof hex !== 'string') {
      return NextResponse.json({ success: false, error: 'RPC error', balance: 0 }, { status: 200 });
    }
    return NextResponse.json({ success: true, address, balance: weiHexToTokens(hex), raw: hex });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message, balance: 0 }, { status: 200 });
  }
}
