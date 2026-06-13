'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIdeStore } from '@/store/useIdeStore';
import {
  ArrowLeft, ArrowRight, RotateCw, Monitor, Smartphone,
  Globe, ExternalLink, Loader2, Play, X,
} from 'lucide-react';

/**
 * LivePreview — WebContainer-powered live preview with resizable frame.
 *
 * Split preview: WebContainer in-browser (free, no cold start).
 * "Open in Browser": E2B sandbox with real URL in new tab.
 * Resizable: drag the frame handle to go full/partial width.
 */

// ── WebContainer singleton ────────────────────────────────────────────────────
let wcInstance: any = null;
let wcReady = false;
let wcBootPromise: Promise<any> | null = null;
let wcMountedProject = ''; // which project's files are currently mounted

async function getWebContainer() {
  if (wcInstance && wcReady) return wcInstance;
  if (wcBootPromise) return wcBootPromise;
  // Dynamic import so server bundle stays clean
  wcBootPromise = (async () => {
    const { WebContainer } = await import('@webcontainer/api');
    wcInstance = await WebContainer.boot();
    wcReady = true;
    return wcInstance;
  })();
  try {
    return await wcBootPromise;
  } finally {
    wcBootPromise = null;
  }
}

/** Fully tear down the WebContainer so the next boot starts from a clean slate. */
function resetWebContainer() {
  if (wcInstance) {
    try { wcInstance.teardown(); } catch { /* ignore */ }
  }
  wcInstance = null;
  wcReady = false;
  wcBootPromise = null;
  wcMountedProject = '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildWCFiles(fileContents: Record<string, string>) {
  const files: Record<string, any> = {};

  for (const [path, content] of Object.entries(fileContents)) {
    if (!content) continue;
    const parts = path.split('/');
    let node = files;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { directory: {} };
      node = node[parts[i]].directory;
    }
    node[parts[parts.length - 1]] = { file: { contents: content } };
  }

  // Ensure package.json has a dev script if missing
  if (!files['package.json']) {
    files['package.json'] = {
      file: {
        contents: JSON.stringify({
          name: 'zyva-preview',
          type: 'module',
          scripts: { dev: 'vite --port 3000 --host' },
          dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
          devDependencies: {
            '@vitejs/plugin-react': '^4.3.1',
            typescript: '^5.2.2',
            vite: '^5.3.1',
          },
        }, null, 2),
      },
    };
  }

  // vite.config.ts
  if (!files['vite.config.ts'] && !files['vite.config.js']) {
    files['vite.config.ts'] = {
      file: {
        contents: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { port: 3000, host: true } });`,
      },
    };
  }

  // index.html entry
  if (!files['index.html']) {
    files['index.html'] = {
      file: {
        contents: `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>ZYVA Preview</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
      },
    };
  }

  // ── Safety net: stub any imported CSS that doesn't exist ──────────────────
  // The model sometimes writes `import './styles.css'` without creating the file.
  // An unresolved import makes Vite fail → blank preview. Create empty stubs.
  const addStub = (relPath: string) => {
    const parts = relPath.split('/').filter(p => p && p !== '.');
    let node = files;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || !node[parts[i]].directory) node[parts[i]] = { directory: {} };
      node = node[parts[i]].directory;
    }
    const leaf = parts[parts.length - 1];
    if (!node[leaf]) node[leaf] = { file: { contents: '' } };
  };
  const cssImportRe = /(?:import\s+['"]|from\s+['"])(\.[^'"]+\.css)['"]/g;
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (!content || !/\.(tsx?|jsx?)$/.test(filePath)) continue;
    const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
    let m: RegExpExecArray | null;
    while ((m = cssImportRe.exec(content)) !== null) {
      // resolve relative import against the importing file's directory
      const segs = (dir ? dir.split('/') : []).concat(m[1].split('/'));
      const resolved: string[] = [];
      for (const s of segs) {
        if (s === '' || s === '.') continue;
        if (s === '..') resolved.pop();
        else resolved.push(s);
      }
      const cssPath = resolved.join('/');
      if (!fileContents[cssPath]) addStub(cssPath);
    }
  }

  return files;
}
export default function LivePreview() {
  const fileContents = useIdeStore(s => s.fileContents);
  const projectPath = useIdeStore(s => s.projectPath);

  const [status, setStatus] = useState<'idle' | 'booting' | 'installing' | 'starting' | 'ready' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [urlBar, setUrlBar] = useState('http://localhost:3000/');
  const [e2bLoading, setE2bLoading] = useState(false);
  const [e2bUrl, setE2bUrl] = useState('');

  // Resizable frame width (as %)
  const [frameWidth, setFrameWidth] = useState(100);
  const isResizingFrame = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startedRef = useRef(false);
  // Which project the WebContainer currently holds — reset preview when it changes.
  const mountedProjectRef = useRef<string>('');

  // ── Reset preview when the active project changes (fresh remount) ──────────
  useEffect(() => {
    if (mountedProjectRef.current === projectPath) return;
    // Project switched (or first load) — tear down stale container + state.
    if (mountedProjectRef.current !== '') {
      resetWebContainer();
      startedRef.current = false;
      setStatus('idle');
      setPreviewUrl('');
      setErrorMsg('');
    }
    mountedProjectRef.current = projectPath;
  }, [projectPath]);

  // E2B preview sandbox tracking — kill on tab close / unmount.
  const e2bSandboxId = useRef<string>('');
  const e2bPopup = useRef<Window | null>(null);
  const e2bPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const killE2bSandbox = useCallback((useBeacon = false) => {
    const id = e2bSandboxId.current;
    if (!id) return;
    e2bSandboxId.current = '';
    setE2bUrl('');
    if (e2bPollTimer.current) { clearInterval(e2bPollTimer.current); e2bPollTimer.current = null; }
    const payload = JSON.stringify({ action: 'kill', sandboxId: id });
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/sandbox', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  }, []);

  // Kill the sandbox if the IDE tab/window is closed, and on unmount.
  useEffect(() => {
    const onHide = () => killE2bSandbox(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      killE2bSandbox(true);
    };
  }, [killE2bSandbox]);

  // ── WebContainer boot + start ────────────────────────────────────────────
  const startPreview = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus('booting');
    setErrorMsg('');

    try {
      // If a container is mounted for a different project, tear it down first
      // so we never serve a previous project's files (e.g. the starter template).
      if (wcMountedProject && wcMountedProject !== projectPath) {
        resetWebContainer();
      }

      const wc = await getWebContainer();
      setStatus('installing');

      // Mount files fresh for this project
      const files = buildWCFiles(fileContents);
      await wc.mount(files);
      wcMountedProject = projectPath;

      // npm install
      const install = await wc.spawn('npm', ['install', '--prefer-offline']);
      const installExit = await install.exit;
      if (installExit !== 0) {
        setStatus('error');
        setErrorMsg('npm install failed. Check package.json.');
        return;
      }

      setStatus('starting');

      // npm run dev
      const dev = await wc.spawn('npm', ['run', 'dev']);

      // Wait for server-ready
      wc.on('server-ready', (_port: number, url: string) => {
        setPreviewUrl(url);
        setUrlBar(url);
        setStatus('ready');
      });

      // Stream stderr for errors
      dev.output.pipeTo(new WritableStream({
        write(chunk) {
          if (chunk.includes('error') || chunk.includes('Error')) {
            console.warn('[ZYVA Sandbox]', chunk);
          }
        },
      }));
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'ZYVA Sandbox failed to start');
      startedRef.current = false;
    }
  }, [fileContents, projectPath]);

  // ── Sync file changes to running WebContainer ───────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !wcInstance) return;
    // Write changed files on every update
    (async () => {
      try {
        for (const [path, content] of Object.entries(fileContents)) {
          if (!content) continue;
          await wcInstance.fs.writeFile(path, content);
        }
      } catch { /* non-fatal */ }
    })();
  }, [fileContents, status]);

  // ── Frame resize drag ────────────────────────────────────────────────────
  const startFrameResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingFrame.current = true;
    const startX = e.clientX;
    const startW = frameWidth;
    const containerW = containerRef.current?.offsetWidth || 800;

    const onMove = (ev: MouseEvent) => {
      if (!isResizingFrame.current) return;
      const delta = ev.clientX - startX;
      const newPct = Math.min(100, Math.max(30, startW + (delta / containerW) * 100));
      setFrameWidth(newPct);
    };
    const onUp = () => {
      isResizingFrame.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [frameWidth]);

  // ── E2B "Open in Browser" ────────────────────────────────────────────────
  const openInBrowser = useCallback(async () => {
    if (e2bUrl && e2bSandboxId.current) { e2bPopup.current = window.open(e2bUrl, '_blank'); return; }
    setE2bLoading(true);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', files: fileContents }),
      });
      const data = await res.json();
      if (data.url) {
        setE2bUrl(data.url);
        if (data.sandboxId) e2bSandboxId.current = data.sandboxId;
        const popup = window.open(data.url, '_blank');
        e2bPopup.current = popup;
        // When the user closes the E2B tab, kill the sandbox immediately.
        if (popup) {
          if (e2bPollTimer.current) clearInterval(e2bPollTimer.current);
          e2bPollTimer.current = setInterval(() => {
            if (e2bPopup.current && e2bPopup.current.closed) killE2bSandbox();
          }, 2000);
        }
      } else {
        // Fallback: open WebContainer URL in new tab (same-origin only)
        if (previewUrl) window.open(previewUrl, '_blank');
      }
    } catch {
      if (previewUrl) window.open(previewUrl, '_blank');
    } finally {
      setE2bLoading(false);
    }
  }, [fileContents, previewUrl, e2bUrl, killE2bSandbox]);

  const statusLabel: Record<typeof status, string> = {
    idle: 'Click Run to start preview',
    booting: 'Starting ZYVA Sandbox…',
    installing: 'Installing packages…',
    starting: 'Starting dev server…',
    ready: '',
    error: errorMsg || 'Error',
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full flex flex-col bg-[#141517] border-l border-[#2b2d31] overflow-hidden select-none"
    >
      {/* Browser toolbar */}
      <div className="h-10 shrink-0 bg-[#1e2022] border-b border-[#2b2d31] flex items-center px-3 gap-2">
        {/* Back/Forward/Reload */}
        <div className="flex items-center gap-1 shrink-0">
          <button className="w-6 h-6 rounded hover:bg-[#2e3032] flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button className="w-6 h-6 rounded hover:bg-[#2e3032] flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer">
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (iframeRef.current && previewUrl) iframeRef.current.src = previewUrl; }}
            className="w-6 h-6 rounded hover:bg-[#2e3032] flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* URL bar */}
        <div className="flex-1 h-6 bg-[#0f1011] border border-zinc-800 rounded-md flex items-center px-2.5 text-[11px] text-zinc-400 font-mono gap-1.5 truncate">
          <Globe className="w-3 h-3 text-[#34d399] shrink-0" />
          <span className="truncate">{urlBar}</span>
        </div>

        {/* Run / status */}
        {status === 'idle' && (
          <button
            onClick={startPreview}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#007acc] hover:bg-[#005f9e] text-white text-[11px] font-bold rounded-lg cursor-pointer shrink-0"
          >
            <Play className="w-3 h-3" /> Run
          </button>
        )}
        {(status === 'booting' || status === 'installing' || status === 'starting') && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-400 shrink-0">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{statusLabel[status]}</span>
          </div>
        )}

        {/* Device mode */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${deviceMode === 'desktop' ? 'bg-[#007acc] text-white' : 'text-zinc-500 hover:bg-[#2e3032] hover:text-white'}`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${deviceMode === 'mobile' ? 'bg-[#007acc] text-white' : 'text-zinc-500 hover:bg-[#2e3032] hover:text-white'}`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Open in browser */}
        <button
          onClick={openInBrowser}
          disabled={e2bLoading}
          title="Open full preview in new tab (E2B sandbox)"
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg cursor-pointer transition-colors shrink-0 disabled:opacity-50"
        >
          {e2bLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
          <span>Open</span>
        </button>
      </div>

      {/* Preview area with resizable frame */}
      <div className="flex-1 bg-[#090a0b] overflow-hidden flex items-start justify-center relative">
        {status === 'idle' && (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-zinc-600 gap-3">
            <Play className="w-8 h-8 opacity-30" />
            <p className="text-[13px]">Click <strong className="text-zinc-500">Run</strong> to start the ZYVA Sandbox preview</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center gap-3">
            <X className="w-8 h-8 text-red-500 opacity-50" />
            <p className="text-[13px] text-red-400">{errorMsg}</p>
            <button
              onClick={() => { startedRef.current = false; startPreview(); }}
              className="px-4 py-2 bg-[#2a2d2e] hover:bg-[#3c3c3c] text-zinc-300 text-[12px] rounded-lg cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {(status === 'booting' || status === 'installing' || status === 'starting') && (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-[#007acc] animate-spin" />
            <div className="text-center">
              <p className="text-[14px] text-zinc-300 font-medium">{statusLabel[status]}</p>
              {status === 'installing' && (
                <p className="text-[12px] text-zinc-600 mt-1">This only happens once per session</p>
              )}
            </div>
          </div>
        )}

        {status === 'ready' && previewUrl && (
          <div className="h-full flex items-start" style={{ width: `${frameWidth}%` }}>
            {/* Resize handle on left edge */}
            <div
              onMouseDown={startFrameResize}
              className="w-1.5 h-full bg-transparent hover:bg-[#007acc]/40 cursor-ew-resize shrink-0 transition-colors"
              title="Drag to resize preview"
            />
            <iframe
              ref={iframeRef}
              src={previewUrl}
              data-testid="live-preview-iframe"
              className="flex-1 h-full border-0 bg-white"
              style={{
                width: deviceMode === 'mobile' ? '375px' : '100%',
                maxWidth: deviceMode === 'mobile' ? '375px' : '100%',
              }}
              title="ZYVA Live Preview"
              allow="cross-origin-isolated"
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 shrink-0 bg-[#007acc]/10 border-t border-[#007acc]/20 px-3 flex items-center justify-between text-[9px] text-[#007acc] font-semibold">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'ready' ? 'bg-[#34d399] animate-pulse' : 'bg-zinc-600'}`} />
          {status === 'ready' ? 'ZYVA Sandbox Online' : statusLabel[status] || 'ZYVA Sandbox'}
        </span>
        <span className="flex items-center gap-2">
          {frameWidth < 100 && (
            <button
              onClick={() => setFrameWidth(100)}
              className="text-[9px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              Full width
            </button>
          )}
          <span>ZYVA Runtime</span>
        </span>
      </div>
    </div>
  );
}
