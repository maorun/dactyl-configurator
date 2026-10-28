// =============================================================================
// Configuration Read/Write
// =============================================================================

// Timer, der Balken und Text nach einem Sync ausblendet. Ein neuer Sync löscht ihn, sonst blendet er dessen Anzeige aus.
let syncProgressHideTimer = null;

async function writeConfigToESP32(options = {}) {
  const autoDisconnectAfter = !!(options && options.autoDisconnectAfter);

  if (!bleConfigChar && (!serialPort || !serialPort.writable)) {
    alert(`Keine Verbindung zum ESP32 aktiv! Halte ${activeProfile().comboLabel} für 0.5s an der ${activeProfile().label} gedrückt oder verbinde USB.`);
    return;
  }
  if (isAutoSyncing) return;

  // Ziel ist die Hälfte der Verbindung (One-Shot Auto-Sync: die Hälfte, die gerade den Config Mode zeigt),
  // nicht die angezeigte Hälfte. Config und Änderungen beim Start festhalten.
  const side = connectedSide();
  if (!side) {
    alert("Die Hälfte am USB-Port ist noch nicht erkannt (DEVICE_INFO fehlt). Bitte USB neu verbinden.");
    return;
  }
  // Nach dem Layout-Diff nur die verglichene Hälfte übertragen
  if (options && options.expectedSide && options.expectedSide !== side) {
    showToast(`Verbindung zur ${SIDE_PROFILES[options.expectedSide].label} unterbrochen. Nichts übertragen.`, 6000);
    return;
  }
  const cfg = configFor(side);
  const profile = SIDE_PROFILES[side];

  const progressWrap = document.getElementById("autoSyncProgressWrap");
  const progressBar = document.getElementById("autoSyncProgressBar");
  // Text über dem Balken: der Balken zeigt die Übertragung, keine Wartezeit auf weitere Änderungen
  const progressLabel = document.getElementById("autoSyncProgressLabel");
  if (syncProgressHideTimer !== null) {
    clearTimeout(syncProgressHideTimer);
    syncProgressHideTimer = null;
  }
  if (progressWrap) progressWrap.style.display = "block";
  if (progressBar) progressBar.style.width = "2%";
  if (progressLabel) {
    progressLabel.style.display = "block";
    progressLabel.textContent = `Übertrage an ${profile.label} …`;
  }

  const previousConfigMode = isConfigModeActive;
  updateConfigModeUI(bleConfigChar ? true : previousConfigMode, true);
  showToast(`🔄 Übertrage Konfiguration an ${profile.label} (ESP32 NVS)...`);

  // Änderungen, die während des Syncs neu vorgemerkt werden, dürfen am Ende nicht mit verworfen werden
  const syncedChangeIds = new Set(pendingFor(side).map(c => c.id));
  let syncSucceeded = false;
  let completedSteps = 0;

  try {
    // Fehler bei SET_K (ungültige Argumente, belegter Mutex) meldet die Firmware asynchron als ERR
    let batchError = null;
    const errWatcher = (okPrefix) => waitForAck(okPrefix, 60000, side).then(ok => { if (ok === false && !batchError) batchError = okPrefix; });

    const sendCmd = async (cmd) => {
      let ok = false;
      // Wechselt die Verbindung während des Syncs zur anderen Hälfte, wird abgebrochen
      if (connectedSide() !== side) throw new Error(`Verbindung zur ${profile.label} unterbrochen`);
      if (bleConfigChar) {
        ok = await sendBleCommand(cmd);
        if (!ok) throw new Error(`BLE-Übertragung unterbrochen (${cmd})`);
      } else if (serialPort && serialPort.writable) {
        ok = await sendSerialCommand(cmd);
        if (!ok) throw new Error(`USB-Übertragung fehlgeschlagen (${cmd})`);
        // Pacing für USB-Serial Übertragung
        if (completedSteps % 16 === 0) {
          await new Promise(r => setTimeout(r, 4));
        }
      } else {
        throw new Error("Verbindung zum ESP32 unterbrochen");
      }
    };

    // Sendet einen Befehl und wartet auf "OK <prefix>" der Firmware (ERR oder Timeout = Fehler).
    // optional: ältere Firmware kennt den Befehl nicht ("ERR UNKNOWN"); der Sync läuft dann ohne ihn weiter.
    const sendConfirmed = async (cmd, okPrefix, timeoutMs = 3000, optional = false) => {
      const ack = waitForAck(okPrefix, timeoutMs, side, optional);
      try {
        await sendCmd(cmd);
      } catch (e) {
        resolveAcksForLine(`ERR SEND ${okPrefix}`, side);
        throw e;
      }
      const result = await ack;
      if (result === "unknown") {
        showToast(`⚠️ Die Firmware der ${profile.label} kennt ${okPrefix} nicht. Bitte neu flashen, um die Einstellung zu übernehmen.`, 7000);
        return "unknown";
      }
      if (result !== true) throw new Error(`Tastatur hat ${okPrefix} nicht bestätigt`);
    };

    const s = cfg.settings || {};
    const settingCommands = buildSettingCommands(s, profile);
    const totalLayers = Math.min(cfg.layers.length, NUM_LAYERS);
    const combos = cfg.combos.slice(0, MAX_COMBOS);
    const macros = (cfg.macros || []).slice(0, MAX_MACROS);
    const totalSteps = countSyncSteps(settingCommands.length, totalLayers, combos.length, macros.length);
    const showProgressLabel = () => {
      if (progressLabel) progressLabel.textContent = syncProgressLabel(profile.label, completedSteps, totalSteps);
    };
    const updateProgress = () => {
      completedSteps++;
      if (progressBar) {
        const pct = Math.round((completedSteps / totalSteps) * 100);
        progressBar.style.width = `${pct}%`;
      }
      showProgressLabel();
    };
    showProgressLabel();

    for (const { cmd, ack, optional } of settingCommands) {
      await sendConfirmed(cmd, ack, 3000, optional);
      updateProgress();
    }

    for (let l = 0; l < NUM_LAYERS; l++) {
      const name = sanitizeCommandText(cfg.layerNames[l], DEFAULT_LAYER_NAMES[l]);
      await sendConfirmed(`SET_NAME ${l} ${name}`, `SET_NAME ${l}`);
      updateProgress();
    }

    // Schnelles RAM-Update für alle Tasten via SET_K (ohne OK) + einmaliges, bestätigtes SAVE_NVS
    const setKErr = errWatcher("SET_K");
    for (let l = 0; l < totalLayers; l++) {
      const layer = cfg.layers[l] || [];
      for (let r = 0; r < NUM_ROWS; r++) {
        const row = layer[r] || [];
        for (let c = 0; c < NUM_COLS; c++) {
          const { tapCode, holdCode, dtapCode } = keyToNumericActions(row[c]);
          await sendCmd(`SET_K ${l} ${r} ${c} ${tapCode} ${holdCode} ${dtapCode}`);
          updateProgress();
        }
      }
    }

    await sendConfirmed("SAVE_NVS", "SAVE_NVS", 5000);
    if (batchError) throw new Error("Tastatur hat mindestens ein SET_K abgelehnt");
    // Watcher für SET_K-Fehler beenden (kein ERR eingetroffen)
    resolveAcksForLine("OK SET_K", side);
    await setKErr;
    updateProgress();

    // Combos synchronisieren
    await sendConfirmed("CLEAR_COMBOS", "CLEAR_COMBOS");
    const bMap = { "KEY_PRESS": 0, "MODIFIER_HOLD": 1, "LAYER_TOGGLE": 2 };
    for (const cb of combos) {
      const bCode = bMap[cb.behavior] ?? 0;
      const actCode = actionCodeToNumeric(cb.action);
      await sendConfirmed(`ADD_COMBO ${cb.key1.r} ${cb.key1.c} ${cb.key2.r} ${cb.key2.c} ${bCode} ${actCode}`, "ADD_COMBO");
      updateProgress();
    }
    await sendConfirmed("SAVE_COMBOS", "SAVE_COMBOS", 5000);
    updateProgress();

    // Tastenpaare synchronisieren (Index = Position in der Liste, PAIR_<n> verweist darauf)
    await sendConfirmed("CLEAR_PAIRS", "CLEAR_PAIRS");
    for (const pair of cfg.keyPairs.slice(0, MAX_KEY_PAIRS)) {
      await sendConfirmed(`ADD_PAIR ${actionCodeToNumeric(pair.first)} ${actionCodeToNumeric(pair.second)}`, "ADD_PAIR");
    }
    await sendConfirmed("SAVE_PAIRS", "SAVE_PAIRS", 5000);
    updateProgress();

    // Makros synchronisieren (Index = Position in der Liste, MACRO_<n> verweist darauf).
    // Firmware ohne Makros antwortet "ERR UNKNOWN CLEAR_MACROS": Hinweis zeigen und die Phase überspringen.
    const macrosKnown = await sendConfirmed("CLEAR_MACROS", "CLEAR_MACROS", 3000, true);
    if (macrosKnown !== "unknown") {
      for (const macro of macros) {
        for (const cmd of macroCommands(macro)) {
          await sendConfirmed(cmd, cmd === "ADD_MACRO" ? "ADD_MACRO" : "ADD_MACRO_STEP");
        }
        updateProgress();
      }
      await sendConfirmed("SAVE_MACROS", "SAVE_MACROS", 5000);
    } else {
      // Übersprungene Phase: ihre Schritte trotzdem zählen, damit der Balken 100 % erreicht
      macros.forEach(() => updateProgress());
    }
    updateProgress();

    // Nur die tatsächlich übertragenen Änderungen dieser Hälfte verwerfen
    const remaining = pendingFor(side).filter(c => !syncedChangeIds.has(c.id));
    if (remaining.length === 0) clearPendingSync(side);
    else {
      setPendingFor(side, remaining);
      if (side === editSide) renderPendingSyncUI();
    }
    syncSucceeded = true;
  } catch (err) {
    console.error("Write config error:", err);
    rejectAllPendingAcks("Sync abgebrochen", side);
    showToast("Fehler beim Übertragen der Konfiguration: " + err.message + " (Änderungen bleiben vorgemerkt)", 7000);
  } finally {
    // One-Shot: Tastatur IMMER zurück in den Mac-Modus schicken, auch nach einem Fehler.
    // isAutoSyncing bleibt bis nach dem Trennen gesetzt, damit kein Live-Sync in EXIT_CONFIG startet.
    if (autoDisconnectAfter && bleConfigChar) {
      let exited = false;
      try {
        exited = await disconnectBle();
      } finally {
        isAutoSyncing = false;
      }
      if (syncSucceeded && exited) {
        showToast(`✅ ${profile.label} automatisch synchronisiert & getrennt! Sie tippt wieder normal.`);
      }
    } else {
      isAutoSyncing = false;
      updateConfigModeUI(bleConfigChar ? true : previousConfigMode, false);
      if (syncSucceeded) showToast(`✅ Vollständige Konfiguration der ${profile.label} im ESP32 NVS gespeichert!`);
    }
    if (progressLabel) progressLabel.textContent = syncSucceeded ? "Übertragung abgeschlossen" : "Übertragung abgebrochen";
    syncProgressHideTimer = setTimeout(() => {
      syncProgressHideTimer = null;
      if (progressWrap) progressWrap.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
      if (progressLabel) progressLabel.style.display = "none";
    }, 600);
  }
}

