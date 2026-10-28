// =============================================================================
// Web Bluetooth Permission Management & Live-Sync Flow
// =============================================================================

function isBtPermissionVerified() {
  return localStorage.getItem("dactyl_bt_permission_verified") === "true";
}

function setBtPermissionUIState(state) {
  // state: 'unverified' | 'denied' | 'granted'
  const btnCheck = document.getElementById("btnCheckBtPermission");
  const btnConfig = document.getElementById("btnOpenBtSettings");
  const btnSync = document.getElementById("btnConnectBle");

  if (state === "granted") {
    if (btnCheck) btnCheck.style.display = "none";
    if (btnConfig) btnConfig.style.display = "none";
    if (btnSync) btnSync.style.display = "inline-flex";
  } else if (state === "denied") {
    if (btnCheck) {
      btnCheck.style.display = "inline-flex";
      btnCheck.innerHTML = `<span class="btn-icon">🔄</span> Erneut prüfen`;
      btnCheck.title = "Klicke hier, nachdem du 'Dactyl Configurator' in den macOS Systemeinstellungen aktiviert hast";
    }
    if (btnConfig) btnConfig.style.display = "inline-flex";
    if (btnSync) btnSync.style.display = "none";
  } else {
    // unverified (default)
    if (btnCheck) {
      btnCheck.style.display = "inline-flex";
      btnCheck.innerHTML = `<span class="btn-icon">🔒</span> Bluetooth prüfen`;
      btnCheck.title = "Prüft die macOS Bluetooth-Berechtigung für diese App und schaltet den Live-Sync-Button frei";
    }
    if (btnConfig) btnConfig.style.display = "none";
    if (btnSync) btnSync.style.display = "none";
  }
}

async function openMacBluetoothSettings() {
  showToast("⚙️ Öffne macOS Systemeinstellungen...");
  try {
    const res = await fetch("/api/open_bluetooth_settings", { method: "POST" });
    if (res.ok) {
      showToast("⚙️ Systemeinstellungen geöffnet! Aktiviere 'Dactyl Configurator' unter Bluetooth und klicke anschließend auf 'Erneut prüfen'.", 8000);
      return;
    }
  } catch (e) {
    console.warn("Server open_bluetooth_settings failed, falling back to direct URL:", e);
  }
  window.open("x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth");
  showToast("⚙️ Systemeinstellungen geöffnet! Aktiviere 'Dactyl Configurator' unter Bluetooth und klicke anschließend auf 'Erneut prüfen'.", 8000);
}

// Geräteauswahl für requestDevice: Config-Mode-Namen beider Hälften (links "Dactyl Config L") und Config-Dienst
function bleRequestFilters() {
  return [
    { name: SIDE_PROFILES.L.bleName },
    { name: SIDE_PROFILES.R.bleName },
    { namePrefix: "Dactyl Config" },
    { services: [CONFIG_SERVICE_UUID] },
    { name: "Dactyl Keyboard" },
    { namePrefix: "Dactyl" }
  ];
}

async function checkBluetoothPermission() {
  if (!("bluetooth" in navigator)) {
    alert("Web Bluetooth wird von deinem Browser oder dieser Electron-App nicht unterstützt.");
    return;
  }

  const btnCheck = document.getElementById("btnCheckBtPermission");
  if (btnCheck) btnCheck.innerHTML = `<span class="btn-icon">⏳</span> Prüfe...`;

  showToast("🔍 Prüfe Bluetooth-Berechtigung (bitte eventuelle Systemabfrage erlauben)...");

  try {
    const dev = await navigator.bluetooth.requestDevice({
      filters: bleRequestFilters(),
      optionalServices: [CONFIG_SERVICE_UUID]
    });

    localStorage.setItem("dactyl_bt_permission_verified", "true");
    setBtPermissionUIState("granted");
    showToast(`✅ Bluetooth-Berechtigung erteilt! Verbinde direkt mit ${dev.name || "Dactyl Config"}...`);
    registerPermittedBleDevice(dev);
    await connectToBleDevice(dev, false);
  } catch (err) {
    console.warn("Bluetooth permission check result:", err);
    const msg = (err.message || "").toLowerCase();

    if (msg.includes("denied") || msg.includes("permission") || msg.includes("scan for bluetooth devices")) {
      // macOS OS-level TCC or user explicitly denied
      localStorage.removeItem("dactyl_bt_permission_verified");
      setBtPermissionUIState("denied");
      showToast("❌ macOS verwehrt Bluetooth-Zugriff! Klicke auf 'macOS Bluetooth-Freigabe öffnen'.", 7000);
    } else if (err.name === "NotFoundError") {
      // Scan lief (Berechtigung vorhanden), aber kein Gerät gewählt/gefunden
      localStorage.setItem("dactyl_bt_permission_verified", "true");
      setBtPermissionUIState("granted");
      showToast("✅ Bluetooth-Berechtigung aktiv! 'Bluetooth Live-Sync' ist jetzt bereit.", 4000);
    } else {
      // Adapter aus, nicht unterstützt o. ä.: Berechtigung NICHT als erteilt markieren
      setBtPermissionUIState("unverified");
      showToast("⚠️ Bluetooth nicht verfügbar: " + (err.message || err.name), 6000);
    }
  }
}

