import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { writeFileSafe } from '@/engine/patch/patchEngine';
import { indexFiles } from '@/engine/retrieval';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
}

// Ignore list to keep scans fast and clean
const IGNORE_LIST = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'out',
  '.vercel',
  '.idea',
  '.vscode',
  'test-results',
  'playwright-report'
]);

const EDITABLE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'rs', 'py', 'txt', 'md', 'css', 'html', 'toml', 'gitignore',
  'mjs', 'cjs', 'yaml', 'yml', 'config', 'sh', 'bat', 'cmd'
]);

function buildFileTree(dirPath: string, rootPath: string): FileNode[] {
  try {
    const items = fs.readdirSync(dirPath);
    const nodes: FileNode[] = [];

    for (const item of items) {
      if (IGNORE_LIST.has(item)) continue;

      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        nodes.push({
          name: item,
          type: 'folder',
          path: relativePath,
          children: buildFileTree(fullPath, rootPath)
        });
      } else {
        nodes.push({
          name: item,
          type: 'file',
          path: relativePath
        });
      }
    }

    // Sort folders first, then files
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error building file tree:', error);
    return [];
  }
}

function readFileContents(dirPath: string, rootPath: string, contents: Record<string, string>) {
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      if (IGNORE_LIST.has(item)) continue;

      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        readFileContents(fullPath, rootPath, contents);
      } else {
        const ext = item.split('.').pop() || '';
        if (EDITABLE_EXTENSIONS.has(ext.toLowerCase())) {
          const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          contents[relativePath] = fileContent;
        }
      }
    }
  } catch (error) {
    console.error('Error reading file contents:', error);
  }
}

export interface VectorDbEntry {
  path: string;
  content: string;
  embeddings: number[];
  timestamp: string;
}

export function generateEmbedding(text: string): number[] {
  const dimensions = 16;
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\W+/);
  
  const features = [
    'ui', 'component', 'button', 'card', 'sidebar', 'page', 'dashboard', 'api',
    'state', 'click', 'style', 'data', 'rust', 'python', 'import', 'main'
  ];
  
  for (const word of words) {
    if (!word) continue;
    const featIdx = features.indexOf(word);
    if (featIdx !== -1) {
      vector[featIdx] += 2.0;
    }
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;
  }
  
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= magnitude;
    }
  }
  return vector;
}

export function updateVectorDb(projectPath: string, filePath: string, content: string) {
  try {
    const zyvaDir = path.join(projectPath, '.zyva');
    if (!fs.existsSync(zyvaDir)) {
      fs.mkdirSync(zyvaDir, { recursive: true });
    }
    const dbPath = path.join(zyvaDir, '0g_vector_db.json');
    let db: Record<string, VectorDbEntry> = {};
    if (fs.existsSync(dbPath)) {
      try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      } catch (e) {
        db = {};
      }
    }
    
    const relPath = path.relative(projectPath, filePath).replace(/\\/g, '/');
    db[relPath] = {
      path: relPath,
      content,
      embeddings: generateEmbedding(content),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to update 0G vector memory:', err);
  }
}