// Einstellungs-Befehle des vollen Syncs, in Sende-Reihenfolge. optional: ältere Firmware ohne diesen Befehl
// antwortet "ERR UNKNOWN"; der Sync läuft dann weiter (SET_TAPPING_TERM kam nach den anderen Einstellungen).
function buildSettingCommands(s, profile) {
  return [
    { cmd: `SET_STANDBY ${clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5)}`, ack: "SET_STANDBY" },
    { cmd: `SET_SLEEP ${clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)}`, ack: "SET_SLEEP" },
    { cmd: `SET_DEV_NAME ${sanitizeCommandText(s.deviceName, profile.deviceName)}`, ack: "SET_DEV_NAME" },
    { cmd: `SET_DEBOUNCE ${clampSetting("debounceMs", s.debounceMs ?? 5)}`, ack: "SET_DEBOUNCE" },
    { cmd: `SET_COMBO_TIMEOUT ${clampSetting("comboTimeoutMs", s.comboTimeoutMs ?? 40)}`, ack: "SET_COMBO_TIMEOUT" },
    { cmd: `SET_TAPPING_TERM ${clampSetting("tappingTermMs", s.tappingTermMs ?? 200)}`, ack: "SET_TAPPING_TERM", optional: true }
  ];
}

// Text über dem Fortschrittsbalken, z. B. "Übertrage an rechte Hälfte: 120 / 395 Schritte"
function syncProgressLabel(sideLabel, done, total) {
  return `Übertrage an ${sideLabel}: ${Math.min(done, total)} / ${total} Schritte`;
}

