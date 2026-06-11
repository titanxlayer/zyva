'use client';

import React, { useRef, useEffect } from 'react';
import { useIdeStore } from '@/store/useIdeStore';
import { ShieldCheck } from 'lucide-react';

export default function TerminalConsole() {
  const terminalLogs = useIdeStore((state) => state.terminalLogs);
  const terminalInput = useIdeStore((state) => state.terminalInput);
  const setTerminalInput = useIdeStore((state) => state.setTerminalInput);
  const executeTerminalCommand = useIdeStore((state) => state.executeTerminalCommand);
  const activeConsoleTab = useIdeStore((state) => state.activeConsoleTab);
  const setActiveConsoleTab = useIdeStore((state) => state.setActiveConsoleTab);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, activeConsoleTab]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeTerminalCommand(terminalInput);
      setTerminalInput('');
    }
  };

  return (
    <div className="h-[260px] border-t border-[#2b2d31] bg-[#181818] flex flex-col shrink-0">
      {/* Header / Tab Terminal */}
      <div className="px-4 h-[35px] flex items-center justify-between border-b border-[#2b2d31] bg-[#151515] shrink-0 select-none">
        <div className="flex items-center space-x-6 h-full">
          {['terminal', 'problems', 'output', 'debug console'].map((tab) => (
            <button 
              key={tab}
              data-testid={`terminal-tab-${tab}`}
              onClick={() => setActiveConsoleTab(tab)}
              className={`text-[11px] uppercase tracking-wider font-semibold h-full flex items-center border-b-2 transition-all cursor-pointer ${
                activeConsoleTab === tab 
                  ? 'text-[#007acc] border-[#007acc]' 
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              {tab}
              {tab === 'terminal' && (
                <span className="ml-2 bg-[#2d2d2d] text-zinc-300 text-[10px] px-1.5 py-0.5 rounded font-mono lowercase">bash</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>TEE Hardware Isolated</span>
        </div>
      </div>

      {/* Isi Log Terminal / Console */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-[12px] bg-[#0c0c0c] text-[#cccccc]">
        {activeConsoleTab === 'terminal' ? (
          <div className="space-y-1">
            {terminalLogs.map((log, i) => (
              <div 
                key={i} 
                className={`leading-relaxed whitespace-pre-wrap ${
                  log.startsWith('✓') ? 'text-[#61c554]' : ''
                } ${
                  log.startsWith('$') ? 'text-white font-bold' : ''
                } ${
                  log.startsWith('Error') || log.startsWith('x') ? 'text-red-500' : ''
                }`}
              >
                {log}
              </div>
            ))}
            <div ref={terminalEndRef} />
            
            {/* Lingkungan TEE Enclave Tag */}
            <div className="flex items-center text-[#61c554] pt-2 pb-1 select-none">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              <span>TEE Secure Sandbox Enclave (Intel SGX) Active</span>
            </div>

            {/* Baris Input Terminal */}
            <div className="flex mt-1">
              <span className="text-[#569cd6] mr-2 font-bold select-none">$</span>
              <input 
                data-testid="terminal-input"
                type="text" 
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-[#cccccc] font-mono text-[12px]"
                spellCheck="false"
                placeholder="Type instruction here... (e.g. 'npm run dev', 'zyva test', 'zyva analyze')"
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600 select-none">
            No output in {activeConsoleTab} tab.
          </div>
        )}
      </div>
    </div>
  );
}
