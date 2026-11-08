// =============================================================================
// Editor: Event-Listener, Combo löschen, Flashen
// =============================================================================

// Öffnet den Combo-Dialog; setupEventListeners setzt die Funktion
let openComboModal = () => {};

window.deleteCombo = function(id) {
  const deletedCombo = currentConfig.combos ? currentConfig.combos.find(c => c.id === id) : null;
  currentConfig.combos = currentConfig.combos.filter(c => c.id !== id);
  renderCombosTable();
  renderMatrix();
  saveConfigToServer();
  if (deletedCombo) {
    markPendingSync({
      type: "combo_del",
      title: `Combo-Chord gelöscht`,
      description: deletedCombo.name || "Combo",
      revert: () => {
        if (!currentConfig.combos) currentConfig.combos = [];
        if (!currentConfig.combos.some(c => c.id === deletedCombo.id) && currentConfig.combos.length < MAX_COMBOS) {
          currentConfig.combos.push(deletedCombo);
        }
        renderCombosTable();
        renderMatrix();
        saveConfigToServer();
      }
    });
  }
};

// Tastenaufnahme (Combo-Dialog, Leader-Editor): ein Zustandsautomat für beide; nur einer kann aktiv sein.
// Die Zeilen MATRIX:, KEY_PRESS:, KEY_RELEASE: und SPLIT_KEY: in js/serial.js rufen feedKeyCapture auf.
// Die Browser-Tastatur (keydown) ist daran nicht beteiligt: der Druck löst keine Editor-Kürzel aus.
const keyCapture = createKeyCapture();
let keyCaptureOnFill = null;
let keyCaptureOnStop = null;

// Hinweis bei einer Taste, die die Aufnahme nicht übernimmt (sonst wirkt sie wie eine fehlende Verbindung)
const CAPTURE_REJECT_HINTS = {
  unusable: "Diese Taste ist hier nicht verwendbar (keine normale Taste ohne Modifier auf Ebene 0).",
  duplicate: "Diese Taste ist schon eingetragen.",
  "not-physical": "Diese Taste gibt es auf der Hälfte nicht."
};

// Ohne Druck beendet sich die Aufnahme selbst: sonst sperrt sie die Tasten des Browsers, wenn der Nutzer weggeht
const KEY_CAPTURE_IDLE_MS = 30000;
let keyCaptureIdleTimer = null;

function armKeyCaptureIdle() {
  clearTimeout(keyCaptureIdleTimer);
  keyCaptureIdleTimer = setTimeout(stopKeyCapture, KEY_CAPTURE_IDLE_MS);
}

function stopKeyCapture() {
  clearTimeout(keyCaptureIdleTimer);
  keyCaptureIdleTimer = null;
  if (!keyCapture.active) return;
  keyCaptureStop(keyCapture);
  const onStop = keyCaptureOnStop;
  keyCaptureOnFill = null;
  keyCaptureOnStop = null;
  if (onStop) onStop();
}

