'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIdeStore } from '@/store/useIdeStore';
import { ArrowLeft, ArrowRight, RotateCw, Monitor, Smartphone, Globe, ShieldAlert } from 'lucide-react';

/**
 * LivePreview — renders React TSX code in a sandboxed iframe.
 *
 * Strategy:
 * 1. Find the entry file (App.tsx or active file)
 * 2. Resolve all local imports from fileContents
 * 3. Transpile TSX → JS using Babel Standalone (loaded in iframe)
 * 4. Render with React + ReactDOM CDN in the iframe
 */
export default function LivePreview() {
  const activeFile = useIdeStore((state) => state.activeFile);
  const fileContents = useIdeStore((state) => state.fileContents);

  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [urlAddress, setUrlAddress] = useState<string>('http://localhost:5173/');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build a module map from workspace files
  const buildModuleMap = useCallback((): Record<string, string> => {
    const moduleMap: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(fileContents)) {
      if (!content) continue;
      // Normalize path keys: remove leading ./ and extensions
      const normalized = filePath
        .replace(/^\.\//, '')
        .replace(/\.(tsx|ts|jsx|js)$/, '');
      moduleMap[normalized] = content;
      // Also store with full extension
      moduleMap[filePath.replace(/^\.\//, '')] = content;
    }
    return moduleMap;
  }, [fileContents]);

  // Find the best entry file for preview
  const findEntryFile = useCallback((): string | null => {
    const keys = Object.keys(fileContents);
    
    // Priority order for entry points
    const candidates = [
      keys.find(k => k === 'src/App.tsx' || k === 'src/App.jsx'),
      keys.find(k => k.endsWith('/App.tsx') || k.endsWith('/App.jsx')),
      activeFile && (activeFile.endsWith('.tsx') || activeFile.endsWith('.jsx')) ? activeFile : null,
      keys.find(k => k.endsWith('page.tsx')),
      keys.find(k => k.endsWith('.tsx') || k.endsWith('.jsx')),
    ];

    return candidates.find(Boolean) || null;
  }, [fileContents, activeFile]);

  // Generate the full iframe HTML document
  const generateIframeDoc = useCallback((): string => {
    const entryFile = findEntryFile();
    if (!entryFile) {
      return `<!DOCTYPE html><html><head><style>body{margin:0;background:#0d0e12;color:#666;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;}</style></head><body><div>No previewable React files found</div></body></html>`;
    }

    const moduleMap = buildModuleMap();

    // Collect all modules into a JSON-safe string, escaping HTML characters to prevent breaking the inline <script> tag
    const modulesJson = JSON.stringify(moduleMap).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

    setUrlAddress(`http://localhost:5173/${entryFile.replace('src/', '')}`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #0d0e12; color: #ffffff; }
    #root { min-height: 100vh; }
    /* Tailwind-like utility reset for common classes */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .p-4 { padding: 16px; }
    .p-6 { padding: 24px; }
    .p-8 { padding: 32px; }
    .px-4 { padding-left: 16px; padding-right: 16px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .m-0 { margin: 0; }
    .mb-4 { margin-bottom: 16px; }
    .text-center { text-align: center; }
    .text-white { color: #ffffff; }
    .text-sm { font-size: 14px; }
    .text-lg { font-size: 18px; }
    .text-xl { font-size: 20px; }
    .text-2xl { font-size: 24px; }
    .text-3xl { font-size: 30px; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .rounded { border-radius: 6px; }
    .rounded-lg { border-radius: 8px; }
    .rounded-xl { border-radius: 12px; }
    .min-h-screen { min-height: 100vh; }
    .w-full { width: 100%; }
    .max-w-md { max-width: 28rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .space-y-4 > * + * { margin-top: 16px; }
    .space-x-2 > * + * { margin-left: 8px; }
    .grid { display: grid; }
    .overflow-hidden { overflow: hidden; }
    .cursor-pointer { cursor: pointer; }
    .transition-all { transition: all 0.2s; }
    .border { border: 1px solid rgba(255,255,255,0.1); }
    .border-none { border: none; }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); }
    /* Error display */
    .preview-error { color: #f87171; background: #1c1917; border: 1px solid #991b1b; border-radius: 8px; padding: 16px; margin: 16px; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
    .preview-error h3 { color: #fca5a5; margin: 0 0 8px; font-size: 14px; }
  </style>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
  (function() {
    try {
      var MODULES = ${modulesJson};
      var moduleCache = {};

      // Simple require/import resolver
      function resolveModule(importPath, fromFile) {
        // Strip leading ./ or ../
        var cleanPath = importPath.replace(/^\\.\\//g, '').replace(/\\.\\.\\//g, '');
        
        // If importing from a file in src/, resolve relative
        if (fromFile && fromFile.startsWith('src/') && importPath.startsWith('./')) {
          var dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
          cleanPath = dir + '/' + importPath.replace('./', '');
        } else if (importPath.startsWith('./')) {
          cleanPath = 'src/' + importPath.replace('./', '');
        }

        // Try various paths
        var attempts = [
          cleanPath,
          cleanPath.replace(/\\.(tsx|ts|jsx|js)$/, ''),
          'src/' + cleanPath,
          'src/' + cleanPath.replace(/\\.(tsx|ts|jsx|js)$/, ''),
        ];

        for (var i = 0; i < attempts.length; i++) {
          var p = attempts[i];
          if (MODULES[p]) return { path: p, code: MODULES[p] };
          if (MODULES[p + '.tsx']) return { path: p + '.tsx', code: MODULES[p + '.tsx'] };
          if (MODULES[p + '.ts']) return { path: p + '.ts', code: MODULES[p + '.ts'] };
          if (MODULES[p + '.jsx']) return { path: p + '.jsx', code: MODULES[p + '.jsx'] };
          if (MODULES[p + '.js']) return { path: p + '.js', code: MODULES[p + '.js'] };
          if (MODULES[p + '.css']) return { path: p + '.css', code: MODULES[p + '.css'] };
          // Try index files
          if (MODULES[p + '/index.tsx']) return { path: p + '/index.tsx', code: MODULES[p + '/index.tsx'] };
          if (MODULES[p + '/index.ts']) return { path: p + '/index.ts', code: MODULES[p + '/index.ts'] };
        }
        return null;
      }

      // Transpile and execute a module, return its exports
      function requireModule(modulePath, fromFile) {
        // External packages -> return stubs
        if (!modulePath.startsWith('.') && !modulePath.startsWith('src/')) {
          if (modulePath === 'react') return window.React;
          if (modulePath === 'react-dom') return window.ReactDOM;
          if (modulePath === 'react-dom/client') return window.ReactDOM;
          if (modulePath === 'framer-motion') return window.Motion || {}; // if motion is loaded
          if (modulePath === 'lucide-react') return window.Lucide || new Proxy({}, { get: function() { return function() { return null; } } });
          return {};
        }

        var resolved = resolveModule(modulePath, fromFile);
        if (!resolved) {
          console.warn('[LivePreview] Module not found:', modulePath, 'from', fromFile);
          return {};
        }

        if (moduleCache[resolved.path]) return moduleCache[resolved.path].exports;

        var module = { exports: {} };
        moduleCache[resolved.path] = module;

        // If it's a CSS file, inject it as a style tag
        if (resolved.path.endsWith('.css')) {
          var style = document.createElement('style');
          style.innerHTML = resolved.code;
          document.head.appendChild(style);
          return module.exports;
        }

        try {
          // Transpile with Babel. Force TS+TSX parsing because resolved module
          // paths may not carry a .tsx extension, which would otherwise leave
          // interfaces, type annotations and generics intact and crash at runtime.
          var transpiled = Babel.transform(resolved.code, {
            presets: [
              'env',
              'react',
              ['typescript', { isTSX: true, allExtensions: true, allowDeclareFields: true }],
            ],
            filename: resolved.path,
          }).code;

          // Execute in a CommonJS wrapper scope
          var fn = new Function('module', 'exports', 'require', 'React', 'ReactDOM', transpiled);
          
          fn(
            module,
            module.exports,
            function(path) { return requireModule(path, resolved.path); },
            window.React,
            window.ReactDOM
          );

          module.exports.__transpiled = transpiled;
          return module.exports;

        } catch(e) {
          console.error('[LivePreview] Error transpiling', resolved.path, ':', e.message);
          module.exports = { __error: e.message, __path: resolved.path };
          return module.exports;
        }
      }

      // Global require function
      window.__require = requireModule;

      // Find and render the App component
      var entryPath = '${entryFile}';
      var appModule = requireModule(entryPath, '');

      var AppComponent = appModule["default"] || appModule.App || appModule[Object.keys(appModule).find(function(k) { return typeof appModule[k] === 'function'; }) || ''];

      if (AppComponent && typeof AppComponent === 'function') {
        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(AppComponent));
      } else if (appModule.__error) {
        document.getElementById('root').innerHTML = '<div class="preview-error"><h3>⚠ Transpilation Error in ' + (appModule.__path || entryPath) + '</h3>' + appModule.__error + '</div>';
      } else {
        document.getElementById('root').innerHTML = '<div class="preview-error" style="height:100%;overflow:auto"><h3>⚠ No React component exported</h3>Entry file: ' + entryPath + '<br/>Exported keys: ' + Object.keys(appModule).join(', ') + '<br/><br/><b>Transpiled Code:</b><pre>' + (appModule.__transpiled || 'none').replace(/</g, '&lt;') + '</pre></div>';
      }

    } catch(e) {
      document.getElementById('root').innerHTML = '<div class="preview-error"><h3>⚠ Preview Runtime Error</h3>' + e.message + '<br/><br/>' + (e.stack || '').substring(0, 500) + '</div>';
    }
  })();
  </script>
</body>
</html>`;
  }, [findEntryFile, buildModuleMap]);

  // Update iframe whenever code changes
  useEffect(() => {
    const doc = generateIframeDoc();
    const iframe = iframeRef.current;
    if (iframe) {
      // Use srcdoc for sandboxed rendering
      iframe.srcdoc = doc;
    }
  }, [generateIframeDoc]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[#141517] border-l border-[#2b2d31] overflow-hidden select-none">
      {/* Browser Navbar mockup */}
      <div className="h-10 shrink-0 bg-[#1e2022] border-b border-[#2b2d31] flex items-center justify-between px-3 gap-3">
        {/* Controls */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button className="w-6 h-6 rounded hover:bg-[#2e3032] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button className="w-6 h-6 rounded hover:bg-[#2e3032] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              const iframe = iframeRef.current;
              if (iframe) iframe.srcdoc = generateIframeDoc();
            }}
            className="w-6 h-6 rounded hover:bg-[#2e3032] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Address Bar */}
        <div className="flex-1 max-w-lg h-6.5 bg-[#0f1011] border border-zinc-800 rounded-md flex items-center px-2.5 text-[11px] text-zinc-400 font-mono gap-1.5 select-all overflow-hidden truncate">
          <Globe className="w-3 h-3 text-[#34d399] shrink-0" />
          <span>{urlAddress}</span>
        </div>

        {/* Device Controls & Info */}
        <div className="flex items-center space-x-1 shrink-0">
          <button 
            onClick={() => setDeviceMode('desktop')}
            className={`w-6.5 h-6.5 rounded flex items-center justify-center cursor-pointer transition-colors ${deviceMode === 'desktop' ? 'bg-[#007acc] text-white' : 'text-zinc-400 hover:bg-[#2e3032] hover:text-white'}`}
            title="Desktop Mode"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setDeviceMode('mobile')}
            className={`w-6.5 h-6.5 rounded flex items-center justify-center cursor-pointer transition-colors ${deviceMode === 'mobile' ? 'bg-[#007acc] text-white' : 'text-zinc-400 hover:bg-[#2e3032] hover:text-white'}`}
            title="Mobile Portrait"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Render Canvas Container */}
      <div className="flex-1 bg-[#090a0b] overflow-auto flex items-center justify-center p-0">
        <iframe 
          ref={iframeRef}
          data-testid="live-preview-iframe"
          sandbox="allow-scripts allow-same-origin"
          className="bg-[#0d0e12] border-0"
          style={{
            width: deviceMode === 'desktop' ? '100%' : '375px',
            height: '100%',
            maxWidth: deviceMode === 'desktop' ? '100%' : '375px',
          }}
          title="ZYVA Live Preview"
        />
      </div>

      {/* Secure TEE attest overlay banner */}
      <div className="h-6 shrink-0 bg-[#007acc]/10 border-t border-[#007acc]/20 px-3 flex items-center justify-between text-[9px] text-[#007acc] font-semibold">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
          0G Storage Dev Server Online
        </span>
        <span>Local Web Sandbox (Intel SGX)</span>
      </div>
    </div>
  );
}
