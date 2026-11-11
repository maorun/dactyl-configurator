// =============================================================================
// Configuration Read/Write
// =============================================================================

// Timer, der Balken und Text nach einem Sync ausblendet. Ein neuer Sync löscht ihn, sonst blendet er dessen Anzeige aus.
let syncProgressHideTimer = null;

async function writeConfigToESP32(options = {}) {
  hideStaleLayoutBanner();
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
    // Vor dem ersten Befehl, nach dem Setzen von isAutoSyncing (kein zweiter Sync während des Wartens):
    // server.py speichert den Stand als automatisches Backup (höchstens alle 10 Minuten)
    await backupConfigOnServer(side, cfg);

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
    // optional "args": auch "ERR ARGS" (ältere Firmware kennt den Wert nicht) lässt den Sync weiterlaufen.
    const sendConfirmed = async (cmd, okPrefix, timeoutMs = 3000, optional = false, quietUnknown = false) => {
      const ack = waitForAck(okPrefix, timeoutMs, side, optional);
      try {
        await sendCmd(cmd);
      } catch (e) {
        resolveAcksForLine(`ERR SEND ${okPrefix}`, side);
        throw e;
      }
      const result = await ack;
      if (result === "unknown") {
        if (quietUnknown) return "unknown";
        const what = okPrefix === "SET_AUTO_SHIFT" ? "den gewählten Auto-Shift-Modus bei SET_AUTO_SHIFT" : okPrefix;
        showToast(`⚠️ Die Firmware der ${profile.label} kennt ${what} nicht. Bitte neu flashen, um die Einstellung zu übernehmen.`, 7000);
        return "unknown";
      }
      if (result !== true) throw new Error(`Tastatur hat ${okPrefix} nicht bestätigt`);
    };

    const s = cfg.settings || {};
    const settingCommands = buildSettingCommands(s, profile);
    const totalLayers = Math.min(cfg.layers.length, NUM_LAYERS);
    const combos = cfg.combos.slice(0, MAX_COMBOS);
    const macros = (cfg.macros || []).slice(0, MAX_MACROS);
    const overrides = profile.master ? (cfg.keyOverrides || []).slice(0, MAX_KEY_OVERRIDES) : [];
    const leaderSeqs = (cfg.leaderSequences || []).slice(0, MAX_LEADER_SEQS);
    const altRepeats = (cfg.altRepeats || []).slice(0, MAX_ALT_REPEATS);
    const totalSteps = countSyncSteps(settingCommands.length, totalLayers, combos.length, macros.length, profile.master ? overrides.length : -1, leaderSeqs.length, altRepeats.length);
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

    // Eigene Tapping-Terme je Taste: Firmware davor kennt CLEAR_TAP_TERMS nicht; der Hinweis erscheint nur,
    // wenn die App Werte senden müsste. Die Werte folgen nach den Tasten (SET_KT, wie SET_K ohne Bestätigung).
    // Eigene Hold-Tap-Varianten ebenso (CLEAR_HOLD_FLAVORS, SET_KF).
    let tapTermsKnown = false;
    let holdFlavorsKnown = false;
    let quickTapsKnown = false;
    for (const { cmd, ack, optional, quietUnknown } of settingCommands) {
      const hasOwn = ack === "CLEAR_QUICK_TAPS" ? hasKeyQuickTaps(cfg.layers) : ack === "CLEAR_HOLD_FLAVORS" ? hasKeyHoldFlavors(cfg.layers) : hasKeyTapTerms(cfg.layers);
      const result = await sendConfirmed(cmd, ack, 3000, optional, !!quietUnknown && !hasOwn);
      if (ack === "CLEAR_TAP_TERMS") tapTermsKnown = result !== "unknown";
      if (ack === "CLEAR_HOLD_FLAVORS") holdFlavorsKnown = result !== "unknown";
      if (ack === "CLEAR_QUICK_TAPS") quickTapsKnown = result !== "unknown";
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
          const term = keyTapTerm(row[c]);
          if (term && tapTermsKnown) await sendCmd(`SET_KT ${l} ${r} ${c} ${term}`);
          const flavor = keyHoldFlavor(row[c]);
          if (flavor && holdFlavorsKnown) await sendCmd(`SET_KF ${l} ${r} ${c} ${flavor}`);
          const quickTap = keyQuickTap(row[c]);
          if (quickTap && quickTapsKnown) await sendCmd(`SET_KQ ${l} ${r} ${c} ${quickTap}`);
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
      // Siebter Wert: Ebenenmaske. Bei "alle Ebenen" entfällt er, so versteht ihn auch Firmware ohne Masken.
      const mask = comboLayerMask(cb);
      // Weitere Werte: r3 c3 (255 255 = keine) und Fenster in ms. Sie entfallen bei zwei Tasten mit globalem Fenster;
      // dann versteht auch Firmware vor Stand 24 den Befehl.
      const third = comboThirdKey(cb);
      const windowMs = comboWindowMs(cb);
      const moreArg = third || windowMs ? ` ${mask} ${third ? third.r : COMBO_NO_KEY} ${third ? third.c : COMBO_NO_KEY} ${windowMs}` : "";
      const maskArg = moreArg || (mask === COMBO_ALL_LAYERS ? "" : ` ${mask}`);
      await sendConfirmed(`ADD_COMBO ${cb.key1.r} ${cb.key1.c} ${cb.key2.r} ${cb.key2.c} ${bCode} ${actCode}${maskArg}`, "ADD_COMBO");
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

    // Tasten-Überschreibungen synchronisieren (nur der Master; Firmware vor Stand 7 antwortet "ERR UNKNOWN":
    // Hinweis zeigen und die Phase überspringen). Die linke Hälfte hat keine Liste.
    if (profile.master) {
      const overrideKnown = await sendConfirmed("CLEAR_OVERRIDES", "CLEAR_OVERRIDES", 3000, true);
      if (overrideKnown !== "unknown") {
        for (const o of overrides) {
          await sendConfirmed(`ADD_OVERRIDE ${keyOverrideModsByte(o)} ${actionCodeToNumeric(o.key)} ${actionCodeToNumeric(o.replacement)}${keyOverrideLayerMask(o) === COMBO_ALL_LAYERS ? "" : " " + keyOverrideLayerMask(o)}`, "ADD_OVERRIDE", 3000, o.strict === true ? "args" : false);
          updateProgress();
        }
        await sendConfirmed("SAVE_OVERRIDES", "SAVE_OVERRIDES", 5000);
      } else {
        overrides.forEach(() => updateProgress());
      }
      updateProgress();
    }

    // Makros synchronisieren (Index = Position in der Liste, MACRO_<n> verweist darauf).
    // Firmware ohne Makros antwortet "ERR UNKNOWN CLEAR_MACROS": Hinweis zeigen und die Phase überspringen.
    const macrosKnown = await sendConfirmed("CLEAR_MACROS", "CLEAR_MACROS", 3000, true);
    if (macrosKnown !== "unknown") {
      for (const macro of macros) {
        for (const cmd of macroCommands(macro)) {
          await sendConfirmed(cmd, cmd.startsWith("ADD_MACRO_STEP") ? "ADD_MACRO_STEP" : "ADD_MACRO");
        }
        updateProgress();
      }
      await sendConfirmed("SAVE_MACROS", "SAVE_MACROS", 5000);
    } else {
      // Übersprungene Phase: ihre Schritte trotzdem zählen, damit der Balken 100 % erreicht
      macros.forEach(() => updateProgress());
    }
    updateProgress();

    // Leader-Sequenzen synchronisieren (beide Hälften; Firmware vor Stand 26 antwortet "ERR UNKNOWN": Hinweis zeigen
    // und die Phase überspringen)
    const leaderKnown = await sendConfirmed("CLEAR_LEADER", "CLEAR_LEADER", 3000, true);
    if (leaderKnown !== "unknown") {
      try {
        for (const q of leaderSeqs) {
          const keys = q.keys.map(actionCodeToNumeric).join(" ");
          await sendConfirmed(`ADD_LEADER ${actionCodeToNumeric(q.action)} ${keys}`, "ADD_LEADER");
          updateProgress();
        }
        await sendConfirmed("SAVE_LEADER", "SAVE_LEADER", 5000);
      } catch (e) {
        // CLEAR_LEADER hat die Liste im RAM schon geleert: bis zum Neustart gilt die Liste ohne Speichern nur teilweise
        showToast(`⚠️ Die Leader-Folgen der ${profile.label} wurden nur teilweise übertragen und nicht gespeichert. Bitte erneut speichern.`, 9000);
        throw e;
      }
    } else {
      leaderSeqs.forEach(() => updateProgress());
    }
    updateProgress();

    // Eigene Alt-Repeat-Paare synchronisieren (beide Hälften; Firmware vor Stand 34 antwortet "ERR UNKNOWN": die Phase überspringen)
    const altRepeatKnown = await sendConfirmed("CLEAR_ALT_REPEATS", "CLEAR_ALT_REPEATS", 3000, true);
    if (altRepeatKnown !== "unknown") {
      try {
        for (const e of altRepeats) {
          await sendConfirmed(`ADD_ALT_REPEAT ${actionCodeToNumeric(e.key)} ${actionCodeToNumeric(e.alt)}`, "ADD_ALT_REPEAT");
          updateProgress();
        }
        await sendConfirmed("SAVE_ALT_REPEATS", "SAVE_ALT_REPEATS", 5000);
      } catch (e) {
        showToast(`⚠️ Die Alt-Repeat-Paare der ${profile.label} wurden nur teilweise übertragen und nicht gespeichert. Bitte erneut speichern.`, 9000);
        throw e;
      }
    } else {
      altRepeats.forEach(() => updateProgress());
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

// Automatisches Backup vor einem Sync (POST /api/backups?side=L|R). Ein Fehler hält den Sync nicht auf.
// Ein hängender Server bricht nach BACKUP_TIMEOUT_MS ab: der Sync wartet sonst, und der Config Mode läuft ab.
const BACKUP_TIMEOUT_MS = 3000;
// Der Live-Sync läuft nach jeder Änderung: die Warnung erscheint einmal pro Fehlerserie, nicht bei jedem Sync
let backupFailureShown = false;
async function backupConfigOnServer(side, cfg) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), BACKUP_TIMEOUT_MS) : null;
  let msg = "Server nicht erreichbar.";
  try {
    const res = await fetch(`/api/backups?side=${side}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
      signal: controller ? controller.signal : undefined
    });
    if (res.ok) {
      backupFailureShown = false;
      return true;
    }
    msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch (_) {}
  } catch (e) {
    console.warn("Backup vor dem Sync fehlgeschlagen:", e);
    if (e && e.name === "AbortError") msg = "Server antwortet nicht.";
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
  if (!backupFailureShown) {
    backupFailureShown = true;
    showToast(`⚠️ Backup vor dem Sync fehlgeschlagen: ${msg}`, 6000);
  }
  return false;
}

// Einstellungs-Befehle des vollen Syncs, in Sende-Reihenfolge. optional: ältere Firmware ohne diesen Befehl
// antwortet "ERR UNKNOWN"; der Sync läuft dann weiter (SET_TAPPING_TERM kam nach den anderen Einstellungen).
// optional "args": auch "ERR ARGS" einer älteren Firmware (kennt den Wert nicht, z. B. Auto-Shift-Modus 2..4) wird so behandelt.
function buildSettingCommands(s, profile) {
  return [
    { cmd: `SET_STANDBY ${clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5)}`, ack: "SET_STANDBY" },
    { cmd: `SET_SLEEP ${clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)}`, ack: "SET_SLEEP" },
    { cmd: `SET_DEV_NAME ${sanitizeCommandText(s.deviceName, profile.deviceName)}`, ack: "SET_DEV_NAME" },
    { cmd: `SET_DEBOUNCE ${clampSetting("debounceMs", s.debounceMs ?? 5)}`, ack: "SET_DEBOUNCE" },
    { cmd: `SET_COMBO_TIMEOUT ${clampSetting("comboTimeoutMs", s.comboTimeoutMs ?? 40)}`, ack: "SET_COMBO_TIMEOUT" },
    { cmd: `SET_TAPPING_TERM ${clampSetting("tappingTermMs", s.tappingTermMs ?? 200)}`, ack: "SET_TAPPING_TERM", optional: true },
    { cmd: `SET_HOLD_MODE ${clampSetting("holdTapMode", s.holdTapMode ?? 0)}`, ack: "SET_HOLD_MODE", optional: true },
    { cmd: `SET_QUICK_TAP ${clampSetting("quickTapMs", s.quickTapMs ?? 0)}`, ack: "SET_QUICK_TAP", optional: true },
    { cmd: `SET_PRIOR_IDLE ${clampSetting("requirePriorIdleMs", s.requirePriorIdleMs ?? 0)}`, ack: "SET_PRIOR_IDLE", optional: true },
    { cmd: `SET_CHORDAL_HOLD ${clampSetting("chordalHold", s.chordalHold ?? 0)}`, ack: "SET_CHORDAL_HOLD", optional: true },
    { cmd: `SET_TRI_LAYER ${triLayerArgs(s.triLayers)}`, ack: "SET_TRI_LAYER", optional: true },
    // Caps-Lock-LED: nur die Hälfte mit dem Host-Dienst (Master) kennt den Befehl
    ...(profile.master ? [{ cmd: `SET_CAPS_LED ${clampSetting("capsLed", s.capsLed ?? 0)}`, ack: "SET_CAPS_LED", optional: true }] : []),
    { cmd: `SET_LEADER_TIMEOUT ${clampSetting("leaderTimeoutMs", s.leaderTimeoutMs ?? 1000)}`, ack: "SET_LEADER_TIMEOUT", optional: true },
    { cmd: `SET_LAYER_TIMEOUT ${clampSetting("layerTimeoutMs", s.layerTimeoutMs ?? 0)}`, ack: "SET_LAYER_TIMEOUT", optional: "args" },
    { cmd: `SET_AUTO_MOUSE_LAYER ${clampSetting("autoMouseLayer", s.autoMouseLayer ?? 255)}`, ack: "SET_AUTO_MOUSE_LAYER", optional: "args" },
    { cmd: `SET_MOUSE_TIMEOUT ${clampSetting("mouseTimeoutMs", s.mouseTimeoutMs ?? 500)}`, ack: "SET_MOUSE_TIMEOUT", optional: "args" },
    { cmd: `SET_ONESHOT_TIMEOUT ${clampSetting("oneShotTimeoutMs", s.oneShotTimeoutMs ?? 0)}`, ack: "SET_ONESHOT_TIMEOUT", optional: "args" },
    { cmd: `SET_AUTO_SHIFT ${clampSetting("autoShift", s.autoShift ?? 0)}`, ack: "SET_AUTO_SHIFT", optional: "args" },
    { cmd: `SET_AUTO_SHIFT_TERM ${clampSetting("autoShiftMs", s.autoShiftMs ?? 175)}`, ack: "SET_AUTO_SHIFT_TERM", optional: true },
    { cmd: `SET_RETRO_TAP ${clampSetting("retroTap", s.retroTap ?? 0)}`, ack: "SET_RETRO_TAP", optional: true },
    { cmd: `SET_NUM_WORD_LAYER ${clampSetting("numWordLayer", s.numWordLayer ?? 1)}`, ack: "SET_NUM_WORD_LAYER", optional: "args" },
    { cmd: `SET_BOOT_LAYER ${clampSetting("bootLayer", s.bootLayer ?? 0)}`, ack: "SET_BOOT_LAYER", optional: "args" },
    { cmd: `SET_CHORDAL_EX ${chordalExNormalize(s.chordalHoldExclusions)}`, ack: "SET_CHORDAL_EX", optional: true },
    { cmd: "CLEAR_TAP_TERMS", ack: "CLEAR_TAP_TERMS", optional: true, quietUnknown: true },
    { cmd: "CLEAR_HOLD_FLAVORS", ack: "CLEAR_HOLD_FLAVORS", optional: "args", quietUnknown: true },
    { cmd: "CLEAR_QUICK_TAPS", ack: "CLEAR_QUICK_TAPS", optional: "args", quietUnknown: true }
  ];
}

// true, wenn mindestens eine Taste einen eigenen Tapping-Term trägt
function hasKeyTapTerms(layers) {
  return (layers || []).some(layer => (layer || []).some(row => (row || []).some(cell => keyTapTerm(cell) > 0)));
}

// true, wenn mindestens eine Taste eine eigene Hold-Tap-Variante trägt
function hasKeyHoldFlavors(layers) {
  return (layers || []).some(layer => (layer || []).some(row => (row || []).some(cell => keyHoldFlavor(cell) > 0)));
}

// true, wenn mindestens eine Taste einen eigenen Quick-Tap-Term trägt
function hasKeyQuickTaps(layers) {
  return (layers || []).some(layer => (layer || []).some(row => (row || []).some(cell => keyQuickTap(cell) > 0)));
}

// Argument von SET_TRI_LAYER: "a b target" je Regel, "-" ohne Regel
function triLayerArgs(rules) {
  const list = normalizeTriLayers(rules);
  return list.length ? list.map(r => `${r.a} ${r.b} ${r.target}`).join(" ") : "-";
}

// Text über dem Fortschrittsbalken, z. B. "Übertrage an rechte Hälfte: 120 / 395 Schritte"
function syncProgressLabel(sideLabel, done, total) {
  return `Übertrage an ${sideLabel}: ${Math.min(done, total)} / ${total} Schritte`;
}

// Fortschrittsschritte des vollen Syncs: Einstellungen, Ebenen-Namen, Tasten (SET_K), SAVE_NVS,
// Combos, SAVE_COMBOS, die Tastenpaar-Phase, je Makro ein Schritt und SAVE_MACROS.
// Muss zu den updateProgress()-Aufrufen passen.
// overrideCount: Zahl der Tasten-Überschreibungen des Masters; -1 = diese Hälfte hat keine Überschreibungen
// leaderCount: Zahl der Leader-Sequenzen; die Phase zählt CLEAR_LEADER/ADD_LEADER/SAVE_LEADER als Sequenzen + 1
// altRepeatCount: Zahl der Alt-Repeat-Paare; dieselbe Zählung (Paare + 1)
function countSyncSteps(settingCount, layerCount, comboCount, macroCount = 0, overrideCount = -1, leaderCount = 0, altRepeatCount = 0) {
  const overrideSteps = overrideCount < 0 ? 0 : overrideCount + 1;
  return settingCount + NUM_LAYERS + layerCount * NUM_ROWS * NUM_COLS + 1 + comboCount + 1 + 1 + overrideSteps + macroCount + 1 + leaderCount + 1 + altRepeatCount + 1;
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
  // Erst die stille Banner-Abfrage abwarten, dann auf Sync und Verbindungsaufbau prüfen
  await waitForStaleLayoutRead();
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
  await waitForStaleLayoutRead();
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
// Hälfte, deren Konfiguration "Vom ESP32 laden" gerade liest oder im Dialog zeigt (null = kein Ladevorgang).
// handleSerialLine übernimmt DEVICE_INFO-Einstellungen dieser Hälfte erst nach der Bestätigung.
let deviceLoadSide = null;
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
  // Komplettes Laden: DEVICE_INFO zusätzlich in den Snapshot legen. Die Zeile geht weiter an den normalen Handler
  // (Firmwarestand, Split-Link, Einstellungen): false = nicht verbraucht.
  if (read.withInfo && !read.stale && prefix === "AUTO_MOUSE:") {
    // Die Zeile kommt vor DEVICE_INFO (BLE-Limit): ihre Felder aml und amt gehören zu info
    try {
      const am = JSON.parse(line.substring(prefix.length));
      if (am && typeof am === "object" && !Array.isArray(am)) read.autoMouse = { aml: am.aml, amt: am.amt };
    } catch (_) {}
    return false;
  }
  if (read.withInfo && !read.stale && prefix === "DEVICE_INFO:") {
    try {
      const info = JSON.parse(line.substring(prefix.length));
      if (info && typeof info === "object" && !Array.isArray(info)) read.snapshot.info = { ...info, ...(read.autoMouse || {}) };
    } catch (_) {}
    return false;
  }
  if (read.stale) {
    if (isDone) read.finish(null);
    return isDone || prefix === "LAYER_NAMES:" || !!MATRIX_DATA_FIELDS[prefix] || prefix === "CHORDAL_EX:" || captureListLine(createDeviceSnapshot(), line);
  }
  if (captureChordalExLine(read.snapshot, line) || captureListLine(read.snapshot, line)) return true;
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
// withInfo: fragt vorher GET_INFO ab und legt DEVICE_INFO in snapshot.info ab (für das komplette Laden).
async function readDeviceSnapshot(side, withInfo = false, silent = false) {
  if (deviceSnapshotRead) return null;
  let timer = null;
  let read = null;
  const result = new Promise(resolve => {
    read = {
      side,
      withInfo,
      // silent: stille Abfrage des Banners; Speichern und Laden warten auf sie (waitForStaleLayoutRead)
      silent,
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
  // Die Antwort auf GET_INFO kommt vor den GET_CONFIG-Zeilen (gleicher Weg, gleiche Reihenfolge)
  const infoSent = !withInfo || await sendDeviceCommand("GET_INFO", side);
  if (!infoSent || !(await sendDeviceCommand("GET_CONFIG", side))) read.finish(null);
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
function showSyncDiffDialog(profile, diff, options = {}) {
  const modal = document.getElementById("syncDiffModal");
  const summary = document.getElementById("syncDiffSummary");
  const list = document.getElementById("syncDiffList");
  const btnConfirm = document.getElementById("btnConfirmSyncDiff");
  const btnCancel = document.getElementById("btnCancelSyncDiff");
  const btnClose = document.getElementById("btnCloseSyncDiff");
  if (!modal || !summary || !list || !btnConfirm || !btnCancel || !btnClose) return Promise.resolve(true);

  const lists = diff.lists || { known: false, combos: [], pairs: [], overrides: [], leader: [], altrep: [], macros: [] };
  const altrepRows = lists.altrep || [];
  const listCount = lists.combos.length + lists.pairs.length + lists.overrides.length + lists.leader.length + altrepRows.length + lists.macros.length;
  const settingsRows = options.settingsRows || [];
  const chordalRows = diff.chordal || [];
  const total = diff.keys.length + diff.names.length + chordalRows.length + listCount + settingsRows.length;
  const listsHint = lists.known ? ""
    : lists.state === "incomplete" ? " Combos, Tastenpaare und Makros kamen unvollständig an und sind nicht verglichen."
    : " Combos, Tastenpaare und Makros vergleicht die Firmware dieses Geräts nicht: Hälfte flashen.";
  const loading = options.mode === "load";
  const what = lists.known ? "Tasten, Ebenen-Namen, Combos, Tastenpaare und Makros" : "Tasten und Ebenen-Namen";
  summary.textContent = total === 0
    ? `${what} der ${profile.label} sind auf dem Gerät gleich.${listsHint}`
    : `${diff.keys.length} Taste(n), ${diff.names.length} Ebenen-Name(n)` + (chordalRows.length ? `, ${chordalRows.length} Chordal-Hold-Ausnahme(n)` : "") +
      (lists.known ? `, ${lists.combos.length} Combo(s), ${lists.pairs.length} Tastenpaar(e), ${lists.overrides.length} Überschreibung(en), ${lists.leader.length} Leader-Sequenz(en), ${altrepRows.length} Alt-Repeat-Paar(e) und ${lists.macros.length} Makro(s)` : "") +
      (settingsRows.length ? `, ${settingsRows.length} Einstellung(en)` : "") +
      ` der ${profile.label} ${loading ? "ändern sich beim Laden" : "ändern sich"}.` + listsHint;
  const hint = document.getElementById("syncDiffHint");
  if (hint) {
    hint.textContent = loading
      ? "Links steht die lokale Belegung, rechts die Belegung auf dem Gerät. Beim Laden ersetzt die Geräte-Belegung die lokale (Rückgängig über die vorgemerkten Änderungen)."
      : "Links steht die Belegung auf dem Gerät, rechts die neue Belegung. Combos und Tastenpaare werden ohne Vergleich übertragen.";
  }
  btnConfirm.textContent = loading ? "Laden" : "Übertragen";
  list.replaceChildren();
  // Beim Laden steht links die lokale Belegung und rechts die Geräte-Belegung, die sie ersetzt
  const addRow = (where, deviceText, localText) => {
    const before = loading ? localText : deviceText;
    const after = loading ? deviceText : localText;
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
  for (const row of settingsRows) addRow(row.where, row.device, row.local);
  for (const n of diff.names) addRow(`Name Ebene ${n.l}:`, n.device, n.local);
  for (const row of chordalRows) addRow(row.where, row.device, row.local);
  for (const row of [...lists.combos, ...lists.pairs, ...lists.overrides, ...lists.leader, ...altrepRows, ...lists.macros]) addRow(`${row.where}:`, row.device, row.local);
  for (const k of diff.keys) addRow(`Ebene ${k.l} R${k.r}C${k.c}:`, describeKeyActions(k.device), describeKeyActions(k.local));
  list.style.display = total === 0 ? "none" : "";
  renderSyncDiffLint();

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
  await waitForStaleLayoutRead();
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

// "Vom ESP32 laden": baut aus GET_CONFIG und DEVICE_INFO der verbundenen Hälfte eine komplette Config, zeigt den
// Diff gegen die lokale Config und ersetzt sie nach der Bestätigung (Snapshot-Änderung wie ein Import).
// Ein Snapshot mit einer ungültigen oder fehlenden Zeile ändert nichts.
async function readConfigFromESP32() {
  await waitForStaleLayoutRead();
  // Während des Diffs würden die GET_CONFIG-Zeilen den Snapshot verfälschen oder den Vergleich veralten lassen
  if (diffFlowActive || deviceSnapshotRead) {
    showToast("Der Vergleich vor dem Speichern läuft noch. Bitte danach erneut laden.");
    return;
  }
  if (isAutoSyncing || isConnectingBle) {
    showToast("Eine Übertragung oder ein Verbindungsaufbau läuft noch. Bitte danach erneut laden.");
    return;
  }
  const side = connectedSide();
  if (!side) {
    alert("Keine Verbindung zum ESP32 aktiv! Bitte verbinde erst Bluetooth Live-Sync oder USB Live-Monitor.");
    return;
  }
  if (side !== editSide) {
    showToast(`Verbunden ist die ${SIDE_PROFILES[side].label}. Wechsle zu dieser Hälfte, um ihre Belegung zu laden.`, 6000);
    return;
  }
  const profile = SIDE_PROFILES[side];
  diffFlowActive = true;
  deviceLoadSide = side;
  let built = null;
  let confirmed = false;
  try {
    showToast(`📥 Lese die komplette Konfiguration der ${profile.label}...`);
    const snapshot = await readDeviceSnapshot(side, true);
    if (connectedSide() !== side || side !== editSide) {
      showToast(`Verbindung zur ${profile.label} unterbrochen. Nichts geladen.`, 6000);
      return;
    }
    if (!snapshot) {
      alert(`Die Konfiguration der ${profile.label} konnte nicht gelesen werden. Nichts geändert.`);
      return;
    }
    built = buildConfigFromSnapshot(snapshot, configFor(side), profile);
    if (built.error) {
      alert(`${built.error} Nichts geändert.`);
      return;
    }
    confirmed = await showSyncDiffDialog(profile, diffKeymap(configFor(side), snapshot, profile),
      { mode: "load", settingsRows: diffSettings(built.config.settings, configFor(side).settings) });
  } finally {
    diffFlowActive = false;
    deviceLoadSide = null;
  }
  if (!confirmed) {
    showToast("Laden abgebrochen. Die lokale Belegung bleibt unverändert.");
    return;
  }
  if (side !== editSide) {
    showToast("Die bearbeitete Hälfte hat gewechselt. Nichts geladen.", 6000);
    return;
  }
  applyDeviceConfig(built.config, profile);
}

// Nach dem Verbinden: liest die Belegung und zeigt das Banner "Gerät weicht ab", wenn sie von der App abweicht.
// Nur ohne vorgemerkte Änderung; es startet keinen Sync und lädt nichts ohne Klick auf "Vom Gerät laden".
// Token und Ignorieren gelten je Hälfte, damit das Trennen eines Wegs den Stand der anderen Hälfte nicht berührt.
const staleLayoutCheckTokens = new Map();
const staleLayoutIgnored = new Set();

// side: Hälfte, deren Verbindung endet oder deren Stand sich ändert (null = alle). forget: "Ignorieren" vergessen.
function hideStaleLayoutBanner(side = null, forget = false) {
  for (const s of side ? [side] : Object.keys(SIDE_PROFILES)) {
    staleLayoutCheckTokens.set(s, (staleLayoutCheckTokens.get(s) || 0) + 1);
    if (forget) staleLayoutIgnored.delete(s);
  }
  const banner = document.getElementById("staleLayoutBanner");
  if (banner && (!side || banner.dataset.side === side)) banner.hidden = true;
}

// Die stille Abfrage des Banners blockiert Speichern und Laden nicht: diese Wege warten, bis sie endet.
async function waitForStaleLayoutRead() {
  const deadline = Date.now() + DEVICE_SNAPSHOT_TIMEOUT_MS + 500;
  while (deviceSnapshotRead && deviceSnapshotRead.silent && !deviceSnapshotRead.stale && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 50));
  }
}

async function checkStaleLayout(side) {
  if (!side || staleLayoutIgnored.has(side)) return;
  if (isAutoSyncing || isConnectingBle || diffFlowActive || deviceSnapshotRead) return;
  if (connectedSide() !== side || pendingFor(side).length > 0) return;
  const token = (staleLayoutCheckTokens.get(side) || 0) + 1;
  staleLayoutCheckTokens.set(side, token);
  const snapshot = await readDeviceSnapshot(side, false, true);
  // Verbindung, Hälfte oder Vorgemerktes hat sich während des Lesens geändert: Ergebnis verwerfen
  if (token !== staleLayoutCheckTokens.get(side) || connectedSide() !== side || !snapshot) return;
  const state = staleLayoutState(configFor(side), snapshot, SIDE_PROFILES[side], pendingFor(side).length);
  const banner = document.getElementById("staleLayoutBanner");
  if (!banner) return;
  banner.dataset.side = side;
  const text = document.getElementById("staleLayoutText");
  if (text) text.textContent = `${state.count} Unterschied(e) auf der ${SIDE_PROFILES[side].label}`;
  banner.hidden = !state.show;
}

function setupStaleLayoutBanner() {
  const load = document.getElementById("btnStaleLayoutLoad");
  const ignore = document.getElementById("btnStaleLayoutIgnore");
  // Das Banner bleibt bis zum geladenen Stand (markPendingSync) oder bis "Ignorieren" stehen: ein Abbruch im Dialog ändert nichts
  if (load) load.addEventListener("click", () => readConfigFromESP32());
  if (ignore) ignore.addEventListener("click", () => {
    const banner = document.getElementById("staleLayoutBanner");
    const side = banner && banner.dataset.side;
    if (side) staleLayoutIgnored.add(side);
    hideStaleLayoutBanner(side || null);
  });
}

// Ersetzt die Config der bearbeiteten Hälfte durch die vom Gerät gelesene (Snapshot-Änderung mit Rückgängig)
function applyDeviceConfig(config, profile) {
  const oldConfig = JSON.parse(JSON.stringify(currentConfig));
  const rerender = () => {
    applySettingsToInputs(currentConfig.settings);
    renderLayerButtons();
    renderMatrix();
    renderCombosTable();
    if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
    saveConfigToServer();
  };
  currentConfig = config;
  rerender();
  markPendingSync({
    type: "device_load",
    snapshot: true,
    pairs: true,
    macros: true,
    title: "Konfiguration vom Gerät geladen",
    description: `Komplette Konfiguration der ${profile.label} gelesen`,
    revert: () => {
      currentConfig = oldConfig;
      rerender();
    }
  });
}
