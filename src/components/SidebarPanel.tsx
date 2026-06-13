'use client';

import React, { useState, useEffect } from 'react';
import { useIdeStore } from '@/store/useIdeStore';
import {
  ChevronRight, ChevronDown, FileCode2, MoreHorizontal,
  Search as SearchIcon, LayoutTemplate, Zap, Wallet, Check, Download, Trash2
} from 'lucide-react';
import { EXTENSIONS_CATALOG, THEME_FILE_MAP, type Extension } from '@/lib/extensions-catalog';
import { getFileIcon, getFolderIcon } from '@/lib/file-icons';

import { FileNode } from '@/store/useIdeStore';

function FileTreeItem({ node, depth, store }: { node: FileNode; depth: number; store: any }) {
  const isFolder = node.type === 'folder';
  const isExpanded = !!store.expandedFolders[node.path];
  const isActive = store.activeFile === node.path;
  const fileIconsEnabled = store.installedExtensions?.includes('file-icons');

  const testId = isFolder
    ? `folder-${node.name}`
    : `file-${node.name.replace('.', '-')}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) { store.toggleFolder(node.path); }
    else { store.setActiveFile(node.path); }
  };

  const fileIcon = !isFolder && fileIconsEnabled ? getFileIcon(node.name) : null;

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
            {isExpanded
              ? <ChevronDown className="w-4 h-4 mr-1 text-zinc-500 shrink-0" />
              : <ChevronRight className="w-4 h-4 mr-1 text-zinc-500 shrink-0" />}
            <span className="mr-1 text-sm">{fileIconsEnabled ? getFolderIcon(node.name) : '📁'}</span>
            <span className="font-semibold text-slate-300 truncate">{node.name}</span>
          </>
        ) : (
          <>
            {fileIcon
              ? <span className="mr-1.5 text-[11px] font-bold shrink-0 w-5 text-center" style={{ color: fileIcon.color }}>{fileIcon.icon}</span>
              : <FileCode2 className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${isActive ? 'text-[#519aba]' : 'text-slate-500'}`} />}
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
      store.gitCommitAndPush(commitMessage);
      setCommitMessage('');
    }
  };

  const handle0GCommit = () => {
    if (commitMessage.trim()) {
      store.commitTo0G(commitMessage);
      setCommitMessage('');
    }
  };

  // Refresh real git status when project opens or source-control tab is opened
  useEffect(() => {
    if (store.activeSidebarTab === 'source-control' && store.projectPath) {
      store.refreshGitStatus();
    }
  }, [store.activeSidebarTab, store.projectPath]);

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
          <div className="p-4 space-y-3">
            {/* Commit message */}
            <div className="bg-[#3c3c3c] border border-[#3c3c3c] rounded focus-within:border-[#007acc] flex flex-col p-1">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleCommitSubmit(); }}
                placeholder="Commit message (Ctrl+Enter)"
                className="w-full h-16 bg-transparent text-[#cccccc] text-[13px] outline-none resize-none p-1"
              />
            </div>

            {/* Two buttons stacked */}
            <div className="flex flex-col gap-2">
              <button
                data-testid="commit-btn"
                onClick={handle0GCommit}
                disabled={!commitMessage.trim()}
                className="w-full bg-[#2a2d2e] hover:bg-[#3c3c3c] border border-[#3c3c3c] text-[#cccccc] hover:text-white text-[13px] py-1.5 rounded transition-colors font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ⬡ Commit to 0G
              </button>
              <button
                data-testid="github-push-btn"
                onClick={handleCommitSubmit}
                disabled={!commitMessage.trim() || store.gitPushing}
                className="w-full bg-[#007acc] hover:bg-[#005f9e] text-white text-[13px] py-1.5 rounded transition-colors font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {store.gitPushing ? (
                  <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="15 30"/></svg>Pushing…</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>Push to GitHub</>
                )}
              </button>
            </div>

            {/* Book icon → deploy guide */}
            <a
              href="/docs/deploy-vercel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded hover:bg-[#2a2d2e] transition-colors group"
              title="How to deploy to Vercel via GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <span className="text-[12px] text-[#8a8f98] group-hover:text-[#a78bfa] transition-colors">
                How to deploy with GitHub + Vercel
              </span>
            </a>

            {/* GitHub repo link */}
            {store.gitRepoUrl && (
              <a href={store.gitRepoUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#4ec9b0] hover:underline truncate px-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                {store.gitRepoUrl.replace('https://github.com/', '')}
              </a>
            )}

            {/* Real changed files */}
            <div className="mt-2 select-none">
              <div className="text-[11px] uppercase text-[#cccccc] font-semibold mb-2 flex items-center justify-between">
                <span>Changes</span>
                <span className="bg-[#4d4d4d] text-white rounded-full px-1.5 text-[10px]">{store.gitChangedFiles.length}</span>
              </div>
              {store.gitChangedFiles.length === 0 && (
                <div className="text-[12px] text-[#858585] px-2 py-1">{store.projectPath ? 'No changes' : 'No project open'}</div>
              )}
              {store.gitChangedFiles.map((f) => {
                const ext = f.path.split('.').pop() || '';
                const name = f.path.split('/').pop() || f.path;
                const extColor = ext === 'ts' || ext === 'tsx' ? '#519aba' : ext === 'css' ? '#e37933' : '#cccccc';
                const statusColor = f.status === 'M' ? '#e2c08d' : f.status === 'A' ? '#73c991' : f.status === 'D' ? '#f44747' : '#cccccc';
                return (
                  <div key={f.path} className="text-[13px] text-[#cccccc] flex justify-between items-center cursor-pointer hover:bg-[#2a2d2e] py-1 px-2 rounded" title={f.path}>
                    <span className="flex items-center truncate">
                      <span style={{ color: extColor }} className="mr-2 text-xs font-bold uppercase">{ext.slice(0, 2)}</span>
                      <span className="truncate">{name}</span>
                    </span>
                    <span style={{ color: statusColor }} className="font-bold text-xs ml-2 shrink-0">{f.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- EXTENSIONS PANEL --- */}
        {store.activeSidebarTab === 'extensions' && (
          <ExtensionsPanel store={store} />
        )}

        {/* --- LAYOUT / ZYVA HUB PANEL --- */}
        {store.activeSidebarTab === 'layout' && (
          <div className="p-4 space-y-6 select-none">
             <div>
               <div className="text-[11px] uppercase text-[#cccccc] font-semibold mb-2">AI Orchestration Status</div>
               <div className="bg-[#2a2d2e] p-3 rounded border border-[#3c3c3c]">
                  <div className="flex items-center justify-between text-[13px] mb-2">
                    <span className="text-[#cccccc]">Active Swarm</span>
                    <span className="text-[#4ec9b0] font-semibold">{store.swarmAgents.filter(a => a.status === 'working').length || store.swarmAgents.length} Agents</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#cccccc]">Total Tokens</span>
                    <span className="text-[#c586c0] font-mono">{store.totalTokensUsed > 0 ? (store.totalTokensUsed > 1000 ? `${(store.totalTokensUsed / 1000).toFixed(1)}K` : store.totalTokensUsed) : '—'}</span>
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
                    <optgroup label="ZYVA">
                      <option value="zyva">⚡ ZYVA (Beta)</option>
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

// ── Extensions Panel ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  formatter: 'Formatters',
  productivity: 'Productivity',
  theme: 'Themes',
  linting: 'Linting',
  language: 'Language Support',
};

function ExtensionsPanel({ store }: { store: any }) {
  const [query, setQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  const installed: string[] = store.installedExtensions || [];
  const activeTheme: string = store.activeTheme || 'zyvaDarkTheme';

  const filtered = EXTENSIONS_CATALOG.filter((e) =>
    !query || e.name.toLowerCase().includes(query.toLowerCase()) || e.description.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Extension[]>>((acc, ext) => {
    const key = CATEGORY_LABELS[ext.category] || ext.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ext);
    return acc;
  }, {});

  async function handleInstall(ext: Extension) {
    setInstalling(ext.id);
    await new Promise((r) => setTimeout(r, 600)); // simulate install
    store.installExtension(ext.id);
    setInstalling(null);
  }

  function handleUninstall(ext: Extension) {
    if (ext.builtin) return;
    store.uninstallExtension(ext.id);
    // If uninstalling active theme, revert to default
    if (ext.id === activeTheme) store.setTheme('zyvaDarkTheme');
  }

  function handleActivateTheme(ext: Extension) {
    store.setTheme(ext.id);
  }

  const isInstalled = (id: string) => installed.includes(id);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 sticky top-0 bg-[#181818] z-10">
        <div className="bg-[#3c3c3c] border border-[#3c3c3c] rounded focus-within:border-[#007acc] flex items-center px-2 py-1">
          <SearchIcon className="w-3.5 h-3.5 text-[#858585] mr-2 shrink-0" />
          <input
            data-testid="extension-search"
            type="text"
            placeholder="Search extensions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-[#cccccc] text-[13px] outline-none"
          />
        </div>
        <div className="text-[10px] text-[#555] mt-1.5 px-1">{filtered.length} extensions</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {Object.entries(grouped).map(([category, exts]) => (
          <div key={category}>
            <div className="text-[10px] uppercase font-bold text-[#555] tracking-wider px-2 py-1">{category}</div>
            {exts.map((ext) => {
              const inst = isInstalled(ext.id);
              const isTheme = ext.category === 'theme';
              const isActive = isTheme && activeTheme === ext.id;
              const isLoading = installing === ext.id;

              return (
                <div
                  key={ext.id}
                  data-testid={`extension-${ext.id}`}
                  className="flex items-start gap-2.5 p-2 rounded hover:bg-[#2a2d2e] group transition-colors"
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 font-bold"
                    style={{ background: ext.iconBg, color: '#fff' }}
                  >
                    {ext.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[#e8e8ea] truncate">{ext.name}</span>
                      {isActive && (
                        <span className="text-[9px] bg-[#007acc22] border border-[#007acc44] text-[#007acc] px-1 rounded font-bold shrink-0">ACTIVE</span>
                      )}
                      {inst && !isTheme && (
                        <Check className="w-3 h-3 text-[#4ec9b0] shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-[#858585] leading-relaxed line-clamp-2 mt-0.5">{ext.description}</div>
                    <div className="text-[10px] text-[#555] mt-0.5">{ext.author} · v{ext.version}</div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex flex-col gap-1">
                    {isTheme ? (
                      <>
                        {!inst ? (
                          <button
                            onClick={() => handleInstall(ext)}
                            disabled={!!isLoading}
                            className="text-[10px] px-2 py-1 bg-[#007acc] hover:bg-[#005f9e] text-white rounded transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          >
                            {isLoading ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="15 30"/></svg> : <Download className="w-3 h-3" />}
                          </button>
                        ) : isActive ? (
                          <span className="text-[10px] text-[#007acc] px-1">✓</span>
                        ) : (
                          <button
                            onClick={() => handleActivateTheme(ext)}
                            className="text-[10px] px-2 py-1 bg-[#2a2d2e] hover:bg-[#3c3c3c] text-[#cccccc] rounded transition-colors cursor-pointer"
                          >
                            Apply
                          </button>
                        )}
                      </>
                    ) : inst ? (
                      !ext.builtin && (
                        <button
                          onClick={() => handleUninstall(ext)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 bg-[#2a2d2e] hover:bg-red-900/30 text-[#858585] hover:text-red-400 rounded transition-all cursor-pointer"
                          title="Uninstall"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleInstall(ext)}
                        disabled={!!isLoading}
                        className="text-[10px] px-2 py-1 bg-[#007acc] hover:bg-[#005f9e] text-white rounded transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {isLoading
                          ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="15 30"/></svg>
                          : <><Download className="w-3 h-3" /></>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
