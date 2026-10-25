// =============================================================================
// Editor: Ebenen, Keycode-Auswahl, Matrix, Inspektor, Combos
// =============================================================================

function renderLayerButtons() {
  const container = document.getElementById("layerButtons");
  if (!container) return;
  container.innerHTML = "";

  const names = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
  for (let i = 0; i < 8; i++) {
    const btn = document.createElement("button");
    btn.className = "layer-btn" + (i === activeLayerIndex ? " active" : "");
    btn.dataset.layer = i;
    const name = names[i] || `Layer ${i}`;
    btn.textContent = `L${i}: ${name}`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeLayerIndex = i;
      updateLayerNameInput();
      renderMatrix();
      if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
    });
    container.appendChild(btn);
  }
  updateLayerNameInput();
}

function updateLayerToolTargets() {
  const opSel = document.getElementById("layerToolOp");
  const targetSel = document.getElementById("layerToolTarget");
  if (!opSel || !targetSel) return;
  const previous = parseInt(targetSel.value, 10);
  const names = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
  targetSel.innerHTML = "";
  for (let i = 0; i < NUM_LAYERS; i++) {
    if (i === activeLayerIndex) continue;
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `L${i}: ${names[i] || `Layer ${i}`}`;
    targetSel.appendChild(opt);
  }
  if (isValidIndex(previous, NUM_LAYERS) && previous !== activeLayerIndex) targetSel.value = String(previous);
  targetSel.style.display = opSel.value === "clear" ? "none" : "";
}

function applyLayerToolFromUI() {
  const op = document.getElementById("layerToolOp").value;
  const source = activeLayerIndex;
  const target = parseInt(document.getElementById("layerToolTarget").value, 10);
  const names = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
  const label = i => `L${i} (${names[i] || `Layer ${i}`})`;
  const texts = {
    copy: [`Ebene ${label(source)} nach ${label(target)} kopieren? Die Belegung von ${label(target)} wird ersetzt.`,
           "Ebene kopiert", `${label(source)} ➔ ${label(target)}`],
    swap: [`Ebenen ${label(source)} und ${label(target)} tauschen?`,
           "Ebenen getauscht", `${label(source)} ⇄ ${label(target)}`],
    clear: [`Alle Tasten von Ebene ${label(source)} auf transparent setzen?`,
            "Ebene geleert", `${label(source)} ist jetzt transparent`]
  }[op];
  if (!texts) return;
  const next = applyLayerOperation(currentConfig.layers, op, source, target);
  if (!next) {
    showToast("Bitte eine andere Ziel-Ebene wählen.");
    return;
  }
  if (!confirm(texts[0])) return;

  const oldLayers = JSON.parse(JSON.stringify(currentConfig.layers));
  currentConfig.layers = next;
  renderMatrix();
  if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
  saveConfigToServer();
  // Wie Preset/Import: als Snapshot vormerken, Übertragung beim nächsten Sync
  markPendingSync({
    type: "layer_tool",
    snapshot: true,
    title: texts[1],
    description: texts[2],
    revert: () => {
      currentConfig.layers = oldLayers;
      renderMatrix();
      if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
      saveConfigToServer();
    }
  });
}

function updateLayerNameInput() {
  updateLayerToolTargets();
  const input = document.getElementById("layerNameInput");
  if (!input) return;
  const names = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
  input.value = names[activeLayerIndex] || `Layer ${activeLayerIndex}`;
}

async function renameActiveLayer() {
  const input = document.getElementById("layerNameInput");
  if (!input) return;
  const newName = sanitizeCommandText(input.value);
  if (!newName) {
    showToast("Bitte gib einen Namen für die Ebene ein.");
    return;
  }
  if (!currentConfig.layerNames) {
    currentConfig.layerNames = [...DEFAULT_LAYER_NAMES];
  }
  const targetLayer = activeLayerIndex;
  const oldName = currentConfig.layerNames[targetLayer] || `Layer ${targetLayer}`;
  currentConfig.layerNames[targetLayer] = newName;
  renderLayerButtons();

  const changeRecord = {
    type: "layer_name",
    title: `Ebene ${targetLayer} umbenannt`,
    description: `"${oldName}" ➔ "${newName}"`,
    revert: () => {
      if (currentConfig.layerNames) {
        currentConfig.layerNames[targetLayer] = oldName;
        renderLayerButtons();
        saveConfigToServer();
      }
    }
  };

  // An die Hälfte per Bluetooth oder USB senden (bei Fehler als ausstehend vormerken)
  const side = editSide;
  const ok = await sendDeviceCommand(`SET_NAME ${targetLayer} ${newName}`, side);
  if (ok) {
    showToast(`Ebene ${targetLayer} in "${newName}" umbenannt!`);
  } else {
    markPendingSync(changeRecord, side);
  }

  saveConfigToServer(side);
}

