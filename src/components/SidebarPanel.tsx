'use client';

import React, { useState } from 'react';
import { useIdeStore } from '@/store/useIdeStore';
import { 
  ChevronRight, ChevronDown, FileCode2, MoreHorizontal,
  Search as SearchIcon, LayoutTemplate, Zap, Wallet
} from 'lucide-react';

import { FileNode } from '@/store/useIdeStore';

function FileTreeItem({ node, depth, store }: { node: FileNode; depth: number; store: any }) {
  const isFolder = node.type === 'folder';
  const isExpanded = !!store.expandedFolders[node.path];
  const isActive = store.activeFile === node.path;

  // Make testId matching playwright spec
  const testId = isFolder 
    ? `folder-${node.name}` 
    : `file-${node.name.replace('.', '-')}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      store.toggleFolder(node.path);
    } else {
      store.setActiveFile(node.path);
    }
  };

  return (
    <div className="select-none">
      <div
        data-testid={testId}
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        className={`flex items-center py-1.5 pr-2 cursor-pointer text-[13px] transition-colors border-l-2 ${
          isActive 
            ? 'bg-[#37373d] text-white border-l-[#007acc]' 
            : 'hover:bg-[#2a2d2e] text-[#cccccc] border-l-transparent'
        }`}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 mr-1 text-zinc-500 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1 text-zinc-500 shrink-0" />
            )}
            <span className="font-semibold text-slate-300 truncate">{node.name}</span>
          </>
        ) : (
          <>
            <FileCode2 className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${
              isActive ? 'text-[#519aba]' : 'text-slate-500'
            }`} />
            <span className="truncate">{node.name}</span>
          </>
        )}
      </div>

      {isFolder && isExpanded && node.children && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SidebarPanel() {
  const store = useIdeStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const handleCommitSubmit = () => {
    if (commitMessage.trim()) {
      store.commitTo0G(commitMessage);
      setCommitMessage('');
    }
  };

  return (
    <div className="w-[240px] bg-[#181818] border-r border-[#2b2d31] flex flex-col shrink-0">
      <div className="px-4 py-2 flex items-center justify-between shrink-0 select-none relative">
        <span className="text-[11px] text-[#cccccc] font-semibold uppercase tracking-wider font-sans">
          {store.activeSidebarTab === 'explorer' && 'Explorer'}
          {store.activeSidebarTab === 'search' && 'Search'}
          {store.activeSidebarTab === 'source-control' && 'Source Control'}
          {store.activeSidebarTab === 'extensions' && 'Extensions'}
          {store.activeSidebarTab === 'layout' && 'ZYVA Hub'}
          {store.activeSidebarTab === 'profile' && 'Accounts'}
          {store.activeSidebarTab === 'settings' && 'Settings'}
        </span>
        <MoreHorizontal 
          data-testid="sidebar-more-btn"
          className="w-4 h-4 text-[#858585] cursor-pointer hover:text-white" 
          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
        />

        {isMoreMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 cursor-default" 
              onClick={() => setIsMoreMenuOpen(false)}
            />
            <div className="absolute right-4 top-8 bg-[#252526] border border-[#454545] rounded shadow-lg py-1 z-50 min-w-[160px] text-[12px] text-[#cccccc] font-sans">
              {store.activeSidebarTab === 'explorer' && (
                <>
                  <div 
                    data-testid="more-menu-refresh"
                    className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer transition-colors"
                    onClick={() => {
                      store.loadWorkspace(store.projectPath);
                      setIsMoreMenuOpen(false);
                    }}
                  >
                    Refresh Explorer
                  </div>
                  <div 
                    data-testid="more-menu-collapse"
                    className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer transition-colors"
                    onClick={() => {
                      store.collapseAllFolders();
                      setIsMoreMenuOpen(false);
                    }}
                  >
                    Collapse All Folders
                  </div>
                </>
              )}
              {store.activeSidebarTab === 'source-control' && (
                <div 
                  data-testid="more-menu-clear-commit"
                  className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer transition-colors"
                  onClick={() => {
                    setCommitMessage('');
                    setIsMoreMenuOpen(false);
                  }}
                >
                  Clear Message
                </div>
              )}
              {store.activeSidebarTab === 'settings' && (
                <div 
                  data-testid="more-menu-reset-settings"
                  className="px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer transition-colors"
                  onClick={() => {
                    store.updateSettings('aiModel', 'glm-5.1');
                    store.updateSettings('storageNodeUrl', 'https://mainnet.0g.ai');
                    store.updateSettings('autoSync', true);
                    store.updateSettings('useTee', true);
                    store.updateSettings('autonomousMode', true);
                    store.updateSettings('geminiApiKey', '');
                    setIsMoreMenuOpen(false);
                  }}
                >
                  Reset Settings
                </div>
              )}
              {['search', 'extensions', 'layout', 'profile'].includes(store.activeSidebarTab) && (
                <div className="px-3 py-1.5 text-zinc-500 italic select-none">
                  No actions available
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto pb-4">
        {/* --- EXPLORER PANEL --- */}
        {store.activeSidebarTab === 'explorer' && (
          <div className="select-none flex flex-col h-full">
            {store.projectPath ? (
              <>
                <div className="flex items-center px-3 py-2 cursor-pointer font-bold text-[11px] text-[#cccccc] hover:bg-[#2a2d2e] uppercase tracking-wider border-b border-[#2b2d31]">
                  <ChevronDown className="w-4 h-4 mr-1 text-zinc-400" /> {store.projectName}
                </div>
                <div className="text-[13px] font-sans text-[#cccccc] py-2 overflow-y-auto">
                  {store.fileTree && store.fileTree.length > 0 ? (
                    store.fileTree.map((node) => (
                      <FileTreeItem key={node.path} node={node} depth={0} store={store} />
                    ))
                  ) : (
                    <div className="px-4 py-3 text-zinc-500 text-xs italic">
                      Workspace is empty
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* No project open — show prompt */
              <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#2a2d2e] flex items-center justify-center mb-1">
                  <Zap className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="text-[12px] text-zinc-500 leading-relaxed">No folder open yet</p>
                <button
                  onClick={() => store.setCreateProjectModalOpen(true)}
                  className="w-full text-[12px] px-3 py-2 bg-[#007acc]/10 hover:bg-[#007acc]/20 border border-[#007acc]/40 text-[#007acc] rounded-lg transition-colors cursor-pointer font-medium"
                >
                  Create Project
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('zyva:openFolderModal'))}
                  className="w-full text-[12px] px-3 py-2 bg-[#2a2d2e] hover:bg-[#323537] border border-zinc-700/60 text-zinc-300 rounded-lg transition-colors cursor-pointer font-medium"
                >
                  Open Folder
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- SEARCH PANEL --- */}
        {store.activeSidebarTab === 'search' && (
          <div className="p-4 space-y-3">
             <div className="bg-[#3c3c3c] border border-[#3c3c3c] rounded focus-within:border-[#007acc] flex items-center px-2 py-1">
                <SearchIcon className="w-3.5 h-3.5 text-[#858585] mr-2" />
                <input 
                  type="text" 
                  placeholder="Search code..." 
                  className="w-full bg-transparent text-[#cccccc] text-[13px] outline-none" 
                />
             </div>
             <div className="bg-[#3c3c3c] border border-[#3c3c3c] rounded focus-within:border-[#007acc] flex items-center px-2 py-1">
                <LayoutTemplate className="w-3.5 h-3.5 text-[#858585] mr-2" />
                <input 
                  type="text" 
                  placeholder="Replace with..." 
                  className="w-full bg-transparent text-[#cccccc] text-[13px] outline-none" 
                />
             </div>
             <div className="text-[#858585] text-[12px] mt-4 flex items-center justify-center pt-8">No search results found.</div>
          </div>
        )}

        {/* --- SOURCE CONTROL PANEL --- */}
        {store.activeSidebarTab === 'source-control' && (
          <div className="p-4 space-y-4">
              <div className="bg-[#3c3c3c] border border-[#3c3c3c] rounded focus-within:border-[#007acc] flex flex-col p-1">
               <textarea 
                 value={commitMessage}
                 onChange={(e) => setCommitMessage(e.target.value)}
                 placeholder="Commit message (Press Cmd+Enter)" 
                 className="w-full h-16 bg-transparent text-[#cccccc] text-[13px] outline-none resize-none p-1" 
               />
             </div>
             <button 
               data-testid="commit-btn"
               onClick={handleCommitSubmit}
               className="w-full bg-[#007acc] hover:bg-[#005f9e] text-white text-[13px] py-1.5 rounded transition-colors font-medium cursor-pointer"
             >
               Commit to 0G
             </button>
             <div className="mt-6 select-none">
                <div className="text-[11px] uppercase text-[#cccccc] font-semibold mb-2 flex items-center justify-between">
                  <span>Changes</span>
                  <span className="bg-[#4d4d4d] text-white rounded-full px-1.5 text-[10px]">1</span>
                </div>
                <div className="text-[13px] text-[#cccccc] flex justify-between items-center cursor-pointer hover:bg-[#2a2d2e] py-1 px-2 rounded">
                  <span className="flex items-center">
                    <span className="text-[#519aba] mr-2 text-xs font-bold">TS</span> dashboard.tsx
                  </span>
                  <span className="text-[#e2c08d] font-bold text-xs">M</span>
                </div>
             </div>
          </div>
        )}

        {/* --- EXTENSIONS PANEL --- */}
        {store.activeSidebarTab === 'extensions' && (
          <div className="p-4 space-y-4 select-none">
             <div className="bg-[#3c3c3c] border border-[#3c3c3c] rounded focus-within:border-[#007acc] flex items-center px-2 py-1">
                <input 
                  type="text" 
                  placeholder="Search Extensions..." 
                  className="w-full bg-transparent text-[#cccccc] text-[13px] outline-none" 
                />
             </div>
             <div className="space-y-4 mt-6">
                <div className="flex space-x-3 cursor-pointer hover:bg-[#2a2d2e] p-2 rounded">
                   <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded flex items-center justify-center shrink-0">
                     <Zap className="w-6 h-6 text-white" />
                   </div>
                   <div className="flex flex-col justify-center">
                      <div className="text-[#cccccc] text-[13px] font-semibold text-white">ZYVA 0G Bridge</div>
                      <div className="text-[#858585] text-[11px]">IDE Integration to 0G Storage</div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* --- LAYOUT / ZYVA HUB PANEL --- */}
        {store.activeSidebarTab === 'layout' && (
          <div className="p-4 space-y-6 select-none">
             <div>
               <div className="text-[11px] uppercase text-[#cccccc] font-semibold mb-2">AI Orchestration Status</div>
               <div className="bg-[#2a2d2e] p-3 rounded border border-[#3c3c3c]">
                  <div className="flex items-center justify-between text-[13px] mb-2">
                    <span className="text-[#cccccc]">Active Swarm</span>
                    <span className="text-[#4ec9b0] font-semibold">4 Agents</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#cccccc]">Total Tokens</span>
                    <span className="text-[#c586c0] font-mono">14.2K</span>
                  </div>
               </div>
             </div>
          </div>
        )}

        {/* --- WEB3 PROFILE PANEL --- */}
        {store.activeSidebarTab === 'profile' && (
          <div className="p-4 space-y-6 select-none">
            <div>
              <div className="text-[11px] uppercase text-[#cccccc] font-semibold mb-3">Web3 Identity</div>
              <button 
                data-testid="connect-wallet-btn"
                onClick={store.isWalletConnected ? store.disconnectWallet : store.connectWallet}
                className={`w-full text-[13px] py-2 rounded transition-colors flex items-center justify-center space-x-2 cursor-pointer font-medium ${
                  store.isWalletConnected 
                    ? 'bg-[#3c3c3c] hover:bg-[#4d4d4d] text-white' 
                    : 'bg-[#007acc] hover:bg-[#005f9e] text-white'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>{store.isWalletConnected ? 'Disconnect' : 'Connect Wallet'}</span>
              </button>
            </div>
            
            {store.isWalletConnected ? (
              <div className="bg-[#2a2d2e] p-3 rounded border border-[#3c3c3c]">
                 <div className="flex items-center space-x-3 mb-3 pb-3 border-b border-[#3c3c3c]">
                   <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center font-bold text-white shadow-md">Z</div>
                   <div>
                     <div className="text-[13px] text-white font-semibold">0G Developer</div>
                     <div className="text-[11px] text-[#858585] font-mono">
                       {store.walletAddress.substring(0, 6)}...{store.walletAddress.substring(store.walletAddress.length - 4)}
                     </div>
                   </div>
                 </div>
                 <div className="flex items-center justify-between text-[12px]">
                   <span className="text-[#858585]">0G Balance</span>
                   <span data-testid="profile-wallet-balance" className="text-[#4ec9b0] font-mono font-bold">{store.walletBalance} ZYVA</span>
                 </div>
              </div>
            ) : (
              <div className="text-[12px] text-[#858585] text-center border border-dashed border-[#3c3c3c] p-4 rounded leading-relaxed">
                Connect your crypto wallet to sync project memory directly with the 0G decentralized storage network.
              </div>
            )}
          </div>
        )}

        {/* --- SETTINGS PANEL --- */}
        {store.activeSidebarTab === 'settings' && (
          <div className="p-4 space-y-6">
            <div>
              <div className="text-[11px] uppercase text-[#cccccc] font-semibold mb-4 select-none">Workspace Settings</div>
              <div className="space-y-5">
                <div>
                  <label className="text-[12px] text-[#858585] block mb-1.5 select-none">Primary AI Model (0G Inference)</label>
                  <select 
                    data-testid="settings-model-select"
                    value={store.aiModel}
                    onChange={(e) => store.updateSettings('aiModel', e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded text-[#cccccc] text-[13px] p-1.5 outline-none focus:border-[#007acc] cursor-pointer"
                  >
                    <optgroup label="★ Gratis (0G Inference)">
                      <option value="glm-5.1">GLM-5.1 (744B)</option>
                      <option value="glm-5">GLM-5 (744B)</option>
                      <option value="glm-4.7">GLM-4.7</option>
                    </optgroup>
                    <optgroup label="0G Router (perlu key)">
                      <option value="0GM-1.0-35B-A3B">0GM-1.0-35B ★ 0G Native</option>
                      <option value="deepseek-v4-pro">DeepSeek-V4-Pro (1M ctx)</option>
                      <option value="deepseek/deepseek-chat-v3-0324">DeepSeek-V3 (131K ctx)</option>
                      <option value="qwen3.7-max">Qwen3.7-Max (1M ctx)</option>
                      <option value="qwen3.6-plus">Qwen3.6-Plus (1M ctx)</option>
                      <option value="zai-org/GLM-5.1-FP8">GLM-5.1-FP8 (0G Infra)</option>
                      <option value="zai-org/GLM-5-FP8">GLM-5-FP8 (0G Infra)</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] text-[#858585] block mb-1.5 select-none">0G Storage Node URL</label>
                  <input 
                    data-testid="settings-node-url"
                    type="text" 
                    value={store.storageNodeUrl}
                    onChange={(e) => store.updateSettings('storageNodeUrl', e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded text-[#cccccc] text-[13px] p-1.5 outline-none focus:border-[#007acc] px-2 py-1 font-mono" 
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#858585] block mb-1.5 select-none">0G Inference API Key</label>
                  <input 
                    data-testid="settings-og-api-key"
                    type="password" 
                    placeholder="Enter 0G Inference API Key..."
                    value={store.ogApiKey || ''}
                    onChange={(e) => store.updateSettings('ogApiKey', e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded text-[#cccccc] text-[13px] p-1.5 outline-none focus:border-[#007acc] px-2 py-1 font-mono mb-3" 
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#858585] block mb-1.5 select-none">Gemini API Key (Fallback)</label>
                  <input 
                    data-testid="settings-gemini-api-key"
                    type="password" 
                    placeholder="Enter Gemini API Key..."
                    value={store.geminiApiKey}
                    onChange={(e) => store.updateSettings('geminiApiKey', e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded text-[#cccccc] text-[13px] p-1.5 outline-none focus:border-[#007acc] px-2 py-1 font-mono" 
                  />
                </div>
                <div className="flex items-center justify-between select-none">
                  <span className="text-[12px] text-[#cccccc]">Auto-Sync Project Memory</span>
                  <input 
                    data-testid="settings-autosync-checkbox"
                    type="checkbox" 
                    checked={store.autoSync}
                    onChange={(e) => store.updateSettings('autoSync', e.target.checked)}
                    className="accent-[#007acc] w-3.5 h-3.5 cursor-pointer" 
                  />
                </div>
                <div className="flex items-center justify-between select-none">
                  <span className="text-[12px] text-[#cccccc]">Use TEE Sandbox</span>
                  <input 
                    data-testid="settings-tee-checkbox"
                    type="checkbox" 
                    checked={store.useTee}
                    onChange={(e) => store.updateSettings('useTee', e.target.checked)}
                    className="accent-[#007acc] w-3.5 h-3.5 cursor-pointer" 
                  />
                </div>
                <div className="flex items-center justify-between select-none">
                  <span className="text-[12px] text-[#cccccc]">Autonomous Mode</span>
                  <input 
                    data-testid="settings-autonomous-checkbox"
                    type="checkbox" 
                    checked={store.autonomousMode}
                    onChange={(e) => store.updateSettings('autonomousMode', e.target.checked)}
                    className="accent-[#007acc] w-3.5 h-3.5 cursor-pointer" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
