import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

// Helper: find private key from common user file locations (cross-platform)
function findPrivateKey(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const pathsToCheck = [
    // Explicit override
    process.env.ZYVA_KEY_PATH || '',
    // Project-local key files (Linux/macOS dev)
    path.join(process.cwd(), '.zyva', '.og_key'),
    path.join(process.cwd(), 'zyva key.md'),
    // Windows locations
    'C:/Users/karim/OneDrive/Documents/private key test.txt',
    'C:/Users/karim/Documents/private key test.txt',
    // Home-based locations (works on Windows USERPROFILE and Linux/macOS HOME)
    path.join(home, 'OneDrive/Documents/private key test.txt'),
    path.join(home, 'Documents/private key test.txt'),
    path.join(home, 'OneDrive/Documents/privatekey.txt'),
    path.join(home, 'Documents/privatekey.txt'),
  ];

  for (const p of pathsToCheck) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) {
        // Support markdown/plain files: take the first 64-hex string found
        const raw = fs.readFileSync(p, 'utf-8');
        const hexMatch = raw.match(/(0x)?[0-9a-fA-F]{64}/);
        const key = (hexMatch?.[0] || raw).trim();
        if (key) return key;
      }
    } catch (_) {}
  }
  return '';
}

export async function GET() {
  try {
    const privateKey = findPrivateKey();

    if (!privateKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'File private key tidak ditemukan di folder Documents. Simpan private key kamu sebagai "private key test.txt".' 
      }, { status: 404 });
    }

    const rpcUrl = 'https://evmrpc.0g.ai';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    return NextResponse.json({
      success: true,
      address: wallet.address,
      balance: 0
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/wallet — DISABLED for security.
// Returning a private key to any local caller is a secret-leak vector. The 0G
// SDK auth must read the key server-side only (never over HTTP to the frontend).
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Disabled: private keys are never served over HTTP.' },
    { status: 410 },
  );
}
