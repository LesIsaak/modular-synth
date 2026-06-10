import { app, BrowserWindow, protocol } from 'electron';
import fs from 'fs';
import path from 'path';

// Reduce audio latency: smaller output buffer + keep the audio service in-process.
app.commandLine.appendSwitch('audio-buffer-size', '256');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.otf':  'font/otf',
  };
  return map[ext] ?? 'application/octet-stream';
}

const distDir = path.join(app.getAppPath(), 'dist');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    title: 'OrangeCastle MODULAR Synthesizer',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  // Custom protocol makes window.location.pathname === '/'
  // so the wouter <Route path="/"> matches correctly
  win.loadURL('app://localhost/');
};

app.whenReady().then(() => {
  // Serve Vite build files via fs (works with or without asar)
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const target = path.join(distDir, relPath);

    let filePath = target;
    try {
      fs.accessSync(filePath);
    } catch {
      // SPA fallback — any unknown path serves index.html
      filePath = path.join(distDir, 'index.html');
    }

    const data = fs.readFileSync(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType(filePath),
        'Access-Control-Allow-Origin': '*',
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
