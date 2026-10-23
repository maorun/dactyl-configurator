// =============================================================================
// Zustand pro Tastaturhälfte
// =============================================================================
// Jede Hälfte hat eigene Config, eigene vorgemerkte Änderungen, eigene Tipp-Statistik und einen eigenen
// Matrix-Test. Die angezeigte Ebene gilt für beide Hälften. app.js hält Config und vorgemerkte Änderungen
// der aktiven Hälfte in seinen Variablen und tauscht sie beim Wechsel der Hälfte hier aus und ein. Kein DOM.
(function (root) {
  "use strict";

  const SIDE_STATE_FIELDS = ["config", "pendingChanges", "typingStats", "matrixTest"];

  function createSideStore(sides, init) {
    const states = {};
    for (const side of sides) {
      states[side] = Object.assign(
        { side, config: null, pendingChanges: [], typingStats: null, matrixTest: null },
        init ? init(side) : {}
      );
    }
    const has = side => Object.prototype.hasOwnProperty.call(states, side);
    const get = side => {
      if (!has(side)) throw new Error(`Unbekannte Tastaturhälfte: ${side}`);
      return states[side];
    };
    // Übernimmt nur die bekannten Zustandsfelder
    const save = (side, values) => {
      const state = get(side);
      for (const field of SIDE_STATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(values, field)) state[field] = values[field];
      }
    };
    return { sides: [...sides], has, get, save };
  }

  root.Dactyl = Object.assign(root.Dactyl || {}, { createSideStore, SIDE_STATE_FIELDS });
})(typeof window !== "undefined" ? window : globalThis);