function initUI() {
  // Tab Buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Hand Switcher Buttons: "Rechts"/"Links" wählen die bearbeitete Hälfte, "Beide" zeigt beide an
  document.querySelectorAll(".hand-btn[data-hand]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".hand-btn[data-hand]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeHandView = btn.dataset.hand;
      if (activeHandView === "right") switchEditSide("R");
      else if (activeHandView === "left") switchEditSide("L");
      else renderMatrix();
      showToast(`Ansicht: ${btn.textContent}`);
    });
  });

  // Apply Layout Preset Button
  const btnPreset = document.getElementById("btnApplyPreset");
  if (btnPreset) {
    btnPreset.addEventListener("click", () => {
      const presetKey = document.getElementById("layoutPresetSelect").value;
      // Presets sind Belegungen der rechten Hand; auf links belegten sie fehlende Tasten (R5C0)
      if (!activeProfile().presets) {
        showToast(`Layout-Presets gibt es nur für die rechte Hand, nicht für die ${activeProfile().label}.`, 5000);
        return;
      }
      if (PRESETS[presetKey]) {
        const oldLayer0 = JSON.parse(JSON.stringify(currentConfig.layers[0]));
        currentConfig.layers[0] = JSON.parse(JSON.stringify(PRESETS[presetKey].layers[0]));
        renderMatrix();
        saveConfigToServer();
        // Immer vormerken: das Preset wird mit dem nächsten Sync (Combo oder "Schreiben") übertragen
        markPendingSync({
          type: "preset",
          snapshot: true,
          title: `Layout-Preset angewendet`,
          description: `${PRESETS[presetKey].name} (Ebene 0)`,
          revert: () => {
            currentConfig.layers[0] = oldLayer0;
            renderMatrix();
            if (selectedKey && activeLayerIndex === 0) updateInspector(selectedKey.r, selectedKey.c);
            saveConfigToServer();
          }
        });
      }
    });
  }

  // Ebenen-Werkzeuge: Kopieren / Tauschen / Leeren der angezeigten Ebene
  const layerToolOp = document.getElementById("layerToolOp");
  const btnLayerTool = document.getElementById("btnApplyLayerTool");
  if (layerToolOp) layerToolOp.addEventListener("change", updateLayerToolTargets);
  if (btnLayerTool) btnLayerTool.addEventListener("click", applyLayerToolFromUI);

  // Connect Serial Button (USB Monitor)
  const btnConnect = document.getElementById("btnConnect");
  if (btnConnect) {
    btnConnect.addEventListener("click", () => {
      if (serialPort) {
        disconnectSerial();
      } else {
        connectSerial();
      }
    });
  }

  // Bluetooth Permission Check & Open Config Buttons
  const btnCheckBtPermission = document.getElementById("btnCheckBtPermission");
  if (btnCheckBtPermission) {
    btnCheckBtPermission.addEventListener("click", checkBluetoothPermission);
  }

  const btnOpenBtSettings = document.getElementById("btnOpenBtSettings");
  if (btnOpenBtSettings) {
    btnOpenBtSettings.addEventListener("click", openMacBluetoothSettings);
  }

  const btnSettingsOpenBtConfig = document.getElementById("btnSettingsOpenBtConfig");
  if (btnSettingsOpenBtConfig) {
    btnSettingsOpenBtConfig.addEventListener("click", openMacBluetoothSettings);
  }

  // Initial State: Zeige Berechtigungsprüfung oder den Live-Sync-Button falls bereits verifiziert
  if (isBtPermissionVerified()) {
    setBtPermissionUIState("granted");
  } else {
    setBtPermissionUIState("unverified");
  }

  // Connect Web Bluetooth Button (Wireless Live-Sync)
  const btnConnectBle = document.getElementById("btnConnectBle");
  if (btnConnectBle) {
    btnConnectBle.addEventListener("click", () => {
      if (bleConfigChar) {
        disconnectBle();
      } else {
        connectBle();
      }
    });
  }

  // Banner Exit Config Mode Button
  const btnExitConfigBanner = document.getElementById("btnExitConfigBanner");
  if (btnExitConfigBanner) {
    btnExitConfigBanner.addEventListener("click", async () => {
      if (bleConfigChar) {
        await disconnectBle();
      } else if (serialPort && serialPort.writable) {
        // UI wechselt erst über "OK EXIT_CONFIG" / "MODE:KEYBOARD" vom Gerät (handleSerialLine)
        const ack = waitForAck("EXIT_CONFIG", 1500);
        if (!(await sendSerialCommand("EXIT_CONFIG"))) {
          resolveAcksForLine("ERR SEND EXIT_CONFIG");
        }
        if ((await ack) !== true) {
          showToast("⚠️ EXIT_CONFIG wurde von der Tastatur nicht bestätigt.", 6000);
        }
      }
    });
  }

  // Layer Rename Button & Input (Enter Key)
  const btnRename = document.getElementById("btnRenameLayer");
  if (btnRename) {
    btnRename.addEventListener("click", renameActiveLayer);
  }
  const inputRename = document.getElementById("layerNameInput");
  if (inputRename) {
    inputRename.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        renameActiveLayer();
      }
    });
  }
}

