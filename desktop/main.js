// ZYVA Desktop (Electron) — wraps the Next standalone server.
// On launch it spawns the bundled Next server, waits for it, then opens a window.
// This keeps ZYVA's server runtime (API routes, engine) intact on the desktop.

const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const PORT = process.env.ZYVA_PORT || '4311';
let serverProc = null;

function resolveServerEntry() {
  // In a packaged app the standalone build is unpacked under resources/app/.next/standalone.
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  return path.join(base, '.next', 'standalone', 'server.js');
}

function startServer() {
  const entry = resolveServerEntry();
  serverProc = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT, HOSTNAME: '127.0.0.1', NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });
  serverProc.on('exit', (code) => console.log('[zyva] server exited', code));
}

function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(url, (res) => { res.destroy(); resolve(); })
        .on('error', () => (Date.now() > deadline ? reject(new Error('server timeout')) : setTimeout(tick, 400)));
    };
    tick();
  });
}

async function createWindow() {
  startServer();
  const url = `http://127.0.0.1:${PORT}`;
  try { await waitForServer(url); } catch (e) { console.error(e); }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0d0e12',
    title: 'ZYVA',
    webPreferences: { contextIsolation: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => { if (serverProc) try { serverProc.kill(); } catch {} });