// =============================================================================
// Web Bluetooth Live-Sync & Modern Auto-Sync (getDevices + watchAdvertisements)
// =============================================================================

async function initModernBleAutoSync() {
  if (!("bluetooth" in navigator) || typeof navigator.bluetooth.getDevices !== "function") {
    console.log("[BLE Auto-Sync] navigator.bluetooth.getDevices() nicht verfügbar.");
    return;
  }

  try {
    const devices = await navigator.bluetooth.getDevices();
    for (const dev of devices) {
      registerPermittedBleDevice(dev);
    }
    if (devices.length > 0) {
      console.log(`[BLE Auto-Sync] ${devices.length} autorisierte(s) Bluetooth-Gerät(e) überwacht.`);
    }
  } catch (e) {
    console.warn("[BLE Auto-Sync] Fehler bei getDevices():", e);
  }

  if (!bleAutoPollTimer) {
    bleAutoPollTimer = setInterval(async () => {
      if (bleConfigChar || isConnectingBle || isAutoSyncing || knownBleDevices.length === 0) return;
      for (const dev of knownBleDevices) {
        // Nur die Config-Profile beider Hälften ("Dactyl Config", "Dactyl Config L") im Hintergrund prüfen
        if (dev.name && !dev.name.includes("Config") && knownBleDevices.length > 1) continue;
        try {
          if (typeof dev.watchAdvertisements === "function" && !dev.watchingAdvertisements) {
            await dev.watchAdvertisements();
          }
        } catch (err) {
          // Ignorieren, falls bereits aktiv oder nicht unterstützt
        }
      }
    }, 3000);
  }
}

function registerPermittedBleDevice(dev) {
  if (!dev) return;
  if (!knownBleDevices.some(d => d.id === dev.id)) {
    knownBleDevices.push(dev);
  }
  if (watchedBleDevices.has(dev.id)) return;
  watchedBleDevices.add(dev.id);

  dev.addEventListener("advertisementreceived", async (event) => {
    const eventName = event.name || "";
    const hasConfigUuid = Array.isArray(event.uuids) && event.uuids.some(u => u.toLowerCase() === CONFIG_SERVICE_UUID.toLowerCase());
    const isConfigAdv = eventName.includes("Config") || hasConfigUuid;
    if (!isConfigAdv) return;
    if (Date.now() - lastBleDisconnectTime < 2500) return;
    console.log(`[BLE Auto-Sync] Advertisement empfangen (Name: '${eventName}', RSSI: ${event.rssi})`);
    if (bleConfigChar || isConnectingBle) return;
    await connectToBleDevice(dev, true, eventName);
  });

  if (typeof dev.watchAdvertisements === "function") {
    dev.watchAdvertisements().then(() => {
      console.log(`[BLE Auto-Sync] watchAdvertisements() aktiv für '${dev.name || dev.id}'`);
    }).catch((err) => {
      console.warn(`[BLE Auto-Sync] watchAdvertisements() Hinweis für '${dev.name || dev.id}':`, err.message);
    });
  }
}

