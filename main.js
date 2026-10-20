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
const URL = `http://localhost:${PORT}`;
const REPO_DIR = '/Users/mdriemel/repos/rovodev-system/dactyl_configurator';

const extraPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin'];
const currentPath = process.env.PATH || '';
const newPath = extraPaths.filter(p => !currentPath.includes(p)).concat(currentPath).join(':');
process.env.PATH = newPath;

function ensureServer(callback) {
  const req = http.get(URL, () => {
    callback();
  });
  req.on('error', () => {
    const serverScript = path.join(REPO_DIR, 'server.py');
    serverProcess = spawn('python3', [serverScript], {
      cwd: REPO_DIR,
      env: process.env,
      detached: false,
      stdio: 'ignore'
    });
    const startTime = Date.now();
    const interval = setInterval(() => {
      http.get(URL, () => {
        clearInterval(interval);
        callback();
      }).on('error', () => {
        if (Date.now() - startTime > 15000) {
          clearInterval(interval);
          callback();
        }
      });
    }, 150);
  });
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

    if (!dactyl && deviceList.length > 0) {
      logElectron(`Fallback: selecting first candidate matching GATT filter: ${deviceList[0].deviceName || '(unnamed)'} (${deviceList[0].deviceId})`);
      dactyl = deviceList[0];
    }

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

  ses.setPermissionCheckHandler(() => true);
  ses.setDevicePermissionHandler(() => true);
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  mainWindow.loadURL(URL);

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
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
  }
  app.quit();
});
