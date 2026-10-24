// =============================================================================
// Seitenprofile der beiden Tastaturhälften (rechts = Master, links = ESP-NOW-Sender)
// =============================================================================
// Reine Daten und Funktionen ohne DOM. Alles, was sich zwischen links und rechts unterscheidet
// (fehlende Tasten, Daumen-Cluster, Config-Combo, BLE-Name, Leitungen), steht hier und nicht in app.js.
// Pins, Namen und Combo müssen zur Firmware passen: tests/test_side_profiles.js prüft sie gegen die Quellen.
(function (root) {
  "use strict";

  const NUM_ROWS = 6;
  const NUM_COLS = 7;
  const FINGER_ROWS = 5;
  const FINGER_COLS = 6;

  const cell = (tap, label) => ({ label, tap, hold: "NONE", dtap: "NONE" });
  const none = () => cell("NONE", "---");
  const emptyRow = () => Array.from({ length: NUM_COLS }, none);
  const emptyLayer = () => Array.from({ length: NUM_ROWS }, emptyRow);

  // Standard-Belegung links, identisch zu KEYMAP in firmware/dactyl_left/dactyl_left.ino
  // (QWERTZ, Spalten außen C0 -> innen C5, C6 nur Daumen; R4C5 und R5C0 existieren nicht)
  function leftDefaultLayers() {
    const base = [
      [cell("KEY_ESC", "Esc"), cell("KEY_1", "1"), cell("KEY_2", "2"), cell("KEY_3", "3"), cell("KEY_4", "4"), cell("KEY_5", "5"), none()],
      [cell("KEY_TAB", "Tab"), cell("KEY_Q", "Q"), cell("KEY_W", "W"), cell("KEY_E", "E"), cell("KEY_R", "R"), cell("KEY_T", "T"), none()],
      [cell("KEY_CAPS_LOCK", "Caps"), cell("KEY_A", "A"), cell("KEY_S", "S"), cell("KEY_D", "D"), cell("KEY_F", "F"), cell("KEY_G", "G"), none()],
      [cell("KEY_LEFT_SHIFT", "Shift"), cell("KEY_Y", "Y"), cell("KEY_X", "X"), cell("KEY_C", "C"), cell("KEY_V", "V"), cell("KEY_B", "B"), none()],
      [cell("KEY_LEFT_CTRL", "Ctrl"), cell("KEY_GRAVE", "^"), cell("KEY_LEFT_ALT", "Alt"), cell("KEY_LEFT_GUI", "Cmd"), cell("MO_1", "Nav"), none(), none()],
      [none(), cell("KEY_BACKSPACE", "Bksp"), cell("KEY_DELETE", "Del"), cell("KEY_LEFT_CTRL", "Ctrl"), cell("KEY_SPACE", "Space"), cell("KEY_LEFT_GUI", "Cmd"), cell("KEY_LEFT_ALT", "Alt")]
    ];
    const nav = emptyLayer();
    nav[0] = [cell("TG_0", "Base"), cell("KEY_F1", "F1"), cell("KEY_F2", "F2"), cell("KEY_F3", "F3"), cell("KEY_F4", "F4"), cell("KEY_F5", "F5"), none()];
    return [base, nav, emptyLayer(), emptyLayer(), emptyLayer(), emptyLayer(), emptyLayer(), emptyLayer()];
  }

  const SIDE_PROFILES = {
    R: {
      id: "R",
      label: "Rechte Hand",
      bleName: "Dactyl Config",
      deviceName: "Dactyl Keyboard",
      configCombo: [{ r: 0, c: 0 }, { r: 4, c: 5 }],
      comboLabel: "R4C5 + R0C0",
      absentKeys: ["4_0", "5_5"],
      // Die rechte Vorlage hat auf R5C5 historisch eine Aktion; sie bleibt ohne Wirkung (wie server.py)
      strictAbsentKeys: false,
      // Layout-Presets (PRESETS in app.js) sind Belegungen der rechten Hand
      presets: true,
      // Rechte Hand: Daumen-Cluster links neben dem Finger-Cluster
      thumbsFirst: true,
      thumbDefs: [
        { r: 5, c: 6, col: "1", row: "1", isTall: false, defaultLabel: "Esc" },
        { r: 5, c: 0, col: "2", row: "1", isTall: false, defaultLabel: "Cmd" },
        { r: 5, c: 1, col: "1", row: "2", isTall: false, defaultLabel: "Alt" },
        { r: 5, c: 4, col: "1", row: "3", isTall: false, defaultLabel: "Tab" },
        { r: 5, c: 3, col: "2", row: "2 / span 2", isTall: true, defaultLabel: "Space (2U)" },
        { r: 5, c: 2, col: "3", row: "2 / span 2", isTall: true, defaultLabel: "Enter (2U)" }
      ],
      rowWires: [
        { gpio: 13, color: "Gelb" }, { gpio: 14, color: "Orange" }, { gpio: 27, color: "Grün" },
        { gpio: 26, color: "Braun" }, { gpio: 33, color: "Blau" }, { gpio: 32, color: "Lila" }
      ],
      colWires: [
        { gpio: 23, color: "Gelb" }, { gpio: 19, color: "Orange" }, { gpio: 18, color: "Grün" },
        { gpio: 17, color: "Braun" }, { gpio: 16, color: "Blau" }, { gpio: 4, color: "Lila" },
        { gpio: 25, color: "Rot" }
      ],
      diodeHint: "Dioden: Kathode zur Zeile",
      heatmapStorageKey: "dactyl_key_heatmap_v1",
      // Die rechte Standard-Konfiguration liegt bis zur Extraktion noch in app.js (DEFAULT_CONFIG)
      defaultConfig: null
    },
    L: {
      id: "L",
      label: "Linke Hand",
      bleName: "Dactyl Config L",
      deviceName: "Dactyl Links",
      // Gespiegelt: innen oben + außen unten (CONFIG_COMBO_* in dactyl_left.ino)
      configCombo: [{ r: 0, c: 5 }, { r: 4, c: 0 }],
      comboLabel: "R0C5 + R4C0",
      absentKeys: ["4_5", "5_0"],
      // Fehlende Tasten dürfen keine Aktion tragen (server.py lehnt sie für links mit HTTP 400 ab)
      strictAbsentKeys: true,
      presets: false,
      // Linke Hand: Finger-Cluster links, Daumen-Cluster rechts (Spiegelbild der rechten Hand)
      thumbsFirst: false,
      thumbDefs: [
        { r: 5, c: 6, col: "3", row: "1", isTall: false, defaultLabel: "Alt" },
        { r: 5, c: 5, col: "2", row: "1", isTall: false, defaultLabel: "Cmd" },
        { r: 5, c: 4, col: "3", row: "2", isTall: false, defaultLabel: "Space" },
        { r: 5, c: 1, col: "3", row: "3", isTall: false, defaultLabel: "Bksp" },
        { r: 5, c: 2, col: "2", row: "2 / span 2", isTall: true, defaultLabel: "Del (2U)" },
        { r: 5, c: 3, col: "1", row: "2 / span 2", isTall: true, defaultLabel: "Ctrl (2U)" }
      ],
      rowWires: [
        { gpio: 23, color: "Gelb" }, { gpio: 19, color: "Orange" }, { gpio: 18, color: "Grün" },
        { gpio: 17, color: "Braun" }, { gpio: 16, color: "Blau" }, { gpio: 4, color: "Lila" }
      ],
      colWires: [
        { gpio: 13, color: "Lila" }, { gpio: 14, color: "Braun" }, { gpio: 27, color: "Grün" },
        { gpio: 26, color: "Orange" }, { gpio: 33, color: "Gelb" }, { gpio: 32, color: "Rot" },
        { gpio: 25, color: "Blau" }
      ],
      diodeHint: "Dioden: Kathode zur Spalte",
      heatmapStorageKey: "dactyl_key_heatmap_L_v1",
      defaultConfig: {
        settings: { deviceName: "Dactyl Links", debounceMs: 5, comboTimeoutMs: 40, standbyTimeoutMinutes: 5, sleepTimeoutMinutes: 60 },
        layers: leftDefaultLayers(),
        combos: [],
        keyPairs: []
      }
    }
  };

  const SIDE_IDS = Object.keys(SIDE_PROFILES);

  function keyId(r, c) {
    return `${r}_${c}`;
  }

  function isPhysicalKey(profile, r, c) {
    return !!profile && !profile.absentKeys.includes(keyId(r, c));
  }

  // Verlötete Schalter: Finger 5x6 und Daumenzeile 5 mit 7 Spalten, ohne die fehlenden Positionen
  function isWiredSwitch(profile, r, c) {
    if (!Number.isInteger(r) || !Number.isInteger(c) || c < 0) return false;
    const inMatrix = (r >= 0 && r < FINGER_ROWS) ? c < FINGER_COLS : (r === FINGER_ROWS && c < NUM_COLS);
    return inMatrix && isPhysicalKey(profile, r, c);
  }

  function isConfigComboKey(profile, r, c) {
    return !!profile && profile.configCombo.some(k => k.r === r && k.c === c);
  }

  // Config-Mode-Werbename -> Hälfte. Nur "Dactyl Config L" ist links; jeder andere Dactyl-Name ist rechts.
  function sideFromBleName(name) {
    return name === SIDE_PROFILES.L.bleName ? "L" : "R";
  }

  // DEVICE_INFO.side -> Hälfte. Firmware vor dem Feld "side" ist immer rechts; ein unbekannter Wert ergibt null.
  function sideFromDeviceInfo(info) {
    if (!info || typeof info !== "object") return null;
    if (info.side === undefined) return "R";
    return Object.prototype.hasOwnProperty.call(SIDE_PROFILES, info.side) ? info.side : null;
  }

  // Aktionen einer Zelle wie cell_actions in server.py: Objekt mit tap/hold/dtap oder ein Code-String
  function cellHasAction(cell) {
    const isAction = v => typeof v === "string" && v !== "" && v !== "NONE" && v !== "0";
    if (typeof cell === "string") return isAction(cell);
    return !!cell && typeof cell === "object" && [cell.tap, cell.hold, cell.dtap].some(isAction);
  }

  // Verstöße gegen die fehlenden Tasten der Hälfte, dieselben Regeln wie validate_config in server.py:
  // Combos auf fehlenden Tasten immer, Aktionen auf fehlenden Tasten nur bei strictAbsentKeys.
  // Liefert lesbare Positionen, z. B. "R5C0 (Ebene 0)" oder "Combo 1 (R4C5)"; leer = gültig.
  function absentKeyViolations(profile, cfg) {
    const out = [];
    if (!profile || !cfg || typeof cfg !== "object") return out;
    if (profile.strictAbsentKeys && Array.isArray(cfg.layers)) {
      cfg.layers.forEach((layer, l) => {
        if (!Array.isArray(layer)) return;
        layer.forEach((row, r) => {
          if (!Array.isArray(row)) return;
          row.forEach((cell, c) => {
            if (!isPhysicalKey(profile, r, c) && cellHasAction(cell)) out.push(`R${r}C${c} (Ebene ${l})`);
          });
        });
      });
    }
    if (Array.isArray(cfg.combos)) {
      cfg.combos.forEach((cb, i) => {
        for (const key of [cb && cb.key1, cb && cb.key2]) {
          if (key && !isPhysicalKey(profile, key.r, key.c)) out.push(`Combo ${i + 1} (R${key.r}C${key.c})`);
        }
      });
    }
    return out;
  }

  root.Dactyl = Object.assign(root.Dactyl || {}, {
    SIDE_PROFILES, SIDE_IDS, isPhysicalKey, isWiredSwitch, isConfigComboKey, sideFromBleName, sideFromDeviceInfo,
    absentKeyViolations
  });
})(typeof window !== "undefined" ? window : globalThis);