// advName: Name aus dem Advertisement (aktueller als der zwischengespeicherte device.name)
async function connectToBleDevice(device, isAutoTriggered = false, advName = "") {
  if (!device || bleConfigChar || isConnectingBle) return;
  isConnectingBle = true;

  try {
    bleDevice = device;
    bleDevice.removeEventListener("gattserverdisconnected", onBleDisconnected);
    bleDevice.addEventListener("gattserverdisconnected", onBleDisconnected);
    // Vorläufig aus dem Namen; GET_INFO bestätigt die Hälfte unten über DEVICE_INFO.side
    bleSide = Dactyl.sideFromBleName(advName || device.name || "");
    const advLabel = advName || device.name || "Dactyl Config";

    if (isAutoTriggered) {
      showToast(`⚡ '${advLabel}' erkannt! Verbinde automatisch...`);
    } else {
      showToast("Verbinde mit Dactyl Bluetooth GATT Server...");
    }

    bleServer = await bleDevice.gatt.connect();
    const service = await bleServer.getPrimaryService(CONFIG_SERVICE_UUID);
    const char = await service.getCharacteristic(CONFIG_CHARACTERISTIC_UUID);

    await char.startNotifications();
    char.removeEventListener("characteristicvaluechanged", handleBleNotification);
    char.addEventListener("characteristicvaluechanged", handleBleNotification);
    bleConfigChar = char;

    // Hälfte über DEVICE_INFO bestätigen, bevor ein Sync die Config einer Hälfte sendet
    const infoSide = await requestBleDeviceSide(1500);
    if (infoSide) bleSide = infoSide;
    if (!bleConfigChar) throw new Error("Verbindung während der Erkennung getrennt");

    updateBleUI(true, `${advLabel} (${SIDE_PROFILES[bleSide].label})`);
    updateConfigModeUI(true, false);

    const autoSyncChk = document.getElementById("chkAutoSyncOnCombo");
    const shouldOneShotAutoSync = autoSyncChk && autoSyncChk.checked;

    if (shouldOneShotAutoSync) {
      // One-Shot Auto-Sync: Konfiguration übertragen, danach automatisch trennen & zurück zur Mac-Tastatur!
      await new Promise(r => setTimeout(r, 120));
      await runAutoSync({ autoDisconnectAfter: true });
    } else {
      showToast("⚡ Konfig-Modus verbunden! Live-Remapping aktiv.");
      setTimeout(async () => {
        if (!bleConfigChar) return;
        if (pendingFor(bleSide).length > 0) {
          await runAutoSync({ autoDisconnectAfter: false });
        } else {
          await sendBleCommand("GET_NAMES");
        }
      }, 180);
    }
  } catch (err) {
    console.warn("BLE connection attempt failed:", err);
    bleConfigChar = null;
    bleServer = null;
    bleSide = null;
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
      try {
        bleDevice.gatt.disconnect();
      } catch (_) {}
    }
    updateBleUI(false);
    updateConfigModeUI(false, false);
    if (!isAutoTriggered) {
      showToast("Bluetooth-Fehler: " + err.message);
    }
  } finally {
    isConnectingBle = false;
  }
}

// Fragt GET_INFO über BLE ab und liefert DEVICE_INFO.side (null bei Timeout oder unbekanntem Wert)
let bleInfoWaiters = [];
function requestBleDeviceSide(timeoutMs) {
  return new Promise((resolve) => {
    const waiter = { resolve, timer: null };
    waiter.timer = setTimeout(() => {
      bleInfoWaiters = bleInfoWaiters.filter(w => w !== waiter);
      resolve(null);
    }, timeoutMs);
    bleInfoWaiters.push(waiter);
    sendBleCommand("GET_INFO").then(ok => {
      if (ok) return;
      clearTimeout(waiter.timer);
      bleInfoWaiters = bleInfoWaiters.filter(w => w !== waiter);
      resolve(null);
    });
  });
}

function resolveBleInfoWaiters(side) {
  const waiters = bleInfoWaiters;
  bleInfoWaiters = [];
  for (const w of waiters) {
    clearTimeout(w.timer);
    w.resolve(side);
  }
}