// Alte Configs speichern Modifier-Halte-Aktionen als MOD_*; im Dropdown entsprechen sie den KEY_*-Modifiern
const LEGACY_HOLD_CODES = {
  MOD_LCTRL: "KEY_LEFT_CTRL", MOD_LSHIFT: "KEY_LEFT_SHIFT", MOD_LALT: "KEY_LEFT_ALT", MOD_LGUI: "KEY_LEFT_GUI",
  MOD_RCTRL: "KEY_RIGHT_CTRL", MOD_RSHIFT: "KEY_RIGHT_SHIFT", MOD_RALT: "KEY_RIGHT_ALT", MOD_RGUI: "KEY_RIGHT_GUI"
};

function normalizeHoldCode(code) {
  return LEGACY_HOLD_CODES[code] || code || "NONE";
}

// Kurze Unterbeschriftung der Halte-Aktion auf der Keycap (max. 6 Zeichen)
const HOLD_SUBLABEL_SHORT = {
  KEY_LEFT_CTRL: "Ctrl", KEY_RIGHT_CTRL: "Ctrl", KEY_LEFT_SHIFT: "Shift", KEY_RIGHT_SHIFT: "Shift",
  KEY_LEFT_ALT: "Alt", KEY_RIGHT_ALT: "Alt", KEY_LEFT_GUI: "Cmd", KEY_RIGHT_GUI: "Cmd",
  LAYER_UP: "L+1", LAYER_DOWN: "L-1", MAC_GLOBE: "Globe", ...UMLAUT_LABELS
};

function holdSublabel(code) {
  const c = normalizeHoldCode(code);
  if (HOLD_SUBLABEL_SHORT[c]) return HOLD_SUBLABEL_SHORT[c];
  let m = /^MO_(\d)$/.exec(c);
  if (m) return `L${m[1]}`;
  m = /^TG_(\d)$/.exec(c);
  if (m) return `TG${m[1]}`;
  return c.replace(/^(KEY_|MEDIA_|MOUSE_)/, "").slice(0, 6);
}

// Präfix der Optionen in den Auswahllisten für Halte- und Doppel-Tipp-Aktion
const OPTIONAL_ACTION_PREFIX = { holdActionSelect: "Halten = ", dtapActionSelect: "2× Tippen = " };

// Gruppe "Sonderzeichen (macOS US)" als Daten; charPairs = auch Option-Zeichen, die ein Tastenpaar brauchen
function deMacCharGroup({ charPairs = false, prefix = "" } = {}) {
  const options = [];
  DE_MAC_CHARS.forEach((entry, i) => {
    if (entry.pair && !charPairs) return;
    options.push({
      value: entry.pair ? charPairCode(i) : entry.code,
      text: `${prefix}${entry.char} ${entry.name} (${entry.hint}${entry.pair ? ", Tastenpaar" : ""})`
    });
  });
  return { label: "Sonderzeichen (macOS US)", options };
}

