import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { net } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonServer;

function startNovaEngine() {
  const isPackaged = app.isPackaged;

  const resourcesDir = isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..');

  const scriptPath = isPackaged
    ? path.join(process.resourcesPath, 'server.py')
    : path.resolve(path.join(__dirname, '..', 'server.py'));

  console.log(`[Nova Boot]: Launching engine from path -> ${scriptPath}`);

  pythonServer = spawn('python', [scriptPath], {
    cwd: resourcesDir
  });

  pythonServer.stdout.on('data', (data) => {
    console.log(`Engine: ${data}`);
  });

  pythonServer.stderr.on('data', (data) => {
    console.error(`Engine Error: ${data}`);
  });
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'src', 'assets', 'NovaAI.ico')
    : path.join(__dirname, 'src', 'assets', 'NovaAI.ico');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const loadUrl = () => {
    const request = net.request('http://localhost:8000');

    request.on('response', () => {
      win.loadURL('http://localhost:8000');
    });

    request.on('error', () => {
      console.log('Server not ready, retrying...');
      setTimeout(loadUrl, 1000);
    });

    request.end();
  };

  loadUrl();

  // Uncomment if you want DevTools automatically
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  startNovaEngine();

  setTimeout(() => {
    createWindow();
  }, 2500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonServer) {
    pythonServer.kill();
  }
});