// Fortschrittsschritte des vollen Syncs: Einstellungen, Ebenen-Namen, Tasten (SET_K), SAVE_NVS,
// Combos, SAVE_COMBOS, die Tastenpaar-Phase, je Makro ein Schritt und SAVE_MACROS.
// Muss zu den updateProgress()-Aufrufen passen.
function countSyncSteps(settingCount, layerCount, comboCount, macroCount = 0) {
  return settingCount + NUM_LAYERS + layerCount * NUM_ROWS * NUM_COLS + 1 + comboCount + 1 + 1 + macroCount + 1;
}

// Live-Sync: jede vorgemerkte Änderung einer verbundenen Hälfte überträgt die vollständige Konfiguration
// (Einstellungen, Ebenen-Namen, alle Tasten, Combos, Tastenpaare, Makros), nicht nur die einzelne Änderung.
// So bleibt die Belegung auf dem Gerät gleich der App, auch wenn das Gerät Einzelbefehle verloren hat.
// Änderungen innerhalb von LIVE_SYNC_DEBOUNCE_MS lösen einen Sync aus; eine Änderung während eines Syncs löst
// danach einen weiteren aus. Jeder Sync schreibt Tasten, Combos, Paare und Makros einmal in den NVS.
const LIVE_SYNC_DEBOUNCE_MS = 300;
const LIVE_SYNC_RETRY_MS = 200;
// Geplante Live-Syncs je Hälfte: force = auch ohne vorgemerkte Änderung senden (nach Rückgängig)
const liveSyncQueued = new Map();

