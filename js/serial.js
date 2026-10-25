// =============================================================================
// WebSerial Communication (Re-engineered: No stream locking bugs!)
// =============================================================================

function onSerialPortDisconnected(event) {
  if (serialPort && event && event.target === serialPort) {
    showToast("🔌 USB-Verbindung zum ESP32 getrennt.");
    disconnectSerial();
  }
}

let serialTransition = Promise.resolve();

// connectSerial/disconnectSerial laufen nacheinander, damit ein Verbinden nie in ein laufendes Trennen fällt
function connectSerial(options = {}) {
  const run = () => connectSerialNow(options);
  serialTransition = serialTransition.then(run, run);
  return serialTransition;
}

function disconnectSerial() {
  const run = () => disconnectSerialNow();
  serialTransition = serialTransition.then(run, run);
  return serialTransition;
}

async function connectSerialNow(options = {}) {
  if (!("serial" in navigator)) {
    alert("WebSerial wird von deinem Browser nicht unterstützt. Bitte benutze Google Chrome, Microsoft Edge, Arc oder Opera.");
    return;
  }
  if (serialPort) return; // bereits verbunden

  let port = null;
  try {
    if (options.reuseGrantedPort && typeof navigator.serial.getPorts === "function") {
      const granted = await navigator.serial.getPorts();
      port = granted[0] || null;
      if (!port) throw new Error("Kein bereits freigegebener USB-Port gefunden. Bitte manuell verbinden.");
    } else {
      port = await navigator.serial.requestPort();
    }
    await port.open({ baudRate: 115200 });
    // Erst nach erfolgreichem open() als aktive Verbindung übernehmen; Hälfte folgt aus DEVICE_INFO
    serialPort = port;
    serialSide = null;
    serialPort.addEventListener("disconnect", onSerialPortDisconnected);

    keepReading = true;
    updateConnectionUI(true, "ESP32 (USB 115200 Baud)");
    showToast("Erfolgreich mit ESP32 verbunden!");

    // Start read loop
    serialReadPromise = startSerialReadLoop(port);

    // Hälfte abfragen: das Öffnen startet das Board neu, eine einzelne Anfrage ginge dann verloren.
    // GET_INFO alle 500 ms wiederholen, bis DEVICE_INFO die Hälfte meldet (höchstens 5 s).
    if (stopSerialInfoRetry) stopSerialInfoRetry();
    setTimeout(() => {
      if (serialPort !== port) return;
      stopSerialInfoRetry = Dactyl.retryUntil(() => serialPort !== port || serialSide !== null,
        () => sendSerialCommand("GET_INFO"), 500, 5000);
    }, 300);

  } catch (err) {
    console.error("Serial connection error:", err);
    if (port && port !== serialPort) {
      try { await port.close(); } catch (_) {}
    }
    serialPort = null;
    updateConnectionUI(false, "Verbindung fehlgeschlagen");
    showToast("Verbindung abgebrochen oder Fehler: " + err.message);
  }
}

async function disconnectSerialNow() {
  if (!serialPort && !serialReadPromise) return;
  keepReading = false;
  if (serialReader) {
    try {
      await serialReader.cancel();
    } catch(e) {}
  }
  if (serialReadPromise) {
    try {
      await serialReadPromise;
    } catch(e) {}
    serialReadPromise = null;
  }
  if (serialPort) {
    const port = serialPort;
    serialPort = null;
    port.removeEventListener("disconnect", onSerialPortDisconnected);
    try {
      await port.close();
    } catch(e) {
      console.warn("Serial close warning:", e);
    }
  }
  if (stopSerialInfoRetry) {
    stopSerialInfoRetry();
    stopSerialInfoRetry = null;
  }
  // Ein laufender BLE-Sync derselben Hälfte bleibt bestehen (js/side-routing.js)
  const scope = Dactyl.usbDisconnectAckScope({ ...connectionState(), serialUp: false });
  if (scope.reject) rejectAllPendingAcks("USB-Verbindung getrennt", scope.side);
  serialSide = null;
  serialReader = null;
  updateConnectionUI(false, "Nicht verbunden");
  showToast("ESP32 getrennt.");
}

function updateBatteryUI(battery, voltage) {
  // Akkumessung deaktiviert (LOLIN32 Lite besitzt keinen internen Spannungsteiler)
}

function resetBatteryUI() {
  // Akkumessung deaktiviert
}

