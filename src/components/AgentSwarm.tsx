'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useIdeStore } from '@/store/useIdeStore';
import {
  BrainCircuit, Code2, Database, Zap, LayoutTemplate,
  MessageSquare, Send, Loader2, MoreHorizontal, Key, Eye, EyeOff, Wallet, AlertCircle, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownBlock, ActionCard, TeeBadge } from './ChatComponents';

// ─── Thinking Indicator ───────────────────────────────────────────────────────
function ThinkingIndicator({ model }: { model: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
      className="flex items-start space-x-2">
      <div className="w-6 h-6 rounded-md bg-[#4ec9b0]/10 flex items-center justify-center shrink-0 mt-0.5">
        <BrainCircuit className="w-3.5 h-3.5 text-[#4ec9b0]" />
      </div>
      <div className="bg-[#2a2d2e] rounded-lg rounded-bl-none px-3 py-2.5 border-l-2 border-[#4ec9b0]">
        <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
          <Loader2 className="w-3 h-3 animate-spin text-[#4ec9b0]" />
          <span>ZYVA Agent thinking</span>
          <span className="text-[9px] font-mono text-zinc-600">{model}</span>
        </div>
        <div className="flex space-x-1 mt-2">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0]/40"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Agent helpers ─────────────────────────────────────────────────────────────
const getAgentIcon = (id: string, color: string) => {
  switch (id) {
    case 'arch': return <BrainCircuit className="w-5 h-5" style={{ color }} />;
    case 'front': return <Code2 className="w-5 h-5" style={{ color }} />;
    case 'back': return <Database className="w-5 h-5" style={{ color }} />;
    case 'debug': return <Zap className="w-5 h-5" style={{ color }} />;
    default: return <BrainCircuit className="w-5 h-5" style={{ color }} />;
  }
};

const getAgentBg = (name: string) => {
  if (name?.includes('Architect') || name?.includes('ZYVA')) return 'rgba(78,201,176,0.1)';
  if (name?.includes('Frontend')) return 'rgba(86,156,214,0.1)';
  if (name?.includes('Backend')) return 'rgba(197,134,192,0.1)';
  return 'rgba(220,220,170,0.1)';
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AgentSwarm({ width = 360 }: { width?: number }) {
  const { data: session } = useSession();
  const swarmAgents          = useIdeStore(s => s.swarmAgents);
  const activityFeed         = useIdeStore(s => s.activityFeed);
  const chatMessages         = useIdeStore(s => s.chatMessages);
  const sendChatMessage      = useIdeStore(s => s.sendChatMessage);
  const isAgentThinking      = useIdeStore(s => s.isAgentThinking);
  const isWalletConnected    = useIdeStore(s => s.isWalletConnected);
  // Authenticated = logged in via Google/GitHub OAuth OR wallet — either unlocks chat
  const isAuthenticated      = !!session?.user || isWalletConnected;
  const walletBalance        = useIdeStore(s => s.walletBalance);
  const aiModelNetwork       = useIdeStore(s => s.aiModelNetwork);
  const aiModel              = useIdeStore(s => s.aiModel);
  const ogApiKey             = useIdeStore(s => s.ogApiKey);
  const updateSettings       = useIdeStore(s => s.updateSettings);
  const connectWallet        = useIdeStore(s => s.connectWallet);
  const connectWalletFallback = useIdeStore(s => s.connectWalletFallback);
  const applyAgentAction     = useIdeStore(s => s.applyAgentAction);
  const rejectAgentAction    = useIdeStore(s => s.rejectAgentAction);
  const multiAgentMode       = useIdeStore(s => s.multiAgentMode);
  const projectPath          = useIdeStore(s => s.projectPath);
  const setCreateProjectModalOpen = useIdeStore(s => s.setCreateProjectModalOpen);

  const [activeTab, setActiveTab] = useState<'swarm' | 'chat'>('chat');
  const [chatInput, setChatInput]   = useState('');
  const [keyInputVal, setKeyInputVal] = useState(ogApiKey || '');
  const [showKey, setShowKey]         = useState(false);
  const [keySaved, setKeySaved]       = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSaveKey = () => {
    updateSettings('ogApiKey', keyInputVal.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAgentThinking, activeTab]);

  // Wallet → always Mainnet
  useEffect(() => {
    if (isWalletConnected && aiModelNetwork !== 'mainnet') {
      updateSettings('aiModelNetwork', 'mainnet');
    }
  }, [isWalletConnected]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !isAgentThinking) {
      sendChatMessage(chatInput.trim());
      setChatInput('');
    }
  };

  // ... (ModelSelector inlined below)

  return (
    <div className="bg-[#181818] border-l border-[#2b2d31] flex flex-col shrink-0 h-full overflow-hidden" style={{ width: `${width}px`, minWidth: 240, maxWidth: 700 }}>
      {/* Tab Switcher */}
      <div className="flex border-b border-[#2b2d31] h-[35px] bg-[#151515] shrink-0 select-none">
        <button data-testid="right-panel-swarm-tab" onClick={() => setActiveTab('swarm')}
          className={`flex-1 flex items-center justify-center space-x-1.5 text-[10px] uppercase tracking-wider font-semibold border-b-2 transition-all cursor-pointer ${activeTab === 'swarm' ? 'text-[#007acc] border-[#007acc] bg-[#181818]/60' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span>Swarm</span>
        </button>
        <button data-testid="right-panel-chat-tab" onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center space-x-1.5 text-[10px] uppercase tracking-wider font-semibold border-b-2 transition-all cursor-pointer relative ${activeTab === 'chat' ? 'text-[#007acc] border-[#007acc] bg-[#181818]/60' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Chat</span>
          {isAgentThinking && <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0] animate-pulse" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* ── SWARM TAB ── */}
        {activeTab === 'swarm' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex flex-col flex-1 border-b border-[#2b2d31] min-h-0 overflow-hidden pb-2">
              <div className="px-4 py-2 flex items-center justify-between text-[10px] font-semibold text-[#cccccc] uppercase tracking-wider shrink-0">
                <span>Agent Nodes</span>
                <MoreHorizontal className="w-4 h-4 text-[#858585] cursor-pointer hover:text-white" />
              </div>
              <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-2">
                {swarmAgents.map(agent => (
                  <div key={agent.id}
                    className={`flex items-start p-2.5 rounded-lg border bg-[#1e1e1e] transition-all duration-300 ${agent.status === 'working' ? 'border-emerald-500/30 shadow-[0_0_12px_rgba(78,201,176,0.1)]' : agent.status === 'done' ? 'border-emerald-600/20' : 'border-[#2b2d31] hover:border-zinc-700'}`}>
                    <div className="mr-3 mt-0.5 shrink-0">{getAgentIcon(agent.id, agent.color)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] font-semibold text-[#cccccc]">{agent.name}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'working' ? 'animate-pulse' : ''}`} style={{ backgroundColor: agent.color }} />
                      </div>
                      <p className="text-[10px] text-[#858585] mt-0.5 truncate">{agent.role}</p>
                      {agent.status === 'working' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono mt-1 inline-block animate-pulse">● Enclave Active</span>
                      )}
                      {agent.status === 'done' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/10 text-emerald-500 font-mono mt-1 inline-block">✓ Completed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-[150px] overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between text-[10px] font-semibold text-[#cccccc] uppercase tracking-wider shrink-0 select-none">
                <span>Activity Feed</span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
                <AnimatePresence initial={false}>
                  {activityFeed.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="flex justify-between items-start">
                      <div className="flex min-w-0">
                        <div className="w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0" style={{ backgroundColor: getAgentBg(item.agent) }}>
                          <BrainCircuit className="w-3 h-3" style={{ color: item.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] text-[#cccccc] font-medium">{item.agent}</div>
                          <div className="text-[10px] text-[#858585] break-words">{item.message}</div>
                        </div>
                      </div>
                      <span className="text-[9px] text-[#858585] font-mono shrink-0 ml-2">{item.timestamp}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {!isAuthenticated ? (
              // ── Gate: not signed in ──
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#252526] border border-zinc-800 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-[#007acc]" />
                </div>
                <h3 className="text-[12px] font-bold text-white mb-2 uppercase tracking-wider">Sign in required</h3>
                <p className="text-[10px] text-zinc-400 max-w-[220px] leading-relaxed">
                  Sign in with Google or GitHub to use the AI chat. Wallet connection is optional and unlocks 0G on-chain features.
                </p>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
                  {!projectPath && (
                    <div className="bg-[#28251e] border border-amber-500/25 rounded-xl p-3.5 text-left text-[11px] space-y-2 mb-2 shrink-0">
                      <div className="flex items-center space-x-2 text-amber-400 font-bold">
                        <AlertCircle className="w-4 h-4" /><span>Workspace Inactive</span>
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[10.5px]">
                        No active project is open. ZYVA Agent cannot write files or run commands. Please set up a workspace first:
                      </p>
                      <div className="flex space-x-2 pt-1">
                        <button onClick={() => setCreateProjectModalOpen(true)}
                          className="flex-1 py-1.5 rounded-lg bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/30 hover:border-amber-600/50 text-amber-300 font-semibold transition-all text-[10px] cursor-pointer text-center">
                          Create Project
                        </button>
                        <button onClick={() => window.dispatchEvent(new CustomEvent('zyva:openFolderModal'))}
                          className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold border border-zinc-700/60 transition-all text-[10px] cursor-pointer text-center">
                          Open Folder
                        </button>
                      </div>
                    </div>
                  )}

                  {chatMessages.map(msg => (
                    <div key={msg.id} data-testid={msg.sender === 'agent' ? 'chat-message-assistant' : 'chat-message-user'}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.sender === 'agent' && (
                        <div className="flex items-center space-x-1.5 mb-1.5 select-none">
                          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: getAgentBg(msg.agentName || '') }}>
                            <BrainCircuit className="w-3 h-3 text-[#4ec9b0]" />
                          </div>
                          <span className="text-[10px] text-zinc-400 font-semibold">{msg.agentName || 'ZYVA Agent'}</span>
                        </div>
                      )}
                      <div className={`rounded-xl max-w-[98%] select-text ${msg.sender === 'user' ? 'bg-[#007acc] px-3 py-2 rounded-br-sm text-white text-[12px]' : 'bg-[#222426] border border-zinc-800/60 px-3 py-2.5 rounded-bl-sm w-full'}`}
                        style={{ borderLeftColor: msg.sender === 'agent' ? (msg.color || '#4ec9b0') : undefined, borderLeftWidth: msg.sender === 'agent' ? 2 : undefined }}>
                        {msg.sender === 'user'
                          ? <span className="leading-relaxed text-[12px]">{msg.text}</span>
                          : <MarkdownBlock text={msg.text} />}
                      </div>
                      {msg.sender === 'agent' && msg.actions && msg.actions.length > 0 && (
                        <div className="w-full space-y-1.5 mt-1">
                          {msg.actions.map(action => (
                            <ActionCard key={action.id} action={action} messageId={msg.id}
                              onApply={() => applyAgentAction(msg.id, action.id)}
                              onReject={() => rejectAgentAction(msg.id, action.id)} />
                          ))}
                        </div>
                      )}
                      {msg.sender === 'agent' && msg.teeAttestation && <TeeBadge tee={msg.teeAttestation} />}
                      <span className="text-[9px] text-zinc-600 mt-1 select-none">{msg.timestamp}</span>
                    </div>
                  ))}

                  <AnimatePresence>
                    {isAgentThinking && <ThinkingIndicator model={aiModel} />}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>

                {/* Chat tab bottom bar — model select + conditional API key */}
                <div className="shrink-0 px-3 pt-2 pb-1">
                  <div className="bg-[#1e1e1e] border border-[#2b2d31] rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-zinc-500 font-medium">Model:</span>
                        <select
                          data-testid="agent-model-select"
                          value={aiModel}
                          onChange={e => updateSettings('aiModel', e.target.value)}
                          className="bg-[#2a2d2e] border border-zinc-700/60 text-zinc-300 rounded text-[10px] px-1.5 py-0.5 outline-none cursor-pointer max-w-[200px]"
                        >
                          <optgroup label="ZYVA">
                            <option value="zyva">ZYVA</option>
                          </optgroup>
                          <optgroup label="0G Private Computer (pc.0g.ai)">
                            <option value="minimax-m3">MiniMax-M3 · 1M ctx</option>
                            <option value="glm-5.1">GLM-5.1 · 207K ctx</option>
                            <option value="qwen3.7-max">Qwen3.7-Max · 1M ctx</option>
                            <option value="qwen3.6-plus">Qwen3.6-Plus · 1M ctx</option>
                            <option value="deepseek-v4-pro">DeepSeek-V4-Pro · 1M ctx</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="flex items-center space-x-1 bg-[#007acc]/10 border border-[#007acc]/30 rounded-lg px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0] animate-pulse" />
                        <span className="text-[9px] font-bold text-[#4ec9b0]">Mainnet</span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800/60 pt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-zinc-500">0G Network:</span>
                          {isWalletConnected ? (
                            <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Wallet connected</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600 italic">Optional — for 0G commits</span>
                          )}
                        </div>
                        {!isWalletConnected && (
                          <button type="button" onClick={() => connectWallet()}
                            className="text-[#007acc] hover:text-sky-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors text-[10px]">
                            Connect
                          </button>
                        )}
                      </div>

                      {/* API Key — only show when a 0G PC model is selected, hidden for ZYVA */}
                      {aiModel !== 'zyva' && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <Key className="w-2.5 h-2.5 text-zinc-600" />
                            <span className="text-[9px] text-zinc-600">0G PC API Key (optional):</span>
                            {ogApiKey && <span className="text-[9px] text-emerald-500">✓ saved</span>}
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <div className="relative flex-1">
                              <input
                                type={showKey ? 'text' : 'password'}
                                value={keyInputVal}
                                onChange={e => setKeyInputVal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                                placeholder="0G API Key (optional)..."
                                className="w-full bg-[#141414] border border-zinc-700/40 rounded-lg text-zinc-400 text-[10px] px-2.5 py-1.5 outline-none focus:border-[#007acc]/50 font-mono pr-7 placeholder:text-zinc-600"
                              />
                              <button type="button" onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-zinc-500 cursor-pointer">
                                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                            <button type="button" onClick={handleSaveKey}
                              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-semibold transition-all cursor-pointer shrink-0 ${keySaved ? 'bg-emerald-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}>
                              {keySaved ? 'Saved' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 px-3 pb-3 pt-1">
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <button
                      type="button"
                      data-testid="multi-agent-toggle"
                      onClick={() => updateSettings('multiAgentMode', !multiAgentMode)}
                      className={`flex items-center space-x-1.5 text-[9px] font-semibold px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                        multiAgentMode
                          ? 'bg-[#4ec9b0]/15 border-[#4ec9b0]/40 text-[#4ec9b0]'
                          : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-500 hover:text-zinc-300'
                      }`}
                      title="Multi-agent graph: Architect → Frontend/Backend → Review"
                    >
                      <BrainCircuit className="w-3 h-3" />
                      <span>{multiAgentMode ? 'Multi-Agent: ON' : 'Multi-Agent: OFF'}</span>
                    </button>
                    {multiAgentMode && (
                      <span className="text-[9px] text-zinc-600">Architect → Frontend/Backend → Review</span>
                    )}
                  </div>
                  <form onSubmit={handleChatSubmit} className="flex items-end space-x-2">
                    <div className="flex-1 relative">
                      <textarea
                        data-testid="chat-input"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e as any); } }}
                        placeholder="Ask ZYVA Agent... (Shift+Enter for new line)"
                        rows={2}
                        className="w-full bg-[#2a2d2e] border border-zinc-700/60 rounded-xl text-zinc-300 text-[12px] px-3 py-2.5 outline-none focus:border-[#007acc]/70 resize-none leading-relaxed placeholder:text-zinc-600"
                        disabled={isAgentThinking}
                      />
                    </div>
                    <button data-testid="chat-send-btn" type="submit"
                      disabled={isAgentThinking || !chatInput.trim()}
                      className="bg-[#007acc] hover:bg-[#005f9e] disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition-colors cursor-pointer shrink-0 self-end">
                      {isAgentThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