// Optionsliste einer Aktions-Auswahl als Daten: Einträge { value, text } oder Gruppen { label, options }.
// holdMode = Halte- bzw. Doppel-Tipp-Aktion mit "Keine" oben und Präfix vor jeder Option.
function keycodeOptionTree({ holdMode = false, prefix = "Halten = ", charPairs = false } = {}) {
  const tree = [];
  // Halte- bzw. Doppel-Tipp-Aktion: jede Aktion ist erlaubt (Modifier, Layer, Media, Maus)
  if (holdMode) tree.push({ value: "NONE", text: "-- Keine (Nur Einzeltaste) --" });
  KEYCODES.forEach(group => {
    const options = group.keys
      .filter(k => !(holdMode && k.code === "NONE")) // "Keine" steht bereits oben
      .map(k => ({ value: k.code, text: holdMode ? `${prefix}${k.label} (${k.code})` : `${k.label} (${k.code})` }));
    tree.push({ label: group.group, options });
    // Sonderzeichen direkt nach "Zahlen & Symbole"
    if (group.group === "Zahlen & Symbole") tree.push(deMacCharGroup({ charPairs, prefix: holdMode ? prefix : "" }));
  });
  return tree;
}

function appendOptionGroup(select, group) {
  const optgroup = document.createElement("optgroup");
  optgroup.label = group.label;
  group.options.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.text;
    optgroup.appendChild(opt);
  });
  select.appendChild(optgroup);
}

function appendDeMacCharGroup(select, options = {}) {
  appendOptionGroup(select, deMacCharGroup(options));
}

function fillKeycodeSelect(select, options = {}) {
  select.innerHTML = "";
  keycodeOptionTree(options).forEach(node => {
    if (node.options) {
      appendOptionGroup(select, node);
      return;
    }
    const opt = document.createElement("option");
    opt.value = node.value;
    opt.textContent = node.text;
    select.appendChild(opt);
  });
}

function populateKeycodeSelects() {
  fillKeycodeSelect(document.getElementById("primaryActionSelect"), { charPairs: true });
  // Combo-Aktionen unterstützen keine Tastenpaare: nur Zeichen mit Einzelcode
  fillKeycodeSelect(document.getElementById("comboActionSelect"));
  fillKeycodeSelect(document.getElementById("holdActionSelect"), { holdMode: true, charPairs: true });
  fillKeycodeSelect(document.getElementById("dtapActionSelect"), { holdMode: true, prefix: OPTIONAL_ACTION_PREFIX.dtapActionSelect, charPairs: true });
  ["primaryActionSelect", "holdActionSelect", "dtapActionSelect", "comboActionSelect"].forEach(id => {
    const input = document.querySelector(`[data-filter-for="${id}"]`);
    if (input) input.addEventListener("input", () => applySelectFilter(id));
  });
}

// Sichtbarkeit der Optionen bei einer Suche, als reine Funktion. nodes: Einträge { text } oder Gruppen
// { label, options: [{ text }] }. Passt der Gruppenname, bleibt die ganze Gruppe sichtbar. prefix ("Halten = ")
// wird vor dem Vergleich vom Optionstext entfernt. Liefert { nodes, matches } mit visible pro Eintrag.
function filterOptionNodes(nodes, query, prefix = "") {
  const strip = text => (prefix && String(text).startsWith(prefix) ? String(text).slice(prefix.length) : text);
  let matches = 0;
  const result = (nodes || []).map(node => {
    if (node.options) {
      const groupMatch = String(query || "").trim() !== "" && keycodeOptionMatches(node.label, query);
      const options = node.options.map(o => groupMatch || keycodeOptionMatches(strip(o.text), query));
      const visible = options.filter(Boolean).length;
      matches += visible;
      return { visible: visible > 0, options };
    }
    const visible = keycodeOptionMatches(strip(node.text), query);
    if (visible) matches++;
    return { visible };
  });
  return { nodes: result, matches };
}

// Hinweis unter einer gefilterten Auswahl. Die Suche ändert die Auswahl nie: ohne Treffer wird das
// Übernehmen gesperrt, eine ausgeblendete gewählte Option bleibt gewählt und wird genannt.
function selectFilterHint(query, matches, selectedHidden, selectedText) {
  if (String(query || "").trim() === "") return { text: "", blocked: false };
  if (matches === 0) return { text: "Keine Treffer. Suche ändern, um zu übernehmen.", blocked: true };
  if (selectedHidden) return { text: `Gewählt bleibt: ${selectedText}`, blocked: false };
  return { text: "", blocked: false };
}

