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

  // Vormerken; eine verbundene Hälfte bekommt sofort die vollständige Konfiguration
  const side = editSide;
  markPendingSync(changeRecord, side);

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
      const viewSide = Dactyl.sideFromHandView(activeHandView);
      if (viewSide) switchEditSide(viewSide);
      else renderMatrix();
      // Combo-Hinweis gilt für die Hälften der Ansicht; ein Combo der ausgeblendeten Hälfte erlischt
      checkActiveCombos();
      showToast(`Ansicht: ${btn.textContent}`);
    });
  });

  // Toggle Layer Overview Button
  const btnToggleOverview = document.getElementById("btnToggleLayerOverview");
  if (btnToggleOverview) {
    btnToggleOverview.addEventListener("click", toggleLayerOverview);
  }

  // Apply Layout Preset Button
  const btnPreset = document.getElementById("btnApplyPreset");
  if (btnPreset) {
    btnPreset.addEventListener("click", () => {
      const presetKey = document.getElementById("layoutPresetSelect").value;
      // Presets gehören zum Profil; eine Hälfte ohne Presets lehnt sie ab
      const presets = activeProfile().presets;
      if (!presets) {
        showToast(`Für die ${activeProfile().label} gibt es keine Layout-Presets.`, 5000);
        return;
      }
      if (presets[presetKey]) {
        const oldLayer0 = JSON.parse(JSON.stringify(currentConfig.layers[0]));
        currentConfig.layers[0] = JSON.parse(JSON.stringify(presets[presetKey].layers[0]));
        renderMatrix();
        saveConfigToServer();
        // Immer vormerken: das Preset wird mit dem nächsten Sync (Combo oder "Schreiben") übertragen
        markPendingSync({
          type: "preset",
          snapshot: true,
          title: `Layout-Preset angewendet`,
          description: `${presets[presetKey].name} (Ebene 0)`,
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
  LAYER_UP: "L+1", LAYER_DOWN: "L-1", MAC_GLOBE: "Globe", ...UMLAUT_LABELS, ...ONE_SHOT_LABELS
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

// =============================================================================
// Visueller On-Screen-Keyboard Action-Picker (Tastatur-Layouts & Aktions-Auswahl)
// =============================================================================

// Flache Liste aller in Select-Dropdowns wählbaren Optionen
const KEYCODE_OPTIONS = keycodeOptionTree({ holdMode: true, charPairs: true })
  .flatMap(node => (node.options ? node.options : [node]));

// Reiter und Tastenanordnung für das visuelle On-Screen-Keyboard (US Mac + Funktionen/Navigation/Modifier)
const ON_SCREEN_KEYBOARD_TABS = {
  keyboard: {
    label: "Tastatur",
    rows: [
      [
        { code: "KEY_ESC", label: "Esc" },
        { code: "KEY_F1", label: "F1" }, { code: "KEY_F2", label: "F2" }, { code: "KEY_F3", label: "F3" }, { code: "KEY_F4", label: "F4" },
        { code: "KEY_F5", label: "F5" }, { code: "KEY_F6", label: "F6" }, { code: "KEY_F7", label: "F7" }, { code: "KEY_F8", label: "F8" },
        { code: "KEY_F9", label: "F9" }, { code: "KEY_F10", label: "F10" }, { code: "KEY_F11", label: "F11" }, { code: "KEY_F12", label: "F12" }
      ],
      [
        { code: "KEY_GRAVE", label: "` ~" },
        { code: "KEY_1", label: "1 !" }, { code: "KEY_2", label: "2 @" }, { code: "KEY_3", label: "3 #" }, { code: "KEY_4", label: "4 $" },
        { code: "KEY_5", label: "5 %" }, { code: "KEY_6", label: "6 ^" }, { code: "KEY_7", label: "7 &" }, { code: "KEY_8", label: "8 *" },
        { code: "KEY_9", label: "9 (" }, { code: "KEY_0", label: "0 )" }, { code: "KEY_MINUS", label: "- _" }, { code: "KEY_EQUAL", label: "= +" },
        { code: "KEY_BACKSPACE", label: "⌫ Backspace", width: 1.5 }
      ],
      [
        { code: "KEY_TAB", label: "⇥ Tab", width: 1.5 },
        { code: "KEY_Q", label: "Q" }, { code: "KEY_W", label: "W" }, { code: "KEY_E", label: "E" }, { code: "KEY_R", label: "R" },
        { code: "KEY_T", label: "T" }, { code: "KEY_Y", label: "Y" }, { code: "KEY_U", label: "U" }, { code: "KEY_I", label: "I" },
        { code: "KEY_O", label: "O" }, { code: "KEY_P", label: "P" }, { code: "KEY_LEFT_BRACKET", label: "[ {" }, { code: "KEY_RIGHT_BRACKET", label: "] }" },
        { code: "KEY_BACKSLASH", label: "\\ |", width: 1.5 }
      ],
      [
        { code: "KEY_CAPS_LOCK", label: "⇪ Caps", width: 1.75 },
        { code: "KEY_A", label: "A" }, { code: "KEY_S", label: "S" }, { code: "KEY_D", label: "D" }, { code: "KEY_F", label: "F" },
        { code: "KEY_G", label: "G" }, { code: "KEY_H", label: "H" }, { code: "KEY_J", label: "J" }, { code: "KEY_K", label: "K" },
        { code: "KEY_L", label: "L" }, { code: "KEY_SEMICOLON", label: "; :" }, { code: "KEY_QUOTE", label: "' \"" },
        { code: "KEY_RETURN", label: "⏎ Enter", width: 2.25 }
      ],
      [
        { code: "KEY_LEFT_SHIFT", label: "⇧ Shift", width: 2 },
        { code: "KEY_NON_US_BACKSLASH", label: "§ ±" },
        { code: "KEY_Z", label: "Z" }, { code: "KEY_X", label: "X" }, { code: "KEY_C", label: "C" }, { code: "KEY_V", label: "V" },
        { code: "KEY_B", label: "B" }, { code: "KEY_N", label: "N" }, { code: "KEY_M", label: "M" }, { code: "KEY_COMMA", label: ", <" },
        { code: "KEY_PERIOD", label: ". >" }, { code: "KEY_SLASH", label: "/ ?" },
        { code: "KEY_RIGHT_SHIFT", label: "⇧ Shift", width: 2 }
      ],
      [
        { code: "KEY_LEFT_CTRL", label: "Control", width: 1.25 },
        { code: "KEY_LEFT_ALT", label: "⌥ Option", width: 1.25 },
        { code: "KEY_LEFT_GUI", label: "⌘ Command", width: 1.25 },
        { code: "KEY_SPACE", label: "Space", width: 6.25 },
        { code: "KEY_RIGHT_GUI", label: "⌘ Command", width: 1.25 },
        { code: "KEY_RIGHT_ALT", label: "⌥ Option", width: 1.25 },
        { code: "KEY_RIGHT_CTRL", label: "Control", width: 1.25 }
      ]
    ]
  },
  navigation: {
    label: "Navigation & Numpad",
    rows: [
      [
        { code: "KEY_INSERT", label: "Einfügen" }, { code: "KEY_DELETE", label: "Entf ⌦" },
        { code: "KEY_HOME", label: "Pos 1" }, { code: "KEY_END", label: "Ende" },
        { code: "KEY_PAGE_UP", label: "Bild ↑" }, { code: "KEY_PAGE_DOWN", label: "Bild ↓" },
        { code: "KEY_PRTSC", label: "Druck" }
      ],
      [
        { code: "KEY_LEFT_ARROW", label: "← Links" }, { code: "KEY_UP_ARROW", label: "↑ Oben" },
        { code: "KEY_DOWN_ARROW", label: "↓ Unten" }, { code: "KEY_RIGHT_ARROW", label: "→ Rechts" }
      ],
      [
        { code: "KEY_NUM_SLASH", label: "Num /" }, { code: "KEY_NUM_ASTERISK", label: "Num *" },
        { code: "KEY_NUM_MINUS", label: "Num -" }, { code: "KEY_NUM_PLUS", label: "Num +" }
      ],
      [
        { code: "KEY_NUM_7", label: "Num 7" }, { code: "KEY_NUM_8", label: "Num 8" }, { code: "KEY_NUM_9", label: "Num 9" },
        { code: "KEY_NUM_4", label: "Num 4" }, { code: "KEY_NUM_5", label: "Num 5" }, { code: "KEY_NUM_6", label: "Num 6" }
      ],
      [
        { code: "KEY_NUM_1", label: "Num 1" }, { code: "KEY_NUM_2", label: "Num 2" }, { code: "KEY_NUM_3", label: "Num 3" },
        { code: "KEY_NUM_0", label: "Num 0", width: 2 }, { code: "KEY_NUM_PERIOD", label: "Num ." },
        { code: "KEY_NUM_ENTER", label: "Num Enter", width: 1.5 }
      ]
    ]
  },
  special: {
    label: "Umlaute & Modifiers",
    rows: [
      [
        { code: "UMLAUT_AE", label: "ä" }, { code: "UMLAUT_OE", label: "ö" }, { code: "UMLAUT_UE", label: "ü" }, { code: "UMLAUT_SZ", label: "ß" },
        { code: "UMLAUT_AE_UPPER", label: "Ä" }, { code: "UMLAUT_OE_UPPER", label: "Ö" }, { code: "UMLAUT_UE_UPPER", label: "Ü" }
      ],
      [
        { code: "OSM_LCTRL", label: "OSM Strg" }, { code: "OSM_LSHIFT", label: "OSM Umschalt" },
        { code: "OSM_LALT", label: "OSM Alt" }, { code: "OSM_LGUI", label: "OSM Cmd" },
        { code: "OSM_RCTRL", label: "OSM Strg R" }, { code: "OSM_RSHIFT", label: "OSM Umschalt R" },
        { code: "OSM_RALT", label: "OSM Alt R" }, { code: "OSM_RGUI", label: "OSM Cmd R" }
      ],
      [
        { code: "CAPS_WORD", label: "Caps Word", width: 2 },
        { code: "REPEAT", label: "Repeat", width: 2 },
        { code: "MAC_GLOBE", label: "🌐 Globus / Fn", width: 2 }
      ]
    ]
  },
  layers: {
    label: "Ebenen",
    rows: [
      [
        { code: "MO_0", label: "MO 0" }, { code: "MO_1", label: "MO 1" }, { code: "MO_2", label: "MO 2" }, { code: "MO_3", label: "MO 3" },
        { code: "MO_4", label: "MO 4" }, { code: "MO_5", label: "MO 5" }, { code: "MO_6", label: "MO 6" }, { code: "MO_7", label: "MO 7" }
      ],
      [
        { code: "TG_0", label: "TG 0" }, { code: "TG_1", label: "TG 1" }, { code: "TG_2", label: "TG 2" }, { code: "TG_3", label: "TG 3" },
        { code: "TG_4", label: "TG 4" }, { code: "TG_5", label: "TG 5" }, { code: "TG_6", label: "TG 6" }, { code: "TG_7", label: "TG 7" }
      ],
      [
        { code: "LAYER_UP", label: "Layer +1 (Aufwärts)", width: 2 },
        { code: "LAYER_DOWN", label: "Layer -1 (Abwärts)", width: 2 },
        { code: "LAYER_LOCK", label: "Layer Lock", width: 2 },
        { code: "NONE", label: "--- Transparent / Keine ---", width: 3 }
      ]
    ]
  },
  media_mouse: {
    label: "Media & Maus",
    rows: [
      [
        { code: "MEDIA_PLAY_PAUSE", label: "⏯ Play/Pause" }, { code: "MEDIA_MUTE", label: "🔇 Mute" },
        { code: "MEDIA_VOLUME_UP", label: "🔊 Vol +" }, { code: "MEDIA_VOLUME_DOWN", label: "🔉 Vol -" },
        { code: "MEDIA_NEXT_TRACK", label: "⏭ Next" }, { code: "MEDIA_PREVIOUS_TRACK", label: "⏮ Prev" },
        { code: "MEDIA_STOP", label: "⏹ Stop" }
      ],
      [
        { code: "MOUSE_LEFT", label: "🖱️ Linksklick" }, { code: "MOUSE_MIDDLE", label: "🖱️ Mittelklick" },
        { code: "MOUSE_RIGHT", label: "🖱️ Rechtsklick" },
        { code: "MOUSE_WHEEL_UP", label: "🖱️ Rad Hoch" }, { code: "MOUSE_WHEEL_DOWN", label: "🖱️ Rad Runter" }
      ],
      [
        { code: "MOUSE_LEFT_MOVE", label: "Maus ←" }, { code: "MOUSE_UP", label: "Maus ↑" },
        { code: "MOUSE_DOWN", label: "Maus ↓" }, { code: "MOUSE_RIGHT_MOVE", label: "Maus →" }
      ]
    ]
  }
};

const ON_SCREEN_KEYBOARD_ROWS = Object.values(ON_SCREEN_KEYBOARD_TABS).flatMap(t => t.rows);

// Übernimmt eine Aktion per Klick auf die On-Screen-Tastatur in das Ziel-Select:
// Setzt aktiven Filter zurück, setzt select.value, löst das change-Event aus und markiert die Taste.
function pickActionFromOnScreenKey(selectEl, codeHex, options = {}) {
  if (!selectEl) return;
  const doc = options.document || (typeof document !== "undefined" ? document : null);
  // Option ergänzen falls sie im Select-Element fehlt (verhindert Leeren von value im HTMLSelectElement)
  if (selectEl.options) {
    const hasOpt = Array.from(selectEl.options).some(o => o.value === codeHex);
    if (!hasOpt) {
      const opt = doc && typeof doc.createElement === "function"
        ? doc.createElement("option")
        : (typeof document !== "undefined" ? document.createElement("option") : { value: codeHex, textContent: codeHex });
      opt.value = codeHex;
      opt.textContent = codeHex;
      if (typeof selectEl.appendChild === "function") {
        selectEl.appendChild(opt);
      }
      if (Array.isArray(selectEl.options) && !selectEl.options.includes(opt)) {
        selectEl.options.push(opt);
      }
    }
  }
  const selectId = selectEl.id || (selectEl.dataset && selectEl.dataset.filterFor);
  if (selectId && typeof clearSelectFilter === "function") {
    clearSelectFilter(selectId);
  } else if (doc && selectId) {
    const input = doc.querySelector(`[data-filter-for="${selectId}"]`);
    if (input) {
      input.value = "";
      if (typeof applySelectFilter === "function") applySelectFilter(selectId);
    }
  }
  selectEl.value = codeHex;
  if (selectEl.dataset && selectEl.dataset.filterBlocked) {
    selectEl.dataset.filterBlocked = "";
  }
  if (typeof updateFilterBlockedButton === "function" && typeof FILTER_BLOCKS_BUTTON !== "undefined" && FILTER_BLOCKS_BUTTON && selectId) {
    updateFilterBlockedButton(FILTER_BLOCKS_BUTTON[selectId]);
  }
  if (typeof Event !== "undefined" && typeof selectEl.dispatchEvent === "function") {
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (typeof selectEl.fire === "function") {
    selectEl.fire("change");
  } else if (typeof selectEl.dispatchEvent === "function") {
    selectEl.dispatchEvent({ type: "change" });
  }
  if (typeof markActiveOnScreenKey === "function") {
    markActiveOnScreenKey(codeHex);
  }
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
  Object.keys(FILTER_BLOCKS_BUTTON).forEach(id => {
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
  comboActionSelect: "btnSaveCombo",
  keyPairFirstSelect: "btnAddKeyPair", keyPairSecondSelect: "btnAddKeyPair", macroStepCode: "btnAddMacroStep"
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
  const insertTarget = (select.closest && select.closest(".select-picker-row")) || select;
  const parent = insertTarget.parentElement || select.parentElement;
  let hintEl = parent && parent.querySelector(`[data-filter-hint-for="${selectId}"]`);
  if (!hintEl && parent) {
    hintEl = document.createElement("small");
    hintEl.className = "form-hint filter-hint";
    hintEl.dataset.filterHintFor = selectId;
    insertTarget.insertAdjacentElement("afterend", hintEl);
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
    // Ein offener Makro-Entwurf gehört zur bisherigen Hälfte
    closeMacroEditor();
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
  const standby = document.getElementById("standbyTimeoutHint");
  if (standby) standby.textContent = `${profile.label}: ${profile.standbyHint}`;
  const flashBtn = document.getElementById("btnSaveToDactyl");
  if (flashBtn) flashBtn.title = `Tastenbelegung der ${profile.label} kompilieren und per USB auf diese Hälfte flashen`;
  const presetBtn = document.getElementById("btnApplyPreset");
  if (presetBtn) {
    presetBtn.disabled = !profile.presets;
    presetBtn.title = profile.presets ? "" : `Für die ${profile.label} gibt es keine Layout-Presets`;
  }
}

function renderMatrix() {
  const container = document.getElementById("matrixGrid");
  container.innerHTML = "";

  const editorWorkspace = document.querySelector(".editor-workspace");
  if (editorWorkspace) {
    editorWorkspace.classList.toggle("split-view", activeHandView === "both");
  }

  const layerOf = side => {
    const cfg = configFor(side);
    return cfg.layers[activeLayerIndex] || cfg.layers[0];
  };

  if (activeHandView === "both") {
    const splitWrapper = document.createElement("div");
    splitWrapper.className = "split-keyboards-row";
    splitWrapper.style.flexWrap = "nowrap";

    for (const side of Dactyl.sidesInDisplayOrder()) {
      const col = document.createElement("div");
      col.className = "split-keyboard-col" + (side === editSide ? " is-active-pane" : "");
      col.style.cursor = side === editSide ? "default" : "pointer";

      const paneHeader = document.createElement("div");
      paneHeader.className = "split-pane-header";

      const title = document.createElement("h4");
      title.style.margin = "0";
      title.style.color = side === editSide ? "#10b981" : "#94a3b8";
      title.textContent = SIDE_PROFILES[side].label;
      paneHeader.appendChild(title);

      const badge = document.createElement("span");
      badge.className = "badge";
      if (side === editSide) {
        badge.style.background = "rgba(16, 185, 129, 0.2)";
        badge.style.color = "#6ee7b7";
        badge.textContent = "Wird bearbeitet";
      } else {
        badge.style.background = "rgba(148, 163, 184, 0.15)";
        badge.style.color = "#94a3b8";
        badge.textContent = "Klicken zum Bearbeiten";
      }
      paneHeader.appendChild(badge);

      col.appendChild(paneHeader);
      col.appendChild(createHalfMatrix(layerOf(side), side));

      col.addEventListener("click", (e) => {
        if (side !== editSide && !e.target.closest(".key-cap")) {
          switchEditSide(side);
        }
      });

      splitWrapper.appendChild(col);
    }
    container.appendChild(splitWrapper);
  } else {
    container.appendChild(createHalfMatrix(layerOf(editSide), editSide));
  }
  if (heatmapEnabled) applyHeatmap();
  renderLayoutLint();
  if (layerOverviewOpen) renderLayerOverview();
}

let layerOverviewOpen = false;

function toggleLayerOverview() {
  layerOverviewOpen = !layerOverviewOpen;
  const panel = document.getElementById("layerOverviewPanel");
  const btn = document.getElementById("btnToggleLayerOverview");
  if (panel) panel.style.display = layerOverviewOpen ? "block" : "none";
  if (btn) {
    btn.classList.toggle("active", layerOverviewOpen);
    btn.setAttribute("aria-expanded", layerOverviewOpen ? "true" : "false");
  }
  if (layerOverviewOpen) {
    renderLayerOverview();
  }
}

function renderLayerOverview() {
  const panel = document.getElementById("layerOverviewPanel");
  const grid = document.getElementById("layerOverviewGrid");
  const badge = document.getElementById("layerOverviewSideBadge");
  if (!panel || !grid) return;

  const profile = activeProfile();
  if (badge) badge.textContent = profile.label;

  const overviewData = buildLayerOverview(currentConfig, profile);
  grid.replaceChildren();

  for (const data of overviewData) {
    const card = document.createElement("div");
    card.className = "layer-overview-card" + (data.layer === activeLayerIndex ? " is-active-layer" : "");
    card.dataset.layer = String(data.layer);

    // Header
    const cardHeader = document.createElement("div");
    cardHeader.className = "layer-overview-card-header";
    cardHeader.title = `Klicken, um zu L${data.layer} (${data.name}) zu wechseln`;

    const titleGroup = document.createElement("div");
    titleGroup.className = "layer-overview-title-group";

    const numSpan = document.createElement("span");
    numSpan.className = "layer-overview-num";
    numSpan.textContent = `L${data.layer}`;
    titleGroup.appendChild(numSpan);

    const nameEl = document.createElement("strong");
    nameEl.className = "layer-overview-name";
    nameEl.textContent = data.name;
    titleGroup.appendChild(nameEl);

    cardHeader.appendChild(titleGroup);

    const badgesDiv = document.createElement("div");
    badgesDiv.className = "layer-overview-badges";

    if (data.conflictCount > 0) {
      const bConf = document.createElement("span");
      bConf.className = "badge badge-conflict";
      bConf.title = `${data.conflictCount} Konflikt${data.conflictCount === 1 ? "" : "e"}`;
      bConf.textContent = `⚠️ ${data.conflictCount}`;
      badgesDiv.appendChild(bConf);
    }
    if (data.layer > 0) {
      const bTrans = document.createElement("span");
      bTrans.className = "badge badge-trans";
      bTrans.title = `${data.transparentCount} transparente Taste${data.transparentCount === 1 ? "" : "n"}`;
      bTrans.textContent = `▽ ${data.transparentCount}`;
      badgesDiv.appendChild(bTrans);
    }
    const bOwn = document.createElement("span");
    bOwn.className = "badge badge-own";
    bOwn.title = `${data.ownCount} eigene Taste${data.ownCount === 1 ? "" : "n"}`;
    bOwn.textContent = String(data.ownCount);
    badgesDiv.appendChild(bOwn);

    cardHeader.appendChild(badgesDiv);

    cardHeader.addEventListener("click", () => {
      if (activeLayerIndex !== data.layer) {
        activeLayerIndex = data.layer;
        document.querySelectorAll(".layer-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.layer) === data.layer));
        updateLayerNameInput();
        renderMatrix();
        if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
      }
    });

    card.appendChild(cardHeader);

    // Matrix
    const matrixWrap = document.createElement("div");
    matrixWrap.className = "layer-overview-matrix-wrap";

    const halfEl = document.createElement("div");
    halfEl.className = "overview-half " + profile.cssClass;

    // Finger matrix
    const fingerMatrixEl = document.createElement("div");
    fingerMatrixEl.className = "overview-finger-matrix";

    for (let r = 0; r < 5; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "overview-row";
      rowEl.dataset.row = String(r);

      for (let c = 0; c < 6; c++) {
        const key = data.rows[r][c];
        rowEl.appendChild(createOverviewKeyElement(key, data.layer, profile));
      }
      fingerMatrixEl.appendChild(rowEl);
    }

    // Thumb cluster
    const thumbGrid = document.createElement("div");
    thumbGrid.className = "overview-thumb-grid";

    (profile.thumbDefs || []).forEach((def, i) => {
      const key = data.thumbs[i];
      const keyEl = createOverviewKeyElement(key, data.layer, profile);
      keyEl.style.gridColumn = def.col;
      keyEl.style.gridRow = def.row;
      if (def.isTall) keyEl.classList.add("is-tall-2u");
      thumbGrid.appendChild(keyEl);
    });

    if (profile.thumbsFirst) {
      halfEl.appendChild(thumbGrid);
      halfEl.appendChild(fingerMatrixEl);
    } else {
      halfEl.appendChild(fingerMatrixEl);
      halfEl.appendChild(thumbGrid);
    }

    matrixWrap.appendChild(halfEl);
    card.appendChild(matrixWrap);

    grid.appendChild(card);
  }
}

function createOverviewKeyElement(key, layerIdx, profile) {
  const keyEl = document.createElement("div");
  keyEl.className = "overview-key";
  keyEl.dataset.row = String(key.r);
  keyEl.dataset.col = String(key.c);
  keyEl.dataset.layer = String(layerIdx);
  if (key.isThumb) keyEl.dataset.isThumb = "true";

  if (!key.exists) {
    keyEl.classList.add("overview-key-spacer");
    return keyEl;
  }

  if (key.transparent) {
    keyEl.classList.add("is-transparent");
    keyEl.dataset.transparent = "true";
    keyEl.title = `L${layerIdx} R${key.r}C${key.c}: Transparent ➔ erbt von L0 (${key.inheritedLabel || "---"})`;
  } else {
    keyEl.title = `L${layerIdx} R${key.r}C${key.c}: ${key.label || key.tap || "---"}`;
  }

  if (key.conflict) {
    keyEl.classList.add("is-conflict");
    keyEl.dataset.conflict = "true";
    keyEl.title += ` ⚠️ ${key.conflictReason}`;
  }

  if (layerIdx === activeLayerIndex && selectedKey && selectedKey.r === key.r && selectedKey.c === key.c) {
    keyEl.classList.add("is-selected");
  }

  const labelSpan = document.createElement("span");
  labelSpan.className = "overview-key-label";
  labelSpan.textContent = key.label || (key.transparent ? "▽" : "·");
  keyEl.appendChild(labelSpan);

  keyEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeLayerIndex !== layerIdx) {
      activeLayerIndex = layerIdx;
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.layer) === layerIdx));
      updateLayerNameInput();
    }
    selectKey(key.r, key.c, editSide, key.isThumb);
    renderMatrix();
  });

  return keyEl;
}

function createHalfMatrix(matrixData, side) {
  const profile = SIDE_PROFILES[side];
  const halfEl = document.createElement("div");
  halfEl.className = "matrix-half " + profile.cssClass;

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
  const termInput = document.getElementById("keyTapTermInput");
  if (termInput) termInput.value = Number.isInteger(keyData.tapTerm) && keyData.tapTerm > 0 ? keyData.tapTerm : "";
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

// Spalte "Ebenen" der Combo-Tabelle: "Alle" oder die Liste der Ebenen der Maske
function comboLayersText(combo) {
  const mask = comboLayerMask(combo);
  return mask === COMBO_ALL_LAYERS ? "Alle" : comboMaskLayers(mask).join(", ");
}

function renderCombosTable() {
  // Tastenpaare, Überschreibungen und Makros liegen im selben Tab und ändern sich bei Laden, Import und Undo zusammen mit den Combos
  renderKeyPairs();
  renderKeyOverrides();
  renderMacros();
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

    const tdLayers = document.createElement("td");
    tdLayers.className = "combo-layers-cell";
    tdLayers.textContent = comboLayersText(combo);

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
    tr.appendChild(tdLayers);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

// =============================================================================
// DOM-Steuerung für On-Screen-Keyboard Action-Picker
// =============================================================================

let activePickerTargetSelect = null;
let activePickerTab = "keyboard";

function markActiveOnScreenKey(code) {
  if (typeof document === "undefined") return;
  const modal = document.getElementById("onScreenPickerModal");
  if (!modal) return;
  modal.querySelectorAll(".osk-key").forEach(k => {
    k.classList.toggle("active", k.dataset.code === code);
  });
}

function openOnScreenPickerForSelect(selectEl) {
  if (!selectEl || typeof document === "undefined") return;
  activePickerTargetSelect = selectEl;
  const modal = document.getElementById("onScreenPickerModal");
  if (!modal) return;

  const currentVal = selectEl.value || "NONE";
  for (const [tabKey, tab] of Object.entries(ON_SCREEN_KEYBOARD_TABS)) {
    if (tab.rows.some(r => r.some(k => k.code === currentVal))) {
      activePickerTab = tabKey;
      break;
    }
  }

  renderOnScreenPicker(currentVal);
  modal.style.display = "flex";
}

function closeOnScreenPicker() {
  const modal = typeof document !== "undefined" && document.getElementById("onScreenPickerModal");
  if (modal) modal.style.display = "none";
  activePickerTargetSelect = null;
}

function renderOnScreenPicker(activeCode) {
  if (typeof document === "undefined") return;
  const tabsContainer = document.getElementById("oskTabs");
  const keyboardContainer = document.getElementById("onScreenKeyboardContainer");
  if (!tabsContainer || !keyboardContainer) return;

  tabsContainer.innerHTML = "";
  Object.entries(ON_SCREEN_KEYBOARD_TABS).forEach(([tabKey, tab]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "osk-tab-btn" + (tabKey === activePickerTab ? " active" : "");
    btn.textContent = tab.label;
    btn.addEventListener("click", () => {
      activePickerTab = tabKey;
      renderOnScreenPicker(activeCode || (activePickerTargetSelect ? activePickerTargetSelect.value : ""));
    });
    tabsContainer.appendChild(btn);
  });

  keyboardContainer.innerHTML = "";
  const currentTab = ON_SCREEN_KEYBOARD_TABS[activePickerTab] || ON_SCREEN_KEYBOARD_TABS.keyboard;
  currentTab.rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "osk-row";
    row.forEach(key => {
      const keyBtn = document.createElement("button");
      keyBtn.type = "button";
      keyBtn.className = "osk-key";
      if (key.width) {
        keyBtn.classList.add(`w-${String(key.width).replace(".", "-")}`);
      }
      if (activeCode && key.code === activeCode) {
        keyBtn.classList.add("active");
      }
      keyBtn.dataset.code = key.code;
      keyBtn.textContent = key.label;
      keyBtn.title = `${key.label} (${key.code})`;
      keyBtn.addEventListener("click", () => {
        if (activePickerTargetSelect) {
          pickActionFromOnScreenKey(activePickerTargetSelect, key.code);
        }
        closeOnScreenPicker();
      });
      rowEl.appendChild(keyBtn);
    });
    keyboardContainer.appendChild(rowEl);
  });
}

function initOnScreenKeyboardPicker() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".action-picker-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.targetSelect;
      const target = targetId ? document.getElementById(targetId) : null;
      if (target) openOnScreenPickerForSelect(target);
    });
  });

  const btnClose = document.getElementById("btnCloseOnScreenPicker");
  const btnCancel = document.getElementById("btnCancelOnScreenPicker");
  const modal = document.getElementById("onScreenPickerModal");

  if (btnClose) btnClose.addEventListener("click", closeOnScreenPicker);
  if (btnCancel) btnCancel.addEventListener("click", closeOnScreenPicker);
  if (modal) {
    modal.addEventListener("click", ev => {
      if (ev.target === modal) closeOnScreenPicker();
    });
  }
}