// Rückgabe: true, wenn ein Sync geplant ist. Der volle Sync überträgt an die Hälfte der aktiven Verbindung
// (BLE bevorzugt); ist das eine andere Hälfte, bleibt die Änderung bis zu deren nächstem Sync vorgemerkt.
function requestLiveSync(side, force = false) {
  if (!side || connectedSide() !== side) return false;
  if (liveSyncQueued.has(side)) {
    if (force) liveSyncQueued.set(side, true);
  } else {
    liveSyncQueued.set(side, force);
    setTimeout(() => runQueuedLiveSync(side), LIVE_SYNC_DEBOUNCE_MS);
  }
  return true;
}

async function runQueuedLiveSync(side) {
  // Laufender Sync oder Verbindungsaufbau: danach erneut prüfen
  if (isAutoSyncing || isConnectingBle) {
    setTimeout(() => runQueuedLiveSync(side), LIVE_SYNC_RETRY_MS);
    return;
  }
  const force = liveSyncQueued.get(side);
  liveSyncQueued.delete(side);
  const hasPending = pendingFor(side).length > 0;
  if (!hasPending && !force) return;
  // Während des Layout-Diffs entscheidet der Benutzer im Dialog; ohne Verbindung wartet die Änderung auf den
  // nächsten Sync. markPendingSync hat den Hinweis dafür unterdrückt: hier zeigen.
  if (deviceSnapshotRead || diffFlowActive || connectedSide() !== side) {
    if (hasPending) {
      const profile = SIDE_PROFILES[side];
      showToast(`💾 Nicht übertragen: Die Änderungen der ${profile.label} bleiben vorgemerkt. Halte ${profile.comboLabel} (0.5s) zum Übertragen.`, 6000);
    }
    return;
  }
  await writeConfigToESP32({ autoDisconnectAfter: false, expectedSide: side });
}

// One-Shot-Auto-Sync (BLE-Verbindung nach der Config-Combo). Während des Layout-Diffs nicht übertragen:
// die GET_CONFIG-Zeilen fließen noch in den Snapshot, und der Benutzer entscheidet im Dialog selbst.
// Bei autoDisconnectAfter kehrt die Tastatur trotzdem sofort in den Tastaturmodus zurück (EXIT_CONFIG).
async function runAutoSync(options) {
  if (deviceSnapshotRead || diffFlowActive) {
    showToast("Der Vergleich vor dem Speichern läuft noch. Automatische Übertragung übersprungen.");
    if (options && options.autoDisconnectAfter && bleConfigChar) await disconnectBle();
    return;
  }
  return writeConfigToESP32(options);
}

// =============================================================================
// Layout-Diff vor dem manuellen Sync ("Auf ESP32 speichern")
// =============================================================================
// Liest die Gerätebelegung mit GET_CONFIG in einen Snapshot (die lokale Config bleibt unverändert) und zeigt
// die Unterschiede pro Taste. Der One-Shot-Auto-Sync nach der Config-Combo überträgt ohne diesen Dialog.