// Auswahl-IDs, deren Suche den Übernehmen- bzw. Speichern-Knopf sperrt
const FILTER_BLOCKS_BUTTON = {
  primaryActionSelect: "btnApplyKey", holdActionSelect: "btnApplyKey", dtapActionSelect: "btnApplyKey",
  comboActionSelect: "btnSaveCombo"
};

// Suchfeld über einer Aktions-Auswahl: blendet nicht passende Optionen und leere Gruppen aus.
// Die gewählte Option bleibt gewählt, auch wenn sie ausgeblendet ist (nur eine explizite Wahl ändert sie).
function applySelectFilter(selectId) {
  const select = document.getElementById(selectId);
  const input = document.querySelector(`[data-filter-for="${selectId}"]`);
  if (!select || !input) return;
  const query = input.value;
  const children = Array.from(select.children);
  const nodes = children.map(child => (child.tagName === "OPTGROUP"
    ? { label: child.label, options: Array.from(child.children).map(opt => ({ text: opt.textContent })) }
    : { text: child.textContent }));
  const filtered = filterOptionNodes(nodes, query, OPTIONAL_ACTION_PREFIX[selectId] || "");
  children.forEach((child, i) => {
    const vis = filtered.nodes[i];
    child.hidden = !vis.visible;
    if (child.tagName === "OPTGROUP") Array.from(child.children).forEach((opt, j) => { opt.hidden = !vis.options[j]; });
  });
  const selected = select.options[select.selectedIndex];
  const selectedHidden = !!selected && (selected.hidden || (selected.parentElement && selected.parentElement.hidden));
  const hint = selectFilterHint(query, filtered.matches, selectedHidden, selected ? selected.textContent : "");
  let hintEl = select.parentElement && select.parentElement.querySelector(`[data-filter-hint-for="${selectId}"]`);
  if (!hintEl && select.parentElement) {
    hintEl = document.createElement("small");
    hintEl.className = "form-hint filter-hint";
    hintEl.dataset.filterHintFor = selectId;
    select.insertAdjacentElement("afterend", hintEl);
  }
  if (hintEl) {
    hintEl.textContent = hint.text;
    hintEl.style.display = hint.text ? "" : "none";
  }
  select.dataset.filterBlocked = hint.blocked ? "true" : "";
  updateFilterBlockedButton(FILTER_BLOCKS_BUTTON[selectId]);
}

function updateFilterBlockedButton(buttonId) {
  const btn = buttonId && document.getElementById(buttonId);
  if (!btn) return;
  const blocked = Object.entries(FILTER_BLOCKS_BUTTON).some(([id, b]) => {
    const sel = document.getElementById(id);
    return b === buttonId && sel && sel.dataset.filterBlocked === "true";
  });
  btn.disabled = blocked;
  btn.title = blocked ? "Eine Suche hat keine Treffer. Suche ändern oder leeren." : "";
}

function clearSelectFilter(selectId) {
  const input = document.querySelector(`[data-filter-for="${selectId}"]`);
  if (!input) return;
  input.value = "";
  applySelectFilter(selectId);
}

// Wechselt die bearbeitete Hälfte: Zustand der bisherigen Hälfte sichern, den der neuen laden
function switchEditSide(side) {
  if (!sideStore.has(side)) return;
  if (side !== editSide) {
    sideStore.save(editSide, { config: currentConfig, pendingChanges });
    editSide = side;
    const state = sideStore.get(side);
    currentConfig = state.config;
    pendingChanges = state.pendingChanges;
    selectedKey = null;
    document.getElementById("inspectorBody").style.display = "none";
    document.getElementById("inspectorPlaceholder").style.display = "";
    document.getElementById("selectedKeyCoords").textContent = "Keine Taste gewählt";
    const btnClear = document.getElementById("btnClearKeySelection");
    if (btnClear) btnClear.style.display = "none";
    applySettingsToInputs(currentConfig.settings);
    renderLayerButtons();
    renderCombosTable();
    renderPendingSyncUI();
    renderMatrixTest();
    updateTypingStatsUI();
  }
  updateSideLabels();
  renderMatrix();
}

