import { app, BrowserWindow, protocol, net } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

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
    },
  });

  // Load via custom protocol so window.location.pathname === '/'
  // which lets wouter match the <Route path="/"> route
  win.loadURL('app://./');
};

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const relPath = pathname.replace(/^\//, '') || 'index.html';
    const target = path.join(distDir, relPath);
    // Serve the file; fall back to index.html for SPA deep links
    return net.fetch(pathToFileURL(target).toString()).catch(() =>
      net.fetch(pathToFileURL(path.join(distDir, 'index.html')).toString())
    );
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