const DEVICE_SNAPSHOT_TIMEOUT_MS = 8000;
// Nach einem Timeout verwirft die App späte GET_CONFIG-Zeilen dieser Hälfte noch so lange (oder bis CONFIG_SYNC_DONE)
const DEVICE_SNAPSHOT_DRAIN_MS = 30000;
// Laufende Abfrage: { side, snapshot, finish, stale }. Solange sie besteht, übernimmt handleSerialLine die Daten nicht.
// stale = true: Abfrage abgelaufen, späte Zeilen werden nur noch verworfen.
let deviceSnapshotRead = null;
// Diff-Ablauf von "Auf ESP32 speichern" läuft (Abfrage, Dialog oder Rückfrage)
let diffFlowActive = false;

// Leitet GET_CONFIG-Zeilen der abgefragten Hälfte in den Snapshot um. Gibt true zurück, wenn verbraucht.
function captureDeviceSnapshotLine(line, side) {
  const read = deviceSnapshotRead;
  if (!read || side !== read.side) return false;
  const prefix = line.substring(0, line.indexOf(":") + 1);
  const isDone = line.startsWith("CONFIG_SYNC_DONE");
  if (read.stale) {
    if (isDone) read.finish(null);
    return isDone || prefix === "LAYER_NAMES:" || !!MATRIX_DATA_FIELDS[prefix];
  }
  if (prefix === "LAYER_NAMES:") {
    try {
      const names = JSON.parse(line.substring(12));
      if (Array.isArray(names)) read.snapshot.names = names.slice(0, NUM_LAYERS);
    } catch (_) {}
    return true;
  }
  if (MATRIX_DATA_FIELDS[prefix]) {
    try {
      captureMatrixData(read.snapshot, MATRIX_DATA_FIELDS[prefix], JSON.parse(line.substring(prefix.length)));
    } catch (_) {}
    return true;
  }
  if (isDone) {
    read.finish(isDeviceSnapshotComplete(read.snapshot) ? read.snapshot : null);
    return true;
  }
  return false;
}

// Liest die Belegung der verbundenen Hälfte. Rückgabe: Snapshot oder null (Timeout, Sendefehler, unvollständig).
async function readDeviceSnapshot(side) {
  if (deviceSnapshotRead) return null;
  let timer = null;
  let read = null;
  const result = new Promise(resolve => {
    read = {
      side,
      // Weg der Abfrage ("ble" oder "usb"): fällt genau dieser Weg weg, endet die Abfrage
      route: Dactyl.routeCommand(side, connectionState()),
      snapshot: createDeviceSnapshot(),
      stale: false,
      // Ergebnis liefern und Abfrage beenden
      finish: (snap) => {
        clearTimeout(timer);
        if (deviceSnapshotRead === read) deviceSnapshotRead = null;
        resolve(snap);
      }
    };
    deviceSnapshotRead = read;
    // Timeout: Ergebnis null, aber späte Zeilen bis CONFIG_SYNC_DONE oder DEVICE_SNAPSHOT_DRAIN_MS weiter verwerfen
    timer = setTimeout(() => {
      if (deviceSnapshotRead !== read) return;
      read.stale = true;
      resolve(null);
      timer = setTimeout(() => read.finish(null), DEVICE_SNAPSHOT_DRAIN_MS);
    }, DEVICE_SNAPSHOT_TIMEOUT_MS);
  });
  if (!(await sendDeviceCommand("GET_CONFIG", side))) read.finish(null);
  return result;
}

// Nach einer BLE- oder USB-Trennung: eine Abfrage, deren Weg weggefallen ist, sofort beenden statt bis zum
// Timeout zu warten. Auch wenn die Hälfte noch über den anderen Weg verbunden ist: die Antwort kommt nur auf
// dem Weg der Anfrage. writeConfigWithDiff meldet danach die Unterbrechung oder fragt nach.
function abortDeviceSnapshotReadIfDisconnected() {
  const read = deviceSnapshotRead;
  if (!read || read.stale) return;
  const conn = connectionState();
  const routeUp = read.route === "ble" ? conn.bleUp && conn.bleSide === read.side
    : read.route === "usb" && conn.serialUp && conn.serialSide === read.side;
  if (!routeUp) read.finish(null);
}

