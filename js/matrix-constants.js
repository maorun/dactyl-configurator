// =============================================================================
// Kanonische Matrix- und Pin-Konstanten für Dactyl Configurator
// =============================================================================
// Zentrale Quelle für Matrix-Dimensionen, GPIO-Pins, physisch fehlende Tasten
// und Hardware-Combos beider Hälften.
// Unterstützt Browser (global DACTYL_MATRIX_CONSTANTS / Dactyl.*), Node.js (CommonJS)
// und Python (server.py liest den JSON-Block).
(function (root, factory) {
  "use strict";
  var constants = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = constants;
  }
  if (root) {
    root.DACTYL_MATRIX_CONSTANTS = constants;
    root.Dactyl = Object.assign(root.Dactyl || {}, constants);
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";
  return /* MATRIX_CONSTANTS_JSON */ {
    "NUM_LAYERS": 8,
    "NUM_ROWS": 6,
    "NUM_COLS": 7,
    "FINGER_ROWS": 5,
    "FINGER_COLS": 6,
    "RIGHT": {
      "rowPins": [13, 14, 27, 26, 33, 32],
      "colPins": [23, 19, 18, 17, 16, 4, 25],
      "missingKeys": ["R4C0", "R5C5"],
      "absentKeys": ["4_0", "5_5"],
      "configCombo": [{ "r": 0, "c": 0 }, { "r": 4, "c": 5 }],
      "comboCoords": [[4, 5], [0, 0]],
      "comboLabel": "R4C5 + R0C0"
    },
    "LEFT": {
      "rowPins": [23, 19, 18, 17, 16, 4],
      "colPins": [13, 14, 27, 26, 33, 32, 25],
      "missingKeys": ["R4C5", "R5C0"],
      "absentKeys": ["4_5", "5_0"],
      "configCombo": [{ "r": 0, "c": 5 }, { "r": 4, "c": 0 }],
      "comboCoords": [[4, 0], [0, 5]],
      "comboLabel": "R0C5 + R4C0"
    }
  } /* END_MATRIX_CONSTANTS_JSON */;
});