// Texte mit Combo, Hälfte und Diodenrichtung an die bearbeitete Hälfte anpassen
function updateSideLabels() {
  const profile = activeProfile();
  const comboBadge = document.getElementById("configComboBadge");
  if (comboBadge) comboBadge.textContent = `${profile.label} · Combo: ${profile.comboLabel} (0,5s)`;
  const diode = document.getElementById("matrixTestSideHint");
  if (diode) diode.textContent = `${profile.label} · ${profile.diodeHint}`;
  const flashBtn = document.getElementById("btnSaveToDactyl");
  if (flashBtn) flashBtn.title = `Tastenbelegung der ${profile.label} kompilieren und per USB auf diese Hälfte flashen`;
  const presetBtn = document.getElementById("btnApplyPreset");
  if (presetBtn) {
    presetBtn.disabled = !profile.presets;
    presetBtn.title = profile.presets ? "" : "Layout-Presets gibt es nur für die rechte Hand";
  }
}

function renderMatrix() {
  const container = document.getElementById("matrixGrid");
  container.innerHTML = "";

  const layerOf = side => {
    const cfg = configFor(side);
    return cfg.layers[activeLayerIndex] || cfg.layers[0];
  };

  if (activeHandView === "both") {
    const splitWrapper = document.createElement("div");
    splitWrapper.style.display = "flex";
    splitWrapper.style.gap = "36px";
    splitWrapper.style.justifyContent = "center";
    splitWrapper.style.flexWrap = "wrap";

    for (const side of ["L", "R"]) {
      const col = document.createElement("div");
      const title = document.createElement("h4");
      title.style.cssText = `margin-bottom: 12px; text-align: center; color: ${side === editSide ? "#10b981" : "#94a3b8"};`;
      title.textContent = SIDE_PROFILES[side].label + (side === editSide ? " (wird bearbeitet)" : "");
      col.appendChild(title);
      col.appendChild(createHalfMatrix(layerOf(side), side));
      splitWrapper.appendChild(col);
    }
    container.appendChild(splitWrapper);
  } else {
    container.appendChild(createHalfMatrix(layerOf(editSide), editSide));
  }
  if (heatmapEnabled) applyHeatmap();
}

function createHalfMatrix(matrixData, side) {
  const profile = SIDE_PROFILES[side];
  const halfEl = document.createElement("div");
  halfEl.className = "matrix-half " + (side === "L" ? "left-half" : "right-half");

  // 1. FINGER-MATRIX (Reihen 0 bis 4 = 5 Fingerreihen mit je 6 Spalten 0..5)
  const fingerMatrixEl = document.createElement("div");
  fingerMatrixEl.className = "finger-matrix";

  for (let r = 0; r < 5; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "matrix-row";
    rowEl.dataset.row = r;

    for (let c = 0; c < 6; c++) {
      // Physisch fehlende Position (rechts R4C0, links R4C5) -> unsichtbarer Platzhalter für den Spalten-Stagger
      if (!isPhysicalKey(r, c, profile)) {
        const spacer = document.createElement("div");
        spacer.className = "key-cap key-cap-spacer";
        rowEl.appendChild(spacer);
        continue;
      }

      const keyData = (matrixData[r] && matrixData[r][c]) ? matrixData[r][c] : { label: "?", tap: "NONE", hold: "NONE" };
      const keyEl = createKeycapElement(r, c, side, keyData, false);
      rowEl.appendChild(keyEl);
    }
    fingerMatrixEl.appendChild(rowEl);
  }

  // 2. DEDIZIERTER DAUMEN-CLUSTER (Dactyl Manuform Custom Layout: 6 Tasten, alle an Row 5 / Lila)
  const thumbCard = document.createElement("div");
  thumbCard.className = "thumb-cluster-card";

  const thumbHeader = document.createElement("div");
  thumbHeader.className = "thumb-header";
  thumbHeader.innerHTML = `
    <span class="thumb-title">👑 Dactyl Daumen-Cluster</span>
    <span class="thumb-badge">${profile.label} (6 Tasten)</span>
  `;
  thumbCard.appendChild(thumbHeader);

  const thumbGrid = document.createElement("div");
  thumbGrid.className = "thumb-dactyl-grid";

  // Position jeder Daumentaste im Raster steht im Seitenprofil (js/side-profiles.js)
  profile.thumbDefs.forEach(def => {
    let keyData = (matrixData[def.r] && matrixData[def.r][def.c])
      ? matrixData[def.r][def.c]
      : { label: def.defaultLabel, tap: "NONE", hold: "NONE" };

    const keyEl = createKeycapElement(def.r, def.c, side, keyData, true);
    keyEl.style.gridColumn = def.col;
    keyEl.style.gridRow = def.row;
    if (def.isTall) {
      keyEl.classList.add("is-tall-2u");
    }
    thumbGrid.appendChild(keyEl);
  });

  thumbCard.appendChild(thumbGrid);

  if (profile.thumbsFirst) {
    // Rechte Hand: Daumen-Cluster links neben dem Finger-Cluster
    halfEl.appendChild(thumbCard);
    halfEl.appendChild(fingerMatrixEl);
  } else {
    // Linke Hand: Finger-Cluster links, Daumen-Cluster rechts
    halfEl.appendChild(fingerMatrixEl);
    halfEl.appendChild(thumbCard);
  }

  return halfEl;
}