// Zeigt den Diff im Dialog. Rückgabe: true = übertragen, false = abbrechen.
function showSyncDiffDialog(profile, diff) {
  const modal = document.getElementById("syncDiffModal");
  const summary = document.getElementById("syncDiffSummary");
  const list = document.getElementById("syncDiffList");
  const btnConfirm = document.getElementById("btnConfirmSyncDiff");
  const btnCancel = document.getElementById("btnCancelSyncDiff");
  const btnClose = document.getElementById("btnCloseSyncDiff");
  if (!modal || !summary || !list || !btnConfirm || !btnCancel || !btnClose) return Promise.resolve(true);

  const total = diff.keys.length + diff.names.length;
  summary.textContent = total === 0
    ? `Tasten und Ebenen-Namen der ${profile.label} sind auf dem Gerät gleich.`
    : `${diff.keys.length} Taste(n) und ${diff.names.length} Ebenen-Name(n) der ${profile.label} ändern sich.`;
  list.replaceChildren();
  const addRow = (where, before, after) => {
    const li = document.createElement("li");
    const pos = document.createElement("strong");
    pos.textContent = where;
    const from = document.createElement("span");
    from.className = "sync-diff-device";
    from.textContent = before;
    const to = document.createElement("span");
    to.className = "sync-diff-local";
    to.textContent = after;
    li.append(pos, " ", from, " → ", to);
    list.appendChild(li);
  };
  for (const n of diff.names) addRow(`Name Ebene ${n.l}:`, n.device, n.local);
  for (const k of diff.keys) addRow(`Ebene ${k.l} R${k.r}C${k.c}:`, describeKeyActions(k.device), describeKeyActions(k.local));
  list.style.display = total === 0 ? "none" : "";

  modal.style.display = "flex";
  return new Promise(resolve => {
    const done = (ok) => {
      modal.style.display = "none";
      btnConfirm.removeEventListener("click", onConfirm);
      btnCancel.removeEventListener("click", onCancel);
      btnClose.removeEventListener("click", onCancel);
      resolve(ok);
    };
    const onConfirm = () => done(true);
    const onCancel = () => done(false);
    btnConfirm.addEventListener("click", onConfirm);
    btnCancel.addEventListener("click", onCancel);
    btnClose.addEventListener("click", onCancel);
  });
}

// "Auf ESP32 speichern": zuerst Diff zeigen, dann übertragen
async function writeConfigWithDiff() {
  if (isAutoSyncing || diffFlowActive) return;
  if (deviceSnapshotRead) {
    showToast("Die Tastatur sendet noch die Antwort einer früheren Abfrage. Bitte gleich erneut versuchen.");
    return;
  }
  const side = connectedSide();
  if (!side) return writeConfigToESP32({ autoDisconnectAfter: false });
  const profile = SIDE_PROFILES[side];

  diffFlowActive = true;
  let confirmed = false;
  try {
    showToast(`🔍 Lese Belegung der ${profile.label} für den Vergleich...`);
    const snapshot = await readDeviceSnapshot(side);
    if (connectedSide() !== side) {
      showToast(`Verbindung zur ${profile.label} unterbrochen. Nichts übertragen.`, 6000);
      return;
    }
    if (!snapshot) {
      confirmed = confirm(`Die Belegung der ${profile.label} konnte nicht gelesen werden. Ohne Vergleich übertragen?`);
    } else {
      confirmed = await showSyncDiffDialog(profile, diffKeymap(configFor(side), snapshot, profile));
      if (!confirmed) showToast("Übertragung abgebrochen. Die Änderungen bleiben vorgemerkt.");
    }
  } finally {
    diffFlowActive = false;
  }
  if (confirmed) return writeConfigToESP32({ autoDisconnectAfter: false, expectedSide: side });
}

async function readConfigFromESP32() {
  // Während des Diffs würden die GET_CONFIG-Zeilen den Snapshot verfälschen oder den Vergleich veralten lassen
  if (diffFlowActive || deviceSnapshotRead) {
    showToast("Der Vergleich vor dem Speichern läuft noch. Bitte danach erneut laden.");
    return;
  }
  if (bleConfigChar) {
    await sendBleCommand("GET_CONFIG");
    showToast("Konfigurations-Anfrage per Bluetooth an ESP32 gesendet...");
  } else if (serialPort && serialPort.writable) {
    await sendSerialCommand("GET_CONFIG");
    showToast("Konfigurations-Anfrage per USB an ESP32 gesendet...");
  } else {
    alert("Keine Verbindung zum ESP32 aktiv! Bitte verbinde erst Bluetooth Live-Sync oder USB Live-Monitor.");
  }
}