function startKeyCapture(options, onFill, onStop) {
  stopKeyCapture();
  keyCaptureStart(keyCapture, { side: editSide, ...options });
  keyCaptureOnFill = onFill;
  keyCaptureOnStop = onStop;
  armKeyCaptureIdle();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function feedKeyCapture(side, r, c, pressed) {
  if (!keyCapture.active) return;
  // Wechselt die bearbeitete Hälfte, gelten die Plätze nicht mehr
  if (keyCapture.side !== editSide) { stopKeyCapture(); return; }
  // Ein Fehler hier darf die Anzeige und die Statistik der Zeile in js/serial.js nicht überspringen
  try {
    const result = keyCaptureFeed(keyCapture, { side, r, c, pressed });
    if (CAPTURE_REJECT_HINTS[result.reason]) showToast(CAPTURE_REJECT_HINTS[result.reason]);
    if (result.accepted) armKeyCaptureIdle();
    if (result.accepted && keyCaptureOnFill) keyCaptureOnFill(result.index, result.value);
    if (result.accepted && keyCapture.slots.length >= keyCapture.max) stopKeyCapture();
  } catch (e) {
    console.warn("Key capture failed:", e);
    stopKeyCapture();
  }
}

// Eine Bluetooth-Tastatur ist zugleich Browser-Tastatur: Leertaste oder Enter würden den fokussierten Knopf auslösen,
// Esc die Auswahl löschen. Während der Aufnahme bleiben keydown und keyup beim Editor ohne Wirkung.
// Tab (Fokuswechsel) und Eingabefelder bleiben frei; Esc beendet die Aufnahme.
function blockKeysDuringCapture(e) {
  if (!keyCapture.active) return;
  if (e.key === "Tab" || isEditableTarget(e.target)) return;
  if (e.key === "Escape" && e.type === "keydown") stopKeyCapture();
  e.preventDefault();
  e.stopImmediatePropagation();
}

function setCaptureButton(button, active) {
  if (!button) return;
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.textContent = active ? "Aufnahme läuft … (Stopp)" : "Auf Tastatur drücken";
  button.classList.toggle("btn-primary", active);
  button.classList.toggle("btn-secondary", !active);
}

// Tapping-Term-Assistent: sammelt MATRIX:-Ereignisse der bearbeiteten Hälfte (USB) und rechnet mit
// computeTimingRecommendations. "Werte übernehmen" schreibt nur in die Felder der Einstellungskarte;
// gespeichert wird erst mit "Einstellungen in Config übernehmen".
const TIMING_MAX_SAMPLES = 20000;
const timingAssistant = { recording: false, side: null, samples: [], result: null, resultSide: null };
const TIMING_LABELS = {
  tappingTermMs: ["Tapping-Term", "tappingTermInput"],
  comboTimeoutMs: ["Combo-Zeitfenster", "comboTimeoutInput"],
  quickTapMs: ["Quick-Tap", "quickTapInput"],
  requirePriorIdleMs: ["Hold nur nach Tipp-Pause", "priorIdleInput"]
};

function feedTimingAssistant(side, evt) {
  if (!timingAssistant.recording || side !== timingAssistant.side || evt.t === undefined) return;
  if (side !== editSide) { timingAssistant.recording = false; timingAssistant.samples = []; renderTimingAssistant(); return; }
  timingAssistant.samples.push({ r: evt.r, c: evt.c, pressed: evt.pressed, t: evt.t });
  if (timingAssistant.samples.length >= TIMING_MAX_SAMPLES) {
    timingAssistant.recording = false;
    showToast("Die Aufnahme ist voll und wurde beendet.");
  }
  // Während der Aufnahme nur die Zahl zeigen; die Auswertung läuft beim Beenden (sonst Sortieren bei jeder Zeile)
  if (timingAssistant.recording) renderTimingAssistantCount(); else renderTimingAssistant();
}

function renderTimingAssistantCount() {
  const status = document.getElementById("timingAssistantStatus");
  if (status) status.textContent = `Aufnahme läuft. ${timingAssistant.samples.length} Ereignis(se).`;
}

function renderTimingAssistant() {
  const status = document.getElementById("timingAssistantStatus");
  const list = document.getElementById("timingAssistantResult");
  const toggle = document.getElementById("btnTimingAssistantToggle");
  const apply = document.getElementById("btnTimingAssistantApply");
  if (!status || !list || !toggle || !apply) return;
  const rec = computeTimingRecommendations(timingAssistant.samples);
  timingAssistant.result = rec;
  timingAssistant.resultSide = timingAssistant.side;
  toggle.textContent = timingAssistant.recording ? "Aufnahme beenden" : "Aufnahme starten";
  status.textContent = `${timingAssistant.recording ? "Aufnahme läuft. " : ""}${rec.stats.holds} Tipp(s), ${rec.stats.rolls} Überlappung(en), ${rec.stats.incomplete} unvollständig verworfen.` +
    (rec.enough ? "" : ` Für einen Vorschlag braucht der Assistent mindestens ${TIMING_MIN_HOLDS} vollständige Tipps (Druck und Loslassen). Ohne die Scan-Zeit der Firmware (ältere Version) kommt keine Messung an.`);
  list.replaceChildren();
  for (const [field, value] of Object.entries(rec.settings)) {
    const li = document.createElement("li");
    li.textContent = `${TIMING_LABELS[field][0]}: ${value} ms`;
    list.appendChild(li);
  }
  apply.disabled = !rec.enough;
}

function setupTimingAssistant() {
  const modal = document.getElementById("timingAssistantModal");
  if (!modal) return;
  const close = () => { timingAssistant.recording = false; modal.style.display = "none"; };
  document.getElementById("btnOpenTimingAssistant")?.addEventListener("click", () => {
    timingAssistant.side = editSide;
    timingAssistant.samples = [];
    timingAssistant.recording = false;
    renderTimingAssistant();
    modal.style.display = "flex";
  });
  document.getElementById("btnCloseTimingAssistant")?.addEventListener("click", close);
  document.getElementById("btnTimingAssistantReset")?.addEventListener("click", () => {
    timingAssistant.samples = [];
    renderTimingAssistant();
  });
  document.getElementById("btnTimingAssistantToggle")?.addEventListener("click", () => {
    timingAssistant.recording = !timingAssistant.recording;
    // Jede neue Aufnahme beginnt leer: nach einem Neustart oder Verbindungswechsel passen die Scan-Zeiten nicht zusammen
    if (timingAssistant.recording) timingAssistant.samples = [];
    timingAssistant.side = editSide;
    renderTimingAssistant();
    if (timingAssistant.recording) renderTimingAssistantCount();
  });
  document.getElementById("btnTimingAssistantApply")?.addEventListener("click", () => {
    const rec = timingAssistant.result;
    if (!rec || !rec.enough) return;
    if (timingAssistant.resultSide !== editSide) {
      showToast("Die Messung gehört zur anderen Hälfte. Starte sie neu.");
      return;
    }
    for (const [field, value] of Object.entries(rec.settings)) {
      const el = document.getElementById(TIMING_LABELS[field][1]);
      if (el) el.value = String(clampSetting(field, value));
    }
    showToast("Werte eingetragen. Mit \"Einstellungen in Config übernehmen\" speichern.");
    close();
  });
}

function setupEventListeners() {
  setupTimingAssistant();
  window.addEventListener("keydown", blockKeysDuringCapture, true);
  window.addEventListener("keyup", blockKeysDuringCapture, true);
  // Diagnose (GET_DIAG): Antwort kommt als DIAG-Zeile in handleSerialLine
  const btnDiagRefresh = document.getElementById("btnDiagRefresh");
  if (btnDiagRefresh) btnDiagRefresh.addEventListener("click", () => requestDiag());
  // Tasten-Inspektor zurücksetzen: Button im Header oder Esc (außerhalb von Eingabefeldern)
  document.getElementById("btnClearKeySelection").addEventListener("click", clearKeySelection);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selectedKey && !isEditableTarget(e.target)) clearKeySelection();
  });
  // Pfeiltasten: Auswahl in der Matrix der bearbeiteten Hälfte bewegen (außerhalb von Eingabefeldern)
  document.addEventListener("keydown", (e) => {
    const direction = ARROW_KEY_DIRECTIONS[e.key];
    if (!direction || !selectedKey || e.defaultPrevented || isEditableTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    // Offener Dialog: die Auswahl dahinter bleibt
    if ([...document.querySelectorAll(".modal-backdrop")].some(m => m.style.display !== "none")) return;
    e.preventDefault();
    const next = moveKeySelection(selectedKey.r, selectedKey.c, direction, activeProfile());
    if (next.r === selectedKey.r && next.c === selectedKey.c) return;
    selectKey(next.r, next.c, editSide, next.isThumb);
  });

  // Apply key inspector changes
  document.getElementById("btnApplyKey").addEventListener("click", async () => {
    if (!selectedKey) return;
    const { r, c } = selectedKey;

    while (currentConfig.layers.length <= activeLayerIndex) {
      currentConfig.layers.push(JSON.parse(JSON.stringify(currentConfig.layers[0])));
    }

    const targetLayer = activeLayerIndex;
    const layer = currentConfig.layers[targetLayer];
    if (!layer[r]) layer[r] = [];

    const labelInput = document.getElementById("keyLabelInput");
    const primarySelect = document.getElementById("primaryActionSelect");
    const holdSelect = document.getElementById("holdActionSelect");

    const label = labelInput.value.trim() || primarySelect.options[primarySelect.selectedIndex].text.split(" ")[0];
    const side = editSide;
    if (!isPhysicalKey(r, c, activeProfile())) {
      showToast(`R${r}C${c} existiert physisch nicht.`);
      return;
    }
    // Eigener Tapping-Term: leer = Wert der Hälfte; außerhalb 100..500 wird abgelehnt (kein stilles Kürzen)
    const termRaw = (document.getElementById("keyTapTermInput")?.value ?? "").trim();
    const termValue = termRaw === "" ? 0 : Number(termRaw);
    if (termRaw !== "" && !(Number.isInteger(termValue) && termValue >= 100 && termValue <= 500)) {
      showToast("Der Tapping-Term einer Taste muss eine ganze Zahl von 100 bis 500 ms sein, oder leer.");
      return;
    }
    // Option-Zeichen (CHAR_PAIR_<i>) als Tastenpaar auflösen: gleiches Paar wiederverwenden, sonst anhängen
    const resolved = resolveCharPairActions({
      tap: primarySelect.value,
      hold: holdSelect.value,
      dtap: document.getElementById("dtapActionSelect").value
    }, currentConfig.keyPairs);
    if (!resolved) {
      showToast(`Kein Platz für ein neues Tastenpaar: maximal ${MAX_KEY_PAIRS} Paare. Lösche zuerst ein Paar.`);
      return;
    }
    const { tap, hold, dtap } = resolved.actions;
    // Neue Paare gehören zur Tastenänderung: ein eigener Revert würde ein noch genutztes Paar entfernen
    const firstAddedIdx = appendResolvedPairs(currentConfig.keyPairs, resolved.added);
    if (resolved.added.length) renderKeyPairs();

    const oldKey = JSON.parse(JSON.stringify(layer[r][c] || { label: "---", tap: "NONE", hold: "NONE" }));
    const layerName = (currentConfig.layerNames && currentConfig.layerNames[targetLayer]) || `Layer ${targetLayer}`;
    const oldDesc = oldKey.label || (oldKey.tap && oldKey.tap !== "NONE" ? oldKey.tap : "---");
    const newDesc = label || (tap && tap !== "NONE" ? tap : (hold || "---"));

    const newKey = { label, tap, hold, dtap };
    if (termValue > 0) newKey.tapTerm = termValue;
    layer[r][c] = newKey;
    renderMatrix();

    const changeRecord = {
      type: "key",
      pairs: resolved.added.length > 0,
      title: `Taste [R${r}, C${c}] (${layerName})`,
      description: `${oldDesc} ➔ ${newDesc}`,
      revert: () => {
        if (currentConfig.layers[targetLayer] && currentConfig.layers[targetLayer][r]) {
          currentConfig.layers[targetLayer][r][c] = oldKey;
          // Mitangelegte Paare entfernen, solange sie am Ende stehen und keine andere Taste sie nutzt
          if (revertResolvedPairs(currentConfig.keyPairs, currentConfig.layers, firstAddedIdx, resolved.added.length, currentConfig.leaderSequences)) renderKeyPairs();
          renderMatrix();
          if (selectedKey && selectedKey.r === r && selectedKey.c === c && activeLayerIndex === targetLayer) {
            updateInspector(r, c);
          }
          saveConfigToServer();
        }
      }
    };
    if (resolved.added.length) {
      changeRecord.description += ` (neues Tastenpaar: ${resolved.added.map(p => keyPairLabel(p, keycodeLabel)).join(", ")})`;
    }

    // Vormerken; eine verbundene Hälfte bekommt sofort die vollständige Konfiguration (mit neuen Paaren und Makros)
    markPendingSync(changeRecord, side);

    saveConfigToServer(side);
  });

  // Pending Changes Drawer Event Listeners
  const pendingBadge = document.getElementById("pendingSyncBadge");
  if (pendingBadge) {
    pendingBadge.addEventListener("click", () => {
      if (pendingChanges.length > 0) {
        togglePendingChangesDrawer();
      }
    });
  }
  const btnToggleDrawer = document.getElementById("btnTogglePendingDrawer");
  if (btnToggleDrawer) {
    btnToggleDrawer.addEventListener("click", togglePendingChangesDrawer);
  }
  const btnDiscardAll = document.getElementById("btnDiscardAllPending");
  if (btnDiscardAll) {
    btnDiscardAll.addEventListener("click", discardAllPendingChanges);
  }

  // Combo Modal Events
  const comboModal = document.getElementById("comboModal");
  // pair ({ a, b } mit r, c) füllt Taste 1 und 2 vor, z. B. aus einem Combo-Vorschlag der Heatmap
  openComboModal = pair => {
    populateComboKeyDropdowns();
    if (pair) {
      document.getElementById("comboKey1Select").value = `${pair.a.r},${pair.a.c}`;
      document.getElementById("comboKey2Select").value = `${pair.b.r},${pair.b.c}`;
    }
    document.querySelectorAll(".combo-layer-check").forEach(cb => { cb.checked = true; });
    document.getElementById("comboWindowInput").value = "";
    clearSelectFilter("comboActionSelect");
    comboModal.style.display = "flex";
  };
  document.getElementById("btnOpenAddComboModal").addEventListener("click", () => openComboModal());
  // Tastenaufnahme: Druck auf Taste 1, 2, 3 der bearbeiteten Hälfte füllt die Auswahlfelder
  const btnCaptureCombo = document.getElementById("btnCaptureComboKeys");
  const comboKeySelectIds = ["comboKey1Select", "comboKey2Select", "comboKey3Select"];
  btnCaptureCombo.addEventListener("click", () => {
    if (btnCaptureCombo.getAttribute("aria-pressed") === "true") { stopKeyCapture(); return; }
    // Taste 3 ist optional: eine Aufnahme mit zwei Tasten darf keine alte dritte Taste behalten
    document.getElementById("comboKey3Select").value = "";
    startKeyCapture(
      { max: comboKeySelectIds.length },
      (index, value) => { document.getElementById(comboKeySelectIds[index]).value = value; },
      () => setCaptureButton(btnCaptureCombo, false)
    );
    setCaptureButton(btnCaptureCombo, true);
  });
  const closeComboModal = () => {
    stopKeyCapture();
    comboModal.style.display = "none";
  };
  document.getElementById("btnCloseComboModal").addEventListener("click", closeComboModal);
  document.getElementById("btnCancelCombo").addEventListener("click", closeComboModal);

  document.getElementById("btnSaveCombo").addEventListener("click", () => {
    const k1Val = document.getElementById("comboKey1Select").value.split(",");
    const k2Val = document.getElementById("comboKey2Select").value.split(",");
    const behavior = document.getElementById("comboBehaviorSelect").value;
    const actionSelect = document.getElementById("comboActionSelect");
    const action = actionSelect.value;
    const actionLabel = actionSelect.options[actionSelect.selectedIndex].text;

    // Leer = keine dritte Taste
    const k3Raw = document.getElementById("comboKey3Select").value;
    const k3Val = k3Raw ? k3Raw.split(",") : null;
    if (k1Val[0] === k2Val[0] && k1Val[1] === k2Val[1]) {
      alert("Taste 1 und Taste 2 dürfen nicht identisch sein!");
      return;
    }
    if (k3Val && ((k3Val[0] === k1Val[0] && k3Val[1] === k1Val[1]) || (k3Val[0] === k2Val[0] && k3Val[1] === k2Val[1]))) {
      alert("Taste 3 muss sich von Taste 1 und Taste 2 unterscheiden!");
      return;
    }
    // Leer = globales Combo-Zeitfenster
    const windowRaw = document.getElementById("comboWindowInput").value.trim();
    const windowMs = windowRaw === "" ? 0 : Number(windowRaw);
    if (windowRaw !== "" && !isValidComboWindow(windowMs)) {
      alert(`Das Zeitfenster muss eine ganze Zahl von ${COMBO_WINDOW_MIN} bis ${COMBO_WINDOW_MAX} ms sein, oder leer für das globale Fenster.`);
      return;
    }
    if (currentConfig.combos.length >= MAX_COMBOS) {
      alert(`Maximal ${MAX_COMBOS} Combos werden von der Firmware unterstützt.`);
      return;
    }
    if (isMouseMoveCode(action)) {
      alert("Combos unterstützen keine Mausbewegung. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (isOslCode(action)) {
      alert("Combos unterstützen keine One-Shot-Ebene. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (isLeaderCode(action)) {
      alert("Combos unterstützen kein Leader. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (isKeyLockCode(action)) {
      alert("Combos unterstützen kein Key Lock. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (isSwapHandsCode(action)) {
      alert("Combos unterstützen kein Swap Hands. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (isBleHostCode(action)) {
      alert("Combos unterstützen keine BLE-Host-Slots. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (isDynamicMacroCode(action)) {
      alert("Combos unterstützen keine dynamischen Makros. Bitte eine normale Taste mit der Aktion belegen.");
      return;
    }
    if (behavior !== "KEY_PRESS" && action === "LAYER_LOCK") {
      alert("Layer Lock funktioniert nur mit dem Verhalten \"Einzeltaste senden\".");
      return;
    }
    if (behavior === "MODIFIER_HOLD" && isOneShotOrCapsWordCode(action)) {
      alert("Modifier Hold unterstützt keine One-Shot-, Caps-Word-, Repeat- oder Layer-Lock-Aktion. Bitte \"Einzeltaste senden\" wählen.");
      return;
    }

    let layerMask = 0;
    document.querySelectorAll(".combo-layer-check").forEach(cb => { if (cb.checked) layerMask |= 1 << parseInt(cb.value, 10); });
    if (layerMask === 0) {
      alert("Wähle mindestens eine Ebene, auf der die Combo gilt.");
      return;
    }

    const r1 = parseInt(k1Val[0], 10), c1 = parseInt(k1Val[1], 10);
    const r2 = parseInt(k2Val[0], 10), c2 = parseInt(k2Val[1], 10);

    const layer = currentConfig.layers[0];
    const lbl1 = (layer[r1] && layer[r1][c1]) ? layer[r1][c1].label : `R${r1}C${c1}`;
    const lbl2 = (layer[r2] && layer[r2][c2]) ? layer[r2][c2].label : `R${r2}C${c2}`;
    const r3 = k3Val ? parseInt(k3Val[0], 10) : null, c3 = k3Val ? parseInt(k3Val[1], 10) : null;
    const lbl3 = k3Val ? ((layer[r3] && layer[r3][c3]) ? layer[r3][c3].label : `R${r3}C${c3}`) : "";

    const newCombo = {
      id: "combo-" + Date.now(),
      name: `${lbl1} + ${lbl2}${k3Val ? ` + ${lbl3}` : ""} -> ${actionLabel}`,
      key1: { r: r1, c: c1, label: lbl1 },
      key2: { r: r2, c: c2, label: lbl2 },
      behavior,
      action,
      actionLabel
    };
    // Die Maske für alle Ebenen steht nicht in der Datei (Standard); ebenso fehlen dritte Taste und Fenster, wenn nicht gesetzt
    if (layerMask !== COMBO_ALL_LAYERS) newCombo.layerMask = layerMask;
    if (k3Val) newCombo.key3 = { r: r3, c: c3, label: lbl3 };
    if (windowMs) newCombo.windowMs = windowMs;

    currentConfig.combos.push(newCombo);
    stopKeyCapture();
    comboModal.style.display = "none";
    renderCombosTable();
    renderMatrix();
    saveConfigToServer();

    markPendingSync({
      type: "combo_add",
      title: `Combo-Chord hinzugefügt`,
      description: newCombo.name,
      revert: () => {
        currentConfig.combos = currentConfig.combos.filter(c => c.id !== newCombo.id);
        renderCombosTable();
        renderMatrix();
        saveConfigToServer();
      }
    });
  });

  // JSON Import & Export
  document.getElementById("btnExportJson").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dactyl_config_${activeProfile().exportPrefix}${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  });

  document.getElementById("btnExportBundle").addEventListener("click", () => {
    const configs = {};
    for (const side of Dactyl.SIDE_IDS) configs[side] = configFor(side);
    let bundle;
    try {
      bundle = buildDualSideBundle(configs, SIDE_PROFILES);
    } catch (err) {
      showToast(`⚠️ Export nicht möglich: ${err.message}`, 6000);
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dactyl_config_beide_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  });

  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Zielhälfte einer Einzel-Config gilt beim Auswählen der Datei, nicht beim Ende des Lesens
    const targetSide = editSide;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // Alle Hälften vollständig validieren, BEVOR ein Zustand ersetzt oder auf dem Server gespeichert wird
        const { kind, configs } = parseConfigImport(JSON.parse(event.target.result), SIDE_PROFILES, targetSide);
        const sides = Object.keys(configs);
        const what = kind === "bundle" ? "beide Hälften" : "die Konfiguration";
        if (!confirm(`${what[0].toUpperCase()}${what.slice(1)} aus "${file.name || "Backup"}" importieren? Die aktuelle Belegung wird ersetzt (Rückgängig über die vorgemerkten Änderungen).`)) {
          return;
        }
        const rerender = () => {
          applySettingsToInputs(currentConfig.settings);
          renderLayerButtons();
          renderMatrix();
          renderCombosTable();
          if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
        };
        const olds = {};
        for (const side of sides) {
          olds[side] = JSON.parse(JSON.stringify(configFor(side)));
          setConfigFor(side, configs[side]);
        }
        rerender();
        for (const side of sides) {
          saveConfigToServer(side);
          markPendingSync({
            type: "import",
            snapshot: true,
            pairs: true,
            macros: true,
            sideRevert: true,
            title: "JSON-Konfiguration importiert",
            description: `${file.name || "Backup"} geladen${kind === "bundle" ? ` (Hälfte ${side})` : ""}`,
            revert: () => {
              setConfigFor(side, olds[side]);
              rerender();
              saveConfigToServer(side);
            }
          }, side);
        }
      } catch (err) {
        alert("Ungültige JSON-Datei: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  const btnWrite = document.getElementById("btnWriteConfig");
  if (btnWrite) btnWrite.addEventListener("click", writeConfigWithDiff);
  const btnRead = document.getElementById("btnReadConfig");
  if (btnRead) btnRead.addEventListener("click", readConfigFromESP32);

  const btnSaveToDactyl = document.getElementById("btnSaveToDactyl");
  if (btnSaveToDactyl) {
    btnSaveToDactyl.addEventListener("click", saveAndFlashToDactyl);
  }
  const btnFlashOta = document.getElementById("btnFlashOta");
  if (btnFlashOta) {
    btnFlashOta.addEventListener("click", flashOtaToDactyl);
  }

  const btnSaveSettings = document.getElementById("btnSaveSettings");
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      // Werte auf die Firmware-Bereiche begrenzen (Firmware lehnt Werte außerhalb mit ERR ARGS ab)
      const side = editSide;
      const devName = sanitizeCommandText(document.getElementById("deviceNameInput")?.value, activeProfile().deviceName);
      const debounce = clampSetting("debounceMs", parseInt(document.getElementById("debounceInput")?.value, 10));
      const comboTimeout = clampSetting("comboTimeoutMs", parseInt(document.getElementById("comboTimeoutInput")?.value, 10));
      const tappingTerm = clampSetting("tappingTermMs", parseInt(document.getElementById("tappingTermInput")?.value, 10));
      const holdTapMode = clampSetting("holdTapMode", parseInt(document.getElementById("holdTapModeSelect")?.value, 10));
      const quickTap = clampSetting("quickTapMs", parseInt(document.getElementById("quickTapInput")?.value, 10));
      const leaderTimeout = clampSetting("leaderTimeoutMs", parseInt(document.getElementById("leaderTimeoutInput")?.value, 10));
      const oneShotTimeout = clampSetting("oneShotTimeoutMs", parseInt(document.getElementById("oneShotTimeoutInput")?.value, 10));
      const layerTimeout = clampSetting("layerTimeoutMs", parseInt(document.getElementById("layerTimeoutInput")?.value, 10));
      const priorIdle = clampSetting("requirePriorIdleMs", parseInt(document.getElementById("priorIdleInput")?.value, 10));
      const chordalHold = clampSetting("chordalHold", parseInt(document.getElementById("chordalHoldSelect")?.value, 10));
      const retroTap = clampSetting("retroTap", parseInt(document.getElementById("retroTapSelect")?.value, 10));
      const autoShift = clampSetting("autoShift", parseInt(document.getElementById("autoShiftSelect")?.value, 10));
      const autoShiftMs = clampSetting("autoShiftMs", parseInt(document.getElementById("autoShiftTermInput")?.value, 10));
      const standbyMinutes = clampSetting("standbyTimeoutMinutes", parseInt(document.getElementById("standbyTimeoutSelect")?.value, 10));
      const sleepMinutes = clampSetting("sleepTimeoutMinutes", parseInt(document.getElementById("sleepTimeoutSelect")?.value, 10));
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
      setVal("deviceNameInput", devName);
      setVal("debounceInput", debounce);
      setVal("comboTimeoutInput", comboTimeout);
      setVal("tappingTermInput", tappingTerm);
      setVal("holdTapModeSelect", holdTapMode);
      setVal("quickTapInput", quickTap);
      setVal("leaderTimeoutInput", leaderTimeout);
      setVal("oneShotTimeoutInput", oneShotTimeout);
      setVal("layerTimeoutInput", layerTimeout);
      setVal("priorIdleInput", priorIdle);
      setVal("chordalHoldSelect", chordalHold);
      setVal("retroTapSelect", retroTap);
      setVal("autoShiftSelect", autoShift);
      setVal("autoShiftTermInput", autoShiftMs);

      const capsLedEl = document.getElementById("capsLedCheckbox");
      const capsLed = capsLedEl && capsLedEl.checked ? 1 : 0;
      const triLayers = readTriLayersFromInputs();
      applyTriLayersToInputs(triLayers);
      const oldSettings = JSON.parse(JSON.stringify(currentConfig.settings || {}));

      currentConfig.settings = {
        deviceName: devName,
        debounceMs: debounce,
        comboTimeoutMs: comboTimeout,
        tappingTermMs: tappingTerm,
        holdTapMode: holdTapMode,
        quickTapMs: quickTap,
        leaderTimeoutMs: leaderTimeout,
        oneShotTimeoutMs: oneShotTimeout,
        layerTimeoutMs: layerTimeout,
        requirePriorIdleMs: priorIdle,
        chordalHold: chordalHold,
        retroTap: retroTap,
        autoShift: autoShift,
        autoShiftMs: autoShiftMs,
        triLayers: triLayers,
        capsLed: capsLed,
        standbyTimeoutMinutes: standbyMinutes,
        sleepTimeoutMinutes: sleepMinutes
      };

      saveConfigToServer();

      const changeRecord = {
        type: "settings",
        snapshot: true,
        title: `Einstellungen & Timeouts`,
        description: `Standby: ${standbyMinutes}m, Sleep: ${sleepMinutes}m, Name: "${devName}"`,
        revert: () => {
          currentConfig.settings = oldSettings;
          applySettingsToInputs(oldSettings);
          saveConfigToServer();
        }
      };

      // Vormerken; eine verbundene Hälfte bekommt sofort die vollständige Konfiguration
      markPendingSync(changeRecord, side);
    });
  }
  setupActionSearch();
}

async function saveAndFlashToDactyl() {
  const btn = document.getElementById("btnSaveToDactyl");
  if (!btn) return;

  // Hälfte und Config beim Klick festhalten: ein Wechsel der Hälfte während des Flashens ändert nichts
  const side = editSide;
  const profile = SIDE_PROFILES[side];
  const cfg = currentConfig;
  const syncedChangeIds = new Set(pendingChanges.map(c => c.id));
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-icon">⏳</span> Flashe ${profile.label}... (ca. 15s)`;

  const hadSerial = !!serialPort;
  if (hadSerial) {
    showToast("Trenne USB-Monitor kurz fürs Flashen...");
    await disconnectSerial();
    await new Promise(r => setTimeout(r, 150));
  }

  showToast(`Kompiliere & Flashe Firmware auf die ${profile.label}... Bitte warten.`);
  const flashLog = openFlashLogDialog(profile);
  // Warnungen der Layout-Prüfung stehen im Protokoll; das Flashen läuft trotzdem
  logLayoutLintToFlashLog(flashLog);

  try {
    // Der Server wählt den USB-Port, dessen Board sich per DEVICE_INFO als diese Hälfte meldet.
    // stream=1: arduino-cli-Ausgabe kommt zeilenweise als NDJSON, das Ergebnis als letzte Zeile.
    const res = await fetch(`/api/save_and_flash?side=${side}&stream=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg)
    });

    let data = {};
    if ((res.headers.get("Content-Type") || "").includes("application/x-ndjson") && res.body) {
      data = (await readFlashStream(res.body, flashLog.onEvent)) || { success: false, error: "Verbindung zum Server vor dem Ergebnis beendet." };
    } else {
      // Validierungsfehler vor dem Start kommen als normales JSON
      try { data = await res.json(); } catch (_) {}
    }
    if (res.ok && data.success) {
      flashLog.finish(true);
      firmwareVersions.forget(side);
      updateFirmwareVersionUI();
      if (hadSerial) {
        try {
          await new Promise(r => setTimeout(r, 1200)); // ESP32 Reboot nach Flashen abwarten
          // Ohne User-Geste ist requestPort() nicht erlaubt: bereits freigegebenen Port wiederverwenden
          await connectSerial({ reuseGrantedPort: true });
          if (serialPort && serialPort.writable && await waitForSerialSide(side, 2500)) {
            if (cfg.settings) {
              const sb = cfg.settings.standbyTimeoutMinutes ?? 5;
              const sl = cfg.settings.sleepTimeoutMinutes ?? 60;
              await sendSerialCommand(`SET_STANDBY ${sb}`);
              await sendSerialCommand(`SET_SLEEP ${sl}`);
            }
            for (let l = 0; l < cfg.layerNames.length; l++) {
              await sendSerialCommand(`SET_NAME ${l} ${sanitizeCommandText(cfg.layerNames[l], DEFAULT_LAYER_NAMES[l])}`);
            }
          }
        } catch (reconnectErr) {
          console.warn("Serial reconnect nach Flashen fehlgeschlagen:", reconnectErr);
        }
      }
      // Nur die beim Klick vorgemerkten Änderungen dieser Hälfte verwerfen
      setPendingFor(side, pendingFor(side).filter(c => !syncedChangeIds.has(c.id)));
      if (side === editSide) renderPendingSyncUI();
      showToast(`✅ ${profile.label} erfolgreich geflasht!`);
      alert(`✅ Erfolgreich auf die ${profile.label} gespeichert (${data.port || "USB"})!\n\nDie Firmware wurde aktualisiert. Die Hälfte startet jetzt mit der neuen Tastenbelegung.`);
    } else {
      const errMsg = data.error || (data.stage ? `Fehler in Phase '${data.stage}'` : "Unbekannter Fehler");
      flashLog.finish(false, data.stage ? `Fehler in Phase: ${flashStageLabel(data.stage)}` : "Flashen fehlgeschlagen");
      showToast("❌ Fehler beim Flashen!");
      alert("Fehler beim Flashen auf den ESP32:\n\n" + errMsg);
    }
  } catch (err) {
    console.error("Flash error:", err);
    flashLog.finish(false, "Server nicht erreichbar");
    showToast("❌ Server nicht erreichbar!");
    alert("Netzwerkfehler: Konnte /api/save_and_flash nicht erreichen.\nLäuft python3 server.py?");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function flashOtaToDactyl() {
  const btn = document.getElementById("btnFlashOta");
  if (!btn) return;

  const side = editSide;
  const profile = SIDE_PROFILES[side];

  if (!bleConfigChar) {
    showToast(`⚠️ Bitte die ${profile.label} zuerst im Config-Modus per Bluetooth verbinden (${profile.comboLabel} für 0.5s gedrückt halten).`, 6000);
    alert(`⚠️ Bluetooth Config-Modus nicht verbunden!\n\nBitte halte ${profile.comboLabel} auf der ${profile.label} für ca. 0.5s gedrückt, um den Config-Modus zu starten, und verbinde die Tastatur über 'Bluetooth Live-Sync'.`);
    return;
  }
  if (bleSide && bleSide !== side) {
    showToast(`⚠️ Per Bluetooth ist die ${SIDE_PROFILES[bleSide].label} verbunden, im Editor ist aber die ${profile.label} aktiv!`, 7000);
    alert(`⚠️ Falsche Hälfte verbunden!\n\nIm Editor ist die ${profile.label} ausgewählt, die aktive Bluetooth-Verbindung gehört aber zur ${SIDE_PROFILES[bleSide].label}.`);
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-icon">⏳</span> Flashe ${profile.label} (OTA)...`;

  try {
    await runBleOtaUpdate(side);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function populateComboKeyDropdowns() {
  const s1 = document.getElementById("comboKey1Select");
  const s2 = document.getElementById("comboKey2Select");
  const s3 = document.getElementById("comboKey3Select");
  s1.innerHTML = "";
  s2.innerHTML = "";
  s3.innerHTML = "";
  // Taste 3 ist optional: der erste Eintrag heißt "keine"
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "(keine, nur zwei Tasten)";
  s3.appendChild(none);

  const layer = currentConfig.layers[0];
  const profile = activeProfile();
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isPhysicalKey(r, c, profile)) continue;
      const k = layer[r] && layer[r][c];
      const lbl = k ? k.label : `R${r}C${c}`;
      const isThumb = (r === 5);
      const optText = `[R${r}, C${c}] ${lbl} ${isThumb ? '(Daumen)' : ''}`;

      const o1 = document.createElement("option");
      o1.value = `${r},${c}`;
      o1.textContent = optText;
      s1.appendChild(o1);

      const o2 = document.createElement("option");
      o2.value = `${r},${c}`;
      o2.textContent = optText;
      s2.appendChild(o2);

      const o3 = document.createElement("option");
      o3.value = `${r},${c}`;
      o3.textContent = optText;
      s3.appendChild(o3);
    }
  }

  s1.value = "2,1"; // J
  s2.value = "2,2"; // K
  s3.value = ""; // keine dritte Taste
}

// Tri-Layer-Felder (Einstellungen): je Regel drei Auswahlfelder a, b, Ziel; leer = Regel aus
function readTriLayersFromInputs() {
  const val = id => parseInt(document.getElementById(id)?.value, 10);
  const raw = [];
  for (let i = 0; i < MAX_TRI_LAYER_RULES; i++) {
    const a = val(`triLayerA${i}`), b = val(`triLayerB${i}`), target = val(`triLayerT${i}`);
    if (Number.isNaN(a) && Number.isNaN(b) && Number.isNaN(target)) continue;
    raw.push({ a, b, target });
  }
  const rules = normalizeTriLayers(raw);
  if (rules.length < raw.length) {
    showToast("Tri-Layer: Eine Regel braucht drei Ebenen 1 bis 7; a und b müssen verschieden sein und das Ziel darf weder a noch b sein. Ungültige Regeln wurden entfernt.", 6000);
  }
  return rules;
}

function applyTriLayersToInputs(rules) {
  const list = normalizeTriLayers(rules);
  for (let i = 0; i < MAX_TRI_LAYER_RULES; i++) {
    const r = list[i];
    for (const [id, v] of [[`triLayerA${i}`, r && r.a], [`triLayerB${i}`, r && r.b], [`triLayerT${i}`, r && r.target]]) {
      const el = document.getElementById(id);
      if (el) el.value = r ? String(v) : "";
    }
  }
}