function updateConnectionUI(connected, text) {
  const btnConnect = document.getElementById("btnConnect");
  const btnRead = document.getElementById("btnReadConfig");
  const btnWrite = document.getElementById("btnWriteConfig");
  const btPill = document.getElementById("btStatusPill");
  const nameText = document.getElementById("btDeviceNameText");

  if (btnConnect) {
    btnConnect.innerHTML = connected
      ? `<span class="btn-icon">🔌</span> USB Verbunden (Trennen)`
      : `<span class="btn-icon">🔌</span> USB Live-Monitor`;
  }

  if (connected) {
    if (btPill) btPill.className = "bluetooth-status-pill connected";
    if (nameText) nameText.textContent = text || "ESP32 (USB)";
  } else if (!bleConfigChar) {
    if (btPill) btPill.className = "bluetooth-status-pill disconnected";
    if (nameText) nameText.textContent = "Nicht verbunden";
    resetBatteryUI();
  }

  const isOnline = connected || !!bleConfigChar;
  if (btnRead) btnRead.disabled = !isOnline;
  if (btnWrite) btnWrite.disabled = !isOnline;
}

// Serielle Schreibvorgänge werden serialisiert (nur ein Writer-Lock gleichzeitig). Rückgabe: true bei Erfolg.
let serialWriteQueue = Promise.resolve();
function sendSerialCommand(cmd) {
  const run = async () => {
    if (!serialPort || !serialPort.writable) return false;
    let writer = null;
    try {
      writer = serialPort.writable.getWriter();
      await writer.write(new TextEncoder().encode(cmd + "\n"));
      return true;
    } catch (e) {
      console.warn("Failed to send command to ESP32:", cmd, e);
      return false;
    } finally {
      // Lock immer freigeben, sonst schlagen alle späteren Schreibvorgänge fehl
      if (writer) {
        try { writer.releaseLock(); } catch (_) {}
      }
    }
  };
  const p = serialWriteQueue.then(run, run);
  serialWriteQueue = p.then(() => {}, () => {});
  return p;
}

// Der Read-Loop ist an "seinen" Port gebunden: ein späteres connectSerial() kann ihn nicht wiederbeleben,
// und sein finally gibt nur den eigenen Reader frei.
async function startSerialReadLoop(port) {
  const decoder = new TextDecoder();
  let buffer = "";
  let reader = null;

  try {
    reader = port.readable.getReader();
    serialReader = reader;
    while (serialPort === port && keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // unvollständige Zeile behalten
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            console.log("[ESP32 SERIAL RECV]", trimmed);
            handleSerialLine(trimmed, serialSide, "usb");
          }
        }
      }
    }
  } catch (err) {
    if (keepReading && serialPort === port) {
      console.warn("Serial read loop error:", err);
    }
  } finally {
    if (reader) {
      try { reader.releaseLock(); } catch(e) {}
    }
    if (serialReader === reader) serialReader = null;
  }
}

