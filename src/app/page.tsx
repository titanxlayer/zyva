'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useIdeStore } from '@/store/useIdeStore';
import SidebarPanel from '@/components/SidebarPanel';
import MonacoCodeEditor from '@/components/MonacoCodeEditor';
import TerminalConsole from '@/components/TerminalConsole';
import AgentSwarm from '@/components/AgentSwarm';
import LivePreview from '@/components/LivePreview';
import IdeBodyClass from '@/components/IdeBodyClass';
import { 
  Search, Settings, Files, GitBranch, Box, LayoutTemplate,
  User, ChevronRight, X, RefreshCw, AlertCircle,
  PanelLeftClose, PanelLeftOpen, Code2, Database, ChevronDown,
  Terminal, ShieldCheck, Wallet, Eye, EyeOff, MessageSquare
} from 'lucide-react';

/** Track viewport: mobile flag (Tailwind md breakpoint) + current width. */
function useViewport(breakpoint = 768) {
  const [vp, setVp] = useState({ isMobile: false, width: 1280 });
  useEffect(() => {
    const check = () => setVp({ isMobile: window.innerWidth < breakpoint, width: window.innerWidth });
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return vp;
}

type MobileView = 'files' | 'code' | 'preview' | 'chat';

export default function Home() {
  const store = useIdeStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isMobile, width: vpWidth } = useViewport();
  const [mobileView, setMobileView] = useState<MobileView>('chat');

  // States for local modal inputs
  const [newProjName, setNewProjName] = useState('my-zyva-app');
  const [newProjTemplate, setNewProjTemplate] = useState<'react' | 'rust' | 'python'>('react');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [commandSearch, setCommandSearch] = useState('');
  
  const [isOpenFolderModalOpen, setOpenFolderModalOpen] = useState(false);
  const [folderPathInput, setFolderPathInput] = useState('');
  const [parentPathInput, setParentPathInput] = useState('');

  // Import-from-GitHub modal (open state lives in the store so mobile panels can trigger it)
  const [importRepoUrl, setImportRepoUrl] = useState('');
  const [importRepoBusy, setImportRepoBusy] = useState(false);
  const [importRepoError, setImportRepoError] = useState('');

  const [activeHeaderMenu, setActiveHeaderMenu] = useState<string | null>(null);
  const [browseDirectories, setBrowseDirectories] = useState<{name: string, path: string}[]>([]);
  const [browseCurrentPath, setBrowseCurrentPath] = useState('');
  const [browseParentPath, setBrowseParentPath] = useState('');

  const fetchDirectories = async (pathToCheck?: string) => {
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'browse',
          currentPath: pathToCheck
        })
      });
      const data = await res.json();
      if (data.success) {
        setBrowseDirectories(data.directories);
        setBrowseCurrentPath(data.currentPath);
        setBrowseParentPath(data.parentPath);
        setFolderPathInput(data.currentPath);
      }
    } catch (e) {
      console.error('Failed to fetch directories:', e);
    }
  };

  const handleOpenBrowserDialog = async () => {
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'selectFolderDialog' })
      });
      const data = await res.json();
      if (data.success && data.selectedPath) {
        setFolderPathInput(data.selectedPath);
        fetchDirectories(data.selectedPath);
      }
    } catch (e) {
      console.error('Failed to open native folder dialog:', e);
    }
  };

  // Load cross-platform default workspace paths (no hardcoded C:/ paths)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'defaults' })
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setParentPathInput(prev => prev || data.defaultProjectsDir);
          setFolderPathInput(prev => prev || data.defaultProjectsDir);
        }
      } catch (e) {
        // Non-fatal
      }
      // Check 0G storage status on load
      if (!cancelled) store.checkStorageStatus();
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isOpenFolderModalOpen) {
      fetchDirectories(store.projectPath || undefined);
    }
  }, [isOpenFolderModalOpen, store.projectPath]);

  // Listen for open folder modal event from welcome screen
  useEffect(() => {
    const handler = () => setOpenFolderModalOpen(true);
    window.addEventListener('zyva:openFolderModal', handler);
    return () => window.removeEventListener('zyva:openFolderModal', handler);
  }, []);

  // Keyboard Shortcuts (Ctrl+N: new chat, Ctrl+Shift+P: commands, Ctrl+S: save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        store.newChatConversation();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        store.setCommandPaletteOpen(true);
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        store.saveActiveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        store.setProjectDropdownOpen(false);
        setActiveHeaderMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [store]);

  // Resize state for right panel (AgentSwarm)
  const [showStorageHelper, setShowStorageHelper] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX; // dragging left = bigger panel
      const newWidth = Math.min(700, Math.max(240, startWidth + delta));
      setRightPanelWidth(newWidth);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleCloseTab = (e: React.MouseEvent, tabName: string) => {
    e.stopPropagation();
    store.closeTab(tabName);
  };

  const handleTabClick = (tabName: string) => {
    store.setActiveFile(tabName);
  };

  // Command Palette Actions list
  const commands = [
    { name: 'ZYVA: New Conversation', action: () => store.newChatConversation() },
    { name: 'ZYVA: Create New Project', action: () => store.setCreateProjectModalOpen(true) },
    { name: 'ZYVA: Open Folder', action: () => setOpenFolderModalOpen(true) },
    { name: 'ZYVA: Save Active File', action: () => store.saveActiveFile() },
    { name: 'ZYVA: Clear Terminal logs', action: () => store.executeTerminalCommand('clear') },
    { name: 'ZYVA: Run Unit & integration tests', action: () => store.executeTerminalCommand('zyva test') },
    { name: 'ZYVA: Run Codebase Semantic Audit', action: () => store.executeTerminalCommand('zyva analyze') },
    { name: 'ZYVA: Connect Web3 Identity wallet', action: () => store.connectWallet() },
    { name: 'ZYVA: Disconnect Web3 Identity wallet', action: () => store.disconnectWallet() },
    { name: 'ZYVA: Switch AI Model to DeepSeek-V4-Pro', action: () => store.updateSettings('aiModel', 'DeepSeek-V4-Pro') },
  ];

  const filteredCommands = commands.filter(c => 
    c.name.toLowerCase().includes(commandSearch.toLowerCase())
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden select-none relative">
      <IdeBodyClass />
      
      {/* 1. TOP BAR */}
      <header className="h-[35px] flex items-center justify-between px-3 bg-[#181818] border-b border-[#2b2d31] shrink-0 z-20">
        
        {/* Left: Window Controls + Menu Bar */}
        <div className="flex items-center w-1/3 relative select-none">
          {/* Mac Window Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#ed6a5e] border border-[#d24f46]"></div>
            <div className="w-3 h-3 rounded-full bg-[#f5bf4f] border border-[#d6a243]"></div>
            <div className="w-3 h-3 rounded-full bg-[#61c554] border border-[#52a63e]"></div>
          </div>

          {/* Menu Items — desktop only */}
          <div className="hidden md:flex items-center ml-5 space-x-1 relative" ref={dropdownRef}>
            {/* Antigravity / ZYVA Menu */}
            <div className="relative">
              <button 
                onClick={() => setActiveHeaderMenu(activeHeaderMenu === 'zyva' ? null : 'zyva')}
                onMouseEnter={() => activeHeaderMenu && setActiveHeaderMenu('zyva')}
                className={`px-3 py-1 rounded text-[12px] font-semibold cursor-pointer transition-colors ${
                  activeHeaderMenu === 'zyva' ? 'bg-[#2b2d31] text-white' : 'hover:bg-[#2b2d31] text-zinc-400 hover:text-white'
                }`}
              >
                ZYVA
              </button>
              {activeHeaderMenu === 'zyva' && (
                <div 
                  className="absolute left-0 mt-1 w-[160px] bg-[#1c1c1c] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-50 text-[12px] text-zinc-300 font-sans"
                >
                  <div className="px-4 py-1.5 text-zinc-500 border-b border-[#2b2d31] font-mono text-[11px]">Version 2.0.11</div>
                  <button 
                    onClick={() => {
                      alert('You are running the latest version of ZYVA!');
                      setActiveHeaderMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Check for Updates
                  </button>
                </div>
              )}
            </div>

            {/* File Menu (Mapped with ZYVA click-tests for backwards-compatibility) */}
            <div className="relative">
              <button 
                data-testid="zyva-menu-btn"
                onClick={() => {
                  setActiveHeaderMenu(activeHeaderMenu === 'file' ? null : 'file');
                  store.setProjectDropdownOpen(activeHeaderMenu !== 'file');
                }}
                onMouseEnter={() => {
                  if (activeHeaderMenu) {
                    setActiveHeaderMenu('file');
                    store.setProjectDropdownOpen(true);
                  }
                }}
                className={`px-3 py-1 rounded text-[12px] cursor-pointer transition-colors ${
                  activeHeaderMenu === 'file' ? 'bg-[#2b2d31] text-white' : 'hover:bg-[#2b2d31] text-zinc-400 hover:text-white'
                }`}
              >
                File
              </button>
              {(activeHeaderMenu === 'file' || store.isProjectDropdownOpen) && (
                <div 
                  data-testid="zyva-dropdown-menu"
                  className="absolute left-0 mt-1 w-[200px] bg-[#1c1c1c] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-50 text-[12px] text-zinc-300 font-sans"
                >
                  <button 
                    data-testid="dropdown-new-chat"
                    onClick={() => {
                      store.newChatConversation();
                      setActiveHeaderMenu(null);
                      store.setProjectDropdownOpen(false);
                    }}
                    className="w-full flex justify-between items-center px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>New Conversation</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+N</span>
                  </button>
                  <button 
                    data-testid="dropdown-create-project"
                    onClick={() => {
                      store.setCreateProjectModalOpen(true);
                      setActiveHeaderMenu(null);
                      store.setProjectDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Create Project...
                  </button>
                  <button 
                    data-testid="dropdown-import-repo"
                    onClick={() => {
                      store.setImportRepoModalOpen(true);
                      setActiveHeaderMenu(null);
                      store.setProjectDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Import from GitHub...
                  </button>
                  <button 
                    data-testid="dropdown-open-folder"
                    onClick={() => {
                      setOpenFolderModalOpen(true);
                      setActiveHeaderMenu(null);
                      store.setProjectDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Open Folder...
                  </button>
                  <div className="h-[1px] bg-[#2b2d31] my-1"></div>
                  <button 
                    onClick={() => {
                      store.saveActiveFile();
                      setActiveHeaderMenu(null);
                      store.setProjectDropdownOpen(false);
                    }}
                    className="w-full flex justify-between items-center px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Save Active File</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+S</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative">
              <button 
                onClick={() => {
                  setActiveHeaderMenu(activeHeaderMenu === 'view' ? null : 'view');
                  store.setProjectDropdownOpen(false);
                }}
                onMouseEnter={() => {
                  if (activeHeaderMenu) {
                    setActiveHeaderMenu('view');
                    store.setProjectDropdownOpen(false);
                  }
                }}
                className={`px-3 py-1 rounded text-[12px] cursor-pointer transition-colors ${
                  activeHeaderMenu === 'view' ? 'bg-[#2b2d31] text-white' : 'hover:bg-[#2b2d31] text-zinc-400 hover:text-white'
                }`}
              >
                View
              </button>
              {activeHeaderMenu === 'view' && (
                <div className="absolute left-0 mt-1 w-[220px] bg-[#1c1c1c] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-50 text-[12px] text-zinc-300 font-sans">
                  <button 
                    data-testid="dropdown-command-palette"
                    onClick={() => {
                      store.setCommandPaletteOpen(true);
                      setActiveHeaderMenu(null);
                    }}
                    className="w-full flex justify-between items-center px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Command Palette...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+P</span>
                  </button>
                  <button 
                    onClick={() => {
                      store.setIsExplorerOpen(!store.isExplorerOpen);
                      setActiveHeaderMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Toggle Sidebar
                  </button>
                  <button 
                    onClick={() => {
                      store.executeTerminalCommand('clear');
                      setActiveHeaderMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Clear Terminal Logs
                  </button>
                </div>
              )}
            </div>

            {/* Window Menu */}
            <div className="relative">
              <button 
                onClick={() => {
                  setActiveHeaderMenu(activeHeaderMenu === 'window' ? null : 'window');
                  store.setProjectDropdownOpen(false);
                }}
                onMouseEnter={() => {
                  if (activeHeaderMenu) {
                    setActiveHeaderMenu('window');
                    store.setProjectDropdownOpen(false);
                  }
                }}
                className={`px-3 py-1 rounded text-[12px] cursor-pointer transition-colors ${
                  activeHeaderMenu === 'window' ? 'bg-[#2b2d31] text-white' : 'hover:bg-[#2b2d31] text-zinc-400 hover:text-white'
                }`}
              >
                Window
              </button>
              {activeHeaderMenu === 'window' && (
                <div className="absolute left-0 mt-1 w-[160px] bg-[#1c1c1c] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-50 text-[12px] text-zinc-300 font-sans">
                  <button 
                    onClick={() => {
                      window.location.reload();
                      setActiveHeaderMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    Reload Window
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Breadcrumbs / Project Name */}
        <div className="hidden md:flex w-1/3 justify-center">
          <div 
            onClick={() => store.setCommandPaletteOpen(true)}
            className="flex items-center bg-[#2b2d31] hover:bg-[#323438] border border-[#3b3d41] rounded-md px-3 py-1 w-full max-w-[400px] cursor-pointer transition-colors select-none"
          >
            <Search className="w-3.5 h-3.5 text-[#858585] mr-2" />
            <span className="text-[12px] text-[#cccccc] font-mono truncate">
              {store.projectPath 
                ? `workspace / ${store.projectName}` 
                : 'ZYVA IDE — no project open'}
            </span>
          </div>
        </div>

        {/* Right Info Status */}
        <div className="w-1/3 flex items-center justify-end space-x-4 select-none">
          <div className="relative">
            <div
              className="flex items-center space-x-1.5 bg-[#1e1e1e] border border-[#2b2d31] px-2 py-0.5 rounded-full cursor-pointer hover:border-[#3b3d41]"
              onClick={() => {
                store.checkStorageStatus();
                if (store.storageNodeOnline === false) setShowStorageHelper(v => !v);
              }}
              title={store.storageNodeOnline === false ? 'Click for help' : 'Click to recheck'}
            >
              <span className={`w-2 h-2 rounded-full ${store.storageNodeOnline === null ? 'bg-yellow-400 animate-pulse' : store.storageNodeOnline ? 'bg-[#61c554] animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[11px] text-[#cccccc]">
                {store.storageNodeOnline === null ? '0G Checking…' : store.storageNodeOnline ? '0G Storage Live' : '0G Offline'}
              </span>
              {store.storageNodeOnline === false && (
                <span className="text-[10px] text-red-400 ml-0.5">?</span>
              )}
            </div>

            {/* Helper popup */}
            {showStorageHelper && store.storageNodeOnline === false && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStorageHelper(false)} />
                <div className="absolute right-0 top-8 z-50 w-72 bg-[#1c1d26] border border-[#3b3d41] rounded-xl shadow-2xl p-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-white">0G Storage Offline</span>
                    <button onClick={() => setShowStorageHelper(false)} className="text-zinc-500 hover:text-white text-[14px] cursor-pointer">×</button>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                    The 0G storage node at <code className="text-[#4ec9b0] bg-zinc-900 px-1 rounded">{store.storageNodeUrl}</code> is unreachable from your browser. This is normal — direct browser-to-node pings are blocked by CORS.
                  </p>
                  <div className="space-y-2 text-[11px]">
                    <div className="bg-[#161720] border border-[#2b2d31] rounded-lg p-2.5">
                      <div className="text-zinc-300 font-semibold mb-1">✅ What still works</div>
                      <ul className="text-zinc-400 space-y-0.5 list-disc list-inside">
                        <li>AI chat and code generation</li>
                        <li>File editing and project management</li>
                        <li>GitHub commit & push</li>
                      </ul>
                    </div>
                    <div className="bg-[#161720] border border-[#2b2d31] rounded-lg p-2.5">
                      <div className="text-zinc-300 font-semibold mb-1">🔧 To enable 0G Storage</div>
                      <ul className="text-zinc-400 space-y-0.5 list-disc list-inside">
                        <li>Connect a Web3 wallet in the Swarm panel</li>
                        <li>Or update the node URL in Settings</li>
                      </ul>
                    </div>
                  </div>
                  <button
                    onClick={() => { store.checkStorageStatus(); }}
                    className="mt-3 w-full text-[11px] py-1.5 bg-[#2b2d31] hover:bg-[#3b3d41] text-zinc-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Recheck connection
                  </button>
                </div>
              </>
            )}
          </div>
          <Settings 
            data-testid="settings-top-btn"
            className="w-4 h-4 text-[#858585] cursor-pointer hover:text-white" 
            onClick={() => { store.setActiveSidebarTab('settings'); store.setIsExplorerOpen(true); }}
          />
        </div>
      </header>

      {/* 2. MAIN WORKSPACE LAYOUT */}
      <div className="flex-1 flex flex-row overflow-hidden">
        
        {/* BILAH AKTIVITAS (Activity Bar - Paling Kiri) — desktop only */}
        <div className="hidden md:flex w-[48px] bg-[#181818] border-r border-[#2b2d31] flex-col items-center py-3 justify-between shrink-0 z-10 select-none">
          <div className="flex flex-col space-y-4 items-center w-full">
            <div 
              data-testid="activity-explorer" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('explorer'); store.setIsExplorerOpen(true); }}
            >
              <Files className={`w-6 h-6 ${store.activeSidebarTab === 'explorer' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'explorer' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
            <div 
              data-testid="activity-search" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('search'); store.setIsExplorerOpen(true); }}
            >
              <Search className={`w-6 h-6 ${store.activeSidebarTab === 'search' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'search' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
            <div 
              data-testid="activity-source-control" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('source-control'); store.setIsExplorerOpen(true); }}
            >
              <GitBranch className={`w-6 h-6 ${store.activeSidebarTab === 'source-control' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'source-control' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
            <div 
              data-testid="activity-extensions" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('extensions'); store.setIsExplorerOpen(true); }}
            >
              <Box className={`w-6 h-6 ${store.activeSidebarTab === 'extensions' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'extensions' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
            <div 
              data-testid="activity-layout" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('layout'); store.setIsExplorerOpen(true); }}
            >
              <LayoutTemplate className={`w-6 h-6 ${store.activeSidebarTab === 'layout' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'layout' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
          </div>
          
          <div className="flex flex-col space-y-4 items-center w-full">
            <div 
              data-testid="activity-profile" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('profile'); store.setIsExplorerOpen(true); }}
            >
              <User className={`w-6 h-6 ${store.activeSidebarTab === 'profile' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'profile' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
            <div 
              data-testid="activity-settings" 
              className="relative w-full flex justify-center group cursor-pointer" 
              onClick={() => { store.setActiveSidebarTab('settings'); store.setIsExplorerOpen(true); }}
            >
              <Settings className={`w-6 h-6 ${store.activeSidebarTab === 'settings' ? 'text-white' : 'text-[#858585] group-hover:text-white'}`} strokeWidth={1.5} />
              {store.activeSidebarTab === 'settings' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007acc]"></div>}
            </div>
          </div>
        </div>

        {/* SIDEBAR PANEL — desktop: toggle; mobile: only in "files" view */}
        {(isMobile ? mobileView === 'files' : store.isExplorerOpen) && (
          <div className={isMobile ? 'flex w-full min-w-0' : 'contents'}>
            <SidebarPanel />
          </div>
        )}

        {/* AREA TENGAH: EDITOR KODE (ATAS) & CONSOLE TERMINAL (BAWAH) */}
        <div className={`flex-1 flex-col min-w-0 bg-[#1e1e1e] h-full ${isMobile && !(mobileView === 'code' || mobileView === 'preview') ? 'hidden' : 'flex'}`}>
          
          {/* EDITOR KODE */}
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Editor Tabs & Sidebar Toggle */}
            <div className="flex items-center h-[35px] bg-[#181818] border-b border-[#2b2d31] overflow-x-auto no-scrollbar shrink-0 select-none justify-between pr-2">
              <div className="flex items-center h-full overflow-x-auto no-scrollbar">
                <button 
                  data-testid="sidebar-toggle-btn"
                  onClick={() => store.setIsExplorerOpen(!store.isExplorerOpen)}
                  className="p-1 mx-2 text-[#858585] hover:text-white hover:bg-[#2a2d2e] rounded transition-colors cursor-pointer"
                  title="Toggle Sidebar"
                >
                  {store.isExplorerOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </button>
                <div className="w-[1px] h-4 bg-[#2b2d31] mr-1"></div>
                
                {store.openedTabs.map(tab => {
                  const tabName = tab.split('/').pop() || tab;
                  return (
                    <div 
                      key={tab}
                      onClick={() => handleTabClick(tab)}
                      data-testid={`tab-${tabName}`}
                      className={`flex items-center px-3 h-full min-w-[120px] max-w-[200px] border-r border-[#2b2d31] cursor-pointer group ${
                        store.activeFile === tab ? 'bg-[#1e1e1e] border-t border-t-[#007acc]' : 'bg-[#2d2d2d] border-t border-t-transparent text-[#858585]'
                      }`}
                    >
                      <Code2 className={`w-3.5 h-3.5 mr-2 ${store.activeFile === tab ? 'text-[#519aba]' : 'text-zinc-500'}`} />
                      <span className={`text-[13px] truncate flex-1 ${store.activeFile === tab ? 'text-white' : ''}`}>{tabName}</span>
                      <button 
                        data-testid={`close-tab-${tabName}`} 
                        onClick={(e) => handleCloseTab(e, tab)} 
                        className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 cursor-pointer ${store.activeFile === tab ? 'hover:bg-[#333333]' : 'hover:bg-[#444444]'}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Live Preview Toggle Button */}
              {store.projectPath && store.activeFile && (
                <button
                  data-testid="preview-tab"
                  onClick={() => store.togglePreview()}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer shrink-0 ${
                    store.isPreviewOpen 
                      ? 'bg-[#007acc] text-white hover:bg-[#005f9e]' 
                      : 'bg-[#2d2d2d] text-[#858585] hover:text-white hover:bg-[#3d3d3d] border border-zinc-800'
                  }`}
                  title="Toggle Split-Screen Live Preview"
                >
                  {store.isPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{store.isPreviewOpen ? 'Close Preview' : 'Preview'}</span>
                </button>
              )}
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center px-4 h-[22px] bg-[#1e1e1e] border-b border-[#2b2d31] text-[12px] text-[#858585] shrink-0 select-none">
              <span>{store.projectName}</span>
              <ChevronRight className="w-3.5 h-3.5 mx-0.5" />
              <span>src</span>
              <ChevronRight className="w-3.5 h-3.5 mx-0.5" />
              <span className={store.activeFile ? 'text-[#cccccc]' : ''}>{store.activeFile}</span>
            </div>

            {/* Content Area Editor (Split Panel: Editor & Live Preview) */}
            <div className="flex-1 flex overflow-hidden relative group">
              <div className={`flex-1 h-full min-w-0 relative ${isMobile && mobileView === 'preview' ? 'hidden' : ''}`}>
                <MonacoCodeEditor />
              </div>
              {((isMobile && mobileView === 'preview') || (!isMobile && store.isPreviewOpen)) && (
                <div className={`${isMobile ? 'w-full' : 'w-[50%]'} h-full shrink-0`}>
                  <LivePreview />
                </div>
              )}
            </div>
          </div>

          {/* TERMINAL & CONSOLE PANEL — desktop only (too cramped on mobile) */}
          {!isMobile && <TerminalConsole />}

        </div>

        {/* PANEL KANAN (AI Agents + AI Activity) — resizable */}
        {/* Drag handle — desktop only */}
        <div
          onMouseDown={startResize}
          className="hidden md:block w-1 bg-[#2b2d31] hover:bg-[#007acc] cursor-col-resize shrink-0 transition-colors active:bg-[#007acc]"
          title="Drag to resize panel"
          style={{ userSelect: 'none' }}
        />
        <div className={isMobile ? (mobileView === 'chat' ? 'flex w-full min-w-0' : 'hidden') : 'flex'}>
          <AgentSwarm width={isMobile ? Math.min(vpWidth, 900) : rightPanelWidth} />
        </div>
      </div>

      {/* --- IMPORT FROM GITHUB MODAL --- */}
      {store.isImportRepoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center font-sans">
          <div data-testid="import-repo-modal" className="w-[460px] bg-[#1c1c1c] border border-[#2b2d31] rounded-xl shadow-2xl p-6 text-zinc-300 relative">
            <button onClick={() => store.setImportRepoModalOpen(false)} className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-[#4ec9b0]" />
              <h2 className="text-[15px] font-semibold text-white">Import from GitHub</h2>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4">Clone a repo into your cloud workspace. Works on any device. Private repos use your connected GitHub account.</p>
            <label className="text-[12px] text-zinc-400 block mb-1.5">Repository URL or owner/repo</label>
            <input
              data-testid="import-repo-input"
              type="text"
              value={importRepoUrl}
              onChange={(e) => { setImportRepoUrl(e.target.value); setImportRepoError(''); }}
              placeholder="https://github.com/vercel/next.js  ·  or  vercel/next.js"
              className="w-full bg-[#2a2d2e] border border-[#2a2d2e] rounded text-white text-[13px] px-3 py-2 outline-none focus:border-[#007acc] placeholder:text-zinc-600"
            />
            {importRepoError && <p className="text-[11px] text-red-400 mt-2">{importRepoError}</p>}
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => store.setImportRepoModalOpen(false)} className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[13px] font-medium transition-colors cursor-pointer">Cancel</button>
              <button
                data-testid="import-repo-submit"
                disabled={importRepoBusy || !importRepoUrl.trim()}
                onClick={async () => {
                  setImportRepoBusy(true); setImportRepoError('');
                  const r = await store.cloneFromGitHub(importRepoUrl);
                  setImportRepoBusy(false);
                  if (r.ok) { store.setImportRepoModalOpen(false); setImportRepoUrl(''); }
                  else setImportRepoError(r.error || 'Clone failed');
                }}
                className="px-4 py-1.5 rounded bg-[#007acc] hover:bg-[#005f9e] text-white text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importRepoBusy ? 'Cloning…' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM TAB BAR — switch panels on small screens */}
      <nav className="md:hidden flex items-stretch h-[54px] bg-[#181818] border-t border-[#2b2d31] shrink-0 z-20 select-none">
        {([
          { key: 'chat', label: 'Chat', Icon: MessageSquare },
          { key: 'preview', label: 'Preview', Icon: Eye },
          { key: 'code', label: 'Code', Icon: Code2 },
          { key: 'files', label: 'Files', Icon: Files },
        ] as { key: MobileView; label: string; Icon: typeof Files }[]).map(({ key, label, Icon }) => (
          <button
            key={key}
            data-testid={`mobile-tab-${key}`}
            onClick={() => {
              setMobileView(key);
              if (key === 'files') { store.setActiveSidebarTab('explorer'); store.setIsExplorerOpen(true); }
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              mobileView === key ? 'text-[#4ec9b0] bg-[#1e1e1e]' : 'text-[#858585] hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={1.6} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* 3. STATUS BAR (Paling Bawah) — desktop only (cramped on mobile) */}
      <footer className="hidden md:flex h-[22px] bg-[#007acc] text-white items-center justify-between px-3 shrink-0 text-[11px] font-sans select-none z-10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 cursor-pointer hover:bg-white/20 px-1 rounded">
            <GitBranch className="w-3.5 h-3.5" />
            <span>{store.gitBranch}{store.gitChangedFiles.length > 0 ? '*' : ''}</span>
          </div>
          <div className="flex items-center space-x-1 cursor-pointer hover:bg-white/20 px-1 rounded">
            <RefreshCw className="w-3.5 h-3.5" onClick={() => store.checkStorageStatus()} />
          </div>
          <div className="flex items-center space-x-1 cursor-pointer hover:bg-white/20 px-1 rounded">
            <X className="w-3 h-3" /> {store.editorErrors}
            <AlertCircle className="w-3 h-3 ml-1" /> {store.editorWarnings}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="cursor-pointer hover:bg-white/20 px-1 rounded">Ln {store.editorLn}, Col {store.editorCol}</span>
          <span className="cursor-pointer hover:bg-white/20 px-1 rounded">Spaces: 2</span>
          <span className="cursor-pointer hover:bg-white/20 px-1 rounded">UTF-8</span>
          <span className="cursor-pointer hover:bg-white/20 px-1 rounded">LF</span>
          <span className="flex items-center cursor-pointer hover:bg-white/20 px-1 rounded">
            <Code2 className="w-3.5 h-3.5 mr-1" /> TypeScript React
          </span>
          <span className="flex items-center cursor-pointer hover:bg-white/20 px-1 rounded" title={store.memoryIndexSynced ? '0G vector index synced' : 'Vector index not built yet'}>
            <Database className="w-3.5 h-3.5 mr-1" />
            {store.memoryIndexSynced ? '0G Memory Synced' : '0G Memory Pending'}
          </span>
        </div>
      </footer>

      {/* --- CREATE PROJECT OVERLAY MODAL --- */}
      {store.isCreateProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center font-sans">
          <div 
            data-testid="create-project-modal"
            className="w-[450px] bg-[#1c1c1c] border border-[#2b2d31] rounded-xl shadow-2xl p-6 text-zinc-300 relative"
          >
            <button 
              onClick={() => store.setCreateProjectModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <Code2 className="w-5 h-5 mr-2 text-[#4ec9b0]" /> Create New Project
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-zinc-400 block mb-1.5">Parent Location</label>
                <input 
                  data-testid="modal-parent-path-input"
                  type="text" 
                  value={parentPathInput}
                  onChange={(e) => setParentPathInput(e.target.value)}
                  className="w-full bg-[#2a2d2e] border border-[#2a2d2e] rounded text-white text-[13px] px-3 py-2 outline-none focus:border-[#007acc]" 
                />
              </div>

              <div>
                <label className="text-[12px] text-zinc-400 block mb-1.5">Project Name</label>
                <input 
                  data-testid="modal-project-name-input"
                  type="text" 
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full bg-[#2a2d2e] border border-[#2a2d2e] rounded text-white text-[13px] px-3 py-2 outline-none focus:border-[#007acc]" 
                />
              </div>

              <div>
                <label className="text-[12px] text-zinc-400 block mb-1.5">Select Tech Template</label>
                <select 
                  data-testid="modal-template-select"
                  value={newProjTemplate}
                  onChange={(e) => setNewProjTemplate(e.target.value as any)}
                  className="w-full bg-[#2a2d2e] border border-[#2a2d2e] rounded text-white text-[13px] px-3 py-2 outline-none focus:border-[#007acc] cursor-pointer"
                >
                  <option value="react">Vite React App (TypeScript + Tailwind)</option>
                  <option value="rust">Rust Service (Cargo Enclave Sandbox)</option>
                  <option value="python">Python AI Agent Node (og-storage-sdk)</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] text-zinc-400 block mb-1.5">Describe your app <span className="text-zinc-600">(optional — helps pick a design)</span></label>
                <textarea
                  data-testid="modal-project-desc-input"
                  rows={2}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  placeholder="e.g. a crypto exchange dashboard with dark mode and trading charts"
                  className="w-full bg-[#2a2d2e] border border-[#2a2d2e] rounded text-white text-[13px] px-3 py-2 outline-none focus:border-[#007acc] resize-none placeholder:text-zinc-600"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-b border-[#2b2d31]">
                <span className="text-[12px] text-zinc-300">Use Hardware TEE Sandbox (Intel SGX)</span>
                <input type="checkbox" defaultChecked className="accent-[#007acc] w-4 h-4 cursor-pointer" />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => store.setCreateProjectModalOpen(false)}
                className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                data-testid="modal-create-project-btn"
                onClick={() => store.createNewProject(newProjName, newProjTemplate, parentPathInput, newProjDesc.trim() || newProjName)}
                className="px-4 py-1.5 rounded bg-[#007acc] hover:bg-[#005f9e] text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- OPEN FOLDER OVERLAY MODAL --- */}
      {isOpenFolderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center font-sans">
          <div 
            data-testid="open-folder-modal"
            className="w-[500px] bg-[#1c1c1c] border border-[#2b2d31] rounded-xl shadow-2xl p-6 text-zinc-300 relative"
          >
            <button 
              onClick={() => setOpenFolderModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <Files className="w-5 h-5 mr-2 text-[#569cd6]" /> Open Folder / Project
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-zinc-400 block mb-1.5">Selected Folder Path</label>
                <div className="flex space-x-2">
                  <input 
                    data-testid="modal-folder-path-input"
                    type="text" 
                    value={folderPathInput}
                    onChange={(e) => setFolderPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchDirectories(folderPathInput);
                      }
                    }}
                    className="flex-1 bg-[#2a2d2e] border border-[#2a2d2e] rounded text-white text-[13px] px-3 py-1.5 outline-none focus:border-[#007acc] font-mono" 
                  />
                  <button 
                    onClick={() => fetchDirectories(folderPathInput)}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[13px] border border-zinc-700 transition-colors cursor-pointer"
                  >
                    Go
                  </button>
                  <button 
                    onClick={handleOpenBrowserDialog}
                    className="px-3 py-1 bg-[#007acc] hover:bg-[#005f9e] text-white rounded text-[13px] transition-colors cursor-pointer flex items-center space-x-1 font-semibold"
                  >
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              {/* Folder Browser Grid */}
              <div className="border border-[#2b2d31] bg-[#151515] rounded-lg overflow-hidden flex flex-col h-[200px]">
                {/* Header/Parent Navigation */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#1e1e1e] border-b border-[#2b2d31] text-[11px]">
                  <span className="text-zinc-400 truncate max-w-[280px]">Directories in workspace</span>
                  {browseParentPath && browseParentPath !== browseCurrentPath && (
                    <button 
                      onClick={() => fetchDirectories(browseParentPath)}
                      className="text-[#569cd6] hover:text-sky-400 font-semibold cursor-pointer transition-colors"
                    >
                      Up to Parent (..)
                    </button>
                  )}
                </div>

                {/* Directories List */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {browseDirectories.length > 0 ? (
                    browseDirectories.map((dir, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setFolderPathInput(dir.path)}
                        onDoubleClick={() => fetchDirectories(dir.path)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors text-[13px] group ${
                          folderPathInput === dir.path 
                            ? 'bg-[#007acc] text-white' 
                            : 'hover:bg-[#2a2d2e] text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center">
                          {/* Folder Icon */}
                          <svg className="w-4 h-4 mr-2 shrink-0 text-[#e2c08d]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                          </svg>
                          <span className="truncate">{dir.name}</span>
                        </span>
                        <span className={`text-[10px] opacity-60 ${folderPathInput === dir.path ? 'text-sky-100' : 'text-zinc-500'}`}>Double-click to enter</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500 text-center py-12 text-xs italic">
                      No subdirectories found
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-zinc-500 leading-relaxed bg-[#252526] p-3 rounded border border-[#2d2d2d] flex items-start space-x-2">
                <span className="text-teal-400">💡</span>
                <span>Double-click any directory to browse inside. Select a directory and click **Open Folder** to load it into the IDE workspace.</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => setOpenFolderModalOpen(false)}
                className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                data-testid="modal-open-folder-btn"
                onClick={() => {
                  store.loadWorkspace(folderPathInput);
                  setOpenFolderModalOpen(false);
                }}
                className="px-4 py-1.5 rounded bg-[#007acc] hover:bg-[#005f9e] text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                Open Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- COMMAND PALETTE OVERLAY MODAL --- */}
      {store.isCommandPaletteOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center pt-24 font-sans">
          {/* Backdrop click to close */}
          <div className="absolute inset-0 z-0" onClick={() => store.setCommandPaletteOpen(false)}></div>
          
          <div 
            data-testid="command-palette-modal"
            className="w-[600px] max-h-[330px] bg-[#1c1c1c] border border-[#2b2d31] rounded-xl shadow-2xl overflow-hidden flex flex-col z-10"
          >
            {/* Search Input */}
            <div className="flex items-center border-b border-[#2b2d31] px-4 py-3 bg-[#151515]">
              <Search className="w-4 h-4 text-zinc-500 mr-3 shrink-0" />
              <input 
                data-testid="command-palette-input"
                type="text" 
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Type a command to execute..." 
                className="w-full bg-transparent text-white text-[14px] outline-none"
                autoFocus
              />
              <button 
                onClick={() => store.setCommandPaletteOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Commands List */}
            <div className="flex-1 overflow-y-auto py-1 text-[13px]">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((c, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      c.action();
                      store.setCommandPaletteOpen(false);
                      setCommandSearch('');
                    }}
                    className="w-full text-left px-5 py-2.5 text-zinc-300 hover:bg-[#007acc] hover:text-white transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] text-zinc-600 font-mono group-hover:text-white">active</span>
                  </button>
                ))
              ) : (
                <div className="text-zinc-500 text-center py-8">No commands found matching "{commandSearch}"</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CONNECT WALLET OVERLAY MODAL --- */}
      {store.isWalletModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center font-sans">
          <div 
            data-testid="connect-wallet-modal"
            className="w-[450px] bg-[#1c1c1c] border border-[#2b2d31] rounded-xl shadow-2xl p-6 text-zinc-300 relative"
          >
            <button 
              onClick={() => store.setWalletModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-[#e2c08d]" /> Connect Web3 Wallet
            </h2>

             <div className="space-y-4">
              <p className="text-[13px] text-zinc-400 leading-relaxed">
                Please select an option below to connect your Web3 identity and authorize ZYVA IDE to interact with the 0G Network:
              </p>

              {/* Option 1: MetaMask Connect */}
              <button 
                onClick={() => store.connectMetaMask()}
                className="w-full bg-[#2a2d2e] hover:bg-[#323537] border border-zinc-700 rounded-lg p-4 text-left transition-all flex items-center space-x-3 cursor-pointer"
              >
                <svg className="w-8 h-8 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 189">
                  <g fill="none" fillRule="evenodd">
                    <polygon fill="#CDBDB2" points="60.75 173.25 88.313 180.563 88.313 171 90.563 168.75 106.313 168.75 106.313 180 106.313 187.875 89.438 187.875 68.625 178.875"/>
                    <polygon fill="#CDBDB2" points="105.75 173.25 132.75 180.563 132.75 171 135 168.75 150.75 168.75 150.75 180 150.75 187.875 133.875 187.875 113.063 178.875" transform="matrix(-1 0 0 1 256.5 0)"/>
                    <polygon fill="#393939" points="90.563 152.438 88.313 171 91.125 168.75 120.375 168.75 123.75 171 121.5 152.438 117 149.625 94.5 150.188"/>
                    <polygon fill="#F89C35" points="75.375 27 88.875 58.5 95.063 150.188 117 150.188 123.75 58.5 136.125 27"/>
                    <polygon fill="#F89D35" points="16.313 96.188 .563 141.75 39.938 139.5 65.25 139.5 65.25 119.813 64.125 79.313 58.5 83.813"/>
                    <polygon fill="#D87C30" points="46.125 101.25 92.25 102.375 87.188 126 65.25 120.375"/>
                    <polygon fill="#EA8D3A" points="46.125 101.813 65.25 119.813 65.25 137.813"/>
                    <polygon fill="#F89D35" points="65.25 120.375 87.75 126 95.063 150.188 90 153 65.25 138.375"/>
                    <polygon fill="#EB8F35" points="65.25 138.375 60.75 173.25 90.563 152.438"/>
                    <polygon fill="#EA8E3A" points="92.25 102.375 95.063 150.188 86.625 125.719"/>
                    <polygon fill="#D87C30" points="39.375 138.938 65.25 138.375 60.75 173.25"/>
                    <polygon fill="#EB8F35" points="12.938 188.438 60.75 173.25 39.375 138.938 .563 141.75"/>
                    <polygon fill="#E8821E" points="88.875 58.5 64.688 78.75 46.125 101.25 92.25 102.938"/>
                    <polygon fill="#DFCEC3" points="60.75 173.25 90.563 152.438 88.313 170.438 88.313 180.563 68.063 176.625"/>
                    <polygon fill="#DFCEC3" points="121.5 173.25 150.75 152.438 148.5 170.438 148.5 180.563 128.25 176.625" transform="matrix(-1 0 0 1 272.25 0)"/>
                    <polygon fill="#393939" points="70.313 112.5 64.125 125.438 86.063 119.813" transform="matrix(-1 0 0 1 150.188 0)"/>
                    <polygon fill="#E88F35" points="12.375 .563 88.875 58.5 75.938 27"/>
                    <path fill="#8E5A30" d="M12.3750002,0.562500008 L2.25000003,31.5000005 L7.87500012,65.250001 L3.93750006,67.500001 L9.56250014,72.5625 L5.06250008,76.5000011 L11.25,82.1250012 L7.31250011,85.5000013 L16.3125002,96.7500014 L58.5000009,83.8125012 C79.1250012,67.3125004 89.2500013,58.8750003 88.8750013,58.5000009 C88.5000013,58.1250009 63.0000009,38.8125006 12.3750002,0.562500008 Z"/>
                    <g transform="matrix(-1 0 0 1 211.5 0)">
                      <polygon fill="#F89D35" points="16.313 96.188 .563 141.75 39.938 139.5 65.25 139.5 65.25 119.813 64.125 79.313 58.5 83.813"/>
                      <polygon fill="#D87C30" points="46.125 101.25 92.25 102.375 87.188 126 65.25 120.375"/>
                      <polygon fill="#EA8D3A" points="46.125 101.813 65.25 119.813 65.25 137.813"/>
                      <polygon fill="#F89D35" points="65.25 120.375 87.75 126 95.063 150.188 90 153 65.25 138.375"/>
                      <polygon fill="#EB8F35" points="65.25 138.375 60.75 173.25 90 153"/>
                      <polygon fill="#EA8E3A" points="92.25 102.375 95.063 150.188 86.625 125.719"/>
                      <polygon fill="#D87C30" points="39.375 138.938 65.25 138.375 60.75 173.25"/>
                      <polygon fill="#EB8F35" points="12.938 188.438 60.75 173.25 39.375 138.938 .563 141.75"/>
                      <polygon fill="#E8821E" points="88.875 58.5 64.688 78.75 46.125 101.25 92.25 102.938"/>
                      <polygon fill="#393939" points="70.313 112.5 64.125 125.438 86.063 119.813" transform="matrix(-1 0 0 1 150.188 0)"/>
                      <polygon fill="#E88F35" points="12.375 .563 88.875 58.5 75.938 27"/>
                      <path fill="#8E5A30" d="M12.3750002,0.562500008 L2.25000003,31.5000005 L7.87500012,65.250001 L3.93750006,67.500001 L9.56250014,72.5625 L5.06250008,76.5000011 L11.25,82.1250012 L7.31250011,85.5000013 L16.3125002,96.7500014 L58.5000009,83.8125012 C79.1250012,67.3125004 89.2500013,58.8750003 88.8750013,58.5000009 C88.5000013,58.1250009 63.0000009,38.8125006 12.3750002,0.562500008 Z"/>
                    </g>
                  </g>
                </svg>
                <div>
                  <div className="text-[13px] font-semibold text-white">Connect via MetaMask / Extension</div>
                  <div className="text-[11px] text-zinc-500">Connect using MetaMask browser wallet extension</div>
                </div>
              </button>

              {/* Option 2: Connect via Local test wallet key file */}
              <button 
                data-testid="connect-local-wallet-btn"
                onClick={() => store.connectWalletFallback()}
                className="w-full bg-[#2a2d2e] hover:bg-[#323537] border border-zinc-700 rounded-lg p-4 text-left transition-all flex items-center space-x-3 cursor-pointer"
              >
                <div className="w-8 h-8 rounded bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <circle cx="10" cy="13" r="2" />
                    <path d="m11.5 14.5 2.5 2.5 1-1" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Connect via Local Key File</div>
                  <div className="text-[11px] text-zinc-500">Auto-detect private key file in Documents and connect</div>
                </div>
              </button>

              {store.walletError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-[12px] flex items-start space-x-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{store.walletError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => store.setWalletModalOpen(false)}
                className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