async function connectBle() {
  if (!("bluetooth" in navigator)) {
    alert("Web Bluetooth wird von deinem Browser nicht unterstützt oder ist nicht aktiviert.\n\nBitte benutze Google Chrome, Microsoft Edge, Arc oder Opera und stelle sicher, dass Bluetooth am Mac aktiviert ist.");
    return;
  }

  if (bleConfigChar) {
    disconnectBle();
    return;
  }

  try {
    // Falls die Tastatur per USB verbunden ist und noch nicht im Config-Modus ist, können wir sie direkt per ENTER_CONFIG umschalten
    const profile = activeProfile();
    if (serialPort && serialPort.writable && serialSide === editSide && !isConfigModeActive) {
      await sendSerialCommand("ENTER_CONFIG");
      await new Promise(r => setTimeout(r, 350));
    }

    showToast(`Suche nach '${profile.bleName}' (${profile.comboLabel} für 0.5s gedrückt halten)...`);
    const selectedDevice = await navigator.bluetooth.requestDevice({
      filters: bleRequestFilters(),
      optionalServices: [CONFIG_SERVICE_UUID]
    });

    registerPermittedBleDevice(selectedDevice);
    await connectToBleDevice(selectedDevice, false);

  } catch (err) {
    console.error("BLE requestDevice error:", err);
    updateBleUI(false);
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("denied") || msg.includes("permission") || msg.includes("scan for bluetooth devices")) {
      localStorage.removeItem("dactyl_bt_permission_verified");
      setBtPermissionUIState("denied");
      showToast("❌ macOS verwehrt Bluetooth-Zugriff! Klicke auf 'macOS Bluetooth-Freigabe öffnen'.", 7000);
    } else if (err.name === "NotFoundError") {
      showToast(`⚠️ Kein '${activeProfile().bleName}' gefunden (${err.message || "Timeout"}). Halte ${activeProfile().comboLabel} für 0.5s auf der ${activeProfile().label} gedrückt!`);
    } else {
      showToast("Bluetooth-Fehler: " + err.message);
    }
  }
}

// Sendet EXIT_CONFIG und trennt. Rückgabe: true, wenn die Tastatur den Befehl bestätigt hat.
async function disconnectBle() {
  lastBleDisconnectTime = Date.now();
  let exitConfirmed = false;
  if (bleConfigChar) {
    exitConfirmed = (await sendBleCommandAwait("EXIT_CONFIG", "EXIT_CONFIG", 1500)) === true;
  }
  const dev = bleDevice;
  if (dev && dev.gatt.connected) {
    dev.gatt.disconnect(); // löst gattserverdisconnected -> onBleDisconnected aus
  }
  onBleDisconnected();
  if (!exitConfirmed) {
    showToast("⚠️ EXIT_CONFIG nicht bestätigt: Die Tastatur kehrt spätestens nach 3 Min automatisch in den Tastaturmodus zurück.", 7000);
  }
  return exitConfirmed;
}

function onBleDisconnected() {
  lastBleDisconnectTime = Date.now();
  // Idempotent: manuelles Trennen und das gattserverdisconnected-Event rufen diese Funktion beide auf
  if (!bleDevice && !bleConfigChar && !bleServer) return;
  if (bleDevice) bleDevice.removeEventListener("gattserverdisconnected", onBleDisconnected);
  if (bleConfigChar) bleConfigChar.removeEventListener("characteristicvaluechanged", handleBleNotification);
  rejectAllPendingAcks("Bluetooth-Verbindung getrennt", bleSide);
  bleConfigChar = null;
  bleServer = null;
  bleDevice = null;
  bleSide = null;
  abortDeviceSnapshotReadIfDisconnected();
  updateBleUI(false);
  updateConfigModeUI(false, false);
  showToast("⌨️ Konfig-Modus beendet -> Tastatur wieder mit Mac verbunden.");
}

function updateBleUI(connected, devName) {
  const btn = document.getElementById("btnConnectBle");
  const btPill = document.getElementById("btStatusPill");
  const nameText = document.getElementById("btDeviceNameText");

  if (btn) {
    if (connected) {
      btn.innerHTML = `<span class="btn-icon">⚡</span> Verbunden (Trennen & Tastatur starten)`;
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-outline");
      btn.style.borderColor = "#10b981";
      btn.style.color = "#ffffff";
      btn.title = "Drahtlosen Config-Modus beenden und Tastatur für macOS starten";
    } else {
      btn.innerHTML = `<span class="btn-icon">⚡</span> Bluetooth Live-Sync`;
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
      btn.style.borderColor = "#3b82f6";
      btn.style.color = "#93c5fd";
      btn.title = "Einmalig koppeln oder manuell verbinden (R4C5 + R0C0 für 0.5s gedrückt halten)";
    }
  }

  if (btPill) {
    if (connected) {
      btPill.className = "bluetooth-status-pill connected";
      if (nameText) nameText.textContent = devName || "Dactyl Config";
    } else if (!serialPort || !serialPort.readable) {
      btPill.className = "bluetooth-status-pill disconnected";
      if (nameText) nameText.textContent = "Nicht verbunden";
      resetBatteryUI();
    }
  }

  const btnRead = document.getElementById("btnReadConfig");
  const btnWrite = document.getElementById("btnWriteConfig");
  const isOnline = connected || (!!serialPort && serialPort.writable);
  if (btnRead) btnRead.disabled = !isOnline;
  if (btnWrite) btnWrite.disabled = !isOnline;
}

