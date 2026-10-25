// =============================================================================
// Gemeinsamer Kern der Seitenprofile (Registrierung und reine Funktionen ohne DOM)
// =============================================================================
// Die Profile selbst stehen in js/side-right.js und js/side-left.js. Alles, was sich zwischen den Hälften
// unterscheidet (fehlende Tasten, Daumen-Cluster, Config-Combo, BLE-Name, Leitungen, Standard-Config,
// Presets, Scancode-Tabelle), steht dort und nicht in app.js oder den übrigen Modulen.
(function (root) {
  "use strict";

  const NUM_ROWS = 6;
  const NUM_COLS = 7;
  const FINGER_ROWS = 5;
  const FINGER_COLS = 6;

  // Die Profile registrieren sich selbst (js/side-right.js, js/side-left.js; Reihenfolge in index.html)
  const SIDE_PROFILES = {};
  const SIDE_IDS = [];
  // Hälfte mit dem Mac-HID-Dienst: Standard für Firmware ohne "side" und für unbekannte Config-Namen
  let masterSide = null;

  function registerSideProfile(profile) {
    if (!profile || typeof profile.id !== "string" || SIDE_PROFILES[profile.id]) {
      throw new Error(`Ungültiges oder doppeltes Seitenprofil: ${profile && profile.id}`);
    }
    if (profile.master && masterSide) throw new Error("Nur eine Hälfte kann Master sein");
    SIDE_PROFILES[profile.id] = profile;
    SIDE_IDS.push(profile.id);
    if (profile.master) masterSide = profile.id;
    return profile;
  }

  function getMasterSide() {
    return masterSide;
  }

  // Hälften in der Reihenfolge der Split-Ansicht (displayOrder: links = 0)
  function sidesInDisplayOrder() {
    return [...SIDE_IDS].sort((a, b) => SIDE_PROFILES[a].displayOrder - SIDE_PROFILES[b].displayOrder);
  }

  // Hälfte zum Knopf data-hand ("right", "left"); null = kein Profil (z. B. "both")
  function sideFromHandView(view) {
    return SIDE_IDS.find(id => SIDE_PROFILES[id].handView === view) || null;
  }

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

  // Config-Mode-Werbename -> Hälfte. Ein unbekannter Dactyl-Name gehört zum Master.
  function sideFromBleName(name) {
    return SIDE_IDS.find(id => SIDE_PROFILES[id].bleName === name) || masterSide;
  }

  // DEVICE_INFO.side -> Hälfte. Firmware vor dem Feld "side" ist immer der Master; ein unbekannter Wert ergibt null.
  function sideFromDeviceInfo(info) {
    if (!info || typeof info !== "object") return null;
    if (info.side === undefined) return masterSide;
    return Object.prototype.hasOwnProperty.call(SIDE_PROFILES, info.side) ? info.side : null;
  }

  // Aktionen einer Zelle exakt wie cell_actions + validate_config in server.py: Objekt mit tap/hold/dtap
  // oder ein Code-String. Kein Tap ("", "NONE", kein String): nur hold wirkt (als normale Taste), ein
  // Doppel-Tipp bleibt ohne Wirkung. Ein Tap "0" gilt dort als Tap; dann zählen hold und dtap mit.
  function cellHasAction(cell) {
    const isAction = v => typeof v === "string" && v !== "" && v !== "NONE" && v !== "0";
    const str = v => (typeof v === "string" ? v : "NONE");
    if (typeof cell === "string") return isAction(cell);
    if (!cell || typeof cell !== "object") return false;
    const tap = str(cell.tap ?? "NONE");
    if (tap === "" || tap === "NONE") return isAction(str(cell.hold ?? "NONE"));
    return [tap, str(cell.hold ?? "NONE"), str(cell.dtap ?? "NONE")].some(isAction);
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
    NUM_ROWS, NUM_COLS, SIDE_PROFILES, SIDE_IDS, registerSideProfile, getMasterSide, sidesInDisplayOrder,
    sideFromHandView, isPhysicalKey, isWiredSwitch, isConfigComboKey, sideFromBleName, sideFromDeviceInfo,
    absentKeyViolations
  });
})(typeof window !== "undefined" ? window : globalThis);