function createKeycapElement(r, c, side, keyData, isThumb = false) {
  const profile = SIDE_PROFILES[side];
  const keyEl = document.createElement("div");
  keyEl.className = "key-cap";
  keyEl.dataset.row = r;
  keyEl.dataset.col = c;
  keyEl.dataset.side = side;
  keyEl.dataset.isThumb = isThumb ? "true" : "false";

  // Check if currently selected
  if (side === editSide && selectedKey && selectedKey.r === r && selectedKey.c === c) {
    keyEl.classList.add("selected");
  }

  // Check if key is currently physically held down
  if (activePressedKeys.has(`${side}_${r}_${c}`)) {
    keyEl.classList.add("is-pressed");
  }

  // Check if part of an active combo
  const isComboKey = configFor(side).combos.some(combo => combo.key1 && combo.key2 &&
    ((combo.key1.r === r && combo.key1.c === c) || (combo.key2.r === r && combo.key2.c === c))
  );
  if (isComboKey) {
    keyEl.classList.add("has-combo");
  }

  const labelEl = document.createElement("span");
  labelEl.className = "key-label";
  labelEl.textContent = keyData.label || (keyData.tap ? keyData.tap.replace("KEY_", "") : "");
  keyEl.appendChild(labelEl);

  if (keyData.hold && keyData.hold !== "NONE") {
    const sublabelEl = document.createElement("span");
    sublabelEl.className = "key-sublabel";
    sublabelEl.textContent = holdSublabel(keyData.hold);
    sublabelEl.title = `Halten = ${keyData.hold}`;
    keyEl.appendChild(sublabelEl);
  }

  if (keyData.dtap && keyData.dtap !== "NONE") {
    const dtapEl = document.createElement("span");
    dtapEl.className = "key-sublabel";
    dtapEl.textContent = `2× ${holdSublabel(keyData.dtap)}`;
    dtapEl.title = `2× Tippen = ${keyData.dtap}`;
    keyEl.appendChild(dtapEl);
  }

  const posEl = document.createElement("span");
  posEl.className = "key-pos";
  posEl.textContent = `${side} R${r}C${c}`;
  keyEl.appendChild(posEl);

  // Highlight hardware combo keys for wireless Bluetooth Config Mode
  if (Dactyl.isConfigComboKey(profile, r, c)) {
    keyEl.classList.add("is-config-combo-key");
    keyEl.title = `⚡ Bluetooth Config Combo: Halte ${profile.comboLabel} für 0.5s gedrückt!`;
    const cfgBadge = document.createElement("span");
    cfgBadge.className = "config-combo-badge";
    cfgBadge.textContent = "CFG";
    keyEl.appendChild(cfgBadge);
  }

  keyEl.addEventListener("click", () => {
    // In der Ansicht "Beide" wechselt ein Klick auf die andere Hälfte zuerst die bearbeitete Hälfte
    if (side !== editSide) switchEditSide(side);
    selectKey(r, c, side, isThumb);
  });

  return keyEl;
}

function selectKey(r, c, side = editSide, isThumb = false) {
  selectedKey = { r, c, side, isThumb };
  renderMatrix();
  updateInspector(r, c);
}

// Setzt den Tasten-Inspektor in den Ausgangszustand zurück (keine Taste gewählt, keine Markierung)
function clearKeySelection() {
  if (!selectedKey) return;
  selectedKey = null;
  renderMatrix();
  document.getElementById("inspectorBody").style.display = "none";
  document.getElementById("inspectorPlaceholder").style.display = "";
  document.getElementById("selectedKeyCoords").textContent = "Keine Taste gewählt";
  const btnClear = document.getElementById("btnClearKeySelection");
  if (btnClear) btnClear.style.display = "none";
}

