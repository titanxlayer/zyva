/**
 * TEE runtime status.
 *
 * IMPORTANT: ZYVA does not yet have real remote attestation wired to 0G TEE.
 * Until a verifiable quote exists, we MUST NOT claim "Verified" or "Attestation
 * Complete". We only report honest runtime state. The fake Math.random()
 * signature has been removed.
 *
 * When real attestation is available, populate `quote`/`verified` from the 0G
 * TEE SDK and flip `status` to 'verified'.
 */

export type TeeStatus = 'connected' | 'sandbox-active' | 'unavailable' | 'verified';

export interface TeeRuntimeState {
  status: TeeStatus;
  label: string;
  isolated: boolean;
  verified: boolean;
  // Populated only when a genuine attestation quote is obtained.
  quote?: string;
  provider?: string;
}

export function getTeeRuntimeState(): TeeRuntimeState {
  // No real attestation source configured yet → report honest, non-verified state.
  return {
    status: 'sandbox-active',
    label: 'TEE Runtime Connected · Sandbox Active',
    isolated: true,
    verified: false,
  };
}
