import { verifyMessage } from 'viem';

/**
 * Verify an EIP-191 personal_sign signature (SIWE / Sign-In With Ethereum).
 * Works with MetaMask, WalletConnect, and any EVM-compatible wallet on 0G chain.
 */
export async function verifyWalletSignature({
  address,
  message,
  signature,
}: {
  address: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  try {
    const recovered = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return recovered;
  } catch {
    return false;
  }
}

/**
 * Build the SIWE message for the user to sign.
 * Includes nonce (timestamp) to prevent replay attacks.
 */
export function buildSignMessage({
  address,
  nonce,
  domain = 'app.zyva.dev',
}: {
  address: string;
  nonce: string;
  domain?: string;
}): string {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to ZYVA Cloud IDE',
    '',
    `URI: https://${domain}`,
    'Version: 1',
    `Chain ID: 16601`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
}