const TEMPLATE_FILES = {
  react: {
    'package.json': `{
  "name": "zyva-react-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}`,
    'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}`,
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZYVA React App</title>
    <style>
      body {
        margin: 0;
        font-family: sans-serif;
        background-color: #0d0e12;
        color: #ffffff;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
    'src/App.tsx': `import React from 'react';
import { Sidebar } from './components/sidebar';
import Dashboard from './dashboard';

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: 'screen', backgroundColor: '#0d0e12', color: '#ffffff' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <Dashboard />
      </main>
    </div>
  );
}`,
    'src/dashboard.tsx': `import { useState } from 'react';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';

export default function Dashboard() {
  const [data, setData] = useState<string | null>(null);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Dashboard</h1>
      
      <Card>
        <Card.Header>
          <Card.Title>Analytics</Card.Title>
        </Card.Header>
        
        <Card.Content>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ backgroundColor: '#27272a', padding: '16px', borderRadius: '8px' }}>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '0 0 8px 0' }}>Total Requests</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', margin: 0 }}>142,391</p>
            </div>
            <div style={{ backgroundColor: '#27272a', padding: '16px', borderRadius: '8px' }}>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '0 0 8px 0' }}>TEE CPU Usage</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#c084fc', margin: 0 }}>12.4%</p>
            </div>
            <div style={{ backgroundColor: '#27272a', padding: '16px', borderRadius: '8px' }}>
              <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '0 0 8px 0' }}>0G Nodes Online</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', margin: 0 }}>4 / 4</p>
            </div>
          </div>
        </Card.Content>
      </Card>
      
      <Button onClick={() => setData('loading')}>
        Refresh Data
      </Button>
    </div>
  );
}`,
    'src/components/sidebar.tsx': `import React from 'react';

export function Sidebar() {
  return (
    <aside style={{ width: '256px', backgroundColor: '#111827', color: '#9ca3af', borderRight: '1px solid #1f2937', height: '100vh', padding: '16px', boxSizing: 'border-box' }}>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <a href="#" style={{ display: 'block', padding: '8px 12px', borderRadius: '4px', backgroundColor: '#1f2937', color: '#ffffff', textDecoration: 'none', fontWeight: '500' }}>Dashboard</a>
        <a href="#" style={{ display: 'block', padding: '8px 12px', borderRadius: '4px', textDecoration: 'none', color: '#9ca3af' }}>Settings</a>
        <a href="#" style={{ display: 'block', padding: '8px 12px', borderRadius: '4px', textDecoration: 'none', color: '#9ca3af' }}>Analytics</a>
      </nav>
    </aside>
  );
}`,
    'src/components/ui/button.tsx': `import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, style = {}, ...props }: ButtonProps) {
  return (
    <button 
      {...props} 
      style={{
        padding: '8px 16px',
        backgroundColor: '#0284c7',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        ...style
      }}
    >
      {children}
    </button>
  );
}`,
    'src/components/ui/card.tsx': `import React from 'react';

export function Card({ children, style = {} }: { children: React.ReactNode, style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px', borderBottom: '1px solid #27272a', backgroundColor: 'rgba(9, 9, 11, 0.5)' }}>{children}</div>;
};

Card.Title = function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontWeight: '600', color: '#ffffff', fontSize: '18px', margin: 0 }}>{children}</h3>;
};

Card.Content = function CardContent({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px' }}>{children}</div>;
};`
  },
  rust: {
    'src/main.rs': `fn main() {
    println!("Hello from secure Intel SGX Enclave Sandbox!");
    
    // Initialize vector store
    let storage_node = "https://mainnet.0g.ai";
    println!("Connecting to 0G storage node: {}", storage_node);
}`,
    'Cargo.toml': `[package]
name = "zyva-rust-node"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
`
  },
  python: {
    'main.py': `import os
import sys

def main():
    print("Initializing ZYVA AI Orchestration model worker...")
    storage_url = os.getenv("OG_STORAGE_NODE_URL", "https://mainnet.0g.ai")
    print(f"Index storage endpoint established at: {storage_url}")

if __name__ == '__main__':
    main()`,
    'requirements.txt': `numpy>=1.20.0
requests>=2.28.0
og-storage-sdk>=0.1.5
`
  }
};

// Normalize a parent path so the IDE works cross-platform. On non-Windows hosts
// a Windows-style path (e.g. "C:/Project Web Zyva") cannot be created at the
// drive root, so we redirect it to <home>/ZyvaProjects instead.
function getDefaultProjectsDir(): string {
  return path.join(os.homedir(), 'ZyvaProjects');
}

function normalizeParentPath(parentPath?: string): string {
  if (!parentPath || !parentPath.trim()) return getDefaultProjectsDir();
  const looksWindows = /^[A-Za-z]:[\\/]/.test(parentPath);
  if (process.platform !== 'win32' && looksWindows) {
    return getDefaultProjectsDir();
  }
  return parentPath;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let workspacePath = searchParams.get('path');

    if (!workspacePath) {
      workspacePath = process.cwd();
    }

    workspacePath = path.resolve(workspacePath);

    if (!fs.existsSync(workspacePath)) {
      return NextResponse.json({ success: false, error: 'Path does not exist' }, { status: 404 });
    }

    const projectName = path.basename(workspacePath);
    const fileTree = buildFileTree(workspacePath, workspacePath);
    const fileContents: Record<string, string> = {};
    readFileContents(workspacePath, workspacePath, fileContents);

    return NextResponse.json({
      success: true,
      projectName,
      projectPath: workspacePath.replace(/\\/g, '/'),
      fileTree,
      fileContents
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    if (action === 'defaults') {
      // Cross-platform default locations for the UI (no hardcoded C:/ paths)
      return NextResponse.json({
        success: true,
        defaultProjectsDir: getDefaultProjectsDir().replace(/\\/g, '/'),
        home: os.homedir().replace(/\\/g, '/'),
        cwd: process.cwd().replace(/\\/g, '/'),
        platform: process.platform,
      });
    }
    if (action === 'selectFolderDialog') {
      // Native folder picker, chosen per-platform. Falls back gracefully when
      // the platform helper (zenity / osascript / powershell) is unavailable.
      const platform = process.platform;
      let cmd: string;
      let tempScriptPath = '';

      if (platform === 'win32') {
        tempScriptPath = path.join(process.cwd(), 'temp_select_folder.ps1');
        const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Select a Project Folder for ZYVA IDE"
$f.ShowNewFolderButton = $true
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}`;
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf-8');
        cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`;
      } else if (platform === 'darwin') {
        cmd = `osascript -e 'POSIX path of (choose folder with prompt "Select a Project Folder for ZYVA IDE")'`;
      } else {
        // Linux: prefer zenity, fall back to kdialog
        cmd = `zenity --file-selection --directory --title="Select a Project Folder for ZYVA IDE" 2>/dev/null || kdialog --getexistingdirectory "$HOME" 2>/dev/null`;
      }

      return new Promise<Response>((resolve) => {
        exec(cmd, (error, stdout) => {
          if (tempScriptPath) { try { fs.unlinkSync(tempScriptPath); } catch (e) {} }
          const selectedPath = (stdout || '').trim().replace(/\\/g, '/');
          if (selectedPath) {
            resolve(NextResponse.json({ success: true, selectedPath }));
          } else {
            // No native dialog available (e.g. headless / minimal desktop) — let UI fall back to manual entry
            resolve(NextResponse.json({ success: false, error: error ? 'No native folder dialog available on this platform' : 'No folder selected' }));
          }
        });
      });
    }

    if (action === 'browse') {
      const { currentPath } = body;
      const targetPath = currentPath ? path.resolve(currentPath) : process.cwd();

      if (!fs.existsSync(targetPath)) {
        return NextResponse.json({ success: false, error: 'Path does not exist' }, { status: 404 });
      }

      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        return NextResponse.json({ success: false, error: 'Path is not a directory' }, { status: 400 });
      }

      const items = fs.readdirSync(targetPath);
      const directories = [];
      const parentDir = path.dirname(targetPath);

      for (const item of items) {
        try {
          const fullPath = path.join(targetPath, item);
          const statItem = fs.statSync(fullPath);
          if (statItem.isDirectory()) {
            // Check list ignore
            if (IGNORE_LIST.has(item)) continue;
            directories.push({
              name: item,
              path: fullPath.replace(/\\/g, '/')
            });
          }
        } catch (e) {
          // ignore permission errors
        }
      }

      return NextResponse.json({
        success: true,
        currentPath: targetPath.replace(/\\/g, '/'),
        parentPath: parentDir.replace(/\\/g, '/'),
        directories: directories.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    if (action === 'saveFile') {
      const { projectPath, filePath, content } = body;
      if (!projectPath || !filePath) {
        return NextResponse.json({ success: false, error: 'Missing path information' }, { status: 400 });
      }

      const cleanFilePath = filePath.replace(/^\//, '');
      const absolutePath = path.isAbsolute(cleanFilePath)
        ? path.resolve(cleanFilePath)
        : path.resolve(projectPath, cleanFilePath);

      // Containment (cross-platform): must stay inside the project.
      const resolvedProjPath = path.resolve(projectPath);
      if (absolutePath !== resolvedProjPath && !absolutePath.startsWith(resolvedProjPath + path.sep)) {
        return NextResponse.json({ success: false, error: 'Access denied: Path lies outside boundary' }, { status: 403 });
      }

      // Snapshot + atomic write (rollback support).
      const rel = path.relative(resolvedProjPath, absolutePath).replace(/\\/g, '/');
      const result = writeFileSafe(resolvedProjPath, rel, content);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error || 'write failed' }, { status: 500 });
      }

      // Real incremental re-index of just this file (best-effort).
      try { await indexFiles(resolvedProjPath, { [rel]: content }); } catch { /* embedding optional */ }

      return NextResponse.json({ success: true, snapshotId: result.snapshotId });
    }

    if (action === 'createProject') {
      const { parentPath, name, template } = body;
      if (!name || !template) {
        return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
      }

      const resolvedParent = normalizeParentPath(parentPath);
      fs.mkdirSync(resolvedParent, { recursive: true });
      const projectPath = path.join(resolvedParent, name);
      fs.mkdirSync(projectPath, { recursive: true });

      const templateData = TEMPLATE_FILES[template as 'react' | 'rust' | 'python'];
      if (!templateData) {
        return NextResponse.json({ success: false, error: 'Invalid template' }, { status: 400 });
      }

      // Write template files
      for (const [filename, content] of Object.entries(templateData)) {
        const absoluteFilePath = path.join(projectPath, filename);
        fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
        fs.writeFileSync(absoluteFilePath, content, 'utf-8');
      }

      const fileTree = buildFileTree(projectPath, projectPath);
      const fileContents: Record<string, string> = {};
      readFileContents(projectPath, projectPath, fileContents);

      // Real semantic index of the new project (best-effort; non-fatal).
      try { await indexFiles(projectPath, fileContents); } catch { /* embedding optional */ }

      return NextResponse.json({
        success: true,
        projectPath: projectPath.replace(/\\/g, '/'),
        projectName: name,
        fileTree,
        fileContents
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
