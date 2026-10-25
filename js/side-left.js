// =============================================================================
// Profil der linken Hand (ESP-NOW-Sender, kein HID-Dienst)
// =============================================================================
// Alles, was nur die linke Hälfte betrifft. Pins, Namen, Combo und Standard-Belegung prüft
// tests/test_side_profiles.js gegen firmware/dactyl_left/ und default_config_left.json.
(function (root) {
  "use strict";

  const { NUM_ROWS, NUM_COLS } = root.Dactyl;
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
      [cell("KEY_LEFT_CTRL", "Ctrl"), cell("KEY_GRAVE", "`"), cell("KEY_LEFT_ALT", "Alt"), cell("KEY_LEFT_GUI", "Cmd"), cell("MO_1", "Nav"), none(), none()],
      [none(), cell("KEY_BACKSPACE", "Bksp"), cell("KEY_DELETE", "Del"), cell("KEY_LEFT_CTRL", "Ctrl"), cell("KEY_SPACE", "Space"), cell("KEY_LEFT_GUI", "Cmd"), cell("KEY_LEFT_ALT", "Alt")]
    ];
    const nav = emptyLayer();
    nav[0] = [cell("TG_0", "Base"), cell("KEY_F1", "F1"), cell("KEY_F2", "F2"), cell("KEY_F3", "F3"), cell("KEY_F4", "F4"), cell("KEY_F5", "F5"), none()];
    return [base, nav, emptyLayer(), emptyLayer(), emptyLayer(), emptyLayer(), emptyLayer(), emptyLayer()];
  }

  root.Dactyl.registerSideProfile({
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
    // Layout-Presets sind Belegungen der rechten Hand; links belegten sie fehlende Tasten (R5C0)
    presets: null,
    scancodeMap: null,
    handView: "left",
    cssClass: "left-half",
    displayOrder: 0,
    exportPrefix: "left_",
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
  });
})(typeof window !== "undefined" ? window : globalThis);
