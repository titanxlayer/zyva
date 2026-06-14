'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useIdeStore } from '@/store/useIdeStore';

interface CreditState {
  plan: string;
  planName: string;
  credits: number;
  creditsUsed: number;
  remaining: number;
}

/**
 * Header credit balance. Shows remaining ZYVA credits and opens the Profile
 * panel (Plan & Usage) on click. Re-fetches when the tab regains focus so the
 * balance updates after returning from a Dodo/Helio checkout tab.
 */
export default function CreditsBadge() {
  const store = useIdeStore();
  const [data, setData] = useState<CreditState | null>(null);

  const load = useCallback(() => {
    fetch('/api/billing/me')
      .then((r) => r.json())
      .then((d) => { if (d?.success) setData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!data) return null;

  const isPaid = data.plan !== 'free';
  const remaining = Math.max(0, data.remaining ?? 0);
  const low = isPaid && data.credits > 0 && remaining / data.credits < 0.15;

  const open = () => { store.setActiveSidebarTab('profile'); store.setIsExplorerOpen(true); };

  return (
    <button
      data-testid="credits-badge"
      onClick={open}
      title={isPaid ? `${remaining.toFixed(1)} of ${data.credits} ZYVA credits left` : 'Free plan — click to upgrade'}
      className={`flex items-center space-x-1.5 border px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
        low
          ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-500/60'
          : 'bg-[#1e1e1e] border-[#2b2d31] hover:border-[#7c3aed]/60'
      }`}
    >
      <Zap className={`w-3 h-3 ${low ? 'text-amber-400' : 'text-[#a78bfa]'}`} />
      <span className="text-[11px] text-[#cccccc] font-mono">
        {isPaid ? `${remaining.toFixed(remaining < 10 ? 1 : 0)} cr` : 'Upgrade'}
      </span>
    </button>
  );
}