// side: Hälfte, von der die Zeile kommt (BLE: aus dem Config-Namen, USB: aus DEVICE_INFO; null = noch unbekannt).
// Rechts ist der Standard, damit ältere Firmware ohne "side" weiter funktioniert.
function handleSerialLine(line, side = null, transport = "ble") {
  if (!line) return;

  // Die Hälfte am USB-Port steht erst nach DEVICE_INFO fest: zuerst erkennen, dann die Zeile zuordnen
  if (line.startsWith("DEVICE_INFO:")) {
    try {
      const detected = Dactyl.sideFromDeviceInfo(JSON.parse(line.substring(12)));
      if (detected) {
        if (transport === "usb") serialSide = detected;
        else resolveBleInfoWaiters(detected);
        side = detected;
      }
    } catch (_) {}
  }
  const lineSide = side || "R";
  const isEditSide = lineSide === editSide;
  const cfg = configFor(lineSide);

  // Bestätigungen/Fehler zuerst an wartende Sync-Schritte weiterreichen
  resolveAcksForLine(line, side);
  if (line.startsWith("ERR ")) {
    console.warn("[ESP32 ERR]", line);
    if (!isAutoSyncing) showToast(`⚠️ Tastatur meldet Fehler: ${line}`, 6000);
    return;
  }

  // 0. Konfig-Modus Status-Events
  if (line === "MODE:CONFIG" || line.startsWith("OK ENTER_CONFIG")) {
    updateConfigModeUI(true, isAutoSyncing);
    showToast("⚡ Tastatur ist jetzt im KONFIG-MODUS ('Dactyl Config')!");
    return;
  }
  if (line === "MODE:KEYBOARD" || line.startsWith("OK EXIT_CONFIG")) {
    updateConfigModeUI(false, false);
    showToast("⌨️ Tastaturmodus aktiv! Verbunden mit macOS.");
    return;
  }
  if (line.startsWith("STATUS:")) {
    if (line.includes("ConfigMode=1")) {
      updateConfigModeUI(true, isAutoSyncing);
    } else if (line.includes("ConfigMode=0") && !bleConfigChar) {
      updateConfigModeUI(false, false);
    }
    return;
  }

  // 1. Device Info (Bluetooth Name, MAC, etc.)
  if (line.startsWith("DEVICE_INFO:")) {
    try {
      const info = JSON.parse(line.substring(12));
      const pill = document.getElementById("btStatusPill");
      const nameText = document.getElementById("btDeviceNameText");
      const statusText = document.getElementById("statusText");

      const devName = info.name || SIDE_PROFILES[lineSide].deviceName;
      const sideLabel = SIDE_PROFILES[lineSide].label;
      if (pill) {
        pill.classList.remove("disconnected");
        pill.classList.add("connected");
      }
      if (nameText) nameText.textContent = `${devName} (${sideLabel})`;
      if (statusText) statusText.textContent = `Verbunden: ${devName} (${sideLabel})`;
      // Felder zeigen immer die bearbeitete Hälfte: Werte der anderen Hälfte nur in deren Config übernehmen
      const setInput = (id, v) => { if (!isEditSide) return; const el = document.getElementById(id); if (el) el.value = String(v); };

      if (info.config_mode !== undefined) {
        updateConfigModeUI(!!info.config_mode, isAutoSyncing);
      }
      if (info.battery !== undefined) {
        updateBatteryUI(info.battery, info.voltage);
      }
      if (info.standby_timeout !== undefined) {
        setInput("standbyTimeoutSelect", info.standby_timeout);
        if (cfg.settings) cfg.settings.standbyTimeoutMinutes = info.standby_timeout;
      }
      if (info.sleep_timeout !== undefined) {
        setInput("sleepTimeoutSelect", info.sleep_timeout);
        if (cfg.settings) cfg.settings.sleepTimeoutMinutes = info.sleep_timeout;
      }
      if (info.debounce_ms !== undefined) {
        setInput("debounceInput", info.debounce_ms);
        if (cfg.settings) cfg.settings.debounceMs = info.debounce_ms;
      }
      if (info.combo_timeout_ms !== undefined) {
        setInput("comboTimeoutInput", info.combo_timeout_ms);
        if (cfg.settings) cfg.settings.comboTimeoutMs = info.combo_timeout_ms;
      }
      if (info.name && !info.name.includes("Config")) {
        setInput("deviceNameInput", info.name);
        if (cfg.settings) cfg.settings.deviceName = info.name;
      }
      showToast(`Tastatur erkannt: ${devName} (${sideLabel})`);
    } catch (e) {
      console.warn("Failed to parse DEVICE_INFO:", e, line);
    }
  }

  // 2. Taste gedrückt (Key Press Event)
  else if (line.startsWith("KEY_PRESS:")) {
    try {
      const evt = JSON.parse(line.substring(10));
      if (!isValidIndex(evt.r, NUM_ROWS) || !isValidIndex(evt.c, NUM_COLS)) return;
      const pressedLayer = isValidIndex(evt.layer, NUM_LAYERS) ? evt.layer : undefined;
      if (isEditSide && isValidIndex(evt.target_layer, NUM_LAYERS) && evt.target_layer !== activeLayerIndex) {
        switchLayerUI(evt.target_layer);
      }
      triggerVisualKeyPress(evt.r, evt.c, typeof evt.key === "string" ? evt.key : "", lineSide, pressedLayer);
      if (recordKeyPress(typingStatsFor(lineSide), evt.r, evt.c, Date.now())) onTypingStatsChanged(lineSide);
      if (markMatrixKeyTested(matrixTestFor(lineSide), evt.r, evt.c) && isEditSide) renderMatrixTest();
    } catch (e) {
      console.warn("Failed to parse KEY_PRESS:", e, line);
    }
  }

  // 3. Taste losgelassen (Key Release Event)
  else if (line.startsWith("KEY_RELEASE:")) {
    try {
      const evt = JSON.parse(line.substring(12));
      if (!isValidIndex(evt.r, NUM_ROWS) || !isValidIndex(evt.c, NUM_COLS)) return;
      triggerVisualKeyRelease(evt.r, evt.c, lineSide);
    } catch (e) {
      console.warn("Failed to parse KEY_RELEASE:", e, line);
    }
  }

  // 4. Layer Umschaltung aus Firmware
  else if (line.startsWith("LAYER:")) {
    const match = line.match(/Layer\s*(\d+)/i);
    if (match && isEditSide) {
      const l = parseInt(match[1], 10);
      switchLayerUI(l);
    }
  }

  // 5. Layer-Daten (Tastenbelegung) von Firmware synchronisieren (GET_CONFIG)
  else if (line.startsWith("LAYER_DATA:") || line.startsWith("HOLD_DATA:") || line.startsWith("DTAP_DATA:")) {
    const prefix = line.substring(0, line.indexOf(":") + 1);
    try {
      const data = JSON.parse(line.substring(prefix.length));
      if (applyMatrixData(cfg.layers, MATRIX_DATA_FIELDS[prefix], data)) renderMatrix();
    } catch (e) {
      console.warn("Failed to parse LAYER_DATA/HOLD_DATA/DTAP_DATA:", e, line);
    }
  } else if (line.startsWith("CONFIG_SYNC_DONE")) {
    clearPendingSync(lineSide);
    saveConfigToServer(lineSide);
    showToast(`✅ Tastaturbelegung der ${SIDE_PROFILES[lineSide].label} vollständig synchronisiert!`);
  }

  // 6. Layer-Namen von Firmware synchronisieren
  else if (line.startsWith("LAYER_NAMES:")) {
    try {
      const names = JSON.parse(line.substring(12));
      if (Array.isArray(names) && names.length > 0) {
        cfg.layerNames = DEFAULT_LAYER_NAMES.map((def, i) => sanitizeCommandText(names[i], def));
        if (isEditSide) renderLayerButtons();
        saveConfigToServer(lineSide);
        showToast("Ebenen-Namen von Tastatur synchronisiert!");
      }
    } catch (e) {
      console.warn("Failed to parse LAYER_NAMES:", e, line);
    }
  }

  // 7. Bestätigung von Konfigurations-Befehlen
  // Ausstehende Änderungen werden NICHT hier verworfen, sondern erst nach vollständig bestätigtem Sync
  // (writeConfigToESP32), damit ein Fehler in der Combo-Phase den Änderungsverlauf nicht löscht.
  else if (line.startsWith("OK SET_KEY")) {
    if (!isAutoSyncing) showToast("✅ Taste im ESP32 NVS gespeichert!");
  } else if (line.startsWith("OK SAVE_NVS")) {
    if (!isAutoSyncing) showToast("✅ Tastenbelegung dauerhaft im ESP32 NVS gespeichert!");
  } else if (line.startsWith("OK SET_NAME")) {
    showToast("✅ Ebenen-Name im ESP32 NVS gespeichert!");
  } else if (line.startsWith("OK SET_STANDBY")) {
    const parts = line.split(" ");
    const mins = parts[2] || "5";
    showToast(`✅ Standby-Timeout im ESP32 NVS auf ${mins} Min gesetzt!`);
  } else if (line.startsWith("OK SET_SLEEP")) {
    const parts = line.split(" ");
    const mins = parts[2] || "60";
    showToast(`✅ Deep-Sleep-Timeout im ESP32 NVS auf ${mins} Min gesetzt!`);
  } else if (line.startsWith("SLEEP_STARTING")) {
    showToast("💤 Tastatur geht in Deep Sleep (Stromsparmodus)... Beliebige Taste drücken zum Aufwecken!", 6000);
    resetBatteryUI();
    const btPill = document.getElementById("btStatusPill");
    const nameText = document.getElementById("btDeviceNameText");
    if (btPill) btPill.className = "bluetooth-status-pill disconnected";
    if (nameText) nameText.textContent = "Deep Sleep (Standby)";
  }
}

function switchLayerUI(layerIdx) {
  if (!isValidIndex(layerIdx, NUM_LAYERS) || layerIdx === activeLayerIndex) return;
  document.querySelectorAll(".layer-btn").forEach(b => {
    if (parseInt(b.dataset.layer, 10) === layerIdx) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });
  activeLayerIndex = layerIdx;
  updateLayerNameInput();
  renderMatrix();
  if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
}
