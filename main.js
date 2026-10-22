const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-web-bluetooth');

const os = require('os');
const LOG_FILE = path.join(os.homedir(), '.dactyl_electron.log');

function logElectron(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    console.error(e);
  }
}
logElectron('=== Electron main.js loaded ===');

let mainWindow = null;
let serverProcess = null;
const PORT = 8088;
const APP_URL = `http://localhost:${PORT}`;

function resolveRepoDir() {
  if (process.env.REPO_DIR && fs.existsSync(path.join(process.env.REPO_DIR, 'server.py'))) {
    return process.env.REPO_DIR;
  }
  if (fs.existsSync(path.join(__dirname, 'server.py'))) {
    return __dirname;
  }
  const candidateParent = path.resolve(__dirname, '../../../..');
  if (fs.existsSync(path.join(candidateParent, 'server.py'))) {
    return candidateParent;
  }
  return '/Users/mdriemel/repos/rovodev-system/dactyl_configurator';
}
const REPO_DIR = resolveRepoDir();

const extraPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin'];
const currentPath = process.env.PATH || '';
const newPath = extraPaths.filter(p => !currentPath.includes(p)).concat(currentPath).join(':');
process.env.PATH = newPath;

// Prüft, ob auf dem Port wirklich der Dactyl-Configurator-Server antwortet (nicht ein fremder Prozess)
function probeServer(onResult) {
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    onResult(ok);
  };
  const req = http.get(`${APP_URL}/api/status`, { timeout: 1500 }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        finish(res.statusCode === 200 && JSON.parse(body).app === 'dactyl-configurator');
      } catch (e) {
        finish(false);
      }
    });
  });
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', () => finish(false));
}

function ensureServer(callback) {
  probeServer((running) => {
    if (running) {
      callback();
      return;
    }
    startServer(callback);
  });
}

function startServer(callback) {
  const serverScript = path.join(REPO_DIR, 'server.py');
  serverProcess = spawn('python3', [serverScript], {
    cwd: REPO_DIR,
    env: process.env,
    detached: false,
    stdio: 'ignore'
  });
  // Fehlt python3, emittiert spawn ein 'error'-Event; ohne Listener stürzt der Main-Prozess ab
  serverProcess.on('error', (err) => {
    logElectron(`Failed to start server.py: ${err.message}`);
    serverProcess = null;
  });
  const startTime = Date.now();
  let probing = false;
  const interval = setInterval(() => {
    if (probing) return;
    probing = true;
    probeServer((ok) => {
      probing = false;
      if (ok || Date.now() - startTime > 15000) {
        clearInterval(interval);
        if (!ok) logElectron('Server did not become ready within 15s.');
        callback();
      }
    });
  }, 150);
}

function stopServer() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 940,
    minWidth: 800,
    minHeight: 600,
    title: 'Dactyl Configurator',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const ses = mainWindow.webContents.session;
  let activeBluetoothCallback = null;
  let bluetoothScanTimeout = null;

  function handleBluetoothSelect(event, deviceList, callback) {
    event.preventDefault();
    logElectron(`select-bluetooth-device fired with ${deviceList.length} devices: ` + JSON.stringify(deviceList));
    activeBluetoothCallback = callback;

    let dactyl = deviceList.find(d => {
      const name = (d.deviceName || '').toLowerCase();
      return name.includes('dactyl') || name.includes('config');
    });

    if (dactyl) {
      logElectron(`Auto-selecting Dactyl: ${dactyl.deviceName || '(unnamed)'} (${dactyl.deviceId})`);
      if (bluetoothScanTimeout) {
        clearTimeout(bluetoothScanTimeout);
        bluetoothScanTimeout = null;
      }
      callback(dactyl.deviceId);
      activeBluetoothCallback = null;
    } else {
      if (!bluetoothScanTimeout) {
        bluetoothScanTimeout = setTimeout(() => {
          logElectron('Bluetooth scan timed out after 15s without finding Dactyl.');
          if (activeBluetoothCallback) {
            activeBluetoothCallback('');
            activeBluetoothCallback = null;
          }
          bluetoothScanTimeout = null;
        }, 15000);
      }
    }
  }

  // WICHTIG: select-bluetooth-device liegt in Electron auf webContents, NICHT auf session!
  mainWindow.webContents.on('select-bluetooth-device', handleBluetoothSelect);
  ses.on('select-bluetooth-device', handleBluetoothSelect);
  logElectron('Registered select-bluetooth-device handler on mainWindow.webContents and session.');

  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    const espPort = portList.find(p => p.portName && (p.portName.includes('usbserial') || p.portName.includes('wchusb')));
    if (espPort) {
      callback(espPort.portId);
    } else if (portList.length > 0) {
      callback(portList[0].portId);
    } else {
      callback('');
    }
  });

  const ALLOWED_ORIGIN = 'http://localhost:8088';

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return requestingOrigin === ALLOWED_ORIGIN;
  });
  ses.setDevicePermissionHandler((details) => {
    return details.origin === ALLOWED_ORIGIN;
  });
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl ? new URL(details.requestingUrl).origin : '';
    callback(origin === ALLOWED_ORIGIN);
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    let origin = '';
    try { origin = new URL(url).origin; } catch (e) {}
    // Exakter Origin-Vergleich: startsWith ließe z. B. http://localhost:8088.evil.com zu
    if (origin !== ALLOWED_ORIGIN) {
      event.preventDefault();
      logElectron(`Blocked navigation to untrusted URL: ${url}`);
    }
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ensureServer(() => {
    createWindow();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

// Cmd+Q / Dock-Beenden löst window-all-closed nicht aus: Server auch hier beenden
app.on('before-quit', stopServer);
