const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const isDev = !app.isPackaged;

let nextServer = null;
const SERVER_PORT = 18923;

function logToFile(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'app_debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${msg}\n`);
    console.log(msg);
  } catch(e) {}
}

/**
 * Next.jsのプロダクションサーバーを起動
 */
function startNextServer() {
  return new Promise((resolve, reject) => {
    const appDir = isDev ? __dirname : path.join(process.resourcesPath, 'app');
    
    // Electron内部のNodeを使用して直接Next CLIを実行する
    const nextScript = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');
    
    logToFile(`Starting next.js server from: ${nextScript} in cwd: ${appDir}`);
    
    if (!fs.existsSync(nextScript)) {
      logToFile(`ERROR: Next.js script not found at ${nextScript}`);
      reject(new Error(`Next.js script not found at ${nextScript}`));
      return;
    }

    nextServer = spawn(process.execPath, [nextScript, 'start', '-p', String(SERVER_PORT)], {
      cwd: appDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' },
    });

    let resolved = false;

    nextServer.stdout.on('data', (data) => {
      const output = data.toString();
      logToFile(`[Next.js stdout] ${output}`);
      // "Ready" メッセージを検知してresolve
      if (!resolved && (output.includes('Ready') || output.includes(`localhost:${SERVER_PORT}`))) {
        resolved = true;
        logToFile(`[Next.js] Server ready detected.`);
        resolve(SERVER_PORT);
      }
    });

    nextServer.stderr.on('data', (data) => {
      logToFile(`[Next.js stderr] ${data.toString()}`);
    });

    nextServer.on('error', (err) => {
      logToFile(`Failed to start Next.js server: ${err.message}`);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    nextServer.on('close', (code) => {
      logToFile(`Next.js server exited with code ${code}`);
      if (!resolved) {
        resolved = true;
        reject(new Error(`Next.js server exited with code ${code}`));
      }
    });

    // 15秒のタイムアウト
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logToFile(`[Next.js] Timeout waiting for ready message, resolving anyway.`);
        resolve(SERVER_PORT);
      }
    }, 15000);
  });

}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 内部リンクはアプリ内で処理、外部リンクはブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('127.0.0.1') || url.includes('localhost')) {
      win.loadURL(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadURL(`http://127.0.0.1:${port}`);
  }
}

app.whenReady().then(async () => {
  // CORS用のUA設定
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  let port = 3000;
  if (!isDev) {
    port = await startNextServer();
  }

  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});

app.on('window-all-closed', () => {
  if (nextServer) {
    // Windows: プロセスツリーごと終了
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(nextServer.pid), '/f', '/t'], { shell: true });
    } else {
      nextServer.kill();
    }
  }
  if (process.platform !== 'darwin') app.quit();
});