function sendBleCommand(cmd) {
  if (!bleConfigChar) return Promise.resolve(false);
  const runWrite = async () => {
    if (!bleConfigChar) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(cmd + "\n");
      if (bleConfigChar.writeValueWithResponse) {
        await bleConfigChar.writeValueWithResponse(data);
      } else {
        await bleConfigChar.writeValue(data);
      }
      console.log("[BLE SENT]", cmd);
      return true;
    } catch (e) {
      console.warn("BLE send error:", cmd, e);
      return false;
    }
  };
  const p = bleWriteQueue.then(runWrite, runWrite);
  bleWriteQueue = p.then(() => {}, () => {});
  return p;
}

// -----------------------------------------------------------------------------
// Firmware-Bestätigungen (OK <CMD> / ERR ...): Erfolg erst nach Antwort der Tastatur
// -----------------------------------------------------------------------------
// Wartende Bestätigungen tragen die Hälfte, von der die Antwort kommen muss (js/side-routing.js)
const ackRegistry = Dactyl.createAckRegistry();
// Löst mit true (OK), false (ERR) oder null (Timeout) auf. side: erwartete Hälfte (null = jede Hälfte).
const waitForAck = (okPrefix, timeoutMs = 2500, side = null, unknownOk = false) =>
  ackRegistry.wait(okPrefix, timeoutMs, side, unknownOk);
const resolveAcksForLine = (line, side = null) => ackRegistry.resolveLine(line, side);
const rejectAllPendingAcks = (reason, side = null) => ackRegistry.reject(reason, side);

// Verbindungszustand für die reinen Routing-Funktionen in js/side-routing.js
function connectionState() {
  return {
    bleUp: !!bleConfigChar, bleSide,
    serialUp: !!(serialPort && serialPort.writable), serialSide
  };
}

async function sendBleCommandAwait(cmd, okPrefix, timeoutMs) {
  const side = bleSide;
  const ack = waitForAck(okPrefix, timeoutMs, side);
  const sent = await sendBleCommand(cmd);
  if (!sent) {
    resolveAcksForLine(`ERR SEND ${okPrefix}`, side);
    return false;
  }
  return ack;
}

// Hälfte der aktiven Verbindung (BLE bevorzugt), null ohne Verbindung oder bei unbekannter USB-Hälfte
function connectedSide() {
  return Dactyl.connectedSide(connectionState());
}

// Sendet einen Befehl an eine Hälfte (BLE bevorzugt). Rückgabe: true bei erfolgreichem Senden.
// Ohne Verbindung zu dieser Hälfte wird nichts gesendet: die Änderung bleibt für deren nächsten Sync vorgemerkt.
async function sendDeviceCommand(cmd, side = editSide) {
  const route = Dactyl.routeCommand(side, connectionState());
  if (route === "ble") return sendBleCommand(cmd);
  if (route === "usb") return sendSerialCommand(cmd);
  return false;
}

// Wartet, bis DEVICE_INFO die Hälfte am USB-Port gemeldet hat. Rückgabe: true, wenn es die erwartete Hälfte ist.
async function waitForSerialSide(side, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!serialPort) return false;
    if (serialSide) return serialSide === side;
    await new Promise(r => setTimeout(r, 50));
  }
  return serialSide === side;
}

function handleBleNotification(event) {
  const decoder = new TextDecoder();
  const raw = decoder.decode(event.target.value);
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      console.log("[BLE RECV]", trimmed);
      handleSerialLine(trimmed, bleSide);
    }
  }
}
