const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-web-bluetooth');
app.commandLine.appendSwitch('disable-serial-blocklist');

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

// server.py, die Weboberfläche und die Firmware-Quellen liegen im App-Paket neben main.js (scripts/build-app.sh).
// Das signierte Paket bleibt unverändert: Configs und gerenderte Firmware schreibt server.py in DACTYL_DATA_DIR.
const SERVER_DIR = __dirname;
const DATA_DIR = path.join(app.getPath('userData'), 'data');

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
  const serverScript = path.join(SERVER_DIR, 'server.py');
  serverProcess = spawn('python3', [serverScript], {
    cwd: SERVER_DIR,
    env: { ...process.env, DACTYL_DATA_DIR: DATA_DIR },
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

    // Eine Hälfte im Config Mode ("Dactyl Config" rechts, "Dactyl Config L" links) hat Vorrang vor der
    // Tastatur im Mac-Modus. Die App erkennt die Hälfte anschließend am Namen und an DEVICE_INFO.
    const nameOf = d => (d.deviceName || '').toLowerCase();
    let dactyl = deviceList.find(d => nameOf(d).startsWith('dactyl config'))
      || deviceList.find(d => nameOf(d).includes('dactyl') || nameOf(d).includes('config'));

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

  // Bei zwei angeschlossenen Hälften wählt dies den ersten USB-Port. Die App erkennt die Hälfte danach
  // über DEVICE_INFO.side und sendet Befehle nur an die passende Hälfte (siehe sendDeviceCommand in js/ble.js).
  let activeSerialCallback = null;
  let serialScanTimeout = null;
  let candidatePorts = [];

  function matchSerialPort(p) {
    if (!p) return false;
    const name = ((p.portName || '') + ' ' + (p.displayName || '')).toLowerCase();
    return name.includes('usbserial') || name.includes('wchusb') || name.includes('serial');
  }

  function clearSerialScan() {
    if (serialScanTimeout) {
      clearTimeout(serialScanTimeout);
      serialScanTimeout = null;
    }
    candidatePorts = [];
    activeSerialCallback = null;
  }

  function handleSerialPortSelect(event, portList, webContents, callback) {
    event.preventDefault();
    logElectron(`select-serial-port fired with ${portList.length} ports: ` + JSON.stringify(portList));
    if (activeSerialCallback) {
      activeSerialCallback('');
      clearSerialScan();
    }
    activeSerialCallback = callback;
    candidatePorts = [...portList];

    const espPort = candidatePorts.find(matchSerialPort);
    if (espPort) {
      logElectron(`Auto-selecting Serial Port: ${espPort.portName || espPort.displayName || espPort.portId}`);
      callback(espPort.portId);
      clearSerialScan();
      return;
    }

    // Wenn noch kein passender ESP-Port in portList ist: auf serial-port-added warten
    serialScanTimeout = setTimeout(() => {
      if (activeSerialCallback) {
        if (candidatePorts.length > 0) {
          logElectron(`Fallback on timeout: selecting first serial port: ${candidatePorts[0].portName || candidatePorts[0].displayName || candidatePorts[0].portId}`);
          activeSerialCallback(candidatePorts[0].portId);
        } else {
          logElectron('Serial port scan timed out after 5s without finding port.');
          activeSerialCallback('');
        }
      }
      clearSerialScan();
    }, 5000);
  }

  function handleSerialPortAdded(event, port) {
    logElectron(`serial-port-added fired: ` + JSON.stringify(port));
    if (!candidatePorts.some(p => p.portId === port.portId)) {
      candidatePorts.push(port);
    }
    if (activeSerialCallback) {
      if (matchSerialPort(port)) {
        logElectron(`Auto-selecting added Serial Port: ${port.portName || port.displayName || port.portId}`);
        activeSerialCallback(port.portId);
        clearSerialScan();
      }
    }
  }

  mainWindow.webContents.on('select-serial-port', handleSerialPortSelect);
  ses.on('select-serial-port', handleSerialPortSelect);
  mainWindow.webContents.on('serial-port-added', handleSerialPortAdded);
  ses.on('serial-port-added', handleSerialPortAdded);
  logElectron('Registered select-serial-port and serial-port-added handlers on mainWindow.webContents and session.');

  mainWindow.webContents.on('console-message', (event, level, message) => {
    logElectron(`[Renderer Console] ${message}`);
  });

  const ALLOWED_ORIGINS = new Set([
    'http://localhost:8088',
    'http://127.0.0.1:8088'
  ]);

  function isAllowedOrigin(rawUrl) {
    if (!rawUrl) return false;
    try {
      const parsed = new URL(rawUrl);
      return ALLOWED_ORIGINS.has(parsed.origin);
    } catch (_) {
      const trimmed = String(rawUrl).replace(/\/+$/, '');
      return ALLOWED_ORIGINS.has(trimmed);
    }
  }

  function isAllowedWebContents(wc, fallbackUrl) {
    if (fallbackUrl) {
      return isAllowedOrigin(fallbackUrl);
    }
    if (wc && typeof wc.getURL === 'function') {
      return isAllowedOrigin(wc.getURL());
    }
    return false;
  }

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const origin = requestingOrigin || details?.requestingUrl || (webContents && webContents.getURL()) || '';
    const allowed = isAllowedWebContents(webContents, origin);
    logElectron(`setPermissionCheckHandler: permission=${permission}, origin=${origin} -> ${allowed}`);
    return allowed;
  });

  ses.setDevicePermissionHandler((details) => {
    if (details && details.deviceType === 'serial') {
      const origin = details.origin || '';
      const allowed = isAllowedOrigin(origin) || origin === '';
      logElectron(`setDevicePermissionHandler: serial access -> ${allowed} (origin=${origin})`);
      return allowed;
    }
    const origin = details?.origin || '';
    const allowed = isAllowedOrigin(origin);
    logElectron(`setDevicePermissionHandler: deviceType=${details?.deviceType}, origin=${origin} -> ${allowed}`);
    return allowed;
  });

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const url = details?.requestingUrl || details?.securityOrigin || (webContents && webContents.getURL()) || '';
    const allowed = isAllowedWebContents(webContents, url);
    logElectron(`setPermissionRequestHandler: permission=${permission}, url=${url} -> ${allowed}`);
    callback(allowed);
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedOrigin(url)) {
      event.preventDefault();
      logElectron(`Blocked navigation to untrusted URL: ${url}`);
    }
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.on('closed', () => {
    if (activeBluetoothCallback) {
      activeBluetoothCallback('');
      activeBluetoothCallback = null;
    }
    if (bluetoothScanTimeout) {
      clearTimeout(bluetoothScanTimeout);
      bluetoothScanTimeout = null;
    }
    if (activeSerialCallback) {
      activeSerialCallback('');
      clearSerialScan();
    }
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
