'use client';

import React, { useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useIdeStore } from '@/store/useIdeStore';
import { Code2, FolderOpen, Plus, ChevronRight } from 'lucide-react';
import { formatWithPrettier } from '@/lib/prettier-format';
import { REACT_SNIPPETS } from '@/lib/snippets';
import { THEME_FILE_MAP } from '@/lib/extensions-catalog';

export default function MonacoCodeEditor() {
  const activeFile = useIdeStore((state) => state.activeFile);
  const fileContents = useIdeStore((state) => state.fileContents);
  const projectPath = useIdeStore((state) => state.projectPath);
  const updateFileContent = useIdeStore((state) => state.updateFileContent);
  const setCreateProjectModalOpen = useIdeStore((state) => state.setCreateProjectModalOpen);
  const setEditorPosition = useIdeStore((state) => state.setEditorPosition);
  const setEditorDiagnostics = useIdeStore((state) => state.setEditorDiagnostics);
  const installedExtensions = useIdeStore((state) => state.installedExtensions);
  const activeTheme = useIdeStore((state) => state.activeTheme);

  // Load and apply monaco-themes when activeTheme changes
  useEffect(() => {
    if (activeTheme === 'zyvaDarkTheme') return; // built-in, no load needed
    const themeFile = THEME_FILE_MAP[activeTheme];
    if (!themeFile) return;
    import(`monaco-themes/themes/${themeFile}.json`).then((data) => {
      import('@monaco-editor/react').then(({ loader }) => {
        loader.init().then((monaco) => {
          monaco.editor.defineTheme(activeTheme, data as any);
          monaco.editor.setTheme(activeTheme);
        });
      });
    }).catch(() => {});
  }, [activeTheme]);

  // We need access to the setOpenFolderModal from page.tsx — we'll trigger via a custom event
  const handleOpenFolder = () => {
    window.dispatchEvent(new CustomEvent('zyva:openFolderModal'));
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile, value);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    // ── ZYVA dark theme ───────────────────────────────────────────────────
    monaco.editor.defineTheme('zyvaDarkTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'comment', foreground: '6a9955' },
        { token: 'tag', foreground: '569cd6' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editor.lineHighlightBackground': '#2d2d2d',
        'editorCursor.foreground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
      },
    });
    monaco.editor.setTheme(activeTheme === 'zyvaDarkTheme' ? 'zyvaDarkTheme' : activeTheme);

    // ── Real cursor position → status bar ────────────────────────────────
    editor.onDidChangeCursorPosition((e: any) => {
      setEditorPosition(e.position.lineNumber, e.position.column);
    });

    // ── Real diagnostics → status bar ────────────────────────────────────
    const updateDiagnostics = () => {
      const model = editor.getModel();
      if (!model) return;
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const errors = markers.filter((m: any) => m.severity === monaco.MarkerSeverity.Error).length;
      const warnings = markers.filter((m: any) => m.severity === monaco.MarkerSeverity.Warning).length;
      setEditorDiagnostics(errors, warnings);
    };
    monaco.editor.onDidChangeMarkers(updateDiagnostics);
    updateDiagnostics();

    // ── Bracket pair colorization (built-in Monaco option) ─────────────
    editor.updateOptions({ bracketPairColorization: { enabled: true } });

    // ── Prettier: format document provider ───────────────────────────────
    const prettierInstalled = installedExtensions.includes('prettier');
    if (prettierInstalled) {
      const langs = ['typescript', 'javascript', 'css', 'html', 'json', 'markdown'];
      langs.forEach((lang) => {
        monaco.languages.registerDocumentFormattingEditProvider(lang, {
          async provideDocumentFormattingEdits(model: any) {
            const filepath = model.uri.path || `file.${lang === 'typescript' ? 'tsx' : lang}`;
            const formatted = await formatWithPrettier(model.getValue(), filepath);
            return [{
              range: model.getFullModelRange(),
              text: formatted,
            }];
          },
        });
      });
      // Format on save: Shift+Alt+F
      editor.addCommand(
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        async () => {
          await editor.getAction('editor.action.formatDocument')?.run();
        },
      );
    }

    // ── React/TS Snippets ────────────────────────────────────────────────
    const snippetsInstalled = installedExtensions.includes('react-snippets');
    const snipsLangs = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
    snipsLangs.forEach((lang) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems(model: any, position: any) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          // Always show built-in snippets; show extra pack if installed
          const snippets = snippetsInstalled ? REACT_SNIPPETS : REACT_SNIPPETS.slice(0, 8);
          return {
            suggestions: snippets.map((s) => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: s.documentation,
              insertText: s.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            })),
          };
        },
      });
    });

    // ── Emmet ────────────────────────────────────────────────────────────
    if (installedExtensions.includes('emmet')) {
      import('emmet-monaco-es').then((mod) => {
        const emmetMonaco = mod.default ?? mod;
        if (typeof emmetMonaco.emmetHTML === 'function') emmetMonaco.emmetHTML(monaco);
        if (typeof emmetMonaco.emmetCSS === 'function') emmetMonaco.emmetCSS(monaco);
      }).catch(() => {});
    }
  };

  // No project open yet — show welcome screen
  if (!projectPath && !activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] overflow-auto">
        <div className="flex flex-col items-center text-center max-w-[480px] px-6 select-none">
          {/* Logo / Brand */}
          <div className="mb-8 relative">
            <div className="w-20 h-20 rounded-2xl bg-[#1c1c22] border border-zinc-800 flex items-center justify-center mb-4 mx-auto shadow-xl overflow-hidden">
              <img src="/logo.png" alt="ZYVA" className="w-14 h-14 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Welcome to ZYVA IDE</h1>
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              AI-powered development environment for the 0G Network
            </p>
          </div>

          {/* Action Cards */}
          <div className="w-full space-y-3 mb-8">
            <button
              data-testid="welcome-create-project-btn"
              onClick={() => setCreateProjectModalOpen(true)}
              className="w-full flex items-center justify-between bg-[#007acc]/10 hover:bg-[#007acc]/20 border border-[#007acc]/40 hover:border-[#007acc]/70 rounded-xl px-5 py-4 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-[#007acc]/20 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5 text-[#007acc]" />
                </div>
                <div className="text-left">
                  <div className="text-[14px] font-semibold text-white">Create New Project</div>
                  <div className="text-[12px] text-zinc-500">Start fresh with React, Rust, or Python templates</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#007acc] transition-colors shrink-0" />
            </button>

            <button
              data-testid="welcome-open-folder-btn"
              onClick={handleOpenFolder}
              className="w-full flex items-center justify-between bg-[#2a2d2e]/80 hover:bg-[#323537] border border-zinc-700/60 hover:border-zinc-600 rounded-xl px-5 py-4 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-[#4ec9b0]/10 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5 text-[#4ec9b0]" />
                </div>
                <div className="text-left">
                  <div className="text-[14px] font-semibold text-white">Open Folder</div>
                  <div className="text-[12px] text-zinc-500">Open an existing project folder from your computer</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#4ec9b0] transition-colors shrink-0" />
            </button>
          </div>

          {/* Keyboard shortcut hints */}
          <div className="flex items-center space-x-5 text-[11px] text-zinc-600">
            <span>
              <kbd className="font-mono bg-[#2b2d31] px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-700">Ctrl+Shift+P</kbd>
              <span className="ml-2">Command Palette</span>
            </span>
            <span className="text-zinc-700">|</span>
            <span>
              <kbd className="font-mono bg-[#2b2d31] px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-700">Ctrl+N</kbd>
              <span className="ml-2">New Chat</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Project is open but no file selected
  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 bg-[#1e1e1e]">
        <div className="text-center select-none">
          <Code2 className="w-16 h-16 opacity-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm text-zinc-600">Select a file from the explorer to open</p>
        </div>
      </div>
    );
  }

  // Get extension to map language in monaco
  const extension = activeFile.split('.').pop() || '';
  let language = 'javascript';
  if (extension === 'tsx' || extension === 'ts') language = 'typescript';
  else if (extension === 'rs') language = 'rust';
  else if (extension === 'py') language = 'python';
  else if (extension === 'json') language = 'json';
  else if (extension === 'md') language = 'markdown';
  else if (extension === 'toml') language = 'toml';
  else if (extension === 'css') language = 'css';
  else if (extension === 'html') language = 'html';

  return (
    <div className="flex-1 w-full h-full overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={fileContents[activeFile] || ''}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          minimap: { enabled: false },
          lineHeight: 22,
          padding: { top: 8, bottom: 8 },
          tabSize: 2,
          insertSpaces: true,
          cursorBlinking: 'smooth',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          selectOnLineNumbers: true,
          selectionHighlight: true,
          occurrencesHighlight: "singleFile",
        }}
      />
    </div>
  );
}