function updateInspector(r, c) {
  const inspectorBody = document.getElementById("inspectorBody");
  const inspectorPlaceholder = document.getElementById("inspectorPlaceholder");
  const coordsBadge = document.getElementById("selectedKeyCoords");
  const labelInput = document.getElementById("keyLabelInput");
  const primarySelect = document.getElementById("primaryActionSelect");
  const holdSelect = document.getElementById("holdActionSelect");

  inspectorPlaceholder.style.display = "none";
  inspectorBody.style.display = "block";
  const btnClear = document.getElementById("btnClearKeySelection");
  if (btnClear) btnClear.style.display = "inline-flex";

  const isThumb = (r === 5 || (r === 2 && c === 6));
  coordsBadge.textContent = `Zeile ${r}, Spalte ${c} ${isThumb ? '(Daumenbereich)' : ''}`;

  const layer = currentConfig.layers[activeLayerIndex] || currentConfig.layers[0];
  const keyData = (layer[r] && layer[r][c]) ? layer[r][c] : { label: "", tap: "NONE", hold: "NONE" };

  ["primaryActionSelect", "holdActionSelect", "dtapActionSelect"].forEach(clearSelectFilter);
  labelInput.value = keyData.label || "";
  primarySelect.value = keyData.tap || "KEY_SPACE";
  setOptionalActionSelect(holdSelect, normalizeHoldCode(keyData.hold));
  setOptionalActionSelect(document.getElementById("dtapActionSelect"), normalizeHoldCode(keyData.dtap));
}

// Setzt eine Halte- oder Doppel-Tipp-Auswahl. Ein unbekannter Code (z. B. aus einem Import) fällt nicht
// still auf "Keine" zurück, sondern erscheint als eigene Option.
function setOptionalActionSelect(select, code) {
  if (!select) return;
  // Zuvor angehängte Optionen für unbekannte Codes entfernen (sonst sammeln sie sich pro Tastenwahl an)
  select.querySelectorAll("option[data-unknown-hold]").forEach(o => o.remove());
  select.value = code;
  if (select.value !== code) {
    const opt = document.createElement("option");
    opt.dataset.unknownHold = "true";
    opt.value = code;
    opt.textContent = `${OPTIONAL_ACTION_PREFIX[select.id] || ""}${code}`;
    select.appendChild(opt);
    select.value = code;
  }
}

function renderCombosTable() {
  // Tastenpaare liegen im selben Tab und ändern sich bei Laden, Import und Undo zusammen mit den Combos
  renderKeyPairs();
  const tbody = document.getElementById("combosTableBody");
  const emptyState = document.getElementById("emptyCombosState");
  tbody.innerHTML = "";

  if (currentConfig.combos.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  currentConfig.combos.forEach((combo) => {
    const tr = document.createElement("tr");

    const behaviorName = {
      "MODIFIER_HOLD": "Modifier Hold (z.B. Strg/Alt halten)",
      "KEY_PRESS": "Einzeltaste senden (z.B. Escape/Enter)",
      "LAYER_TOGGLE": "Layer Umschalten"
    }[combo.behavior] || combo.behavior || "";

    const td1 = document.createElement("td");
    const badge1 = document.createElement("span");
    badge1.className = "combo-key-badge";
    badge1.textContent = (combo.key1 && combo.key1.label) || `R${combo.key1?.r ?? 0}C${combo.key1?.c ?? 0}`;
    td1.appendChild(badge1);

    const tdPlus = document.createElement("td");
    const plusStrong = document.createElement("strong");
    plusStrong.textContent = "+";
    tdPlus.appendChild(plusStrong);

    const td2 = document.createElement("td");
    const badge2 = document.createElement("span");
    badge2.className = "combo-key-badge";
    badge2.textContent = (combo.key2 && combo.key2.label) || `R${combo.key2?.r ?? 0}C${combo.key2?.c ?? 0}`;
    td2.appendChild(badge2);

    const tdAction = document.createElement("td");
    const actStrong = document.createElement("strong");
    actStrong.textContent = combo.actionLabel || combo.action || "";
    tdAction.appendChild(actStrong);

    const tdBehavior = document.createElement("td");
    const behSpan = document.createElement("span");
    behSpan.style.color = "#94a3b8";
    behSpan.style.fontSize = "0.85rem";
    behSpan.textContent = String(behaviorName);
    tdBehavior.appendChild(behSpan);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteCombo(combo.id));
    tdDel.appendChild(delBtn);

    tr.appendChild(td1);
    tr.appendChild(tdPlus);
    tr.appendChild(td2);
    tr.appendChild(tdAction);
    tr.appendChild(tdBehavior);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}
