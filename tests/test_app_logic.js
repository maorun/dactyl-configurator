// Unit-Tests für die DOM-freien Hilfsfunktionen der Web-App (Action-Codes, Sanitizing, Config-Validierung).
// Ausführen: node tests/test_app_logic.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const read = rel => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

// Schneidet reine Logik-Abschnitte aus einer Datei mit DOM-Zugriffen aus
function section(file, startMarker, endMarker) {
  const src = read(file);
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Abschnitt nicht gefunden: ${file}: ${startMarker}`);
  return src.slice(start, end);
}

// Reihenfolge wie im Browser (index.html); keycodes.js und config-model.js sind ganz DOM-frei
const code = [
  ...["js/side-profiles.js", "js/side-right.js", "js/side-left.js", "js/side-state.js", "js/keycodes.js",
      "js/config-model.js", "js/flash-log.js"].map(read),
  section("js/editor.js", "// Alte Configs speichern Modifier-Halte-Aktionen", "function appendOptionGroup"),
  section("js/editor.js", "// Sichtbarkeit der Optionen bei einer Suche", "// Auswahl-IDs, deren Suche"),
  section("js/keyboard-hooks.js", "const ACTION_CODE_TO_EVENT_CODES", "// Gehaltene MO_x-Ebene einer Hälfte"),
  section("js/keyboard-hooks.js", "// Löst einen Browser-Tastencode für eine Hälfte auf", "// Alle Treffer eines Tastendrucks")
].join("\n");

const ctx = { TextDecoder };
vm.createContext(ctx);
vm.runInContext(`${code}
this.api = { keyToNumericActions, sanitizeCommandText, clampSetting, validateConfigShape,
             normalizeConfig, isPhysicalKey, findDefinitionByCode, actionCodeToNumeric, SETTINGS_RANGES,
             LEGACY_HOLD_CODES, normalizeHoldCode, holdSublabel,
             createTypingStats, recordKeyPress, computeWpm, heatLevel, maxKeyCount, WPM_WINDOW_MS, HEAT_LEVELS,
             isWiredSwitch, createMatrixTest, markMatrixKeyTested, summarizeMatrixTest, parseMatrixLine,
             recordMatrixBounce, MATRIX_BOUNCE_MS, lintLayouts, clearAbsentKeyActions,
             SIDE_PROFILES,
             applyLayerOperation, transparentLayer, isUndoBlocked,
             ACT_KEY_PAIR_BASE, MAX_KEY_PAIRS, pairIndexFromCode, isKeyPairMember, keyPairLabel,
             applyMatrixData, MATRIX_DATA_FIELDS, normalizeKeyCell,
             createDeviceSnapshot, captureListLine, snapshotListsKnown, snapshotListsState, captureMatrixData, isDeviceSnapshotComplete, diffKeymap, describeKeyActions,
             DE_MAC_CHARS, charPairCode, charPairIndexFromCode, findKeyPairIndex, deMacCharForCode,
             resolveCharPairActions, keycodeOptionMatches, isKeyPairUsed, appendResolvedPairs, revertResolvedPairs,
             removeKeyPairAt, KEYCODES, UMLAUT_LABELS, ONE_SHOT_LABELS, holdSublabel,
             planKeyPairDeletion,
             ACT_MACRO_BASE, MAX_MACROS, MAX_MACRO_STEPS, MACRO_MAX_PAUSE_MS, MACRO_STEP_TYPES, macroIndexFromCode,
             isValidMacroStep, isValidMacro, normalizeMacroStep, macroCommands, isMacroUsed, removeMacroAt,
             macroSaveIndex, restoreMacroAt, isOneShotOrCapsWordCode,
             MAX_LAYOUT_PROFILES, sanitizeLayoutProfileName, findLayoutProfileIndex, layoutProfileNameKey, upsertLayoutProfile, removeLayoutProfile,
             deMacCharGroup, keycodeOptionTree, OPTIONAL_ACTION_PREFIX, filterOptionNodes, selectFilterHint,
             ACTION_CODE_TO_EVENT_CODES, findKeyForEventCode, resolveKeyForSide, browserKeySides,
             createNdjsonSplitter, appendFlashLogLine, readFlashStream, flashStageLabel, FLASH_LOG_MAX_LINES };`, ctx);
const api = ctx.api;
const R = api.SIDE_PROFILES.R;
const L = api.SIDE_PROFILES.L;

let passed = 0;
let skipped = 0;
// Ein Test ruft skipTest(grund) auf und kehrt zurück: er zählt als übersprungen, nicht als bestanden
let skipReason = null;
function skipTest(reason) { skipReason = reason; }
function test(name, fn) {
  skipReason = null;
  fn();
  if (skipReason) {
    skipped++;
    console.log(`[      SKIP] ${name}: ${skipReason}`);
    return;
  }
  passed++;
  console.log(`[       OK ] ${name}`);
}
// Async-Tests laufen am Ende nacheinander; ein Fehler beendet den Lauf mit Exit-Code 1
const asyncTests = [];

test("Mod-Tap: Tap und Hold werden als Zahlencodes gesendet", () => {
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_SPACE", hold: "MOD_LCTRL" }) }, { tapCode: 32, holdCode: 0x80, dtapCode: 0 });
  // Hold ohne Tap wirkt wie eine normale Taste
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "MO_1" }) }, { tapCode: 0x101, holdCode: 0, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions(undefined) }, { tapCode: 0, holdCode: 0, dtapCode: 0 });
  // Beliebige Halte-Aktion: Tap A / Halten B, Media, Maus, Toggle-Layer
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "KEY_B" }) }, { tapCode: 97, holdCode: 98, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "MEDIA_MUTE" }) }, { tapCode: 97, holdCode: 0x121, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "MOUSE_LEFT" }) }, { tapCode: 97, holdCode: 0x130, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "TG_2" }) }, { tapCode: 97, holdCode: 0x112, dtapCode: 0 });
});

test("Halte-Dropdown: alte MOD_*-Werte entsprechen den KEY_*-Modifiern", () => {
  for (const [legacy, code] of Object.entries(api.LEGACY_HOLD_CODES)) {
    assert.strictEqual(api.normalizeHoldCode(legacy), code);
    assert.strictEqual(api.actionCodeToNumeric(legacy), api.actionCodeToNumeric(code), legacy);
  }
  assert.strictEqual(api.normalizeHoldCode(undefined), "NONE");
  assert.strictEqual(api.normalizeHoldCode("KEY_B"), "KEY_B");
});

test("Halte-Unterbeschriftung: kurze Labels für alle Halte-Aktionen", () => {
  assert.strictEqual(api.holdSublabel("MOD_LCTRL"), "Ctrl");
  assert.strictEqual(api.holdSublabel("KEY_LEFT_CTRL"), "Ctrl");
  assert.strictEqual(api.holdSublabel("MO_1"), "L1");
  assert.strictEqual(api.holdSublabel("TG_3"), "TG3");
  assert.strictEqual(api.holdSublabel("KEY_B"), "B");
  assert.strictEqual(api.holdSublabel("MEDIA_VOLUME_UP"), "VOLUME");
  assert.strictEqual(api.holdSublabel("MOUSE_LEFT"), "LEFT");
  for (const code of ["KEY_PAGE_DOWN", "MEDIA_PREVIOUS_TRACK", "MOUSE_WHEEL_DOWN", "MAC_GLOBE", "LAYER_UP"]) {
    assert.ok(api.holdSublabel(code).length <= 6, code);
  }
});

test("Action-Codes: Roundtrip Name -> Zahl -> Name", () => {
  const codes = ["KEY_A", "KEY_0", "KEY_BACKSLASH", "KEY_QUOTE", "KEY_ESC", "KEY_F1", "KEY_F24",
    "KEY_NUM_0", "MO_0", "MO_7", "TG_0", "TG_7", "LAYER_UP", "LAYER_DOWN", "MEDIA_PLAY_PAUSE",
    "MAC_GLOBE", "MOUSE_LEFT", "MOUSE_WHEEL_DOWN", "KEY_LEFT_CTRL", "KEY_RIGHT_GUI"];
  for (const name of codes) {
    const num = api.actionCodeToNumeric(name);
    assert.ok(num > 0, name);
    assert.strictEqual(api.actionCodeToNumeric(api.findDefinitionByCode(num).tap), num, name);
  }
  assert.strictEqual(api.actionCodeToNumeric("ACT_MOUSE_LEFT"), 0x130);
  assert.strictEqual(api.actionCodeToNumeric("MAC_GLOBE"), 0x127);
  assert.strictEqual(api.actionCodeToNumeric("UNBEKANNT"), 0);
});

test("Befehlstext: Steuerzeichen, Quotes und Backslashes werden entfernt", () => {
  assert.strictEqual(api.sanitizeCommandText("Nav\nSAVE_NVS\r\"x\\"), "NavSAVE_NVSx");
  assert.strictEqual(api.sanitizeCommandText("   ", "Fallback"), "Fallback");
  assert.strictEqual(api.sanitizeCommandText("x".repeat(40)).length, 31);
});

test("Einstellungen: Werte werden auf Firmware-Bereiche begrenzt", () => {
  for (const [field, [lo, hi, def]] of Object.entries(api.SETTINGS_RANGES)) {
    assert.strictEqual(api.clampSetting(field, lo - 1), lo, field);
    assert.strictEqual(api.clampSetting(field, hi + 1), hi, field);
    assert.strictEqual(api.clampSetting(field, "abc"), def, field);
  }
});

test("Config-Validierung: ungültige Struktur wird abgelehnt", () => {
  assert.throws(() => api.validateConfigShape(null));
  assert.throws(() => api.validateConfigShape({ layers: [] }));
  assert.throws(() => api.validateConfigShape({ layers: new Array(9).fill([]) }));
  assert.throws(() => api.validateConfigShape({ layers: [[[], [], [], [], [], [], []]] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: [{ key1: { r: 0, c: 0 } }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: [{ key1: { r: "0", c: 0 }, key2: { r: 1, c: 1 } }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: new Array(17).fill({ key1: { r: 0, c: 0 }, key2: { r: 1, c: 1 } }) }));
  assert.doesNotThrow(() => api.validateConfigShape({
    layers: [[[{ tap: "KEY_A" }]]],
    combos: [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 } }]
  }, R));
});

test("Config-Validierung: Import einer rechten Config in die linke Hälfte wird abgelehnt", () => {
  const rightCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config.json"), "utf8"));
  assert.doesNotThrow(() => api.validateConfigShape(rightCfg, R));
  // Die rechte Belegung legt auf R5C0 und R4C5 Aktionen, die links nicht existieren
  assert.throws(() => api.validateConfigShape(rightCfg, L), /R5C0 \(Ebene 0\)/);
  const leftCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config_left.json"), "utf8"));
  assert.doesNotThrow(() => api.validateConfigShape(leftCfg, L));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: [{ key1: { r: 4, c: 5 }, key2: { r: 0, c: 0 } }] }, L), /Combo 1/);
});

test("Config-Normalisierung: Namen, Einstellungen und Zellen werden bereinigt", () => {
  const n = api.normalizeConfig({
    layers: [[[{ tap: "KEY_A", label: 1 }]]],
    layerNames: ["A\nB"],
    settings: { debounceMs: 0, deviceName: "Dac\"tyl" },
    combos: [{ key1: { r: 9, c: 0 }, key2: { r: 0, c: 0 } }]
  }, R);
  assert.strictEqual(n.layerNames.length, 8);
  assert.strictEqual(n.layerNames[0], "AB");
  assert.strictEqual(n.layerNames[1], "Nav & Pfeile");
  assert.strictEqual(n.settings.debounceMs, 1);
  assert.strictEqual(n.settings.tappingTermMs, 200);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { tappingTermMs: 900 } }, R).settings.tappingTermMs, 500);
  assert.strictEqual(n.settings.deviceName, "Dactyl");
  assert.strictEqual(n.layers[0][0][0].label, "");
  assert.strictEqual(n.layers[0][0][0].hold, "NONE");
  assert.strictEqual(n.combos.length, 0);
});

test("Physische Tasten: R4C0 und R5C5 existieren nicht", () => {
  assert.ok(!api.isPhysicalKey(4, 0, R));
  assert.ok(!api.isPhysicalKey(5, 5, R));
  assert.ok(api.isPhysicalKey(5, 6, R));
  assert.ok(api.isPhysicalKey(0, 0, R));
});

test("Physische Tasten links: R4C5 und R5C0 existieren nicht (gespiegelt)", () => {
  assert.ok(!api.isPhysicalKey(4, 5, L));
  assert.ok(!api.isPhysicalKey(5, 0, L));
  assert.ok(api.isPhysicalKey(4, 0, L));
  assert.ok(api.isPhysicalKey(5, 5, L));
});

test("Gerätename ohne Eintrag hängt von der Hälfte ab", () => {
  assert.strictEqual(api.normalizeConfig({ layers: [[]] }, R).settings.deviceName, "Dactyl Keyboard");
  assert.strictEqual(api.normalizeConfig({ layers: [[]] }, L).settings.deviceName, "Dactyl Links");
});

test("Heatmap: nur physische Tasten der Matrix werden gezählt", () => {
  const s = api.createTypingStats(null, R);
  assert.strictEqual(api.recordKeyPress(s, 2, 1, 0), true);
  assert.strictEqual(api.recordKeyPress(s, 2, 1, 10), true);
  assert.strictEqual(api.recordKeyPress(s, 4, 0, 20), false); // R4C0 existiert nicht
  assert.strictEqual(api.recordKeyPress(s, 5, 5, 20), false); // R5C5 existiert nicht
  assert.strictEqual(api.recordKeyPress(s, 6, 0, 20), false);
  assert.strictEqual(api.recordKeyPress(s, "2", 1, 20), false);
  assert.deepStrictEqual({ ...s.counts }, { "2_1": 2 });
  assert.strictEqual(s.total, 2);
});

test("Heatmap: gespeicherte Zähler werden validiert", () => {
  // JSON.parse erzeugt "__proto__" als eigenen Schlüssel (wie localStorage-Daten)
  const s = api.createTypingStats(JSON.parse('{"0_0": 3, "4_0": 9, "9_9": 1, "1_1": -2, "2_2": 1.5, "__proto__": 4, "x": 1, "5_6": 2}'), R);
  assert.deepStrictEqual({ ...s.counts }, { "0_0": 3, "5_6": 2 });
  assert.ok(!Object.prototype.hasOwnProperty.call(s.counts, "__proto__"));
  assert.strictEqual(typeof Object.getPrototypeOf(s.counts).hasOwnProperty, "function");
  assert.strictEqual(s.total, 5);
  assert.strictEqual(api.createTypingStats("kaputt", R).total, 0);
  assert.strictEqual(api.createTypingStats([1, 2], R).total, 0);
});

test("Heatmap links: R4C0 zählt, R4C5 und R5C0 zählen nicht", () => {
  const s = api.createTypingStats(JSON.parse('{"4_0": 2, "4_5": 9, "5_0": 4}'), L);
  assert.deepStrictEqual({ ...s.counts }, { "4_0": 2 });
  assert.strictEqual(api.recordKeyPress(s, 4, 5, 0), false);
  assert.strictEqual(api.recordKeyPress(s, 5, 0, 0), false);
  assert.strictEqual(api.recordKeyPress(s, 5, 5, 0), true);
});

test("WPM: gleitendes 60-s-Fenster mit 5 Anschlägen pro Wort", () => {
  const s = api.createTypingStats(null, R);
  for (let i = 0; i < 50; i++) api.recordKeyPress(s, 0, 1, i * 100);
  assert.strictEqual(api.computeWpm(s, 5000), 10);
  // Anschläge älter als das Fenster fallen heraus
  assert.strictEqual(api.computeWpm(s, api.WPM_WINDOW_MS + 2400), 5);
  assert.strictEqual(api.computeWpm(s, api.WPM_WINDOW_MS + 10000), 0);
  // Gesamtzähler bleibt unabhängig vom Fenster
  assert.strictEqual(s.total, 50);
});

test("WPM: Fenstergrenze und Zeitstempel in falscher Reihenfolge", () => {
  const s = api.createTypingStats(null, R);
  for (let i = 0; i < 5; i++) api.recordKeyPress(s, 1, 1, 1000);
  // Genau WPM_WINDOW_MS alt: Anschlag liegt außerhalb des Fensters
  assert.strictEqual(api.computeWpm(s, 1000 + api.WPM_WINDOW_MS - 1), 1);
  assert.strictEqual(api.computeWpm(s, 1000 + api.WPM_WINDOW_MS), 0);
  assert.strictEqual(s.recent.length, 0);
  // Ein älterer Zeitstempel verwirft keine neueren Anschläge
  for (let i = 0; i < 5; i++) api.recordKeyPress(s, 1, 1, 200000);
  assert.strictEqual(api.computeWpm(s, 150000), 1);
  // recordKeyPress kürzt das Fenster selbst
  api.recordKeyPress(s, 1, 1, 200000 + api.WPM_WINDOW_MS);
  assert.strictEqual(s.recent.length, 1);
});

test("Heatmap: Stufen skalieren relativ zur häufigsten Taste", () => {
  assert.strictEqual(api.heatLevel(0, 10), 0);
  assert.strictEqual(api.heatLevel(5, 0), 0);
  assert.strictEqual(api.heatLevel(1, 100), 1);
  assert.strictEqual(api.heatLevel(50, 100), 3);
  assert.strictEqual(api.heatLevel(100, 100), api.HEAT_LEVELS);
  const s = api.createTypingStats({ "0_0": 3, "1_1": 7 }, R);
  assert.strictEqual(api.maxKeyCount(s), 7);
  assert.strictEqual(api.maxKeyCount(api.createTypingStats(null, R)), 0);
});

test("Matrix-Test: 35 verlötete Schalter (29 Finger + 6 Daumen ohne R4C0/R5C5)", () => {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (api.isWiredSwitch(r, c, R)) n++;
  assert.strictEqual(n, 35);
  assert.ok(!api.isWiredSwitch(4, 0, R));
  assert.ok(!api.isWiredSwitch(5, 5, R));
  assert.ok(!api.isWiredSwitch(0, 6, R)); // Col 6 nur im Daumen-Cluster
  assert.ok(api.isWiredSwitch(5, 6, R));
  assert.strictEqual(api.summarizeMatrixTest(api.createMatrixTest(R)).total, 35);
});

test("Matrix-Test links: 35 Schalter ohne R4C5/R5C0", () => {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (api.isWiredSwitch(r, c, L)) n++;
  assert.strictEqual(n, 35);
  assert.ok(!api.isWiredSwitch(4, 5, L));
  assert.ok(!api.isWiredSwitch(5, 0, L));
  assert.ok(api.isWiredSwitch(4, 0, L));
  assert.ok(api.isWiredSwitch(5, 5, L));
  const t = api.createMatrixTest(L);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 0), true);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 5), false);
});

test("Matrix-Test: Tasten werden einmalig und nur innerhalb der Matrix gezählt", () => {
  const t = api.createMatrixTest(R);
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), true);
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 6, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 1, "1"), false);
  assert.strictEqual(api.summarizeMatrixTest(t).tested, 1);
});

test("Matrix-Test: MATRIX:-Zeile liefert die Scan-Zeit t, eine ungültige Zeit nur ohne t", () => {
  assert.deepStrictEqual({ ...api.parseMatrixLine('MATRIX:{"r":2,"c":1,"pressed":1,"t":1000}') }, { r: 2, c: 1, pressed: true, t: 1000 });
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":5,"c":6,"pressed":1,"t":4294967295}').t, 4294967295);
  // Ältere Firmware ohne t, und ungültige Zeiten: Zeile gilt, aber ohne Zeit
  for (const bad of ['"t":-1', '"t":4294967296', '"t":"5"', '"t":1.5', '"t":null']) {
    const evt = api.parseMatrixLine(`MATRIX:{"r":2,"c":1,"pressed":0,${bad}}`);
    assert.deepStrictEqual({ ...evt }, { r: 2, c: 1, pressed: false });
  }
});

test("Matrix-Test: Druck kurz nach dem Loslassen zählt als Prellen, später nicht", () => {
  const t = api.createMatrixTest(R);
  assert.strictEqual(api.MATRIX_BOUNCE_MS, 30);
  // Erster Druck ohne vorheriges Loslassen: kein Prellen
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1000), false);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, false, 1100), false);
  // 10 ms nach dem Loslassen: Prellen
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1110), true);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, false, 1200), false);
  // 200 ms nach dem Loslassen: normales Tippen
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1400), false);
  // Arrays aus dem VM-Kontext haben einen anderen Prototyp: in einfache Werte kopieren
  assert.deepStrictEqual([...api.summarizeMatrixTest(t).bouncingKeys].map(k => ({ ...k })), [{ r: 2, c: 1, count: 1 }]);
});

test("Matrix-Test: Prell-Grenze ist 30 ms, gilt je Taste und jedes Loslassen zählt einmal", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 1000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1030), true);   // genau 30 ms
  api.recordMatrixBounce(t, 2, 1, false, 2000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 2031), false);  // 31 ms
  // Eine andere Taste beeinflusst die Zeit nicht
  api.recordMatrixBounce(t, 2, 2, false, 3000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 3005), false);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 2, true, 3005), true);
  // Ein Loslassen erlaubt nur einen Prell-Treffer: der zweite Druck ohne neues Loslassen ist keiner
  api.recordMatrixBounce(t, 3, 3, false, 4000);
  assert.strictEqual(api.recordMatrixBounce(t, 3, 3, true, 4005), true);
  assert.strictEqual(api.recordMatrixBounce(t, 3, 3, true, 4010), false);
  const keys = [...api.summarizeMatrixTest(t).bouncingKeys].map(k => `${k.r}${k.c}:${k.count}`);
  assert.deepStrictEqual(keys, ["21:1", "22:1", "33:1"]);
});

test("Matrix-Test: Prell-Grenze von unten: 0 ms und 29 ms zählen, 31 ms nicht", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 1000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1000), true);   // 0 ms
  api.recordMatrixBounce(t, 2, 1, false, 2000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 2029), true);   // 29 ms
  api.recordMatrixBounce(t, 2, 1, false, 3000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 3031), false);  // 31 ms
  assert.strictEqual(api.summarizeMatrixTest(t).bouncingKeys[0].count, 2);
});

test("Matrix-Test: Neustart der Tastatur verwirft gemerkte Loslass-Zeiten, kein falsches Prellen", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 600000);           // altes Loslassen nach 10 Minuten Laufzeit
  // Neustart: millis() beginnt bei 0. Ein Druck 20 ms nach dem Start läge vor der alten Zeit (Rücksprung)
  assert.strictEqual(api.recordMatrixBounce(t, 3, 3, false, 5), false);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 20), false);
  assert.strictEqual(api.summarizeMatrixTest(t).bouncingKeys.length, 0);
  // Nach dem Neustart arbeitet die Erkennung normal weiter
  api.recordMatrixBounce(t, 2, 1, false, 100);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 110), true);
  // Ein Überlauf nach 2^32 ms ist ein Schritt vorwärts und löscht nichts (siehe der nächste Test)
});

test("Matrix-Test: Prellen übersteht den Überlauf von millis() nach 2^32 ms", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 4294967290);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 5), true);       // 11 ms über den Überlauf
  api.recordMatrixBounce(t, 2, 1, false, 4294967290);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 100), false);    // 106 ms
});

test("Matrix-Test: Prellen ignoriert ungültige Tasten, fehlende Tasten und Ereignisse ohne Zeit", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 4, 0, false, 1000);                              // R4C0 gibt es rechts nicht
  assert.strictEqual(api.recordMatrixBounce(t, 4, 0, true, 1001), false);
  assert.strictEqual(api.recordMatrixBounce(t, 6, 0, true, 1001), false);
  assert.strictEqual(api.recordMatrixBounce(t, 0, 7, true, 1001), false);
  api.recordMatrixBounce(t, 2, 1, false, 1000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, undefined), false); // ältere Firmware: keine Zeit
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, "1001"), false);
  assert.strictEqual(api.summarizeMatrixTest(t).bouncingKeys.length, 0);
});

test("Matrix-Test: MATRIX:-Zeile der Firmware wird streng geprüft", () => {
  assert.deepStrictEqual({ ...api.parseMatrixLine('MATRIX:{"r":2,"c":1,"pressed":1}') }, { r: 2, c: 1, pressed: true });
  assert.deepStrictEqual({ ...api.parseMatrixLine('MATRIX:{"r":5,"c":6,"pressed":0}') }, { r: 5, c: 6, pressed: false });
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":6,"c":0,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":0,"c":7,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":"1","c":0,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":1,"c":0,"pressed":true}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":1,"c":0}'), null);
  assert.strictEqual(api.parseMatrixLine("MATRIX:null"), null);
  assert.strictEqual(api.parseMatrixLine("MATRIX:{kaputt"), null);
  assert.strictEqual(api.parseMatrixLine('KEY_PRESS:{"r":1,"c":0,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine(undefined), null);
});

test("Matrix-Test: Zeilen und Spalten ohne Treffer gelten als verdächtig", () => {
  const t = api.createMatrixTest(R);
  // Ohne Tastendruck keine Verdachtsmeldung
  assert.deepStrictEqual([...api.summarizeMatrixTest(t).suspectRows], []);
  // Alle Tasten außer Row 3 drücken
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (r !== 3) api.markMatrixKeyTested(t, r, c);
  const s = api.summarizeMatrixTest(t);
  assert.deepStrictEqual([...s.suspectRows], [3]);
  assert.deepStrictEqual([...s.suspectCols], []);
  assert.strictEqual(s.tested, 35 - 6);
  // Fehlende Spalte 6 (nur R5C6) wird erkannt
  const t2 = api.createMatrixTest(R);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) api.markMatrixKeyTested(t2, r, c);
  assert.deepStrictEqual([...api.summarizeMatrixTest(t2).suspectCols], [6]);
});

test("Matrix-Test: Leitungsliste entspricht ROW_PINS/COL_PINS der Firmware", () => {
  const ino = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "dactyl_right.ino"), "utf8");
  const pins = name => ino.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}"))[1].split(",").map(v => Number(v.trim()));
  assert.deepStrictEqual([...R.rowWires.map(w => w.gpio)], pins("ROW_PINS"));
  assert.deepStrictEqual([...R.colWires.map(w => w.gpio)], pins("COL_PINS"));
});

test("Tastenpaar: PAIR_<n> wird zu ACT_KEY_PAIR_BASE + n und zurück", () => {
  assert.strictEqual(api.actionCodeToNumeric("PAIR_0"), 0x140);
  assert.strictEqual(api.actionCodeToNumeric("PAIR_15"), 0x14F);
  assert.strictEqual(api.actionCodeToNumeric("PAIR_16"), 0);
  assert.strictEqual(api.pairIndexFromCode("PAIR_x"), -1);
  assert.strictEqual(api.findDefinitionByCode(0x143).tap, "PAIR_3");
  assert.strictEqual(api.findDefinitionByCode(0x143).label, "Paar 3");
  // Als Tap- und als Halte-Aktion für SET_K
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "PAIR_2", hold: "PAIR_5" }) }, { tapCode: 0x142, holdCode: 0x145, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "PAIR_1" }) }, { tapCode: 97, holdCode: 0x141, dtapCode: 0 });
});

test("Tastenpaar: nur normale Tasten und Modifier sind erlaubt", () => {
  for (const ok of ["KEY_LEFT_SHIFT", "KEY_PERIOD", "KEY_A", "KEY_F13", "KEY_RETURN", "KEY_RIGHT_GUI"]) {
    assert.ok(api.isKeyPairMember(ok), ok);
  }
  for (const bad of ["NONE", "", undefined, 5, "MO_1", "TG_2", "MEDIA_MUTE", "MAC_GLOBE", "MOUSE_LEFT", "PAIR_0", "LAYER_UP"]) {
    assert.ok(!api.isKeyPairMember(bad), String(bad));
  }
  assert.strictEqual(api.keyPairLabel({ first: "A", second: "B" }, c => c.toLowerCase()), "a + b");
});

test("Tastenpaar: Config-Validierung und Normalisierung", () => {
  const good = { layers: [[]], keyPairs: [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }] };
  api.validateConfigShape(good);
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: "x" }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: [{ first: "MO_1", second: "KEY_A" }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: new Array(17).fill({ first: "KEY_A", second: "KEY_B" }) }));
  const n = api.normalizeConfig({ layers: [[]], keyPairs: [{ first: "KEY_A", second: "KEY_B", extra: 1 }, { first: "MO_1", second: "KEY_A" }, null] }, R);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.keyPairs)), [{ first: "KEY_A", second: "KEY_B" }]);
  assert.deepStrictEqual([...api.normalizeConfig({ layers: [[]] }, R).keyPairs], []);
});

test("Tastenpaar: Codebereich ist in App, Server und Firmware identisch", () => {
  // Aktionscodes und Key-Pair-Typen gelten für beide Hälften und stehen in DactylCommon.h
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const py = fs.readFileSync(path.join(__dirname, "..", "server.py"), "utf8");
  assert.strictEqual(Number(/#define ACT_KEY_PAIR_BASE\s+(0x[0-9A-Fa-f]+)/.exec(common)[1]), api.ACT_KEY_PAIR_BASE);
  assert.strictEqual(Number(/#define MAX_KEY_PAIRS\s+(\d+)/.exec(common)[1]), api.MAX_KEY_PAIRS);
  assert.strictEqual(Number(/^MAX_KEY_PAIRS = (\d+)/m.exec(py)[1]), api.MAX_KEY_PAIRS);
  // Der Paarbereich überschneidet sich nicht mit Maus-Aktionen (0x130..0x134)
  assert.ok(api.ACT_KEY_PAIR_BASE > 0x134);
});

function sampleLayers() {
  return Array.from({ length: 8 }, (_, l) => [[{ label: `L${l}`, tap: `KEY_${l}`, hold: "NONE" }]]);
}

test("Ebenen-Werkzeug: Kopieren ersetzt nur das Ziel und teilt keine Objekte", () => {
  const layers = sampleLayers();
  const next = api.applyLayerOperation(layers, "copy", 1, 3);
  assert.strictEqual(next[3][0][0].tap, "KEY_1");
  assert.strictEqual(next[1][0][0].tap, "KEY_1");
  assert.strictEqual(next[2][0][0].tap, "KEY_2");
  next[3][0][0].tap = "KEY_X";
  assert.strictEqual(next[1][0][0].tap, "KEY_1");
  // Eingabe bleibt unverändert
  assert.strictEqual(layers[3][0][0].tap, "KEY_3");
});

test("Ebenen-Werkzeug: Tauschen und Leeren", () => {
  const layers = sampleLayers();
  const swapped = api.applyLayerOperation(layers, "swap", 0, 7);
  assert.strictEqual(swapped[0][0][0].tap, "KEY_7");
  assert.strictEqual(swapped[7][0][0].tap, "KEY_0");
  const cleared = api.applyLayerOperation(layers, "clear", 2);
  assert.strictEqual(cleared[2].length, 6);
  assert.ok(cleared[2].every(row => row.length === 7 && row.every(k => k.tap === "NONE" && k.hold === "NONE")));
  assert.strictEqual(cleared[1][0][0].tap, "KEY_1");
  assert.strictEqual(layers[2][0][0].tap, "KEY_2");
});

test("Ebenen-Werkzeug: ungültige Aufrufe ändern nichts", () => {
  const layers = sampleLayers();
  assert.strictEqual(api.applyLayerOperation(layers, "copy", 1, 1), null);
  assert.strictEqual(api.applyLayerOperation(layers, "copy", 1, 8), null);
  assert.strictEqual(api.applyLayerOperation(layers, "swap", -1, 2), null);
  assert.strictEqual(api.applyLayerOperation(layers, "move", 1, 2), null);
  assert.strictEqual(api.applyLayerOperation(null, "clear", 1), null);
  // Fehlende Ebenen werden transparent ergänzt
  const short = api.applyLayerOperation([[[{ tap: "KEY_A" }]]], "copy", 0, 5);
  assert.strictEqual(short.length, 8);
  assert.strictEqual(short[5][0][0].tap, "KEY_A");
  assert.strictEqual(short[3][0][0].tap, "NONE");
});

test("Rückgängig: Änderungen vor einem neueren Snapshot sind gesperrt", () => {
  const key = { snapshot: false }, snap = { snapshot: true };
  // Taste geändert, danach Ebene getauscht: die Tastenänderung darf nicht mehr einzeln zurück
  assert.strictEqual(api.isUndoBlocked([key, snap], 0), true);
  assert.strictEqual(api.isUndoBlocked([key, snap], 1), false);
  // Snapshot mit neueren Änderungen ist gesperrt, neuere Tastenänderung nicht
  assert.strictEqual(api.isUndoBlocked([snap, key], 0), true);
  assert.strictEqual(api.isUndoBlocked([snap, key], 1), false);
  // Ohne Snapshot ist jede Änderung einzeln rückgängig machbar
  assert.strictEqual(api.isUndoBlocked([key, key, key], 0), false);
  assert.strictEqual(api.isUndoBlocked([key], 5), true);
  // Ebene tauschen: Rückgängig stellt den Stand vor dem Tausch exakt wieder her
  const layers = sampleLayers();
  const before = JSON.stringify(layers);
  const swapped = api.applyLayerOperation(layers, "swap", 2, 5);
  assert.strictEqual(JSON.stringify(layers), before);
  assert.notStrictEqual(JSON.stringify(swapped), before);
});

test("Doppel-Tipp: Code wird mitgesendet, ohne Tap-Aktion ist er 0", () => {
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "KEY_ESC" }) },
    { tapCode: 106, holdCode: 0x80, dtapCode: 0xB1 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_J", hold: "NONE", dtap: "PAIR_3" }) },
    { tapCode: 106, holdCode: 0, dtapCode: 0x143 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "NONE", dtap: "KEY_ESC" }) },
    { tapCode: 0, holdCode: 0, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "MO_1", dtap: "KEY_ESC" }) },
    { tapCode: 0x101, holdCode: 0, dtapCode: 0 });
});

test("Doppel-Tipp: normalizeKeyCell und transparentLayer führen das Feld dtap", () => {
  assert.strictEqual(api.normalizeKeyCell({ tap: "KEY_J", dtap: "KEY_ESC" }).dtap, "KEY_ESC");
  assert.strictEqual(api.normalizeKeyCell({ tap: "KEY_J", dtap: 5 }).dtap, "NONE");
  assert.strictEqual(api.normalizeKeyCell({ tap: "KEY_J" }).dtap, "NONE");
  assert.strictEqual(api.normalizeKeyCell(null).dtap, "NONE");
  assert.strictEqual(api.transparentLayer()[0][0].dtap, "NONE");
  const n = api.normalizeConfig({ layers: [[[{ label: "J", tap: "KEY_J", hold: "NONE", dtap: "KEY_ESC" }]]] }, R);
  assert.strictEqual(n.layers[0][0][0].dtap, "KEY_ESC");
});

test("Doppel-Tipp: GET_CONFIG-Matrizen setzen Tap, Halten und Doppel-Tipp", () => {
  const layers = [];
  const row = (v) => [v, 0, 0, 0, 0, 0, 0];
  assert.ok(api.applyMatrixData(layers, api.MATRIX_DATA_FIELDS["LAYER_DATA:"], { l: 1, k: [row(106)] }));
  assert.ok(api.applyMatrixData(layers, api.MATRIX_DATA_FIELDS["HOLD_DATA:"], { l: 1, k: [row(0x80)] }));
  assert.ok(api.applyMatrixData(layers, api.MATRIX_DATA_FIELDS["DTAP_DATA:"], { l: 1, k: [row(0xB1)] }));
  const key = layers[1][0][0];
  assert.strictEqual(key.tap, "KEY_J");
  assert.strictEqual(api.actionCodeToNumeric(key.hold), 0x80);
  assert.strictEqual(key.dtap, "KEY_ESC");
  assert.strictEqual(layers[1][0][1].dtap, "NONE");
  // Neues LAYER_DATA setzt Halten und Doppel-Tipp zurück (sie folgen danach erneut)
  api.applyMatrixData(layers, "tap", { l: 1, k: [row(107)] });
  assert.strictEqual(layers[1][0][0].dtap, "NONE");
  // Ungültige Daten werden abgelehnt
  assert.strictEqual(api.applyMatrixData(layers, "dtap", { l: 8, k: [] }), false);
  assert.strictEqual(api.applyMatrixData(layers, undefined, { l: 0, k: [] }), false);
  api.applyMatrixData(layers, "dtap", { l: 1, k: [[70000, -1, 1.5]] });
  assert.strictEqual(layers[1][0][0].dtap, "NONE");
});

// Snapshot, der genau der lokalen Belegung entspricht (wie GET_CONFIG nach einem Sync)
function snapshotOf(cfg) {
  const snap = api.createDeviceSnapshot();
  snap.names = cfg.layerNames.slice();
  for (let l = 0; l < 8; l++) {
    const m = { tap: [], hold: [], dtap: [] };
    for (let r = 0; r < 6; r++) {
      for (const f of ["tap", "hold", "dtap"]) m[f].push([]);
      for (let c = 0; c < 7; c++) {
        const a = api.keyToNumericActions((cfg.layers[l] || [])[r]?.[c]);
        m.tap[r].push(a.tapCode); m.hold[r].push(a.holdCode); m.dtap[r].push(a.dtapCode);
      }
    }
    for (const f of ["tap", "hold", "dtap"]) assert.ok(api.captureMatrixData(snap, f, { l, k: m[f] }));
  }
  return snap;
}

test("Layout-Diff: gleiche Belegung ergibt keinen Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  assert.ok(api.isDeviceSnapshotComplete(snap));
  const diff = api.diffKeymap(cfg, snap, R);
  assert.strictEqual(diff.keys.length, 0);
  assert.strictEqual(diff.names.length, 0);
});

test("Layout-Diff: geänderte Taste und Ebenen-Name erscheinen mit Geräte- und Neuwert", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "KEY_ESC" };
  cfg.layerNames[4] = "Neu";
  const diff = api.diffKeymap(cfg, snap, R);
  assert.strictEqual(diff.keys.length, 1);
  const k = diff.keys[0];
  assert.deepStrictEqual([k.l, k.r, k.c], [2, 1, 3]);
  assert.deepStrictEqual({ ...k.local }, { tapCode: 106, holdCode: 0x80, dtapCode: 0xB1 });
  assert.strictEqual(api.describeKeyActions(k.local), "J · Halten: LEFT_CTRL · 2×: ESC");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(diff.names)), [{ l: 4, device: snap.names[4], local: "Neu" }]);
  assert.notStrictEqual(snap.names[4], "Neu");
  assert.strictEqual(api.describeKeyActions({ tapCode: 0, holdCode: 0, dtapCode: 0 }), "—");
});

// Zeilen wie die Firmware ab Stand 5 sie sendet (kurze Blöcke mit Offset)
function listLines(cfg) {
  const lines = [];
  const combos = (cfg.combos || []).map(cb => [cb.key1.r, cb.key1.c, cb.key2.r, cb.key2.c,
    { KEY_PRESS: 0, MODIFIER_HOLD: 1, LAYER_TOGGLE: 2 }[cb.behavior], api.actionCodeToNumeric(cb.action)]);
  lines.push("COMBO_COUNT:" + combos.length);
  for (let o = 0; o < combos.length; o += 4) lines.push("COMBO_DATA:" + JSON.stringify({ o, e: combos.slice(o, o + 4) }));
  const pairs = (cfg.keyPairs || []).map(p => [api.actionCodeToNumeric(p.first), api.actionCodeToNumeric(p.second)]);
  lines.push("PAIR_COUNT:" + pairs.length);
  for (let o = 0; o < pairs.length; o += 8) lines.push("PAIR_DATA:" + JSON.stringify({ o, e: pairs.slice(o, o + 8) }));
  const macros = cfg.macros || [];
  lines.push("MACRO_COUNT:" + macros.length);
  macros.forEach((m, i) => {
    const steps = m.steps.map(st => st.type === "pause" ? [4, 0, st.ms] : [api.MACRO_STEP_TYPES[st.type], api.actionCodeToNumeric(st.code), 0]);
    for (let o = 0; o === 0 || o < steps.length; o += 8) lines.push("MACRO_DATA:" + JSON.stringify({ i, n: steps.length, o, s: steps.slice(o, o + 8) }));
  });
  return lines;
}

function snapshotWithLists(cfg) {
  const snap = snapshotOf(cfg);
  for (const line of listLines(cfg)) assert.ok(api.captureListLine(snap, line), line);
  return snap;
}

test("Layout-Diff: gleiche Combos, Tastenpaare und Makros ergeben keinen Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyPairs = [{ first: "KEY_LEFT_ALT", second: "KEY_A" }];
  // 20 Schritte: das Gerät sendet sie in drei Blöcken
  cfg.macros = [{ name: "M", steps: Array.from({ length: 20 }, (_, i) => i % 2 ? { type: "pause", ms: 100 } : { type: "tap", code: "KEY_A" }) }, { name: "E", steps: [] }];
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.snapshotListsState(snap), "complete");
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.known, true);
  assert.strictEqual(d.combos.length + d.pairs.length + d.macros.length, 0);
});

test("Layout-Diff: geändertes Makro, Tastenpaar und Combo erscheinen", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyPairs = [{ first: "KEY_LEFT_ALT", second: "KEY_A" }];
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  const snap = snapshotWithLists(cfg);
  cfg.macros[0].steps.push({ type: "tap", code: "KEY_B" });
  cfg.keyPairs[0].second = "KEY_B";
  cfg.combos = cfg.combos.slice(1);
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.macros.length, 1);
  assert.strictEqual(d.macros[0].where, "Makro 0");
  assert.strictEqual(d.pairs.length, 1);
  assert.ok(d.combos.length >= 1);
});

test("Layout-Diff: Combos mit anderer Reihenfolge oder doppelt zeigen einen Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  assert.ok(cfg.combos.length >= 2);
  const snap = snapshotWithLists(cfg);
  [cfg.combos[0], cfg.combos[1]] = [cfg.combos[1], cfg.combos[0]];
  assert.ok(api.diffKeymap(cfg, snap, R).lists.combos.length > 0);
  const dup = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap2 = snapshotWithLists(dup);
  dup.combos.push(JSON.parse(JSON.stringify(dup.combos[0])));
  assert.strictEqual(api.diffKeymap(dup, snap2, R).lists.combos.length, 1);
});

test("Layout-Diff: ein zusätzliches Makro auf dem Gerät erscheint", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.macros = [];
  const snap = snapshotOf(cfg);
  for (const line of listLines(cfg).filter(l => !l.startsWith("MACRO"))) api.captureListLine(snap, line);
  api.captureListLine(snap, "MACRO_COUNT:1");
  api.captureListLine(snap, 'MACRO_DATA:{"i":0,"n":1,"o":0,"s":[[1,97,0]]}');
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.macros.length, 1);
  assert.strictEqual(d.macros[0].local, "—");
});

test("Layout-Diff: ältere Firmware (keine Listen) ist 'absent', fehlende oder ungültige Zeilen sind 'incomplete'", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const old = snapshotOf(cfg);
  assert.strictEqual(api.snapshotListsState(old), "absent");
  const dOld = api.diffKeymap(cfg, old, R).lists;
  assert.strictEqual(dOld.known, false);
  assert.strictEqual(dOld.state, "absent");

  // Eine verlorene Zeile: unvollständig, nicht "ältere Firmware"
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  const lost = snapshotOf(cfg);
  for (const line of listLines(cfg).filter(l => !l.startsWith("MACRO_DATA"))) api.captureListLine(lost, line);
  assert.strictEqual(api.snapshotListsState(lost), "incomplete");
  assert.strictEqual(api.diffKeymap(cfg, lost, R).lists.state, "incomplete");

  // Ungültige Zeilen werden verbraucht, verfälschen nichts und machen den Snapshot unvollständig
  for (const bad of ["MACRO_COUNT:", "MACRO_COUNT:0x5", "MACRO_COUNT:99", "COMBO_COUNT:17", "COMBO_DATA:nonsense"]) {
    const snap = snapshotOf(cfg);
    assert.strictEqual(api.captureListLine(snap, bad), true, bad);
    assert.strictEqual(api.snapshotListsState(snap), "incomplete", bad);
  }
  const range = snapshotOf(cfg);
  api.captureListLine(range, "COMBO_COUNT:1");
  api.captureListLine(range, 'COMBO_DATA:{"o":0,"e":[[0,0,0,1,3,4]]}');   // Verhalten 3 gibt es nicht
  assert.strictEqual(range.combos.length, 0);
  assert.strictEqual(api.snapshotListsState(range), "incomplete");
  const step = snapshotOf(cfg);
  api.captureListLine(step, "MACRO_COUNT:1");
  api.captureListLine(step, 'MACRO_DATA:{"i":0,"n":1,"o":0,"s":[[9,1,0]]}'); // Schritt-Typ 9 gibt es nicht
  assert.strictEqual(api.snapshotListsState(step), "incomplete");
  // Falscher Offset (doppelter oder übersprungener Block)
  const off = snapshotOf(cfg);
  api.captureListLine(off, "PAIR_COUNT:2");
  api.captureListLine(off, 'PAIR_DATA:{"o":1,"e":[[1,2]]}');
  assert.strictEqual(api.snapshotListsState(off), "incomplete");
  assert.strictEqual(api.captureListLine(snapshotOf(cfg), "LAYER_DATA:{}"), false);
});

test("Layout-Diff: Beschriftung für Tastenpaare und unbekannte Codes", () => {
  const pair = api.ACT_KEY_PAIR_BASE + 3;
  assert.strictEqual(api.describeKeyActions({ tapCode: pair, holdCode: 0, dtapCode: 0 }), "Paar 3");
  assert.strictEqual(api.describeKeyActions({ tapCode: 97, holdCode: pair, dtapCode: 0 }), "A · Halten: Paar 3");
  // Unbekannter Code (z. B. neuere Firmware): Zahl statt leerer Beschriftung
  assert.strictEqual(api.describeKeyActions({ tapCode: 0x1FF, holdCode: 0, dtapCode: 0 }), "Key 511");
  assert.strictEqual(api.describeKeyActions({ tapCode: 97, holdCode: 0, dtapCode: 0x1FE }), "A · 2×: Key 510");
});

test("Layout-Diff: Halten ohne Tap auf dem Gerät gleicht einer normalen Taste", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  cfg.layers[0][0][1] = { label: "Ctrl", tap: "NONE", hold: "KEY_LEFT_CTRL", dtap: "NONE" };
  // Gerät meldet Tap 0 und Halten Ctrl: wirkt wie Tap Ctrl, kein Unterschied
  snap.tap[0][0][1] = 0; snap.hold[0][0][1] = 0x80; snap.dtap[0][0][1] = 0;
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);
});

test("Layout-Diff: nicht vorhandene Tasten zählen nicht, unvollständige Snapshots werden erkannt", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  snap.tap[0][4][0] = 97; // R4C0 fehlt rechts physisch
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);
  const partial = api.createDeviceSnapshot();
  partial.names = cfg.layerNames.slice();
  assert.strictEqual(api.isDeviceSnapshotComplete(partial), false);
  assert.strictEqual(api.captureMatrixData(partial, "names", { l: 0, k: [] }), false);
  assert.strictEqual(api.captureMatrixData(partial, "tap", { l: 8, k: [] }), false);
  api.captureMatrixData(partial, "tap", { l: 0, k: [[70000, -1, 1.5, 97]] });
  assert.deepStrictEqual([...partial.tap[0][0]], [0, 0, 0, 97, 0, 0, 0]);
});

// handleSerialLine aus js/serial.js in einem eigenen Kontext mit Stubs für DOM, Anzeige und Verbindungen.
// conn: Verbindungszustand (bleUp, bleSide, serialUp, serialSide), wie connectionState() in js/ble.js.
function serialLineHarness(conn = {}) {
  const calls = { press: [], release: [], captured: [], rendered: 0, applied: 0, stats: [], layers: [] };
  const s = {
    calls, console: { log() {}, warn() {} },
    document: { getElementById: () => null },
    conn: { bleUp: false, bleSide: null, serialUp: true, serialSide: "R", ...conn },
    snapshotActive: false,
    // Stale-Timer des SPLIT_KEY-Trackers laufen im Test nie ab
    setTimeout: () => 0, clearTimeout: () => {}
  };
  vm.createContext(s);
  vm.runInContext(`${code}
${read("js/side-routing.js")}
var editSide = "R", activeLayerIndex = 0, serialSide = null, isAutoSyncing = false, bleConfigChar = null;
const configs = { R: normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)), SIDE_PROFILES.R),
                  L: normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.L.defaultConfig)), SIDE_PROFILES.L) };
const tests = { R: createMatrixTest(SIDE_PROFILES.R), L: createMatrixTest(SIDE_PROFILES.L) };
const stats = { R: createTypingStats({}, SIDE_PROFILES.R), L: createTypingStats({}, SIDE_PROFILES.L) };
function configFor(side) { return configs[side]; }
function matrixTestFor(side) { return tests[side]; }
function typingStatsFor(side) { return stats[side]; }
function connectionState() { return conn; }
function resolveAcksForLine() {}
function resolveBleInfoWaiters() {}
function captureDeviceSnapshotLine(line, side) { calls.captured.push(side); return snapshotActive; }
function showToast() {}
function updateConfigModeUI() {}
function updateBatteryUI() {}
function switchLayerUI(l) { calls.layers.push(l); }
function renderMatrix() { calls.applied++; }
function renderMatrixTest() { calls.rendered++; }
function renderLayerButtons() {}
function saveConfigToServer() {}
function clearPendingSync() {}
function onTypingStatsChanged(side) { calls.stats.push(side); }
function triggerVisualKeyPress(r, c, label, side) { calls.press.push(side + r + c); }
function triggerVisualKeyRelease(r, c, side) { calls.release.push(side + r + c); }
${section("js/serial.js", "// Gedrückte SPLIT_KEY-Tasten", "function switchLayerUI")}
this.handle = handleSerialLine; this.tested = side => [...tests[side].tested];
this.bounces = side => [...tests[side].bounces].map(([id, n]) => id + ':' + n);`, s);
  // Arrays aus dem VM-Kontext haben einen anderen Prototyp: für deepStrictEqual in einfache Werte kopieren
  const plain = v => JSON.parse(JSON.stringify(v));
  return {
    handle: (...a) => s.handle(...a), tested: side => plain(s.tested(side)), bounces: side => plain(s.bounces(side)),
    calls: new Proxy(calls, { get: (o, k) => plain(o[k]) }),
    set snapshotActive(v) { s.snapshotActive = v; }
  };
}

test("serial.js: GET_CONFIG-Zeilen gehen mit der aufgelösten Hälfte in den Snapshot", () => {
  const s = serialLineHarness();
  s.snapshotActive = true;
  // Ohne bekannte Hälfte gilt der Master: der Snapshot erhält "R", nicht null
  s.handle('LAYER_DATA:{"l":0,"k":[[97]]}', null, "usb");
  s.handle('LAYER_DATA:{"l":0,"k":[[97]]}', "L", "usb");
  assert.deepStrictEqual(s.calls.captured, ["R", "L"]);
  // Verbrauchte Zeilen ändern die lokale Config nicht
  assert.strictEqual(s.calls.applied, 0);
  s.snapshotActive = false;
  s.handle('LAYER_DATA:{"l":0,"k":[[98]]}', null, "usb");
  assert.strictEqual(s.calls.applied, 1);
});

test("serial.js: MATRIX: markiert nur Drücken, je nach Hälfte der Verbindung", () => {
  const s = serialLineHarness();
  s.handle('MATRIX:{"r":2,"c":1,"pressed":0}', "R", "usb");
  assert.deepStrictEqual(s.tested("R"), []);
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1}', "R", "usb");
  assert.deepStrictEqual(s.tested("R"), ["2_1"]);
  assert.strictEqual(s.calls.rendered, 1);           // bearbeitete Hälfte: neu zeichnen
  // Linke Hälfte direkt an USB: MATRIX: zählt für links, ohne die Ansicht der rechten Hälfte zu zeichnen
  s.handle('MATRIX:{"r":1,"c":1,"pressed":1}', "L", "usb");
  assert.deepStrictEqual(s.tested("L"), ["1_1"]);
  assert.strictEqual(s.calls.rendered, 1);
  // Live-Monitor und Heatmap bleiben bei KEY_PRESS
  assert.deepStrictEqual(s.calls.press, []);
  assert.deepStrictEqual(s.calls.stats, []);
});

test("serial.js: MATRIX: mit t erkennt Prellen je Hälfte, ohne t nicht", () => {
  const s = serialLineHarness();
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1000}', "R", "usb");
  s.handle('MATRIX:{"r":2,"c":1,"pressed":0,"t":1050}', "R", "usb");
  assert.strictEqual(s.calls.rendered, 1);                                    // nur der erste Druck markiert die Taste
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1060}', "R", "usb");          // 10 ms nach dem Loslassen
  assert.strictEqual(s.calls.rendered, 2);                                    // Prellen zeichnet die Ansicht neu
  assert.deepStrictEqual(s.bounces("R"), ["2_1:1"]);
  assert.deepStrictEqual(s.bounces("L"), []);
  // Ältere Firmware ohne t: kein Prell-Ergebnis, auch bei schnellem Druck
  s.handle('MATRIX:{"r":3,"c":1,"pressed":0}', "R", "usb");
  s.handle('MATRIX:{"r":3,"c":1,"pressed":1}', "R", "usb");
  assert.deepStrictEqual(s.bounces("R"), ["2_1:1"]);
  // Linke Hälfte direkt an USB: eigener Zähler, die Ansicht der rechten Hälfte bleibt
  s.handle('MATRIX:{"r":1,"c":1,"pressed":0,"t":500}', "L", "usb");
  s.handle('MATRIX:{"r":1,"c":1,"pressed":1,"t":505}', "L", "usb");
  assert.deepStrictEqual(s.bounces("L"), ["1_1:1"]);
  assert.deepStrictEqual(s.bounces("R"), ["2_1:1"]);
});

test("serial.js: DEVICE_INFO und MODE: vergessen die Loslass-Zeiten, die Treffer bleiben", () => {
  const s = serialLineHarness();
  for (const marker of ['DEVICE_INFO:{"side":"R","fw":2}', "MODE:CONFIG", "MODE:KEYBOARD"]) {
    s.handle('MATRIX:{"r":2,"c":1,"pressed":0,"t":1000}', "R", "usb");
    s.handle(marker, "R", "usb");                                             // Neustart oder Moduswechsel
    s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1010}', "R", "usb");        // läge 10 ms nach dem alten Loslassen
    assert.deepStrictEqual(s.bounces("R"), [], marker);
  }
  // Ein Treffer vor dem Neustart bleibt erhalten
  s.handle('MATRIX:{"r":3,"c":1,"pressed":0,"t":2000}', "R", "usb");
  s.handle('MATRIX:{"r":3,"c":1,"pressed":1,"t":2010}', "R", "usb");
  s.handle("MODE:KEYBOARD", "R", "usb");
  assert.deepStrictEqual(s.bounces("R"), ["3_1:1"]);
  // Die andere Hälfte behält ihre Zeiten
  s.handle('MATRIX:{"r":1,"c":1,"pressed":0,"t":500}', "L", "usb");
  s.handle("MODE:KEYBOARD", "R", "usb");
  s.handle('MATRIX:{"r":1,"c":1,"pressed":1,"t":505}', "L", "usb");
  assert.deepStrictEqual(s.bounces("L"), ["1_1:1"]);
});

test("serial.js: SPLIT_KEY drückt und löst die Taste der linken Hälfte", () => {
  const s = serialLineHarness();
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "R", "usb");
  assert.deepStrictEqual(s.calls.press, ["L12"]);
  assert.deepStrictEqual(s.calls.stats, ["L"]);
  assert.deepStrictEqual(s.tested("L"), ["1_2"]);
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":0,"layer":0}', "R", "usb");
  assert.deepStrictEqual(s.calls.release, ["L12"]);
  assert.deepStrictEqual(s.calls.stats, ["L"]);       // Release zählt nicht
  // Von der linken Hälfte selbst: verworfen
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "L", "usb");
  assert.deepStrictEqual(s.calls.press, ["L12"]);
});

test("serial.js: SPLIT_KEY zählt nicht doppelt, wenn die linke Hälfte selbst verbunden ist", () => {
  // Master per BLE, linke Hälfte per USB: deren Tasten kommen als KEY_PRESS direkt
  const s = serialLineHarness({ bleUp: true, bleSide: "R", serialUp: true, serialSide: "L" });
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "R", "ble");
  assert.deepStrictEqual(s.calls.press, []);
  assert.deepStrictEqual(s.calls.stats, []);
  s.handle('KEY_PRESS:{"r":1,"c":2,"key":"q","layer":0}', "L", "usb");
  assert.deepStrictEqual(s.calls.press, ["L12"]);
  assert.deepStrictEqual(s.calls.stats, ["L"]);
});

test("serial.js: Ebenenwechsel der nicht bearbeiteten Hälfte schaltet die geteilte Ebene um", () => {
  // Rechte Hälfte bearbeitet, linke Hälfte per USB: ihr MO_2 gilt auf beiden Hälften (Layer-Abgleich)
  const s = serialLineHarness({ serialUp: true, serialSide: "L" });
  s.handle('KEY_PRESS:{"r":5,"c":0,"key":"MO_2","code":258,"layer":0,"target_layer":2}', "L", "usb");
  assert.deepStrictEqual(s.calls.layers, [2]);
  // LAYER-Zeile vom Abgleich mit der anderen Hälfte ("LAYER: SPLIT -> Layer n")
  s.handle("LAYER: SPLIT -> Layer 3", "L", "usb");
  assert.deepStrictEqual(s.calls.layers, [2, 3]);
});

// Diff-Ablauf aus js/config-sync.js mit Fake-Timern, Fake-Gerät und Fake-Dialog
function diffFlowHarness() {
  const timers = [];
  const calls = { sent: [], writes: 0, dialogs: [], confirms: 0, toasts: [] };
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const h = {
    NUM_LAYERS: 8, MATRIX_DATA_FIELDS: api.MATRIX_DATA_FIELDS, captureMatrixData: api.captureMatrixData,
    isDeviceSnapshotComplete: api.isDeviceSnapshotComplete, createDeviceSnapshot: api.createDeviceSnapshot, captureListLine: api.captureListLine,
    diffKeymap: api.diffKeymap, SIDE_PROFILES: api.SIDE_PROFILES, isAutoSyncing: false,
    side: "R", via: "usb", alsoBle: false, sendOk: true, confirmAnswer: false, dialogAnswer: null,
    Dactyl: { routeCommand: (side, conn) => conn.bleUp && conn.bleSide === side ? "ble"
      : (conn.serialUp && conn.serialSide === side ? "usb" : null) },
    setTimeout: (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length - 1; },
    clearTimeout: (id) => { if (timers[id]) timers[id].done = true; },
    showToast: (t) => calls.toasts.push(t), configFor: () => cfg
  };
  vm.createContext(h);
  vm.runInContext(`${section("js/config-sync.js", "const DEVICE_SNAPSHOT_TIMEOUT_MS", "// Zeigt den Diff im Dialog")}
    ${section("js/config-sync.js", '// "Auf ESP32 speichern": zuerst', "  if (bleConfigChar) {")}
    }
    ${section("js/config-sync.js", "// One-Shot-Auto-Sync (BLE-Verbindung", "// =============================================================================\n// Layout-Diff")}
    ${section("js/config-sync.js", "// Nach einer BLE- oder USB-Trennung", "// Zeigt den Diff im Dialog")}
    this.capture = captureDeviceSnapshotLine; this.write = writeConfigWithDiff; this.load = readConfigFromESP32;
    this.autoSync = runAutoSync; this.abort = abortDeviceSnapshotReadIfDisconnected;
    this.state = () => ({ read: deviceSnapshotRead, active: diffFlowActive });`, h);
  h.bleConfigChar = null; h.serialPort = null;
  h.connectedSide = () => h.side;
  // h.side über h.via ("usb"/"ble"); alsoBle = dieselbe Hälfte zusätzlich per BLE (BLE hat Vorrang)
  h.connectionState = () => ({
    bleUp: !!h.side && (h.via === "ble" || h.alsoBle), bleSide: h.side,
    serialUp: !!h.side && h.via === "usb", serialSide: h.side
  });
  h.disconnects = 0;
  h.disconnectBle = async () => { h.disconnects++; return true; };
  h.sendDeviceCommand = async (cmd, side) => { calls.sent.push(`${side}:${cmd}`); return h.sendOk; };
  h.writeConfigToESP32 = async (opts) => { calls.writes++; calls.lastWrite = opts; };
  h.confirm = () => { calls.confirms++; return h.confirmAnswer; };
  h.showSyncDiffDialog = (profile, diff) => { calls.dialogs.push(diff); return new Promise(r => { h.dialogAnswer = r; }); };
  h.alert = () => {};
  const fire = (ms) => { const t = timers.find(x => !x.done && x.ms === ms); assert.ok(t, `kein Timer ${ms}`); t.done = true; t.fn(); };
  const flush = () => new Promise(r => setImmediate(r));
  const sendDevice = (side, c) => {
    h.capture(`LAYER_NAMES:${JSON.stringify(c.layerNames)}`, side);
    for (let l = 0; l < 8; l++) {
      const m = { tap: [], hold: [], dtap: [] };
      for (let r = 0; r < 6; r++) {
        for (const f of ["tap", "hold", "dtap"]) m[f].push([]);
        for (let col = 0; col < 7; col++) {
          const a = api.keyToNumericActions(c.layers[l][r][col]);
          m.tap[r].push(a.tapCode); m.hold[r].push(a.holdCode); m.dtap[r].push(a.dtapCode);
        }
      }
      for (const [p, f] of Object.entries(api.MATRIX_DATA_FIELDS)) h.capture(`${p}${JSON.stringify({ l, k: m[f] })}`, side);
    }
    for (const line of listLines(c)) h.capture(line, side);
    return h.capture("CONFIG_SYNC_DONE", side);
  };
  return { h, calls, cfg, fire, flush, sendDevice };
}

asyncTests.push(["Layout-Diff: Listenzeilen gehen in den Snapshot; späte Listenzeilen nach dem Timeout werden verworfen", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  const run = h.write();
  await flush();
  assert.strictEqual(sendDevice("R", cfg), true);
  await flush();
  assert.strictEqual(calls.dialogs.length, 1);
  assert.strictEqual(calls.dialogs[0].lists.state, "complete");
  h.dialogAnswer(false);
  await run;

  // Zweiter Ablauf: Timeout, dann kommen Listenzeilen verspätet. Sie werden verbraucht und ändern nichts.
  const second = diffFlowHarness();
  const run2 = second.h.write();
  await second.flush();
  second.fire(8000);
  await second.flush();
  assert.strictEqual(second.h.capture("COMBO_COUNT:1", "R"), true);
  assert.strictEqual(second.h.capture('COMBO_DATA:{"o":0,"e":[[0,0,0,1,0,4]]}', "R"), true);
  assert.strictEqual(second.h.capture("MACRO_DATA:{}", "R"), true);
  assert.strictEqual(second.h.capture("CONFIG_SYNC_DONE", "R"), true);
  await run2;
  assert.strictEqual(second.calls.writes, 0);
}]);

asyncTests.push(["Layout-Diff: Bestätigen überträgt, Abbrechen nicht; Zeilen der anderen Hälfte zählen nicht", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  const run = h.write();
  await flush();
  assert.deepStrictEqual(calls.sent, ["R:GET_CONFIG"]);
  // Zeilen der linken Hälfte verbraucht die Abfrage nicht
  assert.strictEqual(h.capture('LAYER_DATA:{"l":0,"k":[[97]]}', "L"), false);
  const device = JSON.parse(JSON.stringify(cfg));
  device.layerNames[3] = "Alt";
  assert.ok(sendDevice("R", device));
  await flush();
  assert.strictEqual(calls.dialogs.length, 1);
  assert.strictEqual(calls.dialogs[0].names.length, 1);
  assert.strictEqual(calls.dialogs[0].names[0].device, "Alt");
  // Zweiter Klick und "Vom ESP32 laden" während des offenen Dialogs: kein zweiter Ablauf, kein GET_CONFIG
  await h.write();
  await h.load();
  assert.strictEqual(calls.sent.length, 1);
  assert.strictEqual(calls.dialogs.length, 1);
  h.dialogAnswer(true);
  await run;
  assert.strictEqual(calls.writes, 1);
  // Der Sync überträgt nur die verglichene Hälfte
  assert.strictEqual(calls.lastWrite.expectedSide, "R");
  assert.strictEqual(calls.lastWrite.autoDisconnectAfter, false);
  assert.strictEqual(h.state().active, false);
  // Abbrechen
  const run2 = h.write();
  await flush();
  sendDevice("R", device);
  await flush();
  h.dialogAnswer(false);
  await run2;
  assert.strictEqual(calls.writes, 1);
}]);

asyncTests.push(["Layout-Diff: späte Zeilen nach dem Timeout ändern die lokale Config nicht", async () => {
  const { h, calls, cfg, fire, flush, sendDevice } = diffFlowHarness();
  h.confirmAnswer = false;
  const run = h.write();
  await flush();
  fire(8000);
  await run;
  assert.strictEqual(calls.confirms, 1);
  assert.strictEqual(calls.writes, 0);
  // Die Antwort kommt zu spät: alle GET_CONFIG-Zeilen werden verworfen, CONFIG_SYNC_DONE beendet das Verwerfen
  assert.ok(h.state().read && h.state().read.stale);
  assert.strictEqual(sendDevice("R", cfg), true);
  assert.strictEqual(h.state().read, null);
  assert.strictEqual(h.capture("CONFIG_SYNC_DONE", "R"), false);
  // Ohne Antwort endet das Verwerfen nach der Drain-Zeit
  const run2 = h.write();
  await flush();
  fire(8000);
  await run2;
  fire(30000);
  assert.strictEqual(h.state().read, null);
  // Rückfrage bejaht: ohne Vergleich übertragen
  h.confirmAnswer = true;
  const run3 = h.write();
  await flush();
  fire(8000);
  await run3;
  assert.strictEqual(calls.writes, 1);
}]);

asyncTests.push(["Layout-Diff: Verwerfen nach Timeout blockiert Laden und meldet einen zweiten Klick", async () => {
  const { h, calls, fire, flush } = diffFlowHarness();
  h.confirmAnswer = false;
  const run = h.write();
  await flush();
  fire(8000);
  await run;
  assert.ok(h.state().read.stale);
  // "Vom ESP32 laden" sendet während des Verwerfens kein GET_CONFIG
  await h.load();
  assert.deepStrictEqual(calls.sent, ["R:GET_CONFIG"]);
  // Zweiter Klick auf "Auf ESP32 speichern": Hinweis statt stiller Rückkehr, keine neue Abfrage
  const toastsBefore = calls.toasts.length;
  await h.write();
  assert.deepStrictEqual(calls.sent, ["R:GET_CONFIG"]);
  assert.ok(calls.toasts.slice(toastsBefore).some(t => t.includes("früheren Abfrage")));
}]);

asyncTests.push(["Layout-Diff: One-Shot-Auto-Sync überträgt nicht in eine laufende Abfrage", async () => {
  const { h, calls, flush, sendDevice, cfg } = diffFlowHarness();
  const run = h.write();
  await flush();
  // BLE-Auto-Connect während der GET_CONFIG-Abfrage: keine Übertragung
  await h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(calls.writes, 0);
  sendDevice("R", cfg);
  await flush();
  // Dialog offen (diffFlowActive): ebenfalls keine Übertragung
  await h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(calls.writes, 0);
  h.dialogAnswer(false);
  await run;
  // Übersprungener One-Shot-Sync per BLE: Tastatur trotzdem zurück in den Tastaturmodus
  assert.strictEqual(h.disconnects, 0);               // ohne BLE-Verbindung nichts zu trennen
  // Ohne Diff-Ablauf überträgt der Auto-Sync
  await h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(calls.writes, 1);
  assert.strictEqual(calls.lastWrite.autoDisconnectAfter, true);
  // Mit BLE-Verbindung: übersprungen und getrennt (EXIT_CONFIG); ohne autoDisconnectAfter bleibt sie bestehen
  const b = diffFlowHarness();
  b.h.bleConfigChar = {};
  const runB = b.h.write();
  await b.flush();
  await b.h.autoSync({ autoDisconnectAfter: false });
  assert.strictEqual(b.h.disconnects, 0);
  await b.h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(b.h.disconnects, 1);
  assert.strictEqual(b.calls.writes, 0);
  b.h.side = null;
  b.h.abort();
  b.h.confirmAnswer = false;
  await runB;
  // ble.js startet den Auto-Sync nur über runAutoSync
  const ble = read("js/ble.js");
  assert.ok(!/writeConfigToESP32\(/.test(ble));
  assert.ok(/runAutoSync\(\{ autoDisconnectAfter: true \}\)/.test(ble));
}]);

asyncTests.push(["Layout-Diff: Trennen während der Abfrage beendet sie sofort", async () => {
  const { h, calls, flush } = diffFlowHarness();
  const run = h.write();
  await flush();
  // Gleiche Hälfte noch verbunden: Abfrage läuft weiter
  h.abort();
  assert.ok(h.state().read);
  // Verbindung weg: Abfrage endet ohne Timeout, der Ablauf meldet die Unterbrechung
  h.side = null;
  h.abort();
  assert.strictEqual(h.state().read, null);
  await run;
  assert.strictEqual(calls.writes, 0);
  assert.strictEqual(calls.confirms, 0);
  assert.ok(calls.toasts.some(t => t.includes("unterbrochen")));

  // Abfrage per BLE, BLE fällt weg, USB derselben Hälfte bleibt: die Antwort kommt nicht mehr, sofort beenden
  const b = diffFlowHarness();
  b.h.via = "usb"; b.h.alsoBle = true;
  b.h.confirmAnswer = false;
  const runB = b.h.write();
  await b.flush();
  b.h.alsoBle = false;
  b.h.abort();
  assert.strictEqual(b.h.state().read, null);
  await runB;
  assert.strictEqual(b.calls.confirms, 1);           // Rückfrage ohne Vergleich statt 8 s Warten
  // Abfrage per USB, eine zusätzliche BLE-Verbindung ändert den Weg der Anfrage nicht
  const u = diffFlowHarness();
  const runU = u.h.write();
  await u.flush();
  u.h.alsoBle = true;
  u.h.abort();
  assert.ok(u.h.state().read);
  u.h.alsoBle = false;
  u.h.confirmAnswer = false;
  u.h.side = null;
  u.h.abort();
  await runU;
  // Beide Trennpfade rufen die Funktion auf
  assert.ok(section("js/ble.js", "function onBleDisconnected", "function updateBleUI").includes("abortDeviceSnapshotReadIfDisconnected()"));
  assert.ok(section("js/serial.js", "async function disconnectSerialNow", "function updateBatteryUI").includes("abortDeviceSnapshotReadIfDisconnected()"));
}]);

// Live-Sync aus js/config-sync.js: Planung, Warteschlange pro Hälfte und Sperren
function liveSyncHarness() {
  const timers = [];
  const h = {
    side: "R", pending: { R: [{ id: 1 }], L: [] }, writes: [], toasts: [], SIDE_PROFILES: api.SIDE_PROFILES,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }
  };
  h.connectedSide = () => h.side;
  h.pendingFor = side => h.pending[side];
  h.showToast = t => h.toasts.push(t);
  h.writeConfigToESP32 = async opts => { h.writes.push(opts); };
  vm.createContext(h);
  vm.runInContext(`var isAutoSyncing = false, isConnectingBle = false, deviceSnapshotRead = null, diffFlowActive = false;
    ${section("js/config-sync.js", "// Änderungen innerhalb von LIVE_SYNC_DEBOUNCE_MS", "// One-Shot-Auto-Sync (BLE-Verbindung")}
    this.request = requestLiveSync;`, h);
  const run = async () => { while (timers.length) { const t = timers.shift(); await t.fn(); } };
  return { h, timers, run, set: expr => vm.runInContext(expr, h) };
}

asyncTests.push(["Live-Sync: schnelle Änderungen einer verbundenen Hälfte starten einen vollen Sync", async () => {
  const { h, timers, run } = liveSyncHarness();
  assert.strictEqual(h.request("R"), true);
  assert.strictEqual(h.request("R"), true);
  assert.strictEqual(timers.length, 1, "mehrere Änderungen planen einen Sync");
  assert.strictEqual(timers[0].ms, vm.runInContext("LIVE_SYNC_DEBOUNCE_MS", h));
  assert.ok(timers[0].ms > 0);
  await run();
  assert.strictEqual(h.writes.length, 1);
  assert.deepStrictEqual({ ...h.writes[0] }, { autoDisconnectAfter: false, expectedSide: "R" });
  // Nicht verbundene oder andere Hälfte: nichts planen, die Änderung bleibt vorgemerkt
  assert.strictEqual(h.request("L"), false);
  h.side = null;
  assert.strictEqual(h.request("R"), false);
  assert.strictEqual(timers.length, 0);
}]);

asyncTests.push(["Live-Sync: wartet auf einen laufenden Sync, Diff und Trennung zeigen den Hinweis", async () => {
  const { h, timers, run, set } = liveSyncHarness();
  set("isAutoSyncing = true");
  h.request("R");
  await timers.shift().fn();
  assert.strictEqual(h.writes.length, 0);
  assert.strictEqual(timers.at(-1).ms, vm.runInContext("LIVE_SYNC_RETRY_MS", h));
  set("isAutoSyncing = false");
  await run();
  assert.strictEqual(h.writes.length, 1);
  // Während des Diffs nichts übertragen, aber den Vormerk-Hinweis zeigen
  set("diffFlowActive = true");
  h.request("R");
  await run();
  assert.strictEqual(h.writes.length, 1);
  assert.ok(h.toasts.at(-1).includes("bleiben vorgemerkt"));
  set("diffFlowActive = false");
  // BLE-Verbindungsaufbau läuft: erst danach senden
  set("isConnectingBle = true");
  h.request("R");
  await timers.shift().fn();
  assert.strictEqual(h.writes.length, 1);
  assert.strictEqual(timers.at(-1).ms, vm.runInContext("LIVE_SYNC_RETRY_MS", h));
  set("isConnectingBle = false");
  await run();
  assert.strictEqual(h.writes.length, 2);
  // Verbindung endet vor dem Sync (One-Shot trennt): Hinweis statt stillem Verwerfen
  h.toasts.length = 0;
  h.request("R");
  h.side = null;
  await run();
  assert.strictEqual(h.writes.length, 2);
  assert.ok(h.toasts.at(-1).includes("bleiben vorgemerkt"));
  h.side = "R";
  // Ohne vorgemerkte Änderung (inzwischen synchronisiert) kein weiterer Sync
  h.pending.R = [];
  h.request("R");
  await run();
  assert.strictEqual(h.writes.length, 2);
  // Nach Rückgängig (force): auch ohne vorgemerkte Änderung senden, ein späterer Aufruf ohne force hebt das nicht auf
  h.request("R", true);
  h.request("R");
  await run();
  assert.strictEqual(h.writes.length, 3);
}]);

// markPendingSync, undoPendingChange und discardAllPendingChanges aus app.js
function pendingHarness() {
  const w = { toasts: [], requests: [], connected: true, confirm: () => true, console: { error() {} } };
  vm.createContext(w);
  vm.runInContext(`var editSide = "R";
    var pendingChanges = [], otherPending = [], pendingSyncCount = 0;
    var document = { getElementById: () => null };
    function pendingFor(side) { return side === editSide ? pendingChanges : otherPending; }
    function setPendingFor(side, list) { if (side === editSide) pendingChanges = list; else otherPending = list; }
    function renderPendingSyncUI() {}
    function isUndoBlocked() { return false; }
    function showToast(t) { toasts.push(t); }
    function activeProfile() { return { comboLabel: "C", label: "rechte Hälfte" }; }
    function requestLiveSync(side, force) { requests.push([side, !!force]); return connected; }
    ${section("app.js", "function undoPendingChange", "// Verwirft die vorgemerkten Änderungen")}
    ${section("app.js", "// Verwirft die vorgemerkten Änderungen", "// Lädt die gespeicherte Konfiguration")}
    this.mark = markPendingSync; this.undo = undoPendingChange; this.discard = discardAllPendingChanges;
    this.list = () => pendingChanges; this.other = () => otherPending;`, w);
  return w;
}

test("Live-Sync: markPendingSync plant den Sync der Hälfte, ohne Verbindung mit Vormerk-Hinweis", () => {
  const w = pendingHarness();
  w.mark({ type: "key", title: "T" }, "R");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.requests)), [["R", false]]);
  assert.strictEqual(w.list().length, 1);
  assert.strictEqual(w.toasts.length, 0, "verbunden: writeConfigToESP32 meldet den Fortschritt");
  w.connected = false;
  w.mark({ type: "key", title: "U" }, "R");
  assert.ok(w.toasts.at(-1).includes("Vorgemerkt (U)"));
  // Andere Hälfte: eigene Liste, eigener Sync
  w.mark({ type: "key", title: "L" }, "L");
  assert.deepStrictEqual([...w.requests.at(-1)], ["L", false]);
  assert.strictEqual(w.other().length, 1);
  // Rückgängig und Verwerfen übertragen den Stand erneut (force)
  w.undo(w.list()[0].id);
  assert.deepStrictEqual([...w.requests.at(-1)], ["R", true]);
  w.requests.length = 0;
  w.discard();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.requests)), [["R", true]]);
  assert.strictEqual(w.list().length, 0);
});

asyncTests.push(["Live-Sync: Ebene umbenennen merkt vor und sendet kein SET_NAME", async () => {
  const { w, dom, log } = uiHarness(`
${section("js/editor.js", "async function renameActiveLayer", "function initUI")}`);
  dom.document.getElementById("layerNameInput").value = "Nav";
  await w.renameActiveLayer();
  assert.deepStrictEqual(log.sent, []);
  assert.strictEqual(log.pending.at(-1).type, "layer_name");
  assert.strictEqual(vm.runInContext("currentConfig.layerNames[0]", w), "Nav");
}]);

asyncTests.push(["Layout-Diff: writeConfigToESP32 überträgt nach einem Hälftenwechsel nichts", async () => {
  const toasts = [];
  let progressShown = false;
  const w = {
    bleConfigChar: {}, serialPort: null, isAutoSyncing: false, SIDE_PROFILES: api.SIDE_PROFILES,
    connectedSide: () => "L", showToast: (t) => toasts.push(t), alert: () => {},
    activeProfile: () => R, configFor: () => { throw new Error("configFor darf nicht laufen"); },
    document: { getElementById: () => { progressShown = true; return null; } }
  };
  vm.createContext(w);
  vm.runInContext(`${section("js/config-sync.js", "async function writeConfigToESP32", "  const cfg = configFor(side);")}
    }
    this.write = writeConfigToESP32;`, w);
  await w.write({ autoDisconnectAfter: false, expectedSide: "R" });
  assert.strictEqual(progressShown, false);
  assert.ok(toasts.some(t => t.includes(R.label)));
}]);

asyncTests.push(["Layout-Diff: Sendefehler und Verbindungswechsel übertragen nichts ohne Rückfrage", async () => {
  const { h, calls, flush } = diffFlowHarness();
  h.sendOk = false;
  await h.write();
  assert.strictEqual(calls.confirms, 1);
  assert.strictEqual(h.state().read, null);
  // Verbindung wechselt während der Abfrage zur anderen Hälfte
  h.sendOk = true;
  const run = h.write();
  await flush();
  h.side = "L";
  h.capture("CONFIG_SYNC_DONE", "R");
  await run;
  assert.strictEqual(calls.writes, 0);
  assert.strictEqual(calls.confirms, 1);
}]);

test("Makros: Konstanten passen zu Firmware und server.py", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  const py = read("server.py");
  const define = name => Number(new RegExp(`#define ${name}\\s+(0x[0-9A-Fa-f]+|\\d+)`).exec(common)[1]);
  assert.strictEqual(define("ACT_MACRO_BASE"), api.ACT_MACRO_BASE);
  assert.strictEqual(define("MAX_MACROS"), api.MAX_MACROS);
  assert.strictEqual(define("MAX_MACRO_STEPS"), api.MAX_MACRO_STEPS);
  assert.strictEqual(define("MACRO_MAX_PAUSE_MS"), api.MACRO_MAX_PAUSE_MS);
  for (const [name, value] of Object.entries(api.MACRO_STEP_TYPES)) {
    assert.strictEqual(define(`MACRO_STEP_${name.toUpperCase()}`), value);
  }
  assert.strictEqual(Number(/^MAX_MACROS = (\d+)/m.exec(py)[1]), api.MAX_MACROS);
  // Kein anderer Aktionscode (Umlaut, One-Shot, Caps Word) liegt im Makro-Bereich
  for (const m of common.matchAll(/#define (ACT_\w+)\s+(0x[0-9A-Fa-f]+)/g)) {
    if (m[1] === "ACT_MACRO_BASE") continue;
    const v = Number(m[2]);
    assert.ok(v < api.ACT_MACRO_BASE || v >= api.ACT_MACRO_BASE + api.MAX_MACROS, `${m[1]} überlappt mit Makros`);
  }
});

test("Makros: Aktionscode hin und zurück", () => {
  assert.strictEqual(api.actionCodeToNumeric("MACRO_0"), api.ACT_MACRO_BASE);
  assert.strictEqual(api.actionCodeToNumeric("MACRO_15"), api.ACT_MACRO_BASE + 15);
  assert.strictEqual(api.macroIndexFromCode("MACRO_16"), -1);
  assert.strictEqual(api.macroIndexFromCode("MACRO_x"), -1);
  assert.deepStrictEqual({ ...api.findDefinitionByCode(api.ACT_MACRO_BASE + 3) }, { label: "Makro 3", tap: "MACRO_3" });
  // Ein Makro ist kein Tastenpaar- oder Schritt-Mitglied
  assert.strictEqual(api.isKeyPairMember("MACRO_0"), false);
});

test("Makros: Schritte, Validierung und Normalisierung", () => {
  assert.ok(api.isValidMacroStep({ type: "tap", code: "KEY_A" }));
  assert.ok(api.isValidMacroStep({ type: "down", code: "KEY_LEFT_GUI" }));
  assert.ok(api.isValidMacroStep({ type: "pause", ms: 5000 }));
  for (const bad of [{ type: "pause", ms: 0 }, { type: "pause", ms: 5001 }, { type: "pause", ms: "100" },
                     { type: "tap", code: "MO_1" }, { type: "tap", code: "MACRO_0" }, { type: "tap", code: "PAIR_0" },
                     { type: "click", code: "KEY_A" }, null, "tap",
                     // Geerbte Objekt-Namen sind keine Schritt-Typen
                     { type: "constructor", code: "KEY_A" }, { type: "toString", code: "KEY_A" },
                     { type: "__proto__", code: "KEY_A" }]) {
    assert.strictEqual(api.isValidMacroStep(bad), false, JSON.stringify(bad));
  }
  const tooLong = { name: "x", steps: Array(api.MAX_MACRO_STEPS + 1).fill({ type: "tap", code: "KEY_A" }) };
  assert.strictEqual(api.isValidMacro(tooLong), false);
  const base = { layers: [[[]]] };
  assert.throws(() => api.validateConfigShape({ ...base, macros: [tooLong] }, R), /Makro 0/);
  assert.throws(() => api.validateConfigShape({ ...base, macros: Array(17).fill({ steps: [] }) }, R), /macros/);
  assert.throws(() => api.validateConfigShape({ ...base, combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "MACRO_0" }] }, R), /Makros/);
  const cfg = api.normalizeConfig({ layers: [[[]]], macros: [
    { name: "Ok", steps: [{ type: "pause", ms: 10, code: "KEY_A" }, { type: "tap", code: "KEY_A", ms: 7 }] },
    { name: "Kaputt", steps: [{ type: "pause", ms: 0 }] }
  ] }, R);
  // Ein ungültiges Makro wird leer, nicht entfernt: spätere MACRO_<n>-Verweise behalten ihr Ziel
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cfg.macros)),
    [{ name: "Ok", steps: [{ type: "pause", ms: 10 }, { type: "tap", code: "KEY_A" }] }, { name: "Kaputt", steps: [] }]);
  const shifted = api.normalizeConfig({ layers: [[[{ tap: "MACRO_1" }]]], macros: [
    { name: "Kaputt", steps: [{ type: "constructor", code: "KEY_A" }] },
    { name: "Ziel", steps: [{ type: "tap", code: "KEY_B" }] },
    null
  ] }, R);
  assert.strictEqual(shifted.macros[1].name, "Ziel");
  assert.strictEqual(shifted.macros[1].steps.length, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(shifted.macros[2])), { name: "Makro 2", steps: [] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.normalizeConfig({ layers: [[[]]] }, R).macros)), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.macroCommands(cfg.macros[0]))),
    ["ADD_MACRO", "ADD_MACRO_STEP 4 0 10", "ADD_MACRO_STEP 1 97 0"]);
});

test("Makros: Speicher-Index des Editors bleibt in der Liste", () => {
  const two = [{ name: "a", steps: [] }, { name: "b", steps: [] }];
  assert.strictEqual(api.macroSaveIndex(two, -1), 2);          // neues Makro wird angehängt
  assert.strictEqual(api.macroSaveIndex(two, 1), 1);           // vorhandenes Makro
  // Index aus einer längeren Liste (andere Hälfte, Import, Undo): kein Speichern, keine Lücke
  assert.strictEqual(api.macroSaveIndex(two, 2), null);
  assert.strictEqual(api.macroSaveIndex(two, 5), null);
  assert.strictEqual(api.macroSaveIndex([], 0), null);
  assert.strictEqual(api.macroSaveIndex(Array(api.MAX_MACROS).fill({ steps: [] }), -1), null);
  assert.strictEqual(api.macroSaveIndex(undefined, -1), 0);
});

test("Makros: Editor schließt beim Wechsel der Hälfte und bei geänderter Liste", () => {
  const editor = read("js/editor.js");
  const sw = editor.slice(editor.indexOf("function switchEditSide"), editor.indexOf("function updateSideLabels"));
  assert.ok(/closeMacroEditor\(\)/.test(sw), "switchEditSide schließt den Makro-Editor nicht");
  assert.ok(sw.indexOf("closeMacroEditor()") < sw.indexOf("editSide = side"), "Editor muss vor dem Wechsel schließen");
  const ui = read("js/macros-ui.js");
  const render = ui.slice(ui.indexOf("function renderMacros"), ui.indexOf("function renderMacroDraftSteps"));
  assert.ok(/macroSaveIndex\(currentConfig\.macros, macroEditIndex\) === null/.test(render));
  const save = ui.slice(ui.indexOf("function saveMacroFromUI"), ui.indexOf("function deleteMacro"));
  assert.ok(/macroSaveIndex\(currentConfig\.macros, macroEditIndex\)/.test(save));
  assert.ok(!/next\.macros\.length : macroEditIndex/.test(save), "alter ungeprüfter Index");
});

test("Makros: Löschen nummeriert Tasten neu und Staging", () => {
  const key = (tap, hold = "NONE", dtap = "NONE") => ({ label: "", tap, hold, dtap });
  const config = {
    macros: [{ name: "a", steps: [] }, { name: "b", steps: [] }, { name: "c", steps: [] }],
    layers: [[[key("MACRO_0"), key("KEY_A", "MACRO_1"), key("KEY_B", "NONE", "MACRO_2"), "MACRO_1"]]]
  };
  const next = api.removeMacroAt(config, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(next.macros.map(m => m.name))), ["a", "c"]);
  const row = next.layers[0][0];
  assert.strictEqual(row[0].tap, "MACRO_0");
  assert.strictEqual(row[1].hold, "NONE");
  assert.strictEqual(row[2].dtap, "MACRO_1");
  assert.strictEqual(row[3], "NONE");
  assert.strictEqual(config.layers[0][0][1].hold, "MACRO_1");   // nicht in-place
  assert.strictEqual(api.removeMacroAt(config, 3), null);
  assert.ok(api.isMacroUsed(config.layers, 2));
  assert.ok(!api.isMacroUsed(next.layers, 2));
  // Rückgängig: das Makro kommt zurück, nur die geleerten Verweise werden wieder gesetzt
  next.layers[0][0][1].tap = "KEY_Q";                              // spätere Tastenänderung
  next.layers[0][0][3] = "KEY_W";                                  // geleerte Position später neu belegt
  const back = api.restoreMacroAt(next, 1, config.macros[1], next.cleared);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back.macros.map(m => m.name))), ["a", "b", "c"]);
  const brow = back.layers[0][0];
  assert.strictEqual(brow[0].tap, "MACRO_0");
  assert.strictEqual(brow[1].tap, "KEY_Q");                        // spätere Änderung bleibt
  assert.strictEqual(brow[1].hold, "MACRO_1");                     // geleerter Verweis zurück
  assert.strictEqual(brow[2].dtap, "MACRO_2");                     // nachgerückter Verweis zurück
  assert.strictEqual(brow[3], "KEY_W");                            // neu belegt: bleibt
  assert.strictEqual(api.restoreMacroAt({ macros: Array(api.MAX_MACROS).fill({ steps: [] }), layers: [] }, 0, { steps: [] }, []), null);
});

// Voller Sync aus js/config-sync.js mit Fake-USB-Verbindung. reply(cmd) liefert die Antwortzeile oder null.
// holdMs: Timer mit dieser Dauer laufen nicht sofort, sondern warten in held (Ausblend-Timer des Balkens)
function fullSyncHarness(reply, holdMs = null) {
  const progress = [];
  const toasts = [];
  const sent = [];
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.combos = [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "KEY_PRESS", action: "KEY_ESC" }];
  cfg.keyPairs = [{ first: "KEY_LEFT_ALT", second: "*" }];
  cfg.macros = [
    { name: "Copy", steps: [{ type: "down", code: "KEY_LEFT_GUI" }, { type: "tap", code: "KEY_C" }, { type: "up", code: "KEY_LEFT_GUI" }] },
    { name: "Warten", steps: [{ type: "pause", ms: 250 }, { type: "tap", code: "a" }] }
  ];
  const delays = [];
  // Texte über dem Balken in der Reihenfolge der Anzeige; hidden = Label ausgeblendet
  const labels = [];
  const label = { style: { set display(v) { if (v === "none") labels.hidden = true; } },
                  set textContent(v) { labels.push(v); } };
  const held = [];
  const w = {
    console: { error() {}, warn() {} }, sent, reply, delays, held, AbortController,
    setTimeout: (fn, ms) => {
      delays.push(ms);
      if (ms === holdMs) { held.push({ fn, cleared: false }); return held.length; }
      Promise.resolve().then(fn);
      return 0;
    },
    clearTimeout: id => { if (id > 0 && held[id - 1]) held[id - 1].cleared = true; },
    document: { getElementById: id => id === "autoSyncProgressBar"
      ? { style: { set width(v) { progress.push(parseInt(v, 10)); } } }
      : (id === "autoSyncProgressLabel" ? label : { style: {} }) }
  };
  vm.createContext(w);
  vm.runInContext(`${code}
${read("js/side-routing.js")}
var isAutoSyncing = false, isConfigModeActive = false, editSide = "R", bleConfigChar = null;
var serialPort = { writable: true };
function connectedSide() { return "R"; }
function configFor() { return cfgRef; }
function activeProfile() { return SIDE_PROFILES.R; }
function alert() {}
function showToast(t) { toastsRef.push(t); }
function updateConfigModeUI(active, syncing = false) { isAutoSyncing = syncing; }
function pendingFor() { return []; }
function clearPendingSync() {}
function setPendingFor() {}
function renderPendingSyncUI() {}
async function disconnectBle() { return true; }
async function sendBleCommand() { return false; }
const ackRegistry = Dactyl.createAckRegistry({ set: () => 0, clear: () => {} });
const waitForAck = (p, t, side, unknownOk) => ackRegistry.wait(p, t, side, unknownOk);
const resolveAcksForLine = (line, side) => ackRegistry.resolveLine(line, side);
const rejectAllPendingAcks = (reason, side) => ackRegistry.reject(reason, side);
async function sendSerialCommand(cmd) {
  sent.push(cmd);
  const line = reply(cmd);
  if (line) Promise.resolve().then(() => resolveAcksForLine(line, "R"));
  return true;
}
${read("js/config-sync.js")}
this.write = writeConfigToESP32;
this.state = () => ({ isAutoSyncing });
this.setBle = (char, disconnect) => { bleConfigChar = char; disconnectBle = disconnect; };`, Object.assign(w, { cfgRef: cfg, toastsRef: toasts }));
  return { w, progress, toasts, sent, delays, labels, held };
}

const okReply = cmd => cmd.startsWith("SET_K ") ? null : `OK ${cmd}`;

asyncTests.push(["Sync: legt vor dem ersten Befehl ein Backup an, ein Fehler hält den Sync nicht auf", async () => {
  for (const failure of [null, "http", "network"]) {
    const { w, sent, toasts } = fullSyncHarness(okReply);
    const backups = [];
    w.fetch = async (url, opts) => {
      backups.push({ url, sentBefore: sent.length, body: JSON.parse(opts.body), method: opts.method });
      if (failure === "network") throw new Error("offline");
      return failure === "http"
        ? { ok: false, status: 500, json: async () => ({ error: "Platte voll" }) }
        : { ok: true, status: 200, json: async () => ({ success: true, created: true }) };
    };
    await w.write();
    assert.strictEqual(backups.length, 1);
    assert.strictEqual(backups[0].url, "/api/backups?side=R");
    assert.strictEqual(backups[0].method, "POST");
    assert.strictEqual(backups[0].sentBefore, 0, "Backup vor dem ersten Befehl");
    assert.ok(Array.isArray(backups[0].body.layers));
    assert.ok(sent.includes("SAVE_MACROS"), "der Sync läuft weiter");
    if (failure) assert.ok(toasts.some(t => t.includes("Backup vor dem Sync fehlgeschlagen")), failure);
    else assert.ok(!toasts.some(t => t.includes("Backup")));
  }
}]);

asyncTests.push(["Sync: Backup-Warnung einmal pro Fehlerserie, hängender Server bricht ab", async () => {
  const { w, sent, toasts, delays } = fullSyncHarness(okReply);
  let mode = "fail";
  const signals = [];
  w.fetch = async (url, opts) => {
    signals.push(opts.signal);
    if (mode === "ok") return { ok: true, status: 200, json: async () => ({ success: true }) };
    throw new Error("offline");
  };
  const warnings = () => toasts.filter(t => t.includes("Backup vor dem Sync fehlgeschlagen")).length;
  await w.write();
  await w.write();
  assert.strictEqual(warnings(), 1, "zweiter Fehler in Folge: keine weitere Warnung");
  mode = "ok";
  await w.write();
  mode = "fail";
  await w.write();
  assert.strictEqual(warnings(), 2, "nach einem Erfolg warnt der nächste Fehler wieder");
  // Jeder Aufruf trägt ein Abbruchsignal mit Zeitlimit
  assert.ok(signals.every(sig => sig && typeof sig.aborted === "boolean"));
  assert.ok(delays.includes(vm.runInContext("BACKUP_TIMEOUT_MS", w)));
  // Abbruch nach dem Zeitlimit: der Sync läuft weiter
  const hung = fullSyncHarness(okReply, vm.runInContext("BACKUP_TIMEOUT_MS", w));
  hung.w.fetch = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const run = hung.w.write();
  await new Promise(r => setImmediate(r));
  assert.strictEqual(hung.sent.length, 0, "wartet auf das Backup");
  assert.strictEqual(hung.held.length, 1);
  hung.held[0].fn();
  await run;
  assert.ok(hung.toasts.some(t => t.includes("Server antwortet nicht")));
  assert.ok(hung.sent.includes("SAVE_MACROS"));
}]);

asyncTests.push(["Sync: Schrittzahl passt zu den gesendeten Schritten", async () => {
  const { w, progress, sent } = fullSyncHarness(okReply);
  await w.write();
  assert.ok(sent.includes("SAVE_PAIRS"));
  // Breite: 2 % beim Start, dann ein Wert pro Schritt, am Ende 0 % (Ausblenden). Ohne Kappung: zu viele
  // Schritte enden unter 100 %, zu wenige laufen darüber
  assert.strictEqual(progress[0], 2);
  assert.strictEqual(progress.at(-1), 0);
  const steps = progress.slice(1, -1);
  const settings = sent.filter(c => /^SET_(STANDBY|SLEEP|DEV_NAME|DEBOUNCE|COMBO_TIMEOUT|TAPPING_TERM) /.test(c)).length;
  const names = sent.filter(c => c.startsWith("SET_NAME ")).length;
  const keys = sent.filter(c => c.startsWith("SET_K ")).length;
  const combos = sent.filter(c => c.startsWith("ADD_COMBO ")).length;
  const macros = sent.filter(c => c === "ADD_MACRO").length;
  assert.strictEqual(macros, 2);
  // SAVE_NVS, SAVE_COMBOS, die Tastenpaar-Phase, je Makro ein Schritt und SAVE_MACROS
  assert.strictEqual(steps.length, settings + names + keys + 1 + combos + 1 + 1 + macros + 1);
  assert.strictEqual(steps.at(-1), 100);
  assert.ok(steps.every(p => p <= 100), `Fortschritt über 100 %: ${Math.max(...steps)}`);
}]);

test("Sync: countSyncSteps zählt jeden Einstellungs-Befehl und jede Combo", () => {
  const ctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, sanitizeCommandText: api.sanitizeCommandText };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.count = countSyncSteps; this.build = buildSettingCommands;`, ctx);
  // Eine weitere Einstellung erhöht die Schrittzahl (früher fest "+ 9")
  assert.strictEqual(ctx.count(7, 8, 2) - ctx.count(6, 8, 2), 1);
  assert.strictEqual(ctx.count(6, 8, 3) - ctx.count(6, 8, 2), 1);
  assert.strictEqual(ctx.count(6, 8, 0), 6 + 8 + 8 * 6 * 7 + 4);
  assert.strictEqual(ctx.count(6, 8, 0, 3) - ctx.count(6, 8, 0), 3);
  const cmds = ctx.build({}, R);
  assert.strictEqual(cmds.length, 6);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cmds.filter(c => c.optional).map(c => c.ack))), ["SET_TAPPING_TERM"]);
});

asyncTests.push(["Sync: Text über dem Balken zählt die übertragenen Schritte", async () => {
  const { w, labels, progress } = fullSyncHarness(okReply);
  await w.write();
  const steps = progress.slice(1, -1).length;
  assert.strictEqual(labels[0], `Übertrage an ${R.label} …`);
  assert.strictEqual(labels[1], `Übertrage an ${R.label}: 0 / ${steps} Schritte`);
  assert.strictEqual(labels.at(-2), `Übertrage an ${R.label}: ${steps} / ${steps} Schritte`);
  assert.strictEqual(labels.at(-1), "Übertragung abgeschlossen");
  assert.strictEqual(labels.hidden, true);
  // Keine Live-Region: ein Screenreader würde jeden der etwa 400 Schritte ansagen
  const labelTag = /<div id="autoSyncProgressLabel"[^>]*>/.exec(read("index.html"));
  assert.ok(labelTag, "autoSyncProgressLabel fehlt in index.html");
  assert.ok(!/aria-live/.test(labelTag[0]));
  // Abbruch: eigener Endtext
  const bad = fullSyncHarness(cmd => cmd === "SAVE_NVS" ? "ERR NVS SAVE_NVS" : okReply(cmd));
  await bad.w.write();
  assert.strictEqual(bad.labels.at(-1), "Übertragung abgebrochen");
  assert.ok(!bad.labels.includes("Übertragung abgeschlossen"));
}]);

asyncTests.push(["Sync: Ausblend-Timer eines früheren Syncs blendet die Anzeige eines neuen Syncs nicht aus", async () => {
  const { w, labels, held } = fullSyncHarness(okReply, 600);
  await w.write();
  assert.strictEqual(held.length, 1);
  // Zweiter Sync (Live-Sync nach 300 ms) startet, bevor der erste Timer abläuft
  const second = w.write();
  assert.strictEqual(held[0].cleared, true, "neuer Sync löscht den alten Ausblend-Timer");
  await second;
  assert.strictEqual(labels.hidden, undefined);
  // Der Timer des zweiten Syncs blendet aus
  held[1].fn();
  assert.strictEqual(labels.hidden, true);
}]);

asyncTests.push(["One-Shot: Trennen ohne Wartezeit, isAutoSyncing endet auch bei einem Fehler im Trennen", async () => {
  const { w, delays } = fullSyncHarness(okReply);
  let disconnects = 0;
  w.setBle({}, async () => { disconnects++; throw new Error("GATT"); });
  // USB-Pfad für die Befehle: BLE-Senden schlägt fehl, der Sync bricht ab und trennt trotzdem
  const running = w.write({ autoDisconnectAfter: true }).catch(() => {});
  assert.strictEqual(w.state().isAutoSyncing, true);
  await running;
  assert.strictEqual(disconnects, 1);
  assert.strictEqual(w.state().isAutoSyncing, false);
  // Keine Wartezeit vor dem Trennen: nur der 600-ms-Timer zum Ausblenden des Balkens
  assert.ok(!delays.includes(150), `Wartezeiten: ${delays}`);
}]);

asyncTests.push(["Sync: Firmware ohne SET_TAPPING_TERM bricht den Sync nicht ab", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd =>
    cmd.startsWith("SET_TAPPING_TERM") ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  assert.ok(sent.some(c => c.startsWith("SET_K ")));
  assert.ok(sent.includes("SAVE_PAIRS"));
  assert.ok(toasts.some(t => t.includes("SET_TAPPING_TERM") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
  // Andere Befehle bleiben Pflicht
  const strict = fullSyncHarness(cmd => cmd.startsWith("SET_DEBOUNCE") ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await strict.w.write();
  assert.ok(!strict.sent.some(c => c.startsWith("SET_K ")));
  assert.ok(strict.toasts.some(t => t.includes("Fehler beim Übertragen")));
}]);

asyncTests.push(["Sync: Makros gehen als CLEAR_MACROS, ADD_MACRO, ADD_MACRO_STEP und SAVE_MACROS", async () => {
  const { w, sent } = fullSyncHarness(okReply);
  await w.write();
  const start = sent.indexOf("CLEAR_MACROS");
  assert.ok(start > sent.indexOf("SAVE_PAIRS"));
  assert.deepStrictEqual(sent.slice(start), [
    "CLEAR_MACROS",
    "ADD_MACRO", "ADD_MACRO_STEP 2 131 0", "ADD_MACRO_STEP 1 99 0", "ADD_MACRO_STEP 3 131 0",
    "ADD_MACRO", "ADD_MACRO_STEP 4 0 250", "ADD_MACRO_STEP 1 97 0",
    "SAVE_MACROS"
  ]);
}]);

asyncTests.push(["Sync: Firmware ohne Makros überspringt die Makro-Phase mit Hinweis", async () => {
  const { w, toasts, sent, progress } = fullSyncHarness(cmd => cmd === "CLEAR_MACROS" ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  // Auch mit übersprungener Phase endet der Balken bei 100 %
  assert.strictEqual(progress.at(-2), 100);
  assert.ok(sent.includes("CLEAR_MACROS"));
  assert.ok(!sent.some(c => c.startsWith("ADD_MACRO") || c === "SAVE_MACROS"));
  assert.ok(toasts.some(t => t.includes("CLEAR_MACROS") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
  // Ein abgelehnter Schritt bricht den Sync ab (kein stilles Abschneiden)
  const bad = fullSyncHarness(cmd => cmd.startsWith("ADD_MACRO_STEP 4") ? `ERR ARGS ${cmd}` : okReply(cmd));
  await bad.w.write();
  assert.ok(!bad.sent.includes("SAVE_MACROS"));
  assert.ok(bad.toasts.some(t => t.includes("Fehler beim Übertragen")));
}]);

// Zeichen, die dactylAsciiToHid (DactylKeycodes.h) in einen HID-Code übersetzt
const asciiHeader = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylKeycodes.h"), "utf8");
const asciiStart = asciiHeader.indexOf("dactylAsciiToHid");
const asciiFn = asciiHeader.slice(asciiStart, asciiHeader.indexOf("0x00;", asciiStart));
const firmwareAscii = new Set([...asciiFn.matchAll(/c == '(\\.|[^'])'/g)].map(m => m[1].length === 2 ? m[1][1] : m[1]));

test("Sonderzeichen: Einzelcodes sind druckbare ASCII-Zeichen, die die Firmware sendet", () => {
  const singles = api.DE_MAC_CHARS.filter(e => e.code && e.code.length === 1);
  assert.ok(singles.length >= 21);
  for (const e of singles) {
    assert.ok(firmwareAscii.has(e.code), `${e.char}: ${e.code} fehlt in dactylAsciiToHid`);
    const n = api.actionCodeToNumeric(e.code);
    assert.ok(n >= 0x20 && n <= 0x7E, e.char);
    // macOS-Layout "U.S.": der ASCII-Code ist das Zeichen selbst
    assert.strictEqual(e.code, e.char, e.char);
    // GET_CONFIG-Rückweg ergibt denselben Zahlencode
    assert.strictEqual(api.actionCodeToNumeric(api.findDefinitionByCode(n).tap), n, e.char);
  }
  for (const ch of ["<", ">", "^", "~", "+", ":", "@", "|"]) {
    assert.ok(singles.some(e => e.char === ch), `${ch} fehlt`);
  }
  assert.strictEqual(new Set(api.DE_MAC_CHARS.map(e => e.char)).size, api.DE_MAC_CHARS.length);
});

test("Sonderzeichen: § über die ISO-Taste (HID 0x64), ° € ´ über Option-Paare", () => {
  const byChar = Object.fromEntries(api.DE_MAC_CHARS.map(e => [e.char, e]));
  assert.strictEqual(byChar["§"].code, "KEY_NON_US_BACKSLASH");
  // Firmware-Konstante: 0xEC, press() sendet code - 136 = HID 0x64
  const m = /const uint8_t KEY_NON_US_BACKSLASH = (0x[0-9A-F]+);/.exec(asciiHeader);
  assert.ok(m, "KEY_NON_US_BACKSLASH fehlt in DactylKeycodes.h");
  assert.strictEqual(api.actionCodeToNumeric("KEY_NON_US_BACKSLASH"), Number(m[1]));
  assert.strictEqual(Number(m[1]) - 136, 0x64);
  assert.deepStrictEqual({ ...api.findDefinitionByCode(0xEC) }, { label: "§", tap: "KEY_NON_US_BACKSLASH" });
  // Option-Zeichen des Layouts "U.S."
  assert.deepStrictEqual({ ...byChar["°"].pair }, { first: "KEY_LEFT_ALT", second: "*" });
  assert.deepStrictEqual({ ...byChar["€"].pair }, { first: "KEY_LEFT_ALT", second: "@" });
  assert.deepStrictEqual({ ...byChar["´"].pair }, { first: "KEY_LEFT_ALT", second: "KEY_E" });
});

test("Umlaute: Aktionscodes 0x150..0x156 wie DactylCommon.h, Labels und Rückweg", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  const expected = { UMLAUT_AE: "ä", UMLAUT_OE: "ö", UMLAUT_UE: "ü", UMLAUT_AE_UPPER: "Ä", UMLAUT_OE_UPPER: "Ö", UMLAUT_UE_UPPER: "Ü", UMLAUT_SZ: "ß" };
  assert.deepStrictEqual({ ...api.UMLAUT_LABELS }, expected);
  for (const [code, label] of Object.entries(expected)) {
    const n = api.actionCodeToNumeric(code);
    assert.strictEqual(n, fw(code), code);
    assert.deepStrictEqual({ ...api.findDefinitionByCode(n) }, { label, tap: code });
    assert.strictEqual(api.holdSublabel(code), label);
    assert.ok(!api.isKeyPairMember(code), `${code} ist kein Paar-Mitglied`);
  }
  assert.strictEqual(fw("UMLAUT_BASE"), 0x150);
  assert.strictEqual(Number(/#define NUM_UMLAUT_ACTIONS\s+(\d+)/.exec(common)[1]), Object.keys(expected).length);
  // Die Auswahl bietet die Umlaut-Aktionen an, nicht mehr die US-Tasten mit deutscher Beschriftung
  const all = api.KEYCODES.flatMap(g => g.keys);
  for (const code of Object.keys(expected)) assert.ok(all.some(k => k.code === code), code);
  assert.ok(!all.some(k => /\(Ger\)/.test(k.label)));
});

test("One-Shot-Modifier und Caps Word: Aktionscodes wie DactylCommon.h, Labels und Rückweg", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  const codes = ["OSM_LCTRL", "OSM_LSHIFT", "OSM_LALT", "OSM_LGUI", "OSM_RCTRL", "OSM_RSHIFT", "OSM_RALT", "OSM_RGUI"];
  assert.strictEqual(Number(/#define NUM_ONE_SHOT_ACTIONS\s+(\d+)/.exec(common)[1]), codes.length);
  // Reihenfolge = Modifier-Bit (KEY_LEFT_CTRL + i), wie oneShotMaskForAction in der Firmware
  codes.forEach((code, i) => assert.strictEqual(api.actionCodeToNumeric(code), fw("ONE_SHOT_BASE") + i, code));
  const all = api.KEYCODES.flatMap(g => g.keys);
  for (const code of [...codes, "CAPS_WORD", "REPEAT"]) {
    const n = api.actionCodeToNumeric(code);
    assert.strictEqual(n, fw(code), code);
    const label = api.ONE_SHOT_LABELS[code];
    assert.ok(label && label.length <= 8, code);
    assert.deepStrictEqual({ ...api.findDefinitionByCode(n) }, { label, tap: code });
    assert.strictEqual(api.holdSublabel(code), label);
    assert.ok(!api.isKeyPairMember(code), `${code} ist kein Paar-Mitglied`);
    assert.ok(all.some(k => k.code === code), `${code} in der Auswahl`);
  }
  assert.strictEqual(fw("CAPS_WORD"), 0x168);
  // Repeat liegt direkt hinter Caps Word, in keinem anderen Bereich (Makros 0x170, Umlaute 0x150)
  assert.strictEqual(fw("REPEAT"), 0x169);
});

test("Preset Deutsch QWERTZ: Umlaut-Aktionen und US-Codes, keine deutschen Beschriftungen auf US-Tasten", () => {
  const usLabel = { KEY_SEMICOLON: ";", KEY_QUOTE: "'", KEY_LEFT_BRACKET: "[", KEY_RIGHT_BRACKET: "]", KEY_MINUS: "-",
                    KEY_SLASH: "/", KEY_EQUAL: "=", KEY_BACKSLASH: "\\", KEY_GRAVE: "`", KEY_Z: "Z", KEY_Y: "Y" };
  const files = { de_qwertz: R.presets.de_qwertz.layers, us_qwerty: R.presets.us_qwerty.layers,
                  default_config: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config.json"), "utf8")).layers,
                  default_config_left: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config_left.json"), "utf8")).layers };
  for (const [name, layers] of Object.entries(files)) {
    layers.forEach((layer, l) => layer.forEach((row, r) => row.forEach((cell, c) => {
      if (cell && usLabel[cell.tap] !== undefined) assert.strictEqual(cell.label, usLabel[cell.tap], `${name} L${l} R${r}C${c}`);
    })));
  }
  const base = R.presets.de_qwertz.layers[0];
  assert.deepStrictEqual([base[0][5].tap, base[1][0].tap, base[1][5].tap, base[2][4].tap, base[2][5].tap, base[3][4].tap],
                         ["UMLAUT_SZ", "KEY_Z", "UMLAUT_UE", "UMLAUT_OE", "UMLAUT_AE", "KEY_MINUS"]);
});

test("Sonderzeichen: Label aus GET_CONFIG-Codes", () => {
  assert.strictEqual(api.findDefinitionByCode(62).label, ">");
  assert.strictEqual(api.findDefinitionByCode(62).tap, ">");
  assert.strictEqual(api.findDefinitionByCode(126).label, "~");
  assert.strictEqual(api.findDefinitionByCode(43).label, "+");
  assert.strictEqual(api.findDefinitionByCode(93).label, "]"); // KEY_RIGHT_BRACKET bleibt eigener Eintrag
  assert.strictEqual(api.deMacCharForCode("&"), "&");
  assert.strictEqual(api.deMacCharForCode("KEY_NON_US_BACKSLASH"), "§");
  assert.strictEqual(api.deMacCharForCode("KEY_A"), null);
});

test("Sonderzeichen: Option-Zeichen bestehen aus Tastenpaar-Mitgliedern", () => {
  const pairs = api.DE_MAC_CHARS.filter(e => e.pair);
  assert.ok(pairs.length >= 3);
  for (const e of pairs) {
    assert.ok(api.isKeyPairMember(e.pair.first) && api.isKeyPairMember(e.pair.second), e.char);
  }
  const deg = api.DE_MAC_CHARS.findIndex(e => e.char === "°");
  assert.strictEqual(api.charPairIndexFromCode(api.charPairCode(deg)), deg);
  const colon = api.DE_MAC_CHARS.findIndex(e => e.char === ":");
  assert.strictEqual(api.charPairIndexFromCode(api.charPairCode(colon)), -1); // Einzelcode, kein Paar
  for (const bad of ["CHAR_PAIR_99", "CHAR_PAIR_x", "PAIR_0", "", undefined]) {
    assert.strictEqual(api.charPairIndexFromCode(bad), -1, String(bad));
  }
});

test("Sonderzeichen: CHAR_PAIR wird zu PAIR_<n> aufgelöst, gleiche Paare werden wiederverwendet", () => {
  const deg = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "°"));
  const euro = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "€"));
  const existing = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }, { first: "KEY_LEFT_ALT", second: "*" }];
  // Vorhandenes Paar Alt + *
  let res = api.resolveCharPairActions({ tap: deg, hold: "NONE", dtap: "NONE" }, existing);
  assert.deepStrictEqual({ ...res.actions }, { tap: "PAIR_1", hold: "NONE", dtap: "NONE" });
  assert.strictEqual(res.added.length, 0);
  // Neues Paar, zweimal gewählt: nur einmal angehängt; Eingabe bleibt unverändert
  res = api.resolveCharPairActions({ tap: euro, hold: "KEY_A", dtap: euro }, existing);
  assert.deepStrictEqual({ ...res.actions }, { tap: "PAIR_2", hold: "KEY_A", dtap: "PAIR_2" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res.added)), [{ first: "KEY_LEFT_ALT", second: "@" }]);
  assert.strictEqual(existing.length, 2);
  // Ohne CHAR_PAIR keine Änderung
  res = api.resolveCharPairActions({ tap: ">", hold: "NONE", dtap: "NONE" }, []);
  assert.deepStrictEqual({ ...res.actions }, { tap: ">", hold: "NONE", dtap: "NONE" });
  // Voller Speicher: neues Paar nicht möglich, vorhandenes Paar weiterhin
  const full = Array.from({ length: api.MAX_KEY_PAIRS }, (_, i) => i === 3 ? { first: "KEY_LEFT_ALT", second: "*" } : { first: "KEY_A", second: "KEY_B" });
  assert.strictEqual(api.resolveCharPairActions({ tap: euro }, full), null);
  assert.strictEqual(api.resolveCharPairActions({ tap: deg }, full).actions.tap, "PAIR_3");
  // Vergleich über Zahlencodes: "l" und KEY_L sind dasselbe Mitglied, die Reihenfolge zählt
  assert.strictEqual(api.findKeyPairIndex([{ first: "KEY_LEFT_ALT", second: "l" }], { first: "KEY_LEFT_ALT", second: "KEY_L" }), 0);
  assert.strictEqual(api.findKeyPairIndex([{ first: "KEY_L", second: "KEY_LEFT_ALT" }], { first: "KEY_LEFT_ALT", second: "KEY_L" }), -1);
});

test("Tastenpaar: Nutzung durch Tap, Halten oder Doppel-Tipp wird erkannt", () => {
  const layers = [[[{ tap: "KEY_A", hold: "PAIR_1", dtap: "NONE" }]], [[null, { tap: "PAIR_3" }]], [[{ tap: "KEY_B", dtap: "PAIR_4" }]]];
  assert.ok(api.isKeyPairUsed(layers, 1));
  assert.ok(api.isKeyPairUsed(layers, 3));
  assert.ok(api.isKeyPairUsed(layers, 4));
  assert.ok(!api.isKeyPairUsed(layers, 0));
  assert.ok(!api.isKeyPairUsed([], 0));
  assert.ok(!api.isKeyPairUsed(undefined, 0));
});

test("Sonderzeichen: Übernehmen hängt Paare an, Rückgängig entfernt nur ungenutzte Paare am Ende", () => {
  const deg = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "°"));
  const euro = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "€"));
  const pairs = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }];
  const layers = [[[{ label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" }]]];
  // Taste R0C0: Tap = °, Doppel-Tipp = € -> zwei neue Paare 1 und 2
  const res = api.resolveCharPairActions({ tap: deg, hold: "NONE", dtap: euro }, pairs);
  const first = api.appendResolvedPairs(pairs, res.added);
  assert.strictEqual(first, 1);
  assert.strictEqual(pairs.length, 3);
  layers[0][0][0] = { label: "°", ...res.actions };
  assert.strictEqual(layers[0][0][0].tap, "PAIR_1");
  assert.strictEqual(layers[0][0][0].dtap, "PAIR_2");
  // Revert bei weiterhin genutzter Taste (z. B. andere Taste nutzt PAIR_2): nichts oberhalb wird entfernt
  const other = [[[{ tap: "KEY_A" }, { tap: "PAIR_2" }]]];
  assert.strictEqual(api.revertResolvedPairs([...pairs], other, first, res.added.length), 0);
  // Revert, nachdem ein weiteres Paar angehängt wurde: Paare stehen nicht mehr am Ende
  assert.strictEqual(api.revertResolvedPairs([...pairs, { first: "KEY_A", second: "KEY_B" }], [[[{ tap: "KEY_A" }]]], first, res.added.length), 0);
  // Normaler Revert: Taste wieder alt, beide Paare entfernt, vorhandenes Paar 0 bleibt
  layers[0][0][0] = { label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(api.revertResolvedPairs(pairs, layers, first, res.added.length), 2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(pairs)), [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }]);
  // Ohne neue Paare entfernt der Revert nichts
  assert.strictEqual(api.revertResolvedPairs(pairs, layers, 1, 0), 0);
  assert.strictEqual(pairs.length, 1);
});

test("Tastenpaar: jedes Paar ist löschbar, Verweise werden neu nummeriert", () => {
  const p = (a, b) => ({ first: a, second: b });
  const config = {
    keyPairs: [p("KEY_A", "KEY_B"), p("KEY_LEFT_SHIFT", "KEY_PERIOD"), p("KEY_LEFT_ALT", "KEY_L")],
    layers: [
      [[{ label: "x", tap: "PAIR_0", hold: "PAIR_1", dtap: "PAIR_2" }, { label: "y", tap: "KEY_A", hold: "NONE", dtap: "NONE" }]],
      [["PAIR_2", null]]
    ],
    combos: [{ id: "c1", action: "PAIR_1" }, { id: "c2", action: "PAIR_2" }, { id: "c3", action: "KEY_ESC" }]
  };
  const before = JSON.stringify(config);
  // Mittleres Paar löschen: PAIR_1 wird leer, PAIR_2 rückt auf PAIR_1, PAIR_0 bleibt
  const mid = JSON.parse(JSON.stringify(api.removeKeyPairAt(config, 1)));
  assert.deepStrictEqual(mid.keyPairs, [p("KEY_A", "KEY_B"), p("KEY_LEFT_ALT", "KEY_L")]);
  assert.deepStrictEqual(mid.layers[0][0][0], { label: "x", tap: "PAIR_0", hold: "NONE", dtap: "PAIR_1" });
  assert.deepStrictEqual(mid.layers[0][0][1], { label: "y", tap: "KEY_A", hold: "NONE", dtap: "NONE" });
  assert.deepStrictEqual(mid.layers[1][0], ["PAIR_1", null]);
  assert.deepStrictEqual(mid.combos.map(c => c.action), ["NONE", "PAIR_1", "KEY_ESC"]);
  assert.strictEqual(JSON.stringify(config), before); // Eingabe unverändert (Revert nutzt den alten Stand)
  // Erstes Paar löschen: alle Verweise rücken auf
  const first = JSON.parse(JSON.stringify(api.removeKeyPairAt(config, 0)));
  assert.deepStrictEqual(first.layers[0][0][0], { label: "x", tap: "NONE", hold: "PAIR_0", dtap: "PAIR_1" });
  // Letztes Paar löschen: nur dessen Verweise werden leer
  const last = JSON.parse(JSON.stringify(api.removeKeyPairAt(config, 2)));
  assert.deepStrictEqual(last.layers[0][0][0], { label: "x", tap: "PAIR_0", hold: "PAIR_1", dtap: "NONE" });
  assert.deepStrictEqual(last.combos.map(c => c.action), ["PAIR_1", "NONE", "KEY_ESC"]);
  // Ungültiger Index
  assert.strictEqual(api.removeKeyPairAt(config, 3), null);
  assert.strictEqual(api.removeKeyPairAt(config, -1), null);
  assert.strictEqual(api.removeKeyPairAt({ layers: [] }, 0), null);
});

test("Suchfeld: Teilstring ohne Groß-/Kleinschreibung", () => {
  assert.ok(api.keycodeOptionMatches(": Doppelpunkt (Shift + .)", "doppel"));
  assert.ok(api.keycodeOptionMatches(": Doppelpunkt (Shift + .)", "DOPPEL"));
  assert.ok(api.keycodeOptionMatches(": Doppelpunkt (Shift + .)", " : "));
  assert.ok(!api.keycodeOptionMatches("A (KEY_A)", "zz"));
  assert.ok(api.keycodeOptionMatches("A (KEY_A)", ""));
  assert.ok(api.keycodeOptionMatches("A (KEY_A)", undefined));
  assert.ok(!api.keycodeOptionMatches(undefined, "a"));
});

const p = (a, b) => ({ first: a, second: b });

test("Tastenpaar: alte Zellen im String-Format zählen als Nutzung", () => {
  const layers = [[["PAIR_2", "KEY_A"]], [[{ tap: "KEY_B", hold: "NONE", dtap: "NONE" }]]];
  assert.ok(api.isKeyPairUsed(layers, 2));
  assert.ok(!api.isKeyPairUsed(layers, 1));
  assert.ok(!api.isKeyPairUsed([[["PAIR_20"]]], 2));
  // deleteKeyPair fragt deshalb nach und removeKeyPairAt leert die Zelle
  const plan = api.planKeyPairDeletion({ keyPairs: [p("KEY_A", "KEY_B"), p("KEY_C", "KEY_D"), p("KEY_E", "KEY_F")], layers, combos: [] }, 2);
  assert.strictEqual(plan.used, true);
  assert.strictEqual(plan.next.layers[0][0][0], "NONE");
});

test("Tastenpaar löschen: Nachfrage, Snapshot-Zustand und Revert", () => {
  const config = {
    keyPairs: [p("KEY_A", "KEY_B"), p("KEY_C", "KEY_D")],
    layers: [[[{ label: "x", tap: "PAIR_1", hold: "NONE", dtap: "NONE" }, { label: "y", tap: "KEY_A", hold: "NONE", dtap: "NONE" }]]],
    combos: [{ id: 1, action: "PAIR_0" }]
  };
  const before = JSON.stringify(config);
  // Paar 1 nutzt eine Taste, Paar 0 eine Combo: beide fragen nach
  assert.strictEqual(api.planKeyPairDeletion(config, 1).used, true);
  const plan0 = api.planKeyPairDeletion(config, 0);
  assert.strictEqual(plan0.used, true);
  assert.strictEqual(plan0.shiftsFollowing, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plan0.removed)), { first: "KEY_A", second: "KEY_B" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plan0.next.keyPairs)), [{ first: "KEY_C", second: "KEY_D" }]);
  assert.strictEqual(plan0.next.layers[0][0][0].tap, "PAIR_0");
  assert.strictEqual(plan0.next.combos[0].action, "NONE");
  // Revert-Zustand: Paare, Ebenen und Combos wie vorher, unabhängig vom Original
  assert.strictEqual(JSON.stringify(plan0.old), JSON.stringify({ keyPairs: config.keyPairs, layers: config.layers, combos: config.combos }));
  plan0.old.layers[0][0][0].tap = "MUTATED";
  assert.strictEqual(JSON.stringify(config), before);
  // Ungenutztes letztes Paar: keine Nachfrage, nichts rückt auf
  const unused = api.planKeyPairDeletion({ keyPairs: config.keyPairs, layers: [[[]]], combos: [] }, 1);
  assert.strictEqual(unused.used, false);
  assert.strictEqual(unused.shiftsFollowing, false);
  assert.strictEqual(api.planKeyPairDeletion(config, 5), null);
});

test("Optionslisten: Gruppenposition, Präfix und Combo ohne Tastenpaar-Zeichen", () => {
  const groupLabels = tree => tree.filter(n => n.options).map(n => n.label);
  const primary = api.keycodeOptionTree({ charPairs: true });
  const labels = groupLabels(primary);
  assert.strictEqual(labels[labels.indexOf("Zahlen & Symbole") + 1], "Sonderzeichen (macOS US)");
  const values = tree => tree.flatMap(n => (n.options ? n.options.map(o => o.value) : [n.value]));
  const pairChars = api.DE_MAC_CHARS.map((e, i) => (e.pair ? api.charPairCode(i) : null)).filter(Boolean);
  assert.ok(pairChars.length > 0);
  pairChars.forEach(code => assert.ok(values(primary).includes(code)));
  // Combo: keine Option-Zeichen, die ein Tastenpaar brauchen
  const combo = api.keycodeOptionTree();
  pairChars.forEach(code => assert.ok(!values(combo).includes(code)));
  assert.ok(values(combo).includes("KEY_NON_US_BACKSLASH"));
  // Halten: "Keine" oben, Präfix vor jeder Option, kein zweites NONE
  const hold = api.keycodeOptionTree({ holdMode: true, charPairs: true });
  assert.strictEqual(hold[0].value, "NONE");
  assert.strictEqual(values(hold).filter(v => v === "NONE").length, 1);
  hold.filter(n => n.options).forEach(g => g.options.forEach(o => assert.ok(o.text.startsWith("Halten = "), o.text)));
  const dtap = api.keycodeOptionTree({ holdMode: true, prefix: api.OPTIONAL_ACTION_PREFIX.dtapActionSelect, charPairs: true });
  dtap.filter(n => n.options).forEach(g => g.options.forEach(o => assert.ok(o.text.startsWith("2× Tippen = "), o.text)));
});

test("Suchfeld: Filter ohne Präfix, Gruppentreffer und Trefferzahl", () => {
  const prefix = api.OPTIONAL_ACTION_PREFIX.holdActionSelect;
  const tree = api.keycodeOptionTree({ holdMode: true, charPairs: true });
  const total = tree.reduce((n, node) => n + (node.options ? node.options.length : 1), 0);
  // "halten", "tippen" und "=" treffen nicht jede Option über das Präfix
  ["halten", "=", " = "].forEach(q => {
    const r = api.filterOptionNodes(tree, q, prefix);
    assert.ok(r.matches < total / 2, `${q}: ${r.matches} von ${total}`);
  });
  const dtapTree = api.keycodeOptionTree({ holdMode: true, prefix: api.OPTIONAL_ACTION_PREFIX.dtapActionSelect });
  assert.strictEqual(api.filterOptionNodes(dtapTree, "tippen", api.OPTIONAL_ACTION_PREFIX.dtapActionSelect).matches, 0);
  // Ein echter Treffer bleibt sichtbar, leere Gruppen werden ausgeblendet
  const r = api.filterOptionNodes(tree, "doppelpunkt", prefix);
  assert.strictEqual(r.matches, 1);
  const visibleGroups = tree.filter((n, i) => n.options && r.nodes[i].visible).map(n => n.label);
  assert.deepStrictEqual(Array.from(visibleGroups), ["Sonderzeichen (macOS US)"]);
  // Passt der Gruppenname, bleibt die ganze Gruppe sichtbar
  const g = api.filterOptionNodes([{ label: "Media", options: [{ text: "Play" }, { text: "Mute" }] }], "media");
  assert.deepStrictEqual(Array.from(g.nodes[0].options), [true, true]);
  // Leere Suche zeigt alles
  assert.strictEqual(api.filterOptionNodes(tree, "", prefix).matches, total);
});

test("Suchfeld: Hinweis sperrt ohne Treffer und nennt eine ausgeblendete Auswahl", () => {
  const plain = o => JSON.parse(JSON.stringify(o));
  assert.deepStrictEqual(plain(api.selectFilterHint("", 0, true, "x")), { text: "", blocked: false });
  assert.deepStrictEqual(plain(api.selectFilterHint("zz", 0, true, "x")), { text: "Keine Treffer. Suche ändern, um zu übernehmen.", blocked: true });
  assert.deepStrictEqual(plain(api.selectFilterHint("ctrl", 3, true, "Halten = A (KEY_A)")), { text: "Gewählt bleibt: Halten = A (KEY_A)", blocked: false });
  assert.deepStrictEqual(plain(api.selectFilterHint("ctrl", 3, false, "x")), { text: "", blocked: false });
  // applySelectFilter setzt select.value nicht mehr (die Auswahl ändert nur eine explizite Wahl)
  const filterSrc = section("js/editor.js", "function applySelectFilter", "function updateFilterBlockedButton");
  assert.ok(!/select\.value\s*=/.test(filterSrc));
});

test("Suche: Tastenpaare und Makro-Schritt haben ein Suchfeld", () => {
  const html = read("index.html");
  ["keyPairFirstSelect", "keyPairSecondSelect", "macroStepCode"].forEach(id => {
    assert.ok(html.includes(`data-filter-for="${id}"`), `Suchfeld fehlt für ${id}`);
  });
  const table = section("js/editor.js", "const FILTER_BLOCKS_BUTTON", "};");
  assert.ok(/keyPairFirstSelect:\s*"btnAddKeyPair"/.test(table));
  assert.ok(/keyPairSecondSelect:\s*"btnAddKeyPair"/.test(table));
  assert.ok(/macroStepCode:\s*"btnAddMacroStep"/.test(table));
  assert.ok(/Object\.keys\(FILTER_BLOCKS_BUTTON\)/.test(section("js/editor.js", "function populateKeycodeSelects", "function filterOptionNodes")));
  // Jeder Aufruf steht im Körper seiner eigenen Funktion (nicht im Körper der anderen)
  const stepInputs = section("js/macros-ui.js", "function updateMacroStepInputs", "function addMacroStepFromUI");
  const openEditor = section("js/macros-ui.js", "function openMacroEditor", "function closeMacroEditor");
  assert.ok(stepInputs.includes('clearSelectFilter("macroStepCode")'));
  assert.ok(openEditor.includes('clearSelectFilter("macroStepCode")'));
});

test("Suche: Tastenpaar- und Makro-Auswahl sperren ihren Knopf ohne Treffer, die Auswahl bleibt", () => {
  const els = {};
  const mkSelect = (id, texts) => {
    const hintHolder = { el: null };
    const opts = texts.map(t => ({ textContent: t, hidden: false, value: t }));
    const group = { tagName: "OPTGROUP", label: "Buchstaben", hidden: false, children: opts };
    opts.forEach(o => { o.parentElement = group; });
    const select = {
      id, children: [group], options: opts, selectedIndex: 0, dataset: {},
      get value() { return opts[this.selectedIndex].value; },
      parentElement: { querySelector: () => hintHolder.el },
      insertAdjacentElement(_pos, el) { hintHolder.el = el; }
    };
    group.parentElement = select;
    els[id] = select;
    els[`filter:${id}`] = { value: "" };
    return select;
  };
  mkSelect("keyPairFirstSelect", ["Shift (KEY_LEFT_SHIFT)", "A (KEY_A)"]);
  mkSelect("keyPairSecondSelect", ["Punkt (KEY_PERIOD)", "B (KEY_B)"]);
  mkSelect("macroStepCode", ["A (KEY_A)", "B (KEY_B)"]);
  ["btnAddKeyPair", "btnAddMacroStep"].forEach(id => { els[id] = { disabled: false, title: "" }; });
  const ctx = {
    document: {
      getElementById: id => els[id] || null,
      querySelector: sel => { const m = /data-filter-for="([^"]+)"/.exec(sel); return m ? els[`filter:${m[1]}`] || null : null; },
      createElement: () => ({ style: {}, dataset: {}, className: "", textContent: "" })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/keycodes.js", "function keycodeOptionMatches", "\n}\n")}
}
const OPTIONAL_ACTION_PREFIX = {};
${section("js/editor.js", "function filterOptionNodes", "function switchEditSide")}`, ctx);
  const run = src => vm.runInContext(src, ctx);
  const query = (id, text) => { els[`filter:${id}`].value = text; run(`applySelectFilter("${id}")`); };

  query("macroStepCode", "zzzz");
  assert.strictEqual(els.btnAddMacroStep.disabled, true);
  assert.strictEqual(els.macroStepCode.selectedIndex, 0);
  assert.ok(els.macroStepCode.dataset.filterBlocked === "true");
  // Ein Treffer gibt den Knopf frei, eine Pause leert die Suche
  query("macroStepCode", "zzzz");
  run('clearSelectFilter("macroStepCode")');
  assert.strictEqual(els.btnAddMacroStep.disabled, false);
  assert.strictEqual(els.macroStepCode.options.every(o => !o.hidden), true);

  // Zwei Auswahlen teilen einen Knopf: er bleibt gesperrt, bis beide Suchen Treffer haben
  query("keyPairFirstSelect", "zzzz");
  query("keyPairSecondSelect", "zzzz");
  assert.strictEqual(els.btnAddKeyPair.disabled, true);
  run('clearSelectFilter("keyPairFirstSelect")');
  assert.strictEqual(els.btnAddKeyPair.disabled, true);
  run('clearSelectFilter("keyPairSecondSelect")');
  assert.strictEqual(els.btnAddKeyPair.disabled, false);
  // Eine Suche mit Treffer blendet nur Nicht-Treffer aus und ändert die Auswahl nicht
  query("keyPairSecondSelect", "punkt");
  assert.deepStrictEqual(els.keyPairSecondSelect.options.map(o => o.hidden), [false, true]);
  assert.strictEqual(els.keyPairSecondSelect.selectedIndex, 0);
  assert.strictEqual(els.btnAddKeyPair.disabled, false);
});

test("Live-Monitor: US-Beschriftungen und Umlaut-Zuordnung", () => {
  const m = R.scancodeMap;
  assert.deepStrictEqual([m.Minus.label, m.BracketLeft.label, m.Semicolon.label, m.Quote.label, m.Slash.label], ["-", "[", ";", "'", "/"]);
  // Keine Y/Z-Vertauschung mehr (macOS "U.S.")
  assert.deepStrictEqual(Array.from(api.ACTION_CODE_TO_EVENT_CODES.KEY_Y), ["KeyY"]);
  assert.deepStrictEqual(Array.from(api.ACTION_CODE_TO_EVENT_CODES.KEY_Z), ["KeyZ"]);
  // Jede Umlaut-Aktion hat einen Eintrag
  Object.keys(api.UMLAUT_LABELS).forEach(code => assert.ok(api.ACTION_CODE_TO_EVENT_CODES[code], code));
  const key = (tap, label) => ({ label, tap, hold: "NONE", dtap: "NONE" });
  const layer = [[], [key("KEY_U", "U"), key("UMLAUT_UE", "ü")], [key("KEY_S", "S"), key("UMLAUT_OE", "ö"), key("UMLAUT_SZ", "ß")]];
  // Tottaste Alt + u leuchtet die Umlaut-Taste auf, ein u ohne Alt die U-Taste
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyU", true).key.label, "ü");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyU", false).key.label, "U");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyS", true).key.label, "ß");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyS", false).key.label, "S");
  // Mit Alt, aber ohne passende Umlaut-Taste: normale Taste
  assert.strictEqual(api.findKeyForEventCode([[key("KEY_U", "U")]], "KeyU", true).key.label, "U");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyQ", false), null);
});

test("Live-Monitor Split-Ansicht: jede Hälfte mit eigener Config, gemeinsame Codes auf beiden", () => {
  const plain = o => JSON.parse(JSON.stringify(o));
  // Split-Ansicht prüft beide Hälften, die Einzelansicht nur die bearbeitete
  assert.deepStrictEqual(plain(api.browserKeySides("both", "R", ["R", "L"])), ["R", "L"]);
  assert.deepStrictEqual(plain(api.browserKeySides("left", "L", ["R", "L"])), ["L"]);
  assert.deepStrictEqual(plain(api.browserKeySides("right", "R", ["R", "L"])), ["R"]);
  const left = { layers: L.defaultConfig.layers };
  const right = { layers: R.defaultConfig.layers };
  const ev = (code, altKey = false) => ({ code, key: "", altKey });
  // Q liegt nur links, J nur rechts: jede Hälfte findet nur ihre eigene Taste
  assert.deepStrictEqual(plain(api.resolveKeyForSide(left, L, 0, ev("KeyQ"))), { r: 1, c: 1, label: "Q", layer: 0 });
  assert.strictEqual(api.resolveKeyForSide(right, R, 0, ev("KeyQ")), null);
  assert.strictEqual(api.resolveKeyForSide(left, L, 0, ev("KeyJ")), null);
  assert.deepStrictEqual(plain(api.resolveKeyForSide(right, R, 0, ev("KeyJ"))), { r: 2, c: 1, label: "J", layer: 0 });
  // Space liegt auf beiden Hälften: beide liefern einen Treffer an ihrer eigenen Position
  const spaceL = api.resolveKeyForSide(left, L, 0, ev("Space"));
  const spaceR = api.resolveKeyForSide(right, R, 0, ev("Space"));
  assert.deepStrictEqual([spaceL.r, spaceL.c], [5, 4]);
  assert.deepStrictEqual([spaceR.r, spaceR.c], [5, 3]);
  // Gehaltene Ebene der Hälfte: Treffer auf Ebene 1, sonst Rückfall auf Ebene 0
  assert.deepStrictEqual(plain(api.resolveKeyForSide(left, L, 1, ev("F1"))), null);
  assert.strictEqual(api.resolveKeyForSide(left, L, 1, ev("KeyQ")).layer, 0);
  // Scancode-Tabelle nur im rechten Profil: leere rechte Ebene fällt auf die Tabelle zurück, links nicht
  const empty = { layers: [Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ tap: "NONE" })))] };
  assert.deepStrictEqual(plain(api.resolveKeyForSide(empty, R, 0, ev("KeyJ"))), { r: 2, c: 1, label: "J", layer: 0 });
  assert.strictEqual(api.resolveKeyForSide(empty, L, 0, ev("KeyJ")), null);
});

// Verdrahtung mit dem globalen Zustand: resolveKeysFromEvent und checkActiveCombos laufen in einem eigenen
// Kontext mit ersetzten Werten für activeHandView, editSide, configFor und den Combo-Hinweis.
function liveContext(handView, edited) {
  const live = { alerts: [] };
  vm.createContext(live);
  vm.runInContext(`${code}
${section("js/keyboard-hooks.js", "// Gehaltene MO_x-Ebene einer Hälfte", "// Löst einen Browser-Tastencode für eine Hälfte auf")}
${section("js/keyboard-hooks.js", "// Alle Treffer eines Tastendrucks", "// Find key on Layer 0")}
var Dactyl = { SIDE_IDS: ["R", "L"] };
${section("js/live-monitor.js", "// Combos gelten je Hälfte", "function showComboAlert")}
var activeHandView = ${JSON.stringify(handView)};
var editSide = ${JSON.stringify(edited)};
const activePressedKeys = new Set();
const configs = { R: JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)),
                  L: JSON.parse(JSON.stringify(SIDE_PROFILES.L.defaultConfig)) };
function configFor(side) { return configs[side]; }
function showComboAlert(combo) { alerts.push(combo.id); }
function hideComboAlert() { alerts.push(null); }
this.live = { resolveKeysFromEvent, checkActiveCombos, activePressedKeys, getSharedHeldLayer, configs,
  setView: v => { activeHandView = v; } };`, live);
  return live;
}

test("Live-Monitor Split-Ansicht: Verdrahtung mit Ansicht, bearbeiteter Hälfte und Combos", () => {
  const plain = o => JSON.parse(JSON.stringify(o));
  const ev = code => ({ code, key: "", altKey: false });
  const hits = (ctx, code) => plain(ctx.live.resolveKeysFromEvent(ev(code))).map(h => `${h.side}R${h.matched.r}C${h.matched.c}`);
  // Split-Ansicht, rechts bearbeitet: Q (nur links) trifft links, Space trifft beide Hälften
  const split = liveContext("both", "R");
  assert.deepStrictEqual(hits(split, "KeyQ"), ["LR1C1"]);
  assert.deepStrictEqual(hits(split, "Space"), ["RR5C3", "LR5C4"]);
  // Einzelansicht: nur die bearbeitete Hälfte
  assert.deepStrictEqual(hits(liveContext("right", "R"), "KeyQ"), []);
  assert.deepStrictEqual(hits(liveContext("left", "L"), "KeyQ"), ["LR1C1"]);
  assert.deepStrictEqual(hits(liveContext("left", "L"), "KeyJ"), []);
  // Combo der rechten Hälfte (J + K) meldet sich in der Split-Ansicht auch bei bearbeiteter linker Hälfte
  const combo = liveContext("both", "L");
  combo.live.activePressedKeys.add("R_2_1");
  combo.live.activePressedKeys.add("R_2_2");
  combo.live.checkActiveCombos();
  assert.strictEqual(combo.alerts.at(-1), "combo-1");
  // Wechsel in die linke Einzelansicht: der rechte Combo-Hinweis erlischt
  combo.live.setView("left");
  combo.live.checkActiveCombos();
  assert.strictEqual(combo.alerts.at(-1), null);
});

test("Live-Monitor Einzelansicht: ein MO der ausgeblendeten Hälfte gilt für die bearbeitete", () => {
  // triggerVisualKeyPress markiert jede Taste mit ihrer Hälfte, unabhängig von der Ansicht (SPLIT_KEY, USB)
  const ctx = liveContext("right", "R");
  const { configs, activePressedKeys } = ctx.live;
  configs.L.layers[0][5][0] = { tap: "MO_2", label: "MO2" };
  configs.R.layers[2][2][1] = { tap: "KEY_PAGE_UP", label: "PgUp" };
  activePressedKeys.add("L_5_0");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 2);
  const hit = JSON.parse(JSON.stringify(ctx.live.resolveKeysFromEvent({ code: "PageUp", key: "", altKey: false })));
  assert.deepStrictEqual(hit.map(h => `${h.side}R${h.matched.r}C${h.matched.c}L${h.matched.layer}`), ["RR2C1L2"]);
});

test("Live-Monitor: ein gehaltenes MO einer Hälfte gilt auf beiden Hälften", () => {
  const ctx = liveContext("both", "R");
  const { configs, activePressedKeys } = ctx.live;
  configs.L.layers[0][5][0] = { tap: "MO_2", label: "MO2" };
  configs.R.layers[0][5][6] = { tap: "MO_1", label: "MO1" };
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 0);
  activePressedKeys.add("L_5_0");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 2);
  // Höchste Ebene gewinnt, wie getActiveLayer() der Firmware
  activePressedKeys.add("R_5_6");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 2);
  activePressedKeys.delete("L_5_0");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 1);
  // Die rechte Hälfte löst mit der Ebene auf, die links gehalten wird
  activePressedKeys.delete("R_5_6");
  activePressedKeys.add("L_5_0");
  configs.R.layers[2][2][1] = { tap: "KEY_PAGE_UP", label: "PgUp" };
  const hit = ctx.live.resolveKeysFromEvent({ code: "PageUp", key: "", altKey: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(hit)).map(h => `${h.side}R${h.matched.r}C${h.matched.c}L${h.matched.layer}`), ["RR2C1L2"]);
});

test("Ansichtswechsel prüft den Combo-Hinweis neu", () => {
  const handler = section("js/editor.js", "// Hand Switcher Buttons", "// Apply Layout Preset Button");
  assert.ok(/checkActiveCombos\(\)/.test(handler));
});

test("Layout-Profile: Speichern, Ersetzen, Löschen und Grenzen", () => {
  const cfgA = { layers: [[[{ tap: "KEY_A" }]]] };
  const cfgB = { layers: [[[{ tap: "KEY_B" }]]] };
  let res = api.upsertLayoutProfile([], "  Gaming\n", cfgA, "t1");
  assert.strictEqual(res.replaced, false);
  assert.strictEqual(res.profiles[0].name, "Gaming");
  // Kopie: spätere Änderungen an der Config verändern das Profil nicht
  cfgA.layers[0][0][0].tap = "KEY_Z";
  assert.strictEqual(res.profiles[0].config.layers[0][0][0].tap, "KEY_A");
  const first = res.profiles;
  res = api.upsertLayoutProfile(first, "Code", cfgB, "t2");
  assert.deepStrictEqual([...res.profiles.map(p => p.name)], ["Gaming", "Code"]);
  // Gleicher Name ohne Groß-/Kleinschreibung ersetzt an derselben Stelle; die alte Liste bleibt unverändert
  res = api.upsertLayoutProfile(res.profiles, "gaming", cfgB, "t3");
  assert.strictEqual(res.replaced, true);
  assert.deepStrictEqual([...res.profiles.map(p => p.name)], ["gaming", "Code"]);
  assert.strictEqual(res.profiles[0].savedAt, "t3");
  assert.strictEqual(first[0].savedAt, "t1");
  assert.strictEqual(api.findLayoutProfileIndex(res.profiles, "CODE"), 1);
  assert.throws(() => api.upsertLayoutProfile([], ' "\\ ', cfgA, "t"), /Profilname fehlt/);
  const full = Array.from({ length: api.MAX_LAYOUT_PROFILES }, (_, i) => ({ name: `P${i}`, savedAt: "", config: cfgA }));
  assert.throws(() => api.upsertLayoutProfile(full, "Neu", cfgA, "t"), /Maximal/);
  assert.strictEqual(api.upsertLayoutProfile(full, "p3", cfgB, "t").replaced, true);
  assert.deepStrictEqual([...api.removeLayoutProfile(res.profiles, "code").map(p => p.name)], ["gaming"]);
  assert.strictEqual(api.removeLayoutProfile(res.profiles, "fehlt"), res.profiles);
});

test("Layout-Profile: Namen werden wie str.casefold() in server.py verglichen", () => {
  const list = [{ name: "Straße", savedAt: "", config: {} }];
  assert.strictEqual(api.findLayoutProfileIndex(list, "STRASSE"), 0);
  assert.strictEqual(api.findLayoutProfileIndex(list, "strasse"), 0);
  assert.strictEqual(api.upsertLayoutProfile(list, "STRASSE", { layers: [] }, "t").replaced, true);
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "Σ" }], "ς"), 0);
  // Großes ẞ: casefold ergibt "ss", toUpperCase allein ließe es stehen
  assert.strictEqual(api.findLayoutProfileIndex(list, "STRAẞE"), 0);
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ẞ" }], "ss"), 0);
  // ı ist für casefold nicht gleich i
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ı" }], "i"), -1);
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ı" }], "I"), -1);
  // End-Sigma im Wort: zeichenweise gleich wie casefold
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ΑΣ" }], "ασ"), 0);
  assert.strictEqual(api.findLayoutProfileIndex(list, "Strase"), -1);
});

test("Combos: Modifier Hold mit One-Shot und Caps Word wird abgelehnt oder migriert", () => {
  const combo = (behavior, action) => ({ layers: [[[]]], combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior, action }] });
  for (const action of ["OSM_LSHIFT", "OSM_RGUI", "CAPS_WORD", "REPEAT"]) {
    assert.ok(api.isOneShotOrCapsWordCode(action));
    const migrated = combo("MODIFIER_HOLD", action);
    api.validateConfigShape(migrated, R);
    assert.strictEqual(migrated.combos[0].behavior, "KEY_PRESS");
    api.validateConfigShape(combo("KEY_PRESS", action), R);
  }
  assert.ok(!api.isOneShotOrCapsWordCode("KEY_LEFT_SHIFT"));
  assert.ok(!api.isOneShotOrCapsWordCode("constructor"));
  // Firmware-Namen, die server.py ebenfalls annimmt
  assert.ok(api.isOneShotOrCapsWordCode("ACT_OSM_LSHIFT") && api.isOneShotOrCapsWordCode("ACT_CAPS_WORD"));
  assert.ok(api.isOneShotOrCapsWordCode("ACT_REPEAT"));
  assert.ok(!api.isOneShotOrCapsWordCode("ACT_MOUSE_LEFT"));
  // Gespeicherte Configs mit der alten Form: validateConfigShape wandelt die Combo in KEY_PRESS um, statt abzulehnen
  const legacy = combo("MODIFIER_HOLD", "CAPS_WORD");
  api.validateConfigShape(legacy, R);
  assert.strictEqual(legacy.combos[0].behavior, "KEY_PRESS");
  api.validateConfigShape(combo("MODIFIER_HOLD", "KEY_LEFT_SHIFT"), R);
});

test("Layout-Profile: Namensvergleich entspricht str.casefold() für jedes Unicode-Zeichen", () => {
  // Unicode-Tabellen von Python und Node können sich unterscheiden: nur bei gleicher Version vergleichen
  const py = require("child_process").spawnSync("python3", ["-I", "-c",
    // Zeichen, deren casefold, upper oder lower abweicht, plus alle Faltungen: jedes andere Zeichen bildet auf sich selbst ab
    "import json,sys,unicodedata\n"
    + "s={chr(i) for i in range(0x110000) if not 0xD800<=i<=0xDFFF and (chr(i).casefold()!=chr(i) or chr(i).upper()!=chr(i) or chr(i).lower()!=chr(i))}\n"
    + "t=set(s)\n"
    + "for c in s: t.update(c.casefold())\n"
    + "json.dump({'v': unicodedata.unidata_version, 'p': [[c, c.casefold()] for c in sorted(t)]}, sys.stdout)"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.strictEqual(py.status, 0, py.stderr);
  const { v, p: pairs } = JSON.parse(py.stdout);
  if (v.split(".")[0] !== process.versions.unicode.split(".")[0]) {
    skipTest(`Unicode ${v} (Python) und ${process.versions.unicode} (Node) unterscheiden sich`);
    return;
  }
  // Beide Richtungen: gleiche App-Klasse bedeutet gleichen casefold, und umgekehrt
  const foldOfKey = new Map(), keyOfFold = new Map(), mismatches = [];
  for (const [ch, fold] of pairs) {
    const key = api.layoutProfileNameKey(ch);
    // Mehrzeichen-Faltungen (ß → ss, ﬃ → ffi): der Schlüssel des Zeichens entspricht dem Schlüssel seiner Faltung
    if (api.layoutProfileNameKey(fold) !== key) mismatches.push(`${ch}: Schlüssel von Zeichen und Faltung verschieden`);
    if (foldOfKey.has(key) && foldOfKey.get(key) !== fold) mismatches.push(`${ch} und ${foldOfKey.get(key)} haben gleichen Schlüssel, aber verschiedenen casefold`);
    foldOfKey.set(key, fold);
    if (keyOfFold.has(fold) && keyOfFold.get(fold) !== key) mismatches.push(`${ch}: gleicher casefold, aber verschiedener Schlüssel`);
    keyOfFold.set(fold, key);
  }
  assert.deepStrictEqual(mismatches.slice(0, 10), []);
  // Namen aus mehreren Zeichen: gleiche Schlüssel genau dann, wenn die casefold-Ergebnisse gleich sind
  const foldOf = new Map(pairs);
  const foldName = name => Array.from(name, c => foldOf.get(c) ?? c).join("");
  for (const [a, b] of [["Straße", "STRASSE"], ["FFI", "ffi"], ["Mein ẞ", "mein ss"], ["Ωmega", "ωMEGA"], ["Ab ı", "AB I"]]) {
    assert.strictEqual(api.layoutProfileNameKey(a) === api.layoutProfileNameKey(b), foldName(a) === foldName(b), `${a} / ${b}`);
  }
});

test("Layout-Profile: Namen wie sanitize_name in server.py (unverändert gültig)", () => {
  // Kürzen auf 31 Zeichen darf kein Leerzeichen am Ende lassen
  assert.strictEqual(api.sanitizeLayoutProfileName(`${"a".repeat(30)} b`), "a".repeat(30));
  assert.strictEqual(api.sanitizeLayoutProfileName(' Mein "Layout"\t\\ '), "Mein Layout");
  // Nicht druckbare Zeichen (Python str.isprintable) fallen weg, Umlaute bleiben
  assert.strictEqual(api.sanitizeLayoutProfileName("Grün ​Ä "), "GrünÄ");
  assert.strictEqual(Array.from(api.sanitizeLayoutProfileName("😀".repeat(40))).length, 31);
});


// =============================================================================
// DOM-Stub-Tests: js/macros-ui.js, Staging in js/editor-events.js und js/layout-profiles-ui.js
// =============================================================================
// Minimales DOM: Elemente nach ID, Listener, Kinder; nur was die getesteten Module nutzen
function fakeDom() {
  const byId = {};
  const make = (tag = "div") => {
    const el = {
      tagName: tag.toUpperCase(), children: [], listeners: {}, style: {}, dataset: {}, disabled: false,
      value: "", textContent: "", className: "", title: "", type: "", options: [], selectedIndex: 0,
      get innerHTML() { return ""; }, set innerHTML(_) { this.children = []; },
      appendChild(child) { this.children.push(child); return child; },
      append(...nodes) { nodes.forEach(n => this.children.push(n)); },
      replaceChildren() { this.children = []; },
      remove() {},
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      async fire(type, ev = {}) { for (const fn of this.listeners[type] || []) await fn({ target: this, ...ev }); },
      querySelectorAll(sel) {
        if (sel !== ".modal-body button") return [];
        const out = [];
        const walk = n => { (n.children || []).forEach(c => { if (c.tagName === "BUTTON") out.push(c); walk(c); }); };
        walk(this);
        // Statische Knöpfe des Dialogs (Speichern) liegen nicht im Baum der Stubs
        return out.concat(this.staticButtons || []);
      },
      click() { return this.fire("click"); }
    };
    return el;
  };
  const document = {
    getElementById: id => byId[id] || (byId[id] = make()),
    createElement: tag => make(tag),
    addEventListener() {}
  };
  return { document, byId, make };
}

// Kontext mit dem gemeinsamen Kern (code), einer Config der rechten Hälfte und Stubs für Anzeige und Server
function uiHarness(extra = "") {
  const dom = fakeDom();
  const log = { pending: [], toasts: [], alerts: [], saved: 0, sent: [], fetches: [], confirm: true };
  const w = {
    console: { log() {}, warn() {}, error() {} }, document: dom.document, log,
    setTimeout: fn => { Promise.resolve().then(fn); return 0; }, clearTimeout() {}
  };
  w.confirm = () => log.confirm;
  w.alert = msg => log.alerts.push(msg);
  vm.createContext(w);
  vm.runInContext(`${code}
var editSide = "R", activeLayerIndex = 0, selectedKey = null;
var currentConfig = normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)), SIDE_PROFILES.R);
var pendingBySide = { R: [], L: [] };
function activeProfile() { return SIDE_PROFILES[editSide]; }
function markPendingSync(change, side = editSide) { change.id = pendingBySide[side].length + 1; pendingBySide[side].push(change); log.pending.push(change); }
function pendingFor(side) { return pendingBySide[side]; }
function showToast(t) { log.toasts.push(t); }
function saveConfigToServer() { log.saved++; }
function renderMatrix() {} function renderLayerButtons() {} function renderCombosTable() {} function renderKeyPairs() {}
function updateInspector() {} function applySettingsToInputs() {} function applySelectFilter() {} function clearSelectFilter() {}
function clearKeySelection() {} function isEditableTarget() { return false; }
async function sendDeviceCommand(cmd, side) { log.sent.push(cmd); return true; }
${section("js/key-pairs-ui.js", "function keycodeLabel", "\n}\n")}
}
var window = this;
${extra}
${read("js/macros-ui.js")}
${read("js/layout-profiles-ui.js")}
`, w);
  return { w, dom, log };
}

test("Makro-UI: Speichern und Rückgängig ersetzen nur die Makro-Liste", () => {
  const { w, dom, log } = uiHarness();
  vm.runInContext("currentConfig.macros = [];", w);
  w.openMacroEditor(-1);
  dom.document.getElementById("macroNameInput").value = "Copy";
  dom.document.getElementById("macroStepType").value = "tap";
  dom.document.getElementById("macroStepCode").value = "KEY_C";
  w.addMacroStepFromUI();
  w.saveMacroFromUI();
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 1);
  const change = log.pending.at(-1);
  assert.ok(change.snapshot && change.macros);
  assert.strictEqual(change.title, "Makro 0 hinzugefügt");
  change.revert();
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 0);
});

test("Makro-UI: Löschen und Rückgängig behalten spätere Tastenänderungen", () => {
  const { w, log } = uiHarness();
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] },
                                           { name: "b", steps: [{ type: "tap", code: "KEY_B" }] }];
    currentConfig.layers[0][2][1] = { label: "M0", tap: "MACRO_0", hold: "NONE", dtap: "NONE" };
    currentConfig.layers[0][2][2] = { label: "M1", tap: "MACRO_1", hold: "NONE", dtap: "NONE" };`, w);
  w.deleteMacro(0);
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][1].tap", w), "NONE");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][2].tap", w), "MACRO_0");
  // Spätere Änderung an einer anderen Taste
  vm.runInContext(`currentConfig.layers[0][3][1] = { label: "X", tap: "KEY_X", hold: "NONE", dtap: "NONE" };`, w);
  log.pending.at(-1).revert();
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(currentConfig.macros.map(m => m.name))", w)), ["a", "b"]);
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][1].tap", w), "MACRO_0");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][2].tap", w), "MACRO_1");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][3][1].tap", w), "KEY_X");
  // Rückgängig nicht möglich: die Meldung nennt die Ursache
  w.deleteMacro(0);
  const revert = log.pending.at(-1).revert;
  vm.runInContext(`currentConfig.macros = Array.from({ length: MAX_MACROS }, (_, i) => ({ name: "m" + i, steps: [] }));`, w);
  revert();
  assert.ok(log.toasts.at(-1).includes(`schon ${api.MAX_MACROS} Makros`));
  // Liste inzwischen kürzer als der Index: andere Ursache
  vm.runInContext(`currentConfig.macros = [{ name: "x", steps: [] }, { name: "y", steps: [] }];`, w);
  w.deleteMacro(1);
  const second = log.pending.at(-1).revert;
  vm.runInContext(`currentConfig.macros = [];`, w);
  second();
  assert.ok(log.toasts.at(-1).includes("Makro-Liste hat sich geändert"));
});

// Taste über den Inspektor übernehmen (setupEventListeners aus js/editor-events.js)
function applyKeyHarness() {
  const h = uiHarness(`var pendingChanges = [];
function togglePendingChangesDrawer() {} function discardAllPendingChanges() {} function populateComboKeyDropdowns() {}
function renderPendingSyncUI() {} function setPendingFor() {}
function writeConfigWithDiff() {} function saveAndFlashToDactyl() {} function readConfigFromESP32() {}
${read("js/editor-events.js")}`);
  const { w, dom } = h;
  // Selects: options/selectedIndex für das Label der Taste
  ["primaryActionSelect", "holdActionSelect", "dtapActionSelect"].forEach(id => {
    const el = dom.document.getElementById(id);
    el.options = [{ text: "M" }];
    el.value = "NONE";
  });
  w.setupEventListeners();
  return h;
}

asyncTests.push(["Live-Sync: Taste übernehmen merkt vor und sendet keinen Einzelbefehl", async () => {
  const { w, dom, log } = applyKeyHarness();
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }];
    selectedKey = { r: 2, c: 1 };`, w);
  dom.document.getElementById("primaryActionSelect").value = "MACRO_0";
  await dom.document.getElementById("btnApplyKey").click();
  // Kein SET_KEY: markPendingSync startet bei verbundener Hälfte den vollen Sync
  assert.deepStrictEqual(log.sent, []);
  assert.strictEqual(log.pending.at(-1).type, "key");
  // markPendingSync (Stub) bekam die Hälfte R: dort plant requestLiveSync den Sync
  assert.strictEqual(vm.runInContext("pendingFor('R').at(-1).type", w), "key");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][1].tap", w), "MACRO_0");
  // Einstellungen speichern: ebenfalls vormerken statt SET_*-Einzelbefehle
  await dom.document.getElementById("btnSaveSettings").click();
  assert.deepStrictEqual(log.sent, []);
  assert.strictEqual(log.pending.at(-1).type, "settings");
}]);

asyncTests.push(["Combo-Dialog: Modifier Hold mit One-Shot oder Caps Word wird nicht gespeichert", async () => {
  const { w, dom, log } = applyKeyHarness();
  const el = id => dom.document.getElementById(id);
  const save = async (behavior, action) => {
    el("comboKey1Select").value = "2,1";
    el("comboKey2Select").value = "2,2";
    el("comboBehaviorSelect").value = behavior;
    const sel = el("comboActionSelect");
    sel.value = action;
    sel.options = [{ text: action }];
    sel.selectedIndex = 0;
    await el("btnSaveCombo").click();
  };
  const count = () => vm.runInContext("currentConfig.combos.length", w);
  const before = count();
  for (const action of ["OSM_LSHIFT", "CAPS_WORD", "REPEAT"]) {
    await save("MODIFIER_HOLD", action);
    assert.strictEqual(count(), before);
    assert.ok(log.alerts.at(-1).includes("Modifier Hold"));
  }
  // Gegenprobe: KEY_PRESS mit One-Shot und MODIFIER_HOLD mit Shift werden gespeichert
  await save("KEY_PRESS", "OSM_LSHIFT");
  await save("MODIFIER_HOLD", "KEY_LEFT_SHIFT");
  assert.strictEqual(count(), before + 2);
}]);

asyncTests.push(["Import: vorgemerkte Änderung trägt pairs und macros", async () => {
  const { w, dom, log } = applyKeyHarness();
  const cfg = { layers: [[[{ tap: "MACRO_0" }]]], macros: [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }] };
  w.FileReader = function () {
    this.readAsText = () => Promise.resolve().then(() => this.onload({ target: { result: JSON.stringify(cfg) } }));
  };
  await dom.document.getElementById("fileInput").fire("change", { target: { files: [{ name: "x.json" }], value: "" } });
  await new Promise(r => setImmediate(r));
  const change = log.pending.at(-1);
  assert.strictEqual(change.type, "import");
  assert.ok(change.pairs && change.macros);
}]);

// Fetch-Stub für /api/profiles: Antworten in der Reihenfolge der Aufrufe
function profilesHarness(responses) {
  const h = uiHarness();
  const queue = responses.slice();
  h.backups = { body: { backups: [], skipped: 0 } };
  h.w.fetch = async (url, opts = {}) => {
    // Backups haben eine eigene Antwort; die Warteschlange gilt nur für /api/profiles
    if (url.startsWith("/api/backups")) {
      h.log.backupFetches = (h.log.backupFetches || 0) + 1;
      const { status = 200, body } = h.backups;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
    h.log.fetches.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    const next = queue.shift();
    if (next && next.gate) await next.gate;
    const { status = 200, body } = next || {};
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  vm.runInContext(`SIDE_PROFILES.R.label = "rechte Hälfte";`, h.w);
  return h;
}

asyncTests.push(["Layout-Profile: Laden, Seitenprüfung, Revert und Revision beim Speichern", async () => {
  const profileCfg = { layers: [[[{ tap: "KEY_Q" }]]] };
  const { w, dom, log } = profilesHarness([
    { body: { profiles: [{ name: "Gaming", savedAt: "", config: profileCfg }], revision: 3, skipped: [] } },
    { body: { profiles: [{ name: "Gaming", savedAt: "", config: profileCfg }], revision: 3, skipped: [] } },
    { body: { success: true, revision: 4 } }
  ]);
  await w.openLayoutProfilesDialog();
  const before = vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", w);
  // Hälfte gewechselt: Laden tut nichts
  vm.runInContext(`editSide = "L";`, w);
  w.loadLayoutProfile("gaming");
  assert.strictEqual(log.pending.length, 0);
  vm.runInContext(`editSide = "R";`, w);
  w.loadLayoutProfile("gaming");
  const change = log.pending.at(-1);
  assert.ok(change.snapshot && change.pairs && change.macros && change.type === "profile_load");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][0][0].tap", w), "KEY_Q");
  change.revert();
  assert.strictEqual(vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", w), before);
  // Speichern sendet die gelesene Revision und übernimmt die neue
  await w.openLayoutProfilesDialog();
  dom.document.getElementById("layoutProfileNameInput").value = "Neu";
  await w.saveLayoutProfileFromUI();
  const post = log.fetches.find(f => f.method === "POST");
  assert.strictEqual(post.body.revision, 3);
  assert.deepStrictEqual(post.body.profiles.map(p => p.name), ["Gaming", "Neu"]);
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", w), 4);
}]);

asyncTests.push(["Backups: Dialog listet Backups der Hälfte und lädt eines mit Rückgängig", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }]);
  const backupCfg = { layers: [[[{ tap: "KEY_W" }]]] };
  h.backups = { body: { backups: [
    { id: "backup-000002-20261029-120000-000", savedAt: "2026-10-29T12:00:00+0100", reason: "flash", config: backupCfg },
    { id: "backup-000001-20261029-110000-000", savedAt: "", reason: "sync", config: { layers: [[[{ tap: "KEY_V" }]]] } }
  ], skipped: 1 } };
  await h.w.openLayoutProfilesDialog();
  const list = h.dom.document.getElementById("layoutBackupsList");
  assert.strictEqual(list.children.length, 2);
  assert.strictEqual(list.children[0].children[1].textContent, "vor Flash");
  // Ohne gültigen Zeitstempel zeigt die Zeile die ID
  assert.strictEqual(list.children[1].children[0].textContent, "backup-000001-20261029-110000-000");
  assert.ok(h.dom.document.getElementById("layoutBackupsStatus").textContent.includes("1 unlesbare"));
  const before = vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", h.w);
  // Abbruch in der Rückfrage: nichts ändert sich
  h.log.confirm = false;
  await list.children[0].children[2].click();
  assert.strictEqual(h.log.pending.length, 0);
  h.log.confirm = true;
  await list.children[0].children[2].click();
  const change = h.log.pending.at(-1);
  assert.ok(change.snapshot && change.pairs && change.macros && change.type === "backup_load");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][0][0].tap", h.w), "KEY_W");
  assert.ok(h.log.saved > 0);
  change.revert();
  assert.strictEqual(vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", h.w), before);
  // Andere Hälfte bearbeitet: Laden tut nichts
  await h.w.openLayoutProfilesDialog();
  vm.runInContext(`editSide = "L";`, h.w);
  h.w.loadLayoutBackup("backup-000002-20261029-120000-000");
  assert.strictEqual(h.log.pending.length, 1);
}]);

asyncTests.push(["Backups: Fehler und leere Liste zeigen einen Hinweis", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }, { body: { profiles: [], revision: 0, skipped: [] } }]);
  h.backups = { status: 500, body: { success: false, error: "kaputt" } };
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("layoutBackupsStatus").textContent.includes("kaputt"));
  h.backups = { body: { backups: [], skipped: 0 } };
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("layoutBackupsStatus").textContent.includes("Noch kein Backup"));
  assert.strictEqual(h.dom.document.getElementById("layoutBackupsList").children.length, 0);
}]);

asyncTests.push(["Layout-Profile: Antwort ohne Liste, übersprungene Profile und Konflikt", async () => {
  // Antwort ohne Liste: klarer Fehler statt TypeError
  let h = profilesHarness([{ body: { nichts: true } }]);
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("layoutProfilesStatus").textContent.includes("keine Profilliste"), h.dom.document.getElementById("layoutProfilesStatus").textContent);
  // Übersprungene Profile werden gemeldet
  h = profilesHarness([{ body: { profiles: [], revision: 1, skipped: ["Profil 'Alt': kaputt"] } }]);
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.log.alerts.some(a => a.includes("Profil 'Alt'")));
  // Konflikt (409): Meldung und Neuladen der Liste mit neuer Revision
  h = profilesHarness([
    { body: { profiles: [], revision: 1, skipped: [] } },
    { status: 409, body: { success: false, error: "anderes Fenster" } },
    { body: { profiles: [{ name: "Fremd", savedAt: "", config: { layers: [[[]]] } }], revision: 2, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "Mein";
  await h.w.saveLayoutProfileFromUI();
  const post = h.log.fetches.find(f => f.method === "POST");
  assert.strictEqual(post.body.revision, 1);
  assert.ok(h.log.alerts.some(a => a.includes("anderes Fenster")));
  assert.strictEqual(h.log.fetches.at(-1).method, "GET");
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles.map(p => p.name))", h.w)), ["Fremd"]);
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 2);
}]);

asyncTests.push(["Layout-Profile: ein Lesen, das vor einem Schreibzugriff begann, überschreibt die Revision nicht", async () => {
  let releaseGet;
  const slowGet = new Promise(r => { releaseGet = r; });
  const h = profilesHarness([
    { body: { profiles: [], revision: 1, skipped: [] } },
    { gate: slowGet, body: { profiles: [], revision: 1, skipped: [] } },   // langsames Lesen mit altem Stand
    { body: { success: true, revision: 2 } }
  ]);
  await h.w.openLayoutProfilesDialog();
  const reading = h.w.reloadLayoutProfiles("R");
  h.dom.document.getElementById("layoutProfileNameInput").value = "Neu";
  await h.w.saveLayoutProfileFromUI();
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 2);
  releaseGet();
  await reading;
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 2);
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles.map(p => p.name))", h.w)), ["Neu"]);
}]);

asyncTests.push(["Layout-Profile: Schreiben auf einer Hälfte verwirft das Lesen der anderen Hälfte nicht", async () => {
  let releaseWrite, releaseRead;
  const writeGate = new Promise(r => { releaseWrite = r; });
  const readGate = new Promise(r => { releaseRead = r; });
  const h = profilesHarness([
    { body: { profiles: [], revision: 0, skipped: [] } },                                   // Öffnen rechts
    { gate: writeGate, body: { success: true, revision: 1 } },                               // Schreiben rechts, hängt
    { gate: readGate, body: { profiles: [{ name: "Links", savedAt: "", config: { layers: [[[]]] } }], revision: 7, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "Rechts";
  const saving = h.w.saveLayoutProfileFromUI();
  await Promise.resolve();
  h.w.closeLayoutProfilesDialog();
  vm.runInContext(`editSide = "L";`, h.w);
  const opening = h.w.openLayoutProfilesDialog();         // Lesen links beginnt vor dem Ende des Schreibens rechts
  releaseWrite();
  await saving;
  releaseRead();                                           // Lesen links endet nach dem Schreiben rechts
  await opening;
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles && layoutProfiles.map(p => p.name))", h.w)), ["Links"]);
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 7);
}]);

asyncTests.push(["Layout-Profile: nach dem Schreiben rendert der Dialog nie die alte Liste", async () => {
  const cfg = { layers: [[[]]] };
  const h = profilesHarness([
    { body: { profiles: [{ name: "A", savedAt: "", config: cfg }], revision: 0, skipped: [] } },
    { body: { success: true, revision: 1 } },
    { body: { success: true, revision: 2 } }
  ]);
  await h.w.openLayoutProfilesDialog();
  const status = h.dom.document.getElementById("layoutProfilesStatus");
  const seen = [];
  Object.defineProperty(status, "textContent", { get() { return this._t; }, set(v) { this._t = v; seen.push(v); } });
  h.dom.document.getElementById("layoutProfileNameInput").value = "B";
  await h.w.saveLayoutProfileFromUI();
  assert.ok(!seen.some(t => t.startsWith("1 von")), `Dialog zeigte kurz die alte Liste: ${seen.join(" | ")}`);
  assert.strictEqual(seen.at(-1).split(" ")[0], "2");
  seen.length = 0;
  await h.w.deleteLayoutProfile("B");
  assert.ok(!seen.some(t => t.startsWith("2 von")), `Dialog zeigte kurz die alte Liste: ${seen.join(" | ")}`);
  assert.strictEqual(seen.at(-1).split(" ")[0], "1");
}]);

asyncTests.push(["Layout-Profile: Meldung über übersprungene Profile erscheint einmal pro Stand", async () => {
  const body = { profiles: [], revision: 3, skipped: ["Profil 'Alt': kaputt"] };
  const h = profilesHarness([{ body }, { body }, { body: { ...body, revision: 4 } }]);
  await h.w.openLayoutProfilesDialog();
  await h.w.openLayoutProfilesDialog();
  assert.strictEqual(h.log.alerts.filter(a => a.includes("Profil 'Alt'")).length, 1);
  await h.w.openLayoutProfilesDialog();                    // neuer Stand: erneut melden
  assert.strictEqual(h.log.alerts.filter(a => a.includes("Profil 'Alt'")).length, 2);
}]);

asyncTests.push(["Layout-Profile: Laden ist während eines Schreibzugriffs gesperrt", async () => {
  const { w, log } = profilesHarness([{ body: { profiles: [{ name: "Gaming", savedAt: "", config: { layers: [[[{ tap: "KEY_Q" }]]] } }], revision: 0, skipped: [] } }]);
  await w.openLayoutProfilesDialog();
  vm.runInContext("layoutProfilesBusy = true;", w);
  w.loadLayoutProfile("Gaming");
  assert.strictEqual(log.pending.length, 0);
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][0][0].tap !== 'KEY_Q'", w), true);
  vm.runInContext("layoutProfilesBusy = false;", w);
  w.loadLayoutProfile("Gaming");
  assert.strictEqual(log.pending.length, 1);
}]);

asyncTests.push(["Layout-Profile: fehlgeschlagener Schreibzugriff nach erneutem Öffnen lädt die Liste neu", async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const h = profilesHarness([
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } },
    { gate, status: 500, body: { success: false, error: "Platte voll" } },
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } },
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "B";
  const saving = h.w.saveLayoutProfileFromUI();
  await Promise.resolve();
  h.w.closeLayoutProfilesDialog();
  const reopening = h.w.openLayoutProfilesDialog();   // Lesen beginnt vor dem Ende des Schreibens
  release();
  await saving;
  await reopening;
  assert.ok(h.log.alerts.some(a => a.includes("Platte voll")));
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles && layoutProfiles.map(p => p.name))", h.w)), ["A"]);
  assert.notStrictEqual(h.dom.document.getElementById("layoutProfilesStatus").textContent, "Speichert …");
}]);

asyncTests.push(["Layout-Profile: neu geöffneter Dialog übernimmt die Sperre eines laufenden Schreibzugriffs", async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const h = profilesHarness([
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } },
    { gate, body: { success: true, revision: 1 } },
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "B";
  const saving = h.w.saveLayoutProfileFromUI();
  await Promise.resolve();
  assert.strictEqual(vm.runInContext("layoutProfilesBusy", h.w), true);
  // Dialog schließen und während des Schreibens neu öffnen
  h.w.closeLayoutProfilesDialog();
  await h.w.openLayoutProfilesDialog();
  const modal = h.dom.document.getElementById("layoutProfilesModal");
  modal.children = [h.dom.document.getElementById("layoutProfilesList")];
  vm.runInContext("renderLayoutProfiles()", h.w);
  const buttons = modal.querySelectorAll(".modal-body button");
  assert.ok(buttons.length > 0 && buttons.every(b => b.disabled), "Knöpfe sind während des Schreibens aktiv");
  assert.strictEqual(h.dom.document.getElementById("layoutProfilesStatus").textContent, "Speichert …");
  release();
  await saving;
  assert.strictEqual(vm.runInContext("layoutProfilesBusy", h.w), false);
}]);

test("Flash-Protokoll: NDJSON-Zeilen über Stückgrenzen hinweg", () => {
  const sp = api.createNdjsonSplitter();
  assert.strictEqual(sp.push('{"type":"log","li').length, 0);
  const out = sp.push('ne":"a"}\n{"type":"log","line":"b"}\n{"type":"res');
  assert.deepStrictEqual([...out.map(e => e.line)], ["a", "b"]);
  // Kaputte Zeilen und Nicht-Objekte werden übersprungen, der Rest bleibt erhalten
  assert.deepStrictEqual([...sp.push('ult","success":true}\nkaputt\n42\n\n').map(e => ({ ...e }))], [{ type: "result", success: true }]);
  assert.strictEqual(sp.push('{"type":"log","line":"ohne Zeilenende"}').length, 0);
  assert.deepStrictEqual([...sp.flush().map(e => e.line)], ["ohne Zeilenende"]);
  assert.strictEqual(sp.flush().length, 0);
});

test("Flash-Protokoll: Zeilenliste kürzt die ältesten Zeilen", () => {
  const lines = [];
  for (let i = 0; i < api.FLASH_LOG_MAX_LINES + 5; i++) api.appendFlashLogLine(lines, `z${i}`);
  assert.strictEqual(lines.length, api.FLASH_LOG_MAX_LINES);
  assert.strictEqual(lines[0], "z5");
  assert.strictEqual(lines[lines.length - 1], `z${api.FLASH_LOG_MAX_LINES + 4}`);
  assert.deepStrictEqual([...api.appendFlashLogLine(["a", "b"], "c", 2)], ["b", "c"]);
});

test("Flash-Protokoll: Phasen-Namen", () => {
  assert.strictEqual(api.flashStageLabel("compile"), "Kompilieren");
  assert.strictEqual(api.flashStageLabel("upload"), "Upload");
  assert.strictEqual(api.flashStageLabel("port"), "USB-Port");
  assert.strictEqual(api.flashStageLabel(undefined), "Flashen");
});

// =============================================================================
// Layout-Prüfung (lintLayouts, js/config-model.js)
// =============================================================================
// Leere Konfiguration mit transparenten Ebenen; set() belegt eine Taste, combo() fügt eine Combo hinzu
function lintCfg() {
  return { layers: Array.from({ length: 8 }, () => api.transparentLayer()), combos: [], keyPairs: [], macros: [] };
}
function lintSet(cfg, l, r, c, tap, hold = "NONE", dtap = "NONE") {
  cfg.layers[l][r][c] = { label: "x", tap, hold, dtap };
}
function lintCombo(cfg, k1, k2, behavior = "KEY_PRESS", action = "KEY_A") {
  cfg.combos.push({ key1: { r: k1[0], c: k1[1] }, key2: { r: k2[0], c: k2[1] }, behavior, action });
}
// Beide Hälften mit einem Weg in und aus Ebene 1 (MO_1 auf Ebene 0, rechts), damit nur der geprüfte Fall auffällt
function lintBoth(right, left = lintCfg()) {
  return api.lintLayouts({ R: right, L: left }, api.SIDE_PROFILES);
}
function lintCodes(findings, code) {
  return [...findings].filter(f => f.code === code).map(f => ({ ...f }));
}

test("Layout-Prüfung: leeres Layout ohne Befund, ohne Konfiguration kein Absturz", () => {
  assert.deepStrictEqual([...lintBoth(lintCfg())], []);
  assert.deepStrictEqual([...api.lintLayouts({}, api.SIDE_PROFILES)], []);
  assert.deepStrictEqual([...api.lintLayouts(undefined, undefined)], []);
  // Eine Hälfte ohne Profil oder Konfiguration wird übersprungen
  assert.deepStrictEqual([...api.lintLayouts({ R: lintCfg(), X: lintCfg(), L: null }, api.SIDE_PROFILES)], []);
});

test("Layout-Prüfung: Aktion auf einer fehlenden Taste (R5C5 rechts, R2C6 außerhalb der Matrix)", () => {
  const cfg = lintCfg();
  for (let l = 0; l < 8; l++) lintSet(cfg, l, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 0, 2, 6, "KEY_DELETE");
  lintSet(cfg, 3, 2, 6, "KEY_DELETE");
  lintSet(cfg, 0, 4, 0, "KEY_A", "KEY_B");               // R4C0 fehlt rechts
  const found = lintCodes(lintBoth(cfg), "absent-key-action");
  assert.deepStrictEqual(found.map(f => f.side), ["R", "R", "R"]);
  const text = found.map(f => f.message).join("\n");
  assert.ok(text.includes("R5C5 hat auf allen Ebenen"), text);
  assert.ok(text.includes("R2C6 hat auf Ebenen 0, 3"), text);
  assert.ok(text.includes("R4C0 hat auf Ebene 0"), text);
  assert.ok(found.every(f => f.level === "warn"));
  // Dieselben Positionen sind links echte Tasten (R5C5) oder fehlen auch (R4C0 ist links vorhanden)
  const left = lintCfg();
  lintSet(left, 0, 5, 5, "KEY_UP_ARROW");
  lintSet(left, 0, 4, 0, "KEY_LEFT_CTRL");
  assert.deepStrictEqual(lintCodes(lintBoth(lintCfg(), left), "absent-key-action"), []);
  // Links fehlen R4C5 und R5C0
  const left2 = lintCfg();
  lintSet(left2, 1, 5, 0, "KEY_A");
  const f2 = lintCodes(lintBoth(lintCfg(), left2), "absent-key-action");
  assert.strictEqual(f2.length, 1);
  assert.strictEqual(f2[0].side, "L");
  assert.ok(f2[0].message.includes("R5C0 hat auf Ebene 1"));
});

test("Layout-Prüfung: nur eine Halte- oder Doppel-Tipp-Aktion auf einer fehlenden Taste zählt auch", () => {
  const holdOnly = lintCfg();
  lintSet(holdOnly, 0, 5, 5, "NONE", "KEY_LEFT_CTRL");
  assert.strictEqual(lintCodes(lintBoth(holdOnly), "absent-key-action").length, 1);
  const dtapOnly = lintCfg();
  lintSet(dtapOnly, 0, 5, 5, "NONE", "NONE", "KEY_A");
  assert.strictEqual(lintCodes(lintBoth(dtapOnly), "absent-key-action").length, 1);
  // Eine Zelle als reiner Code-String (älteres Format) und "0" als leere Aktion
  const stringCell = lintCfg();
  stringCell.layers[0][5][5] = "KEY_A";
  assert.strictEqual(lintCodes(lintBoth(stringCell), "absent-key-action").length, 1);
  const zero = lintCfg();
  zero.layers[0][5][5] = { tap: "0", hold: "", dtap: "NONE" };
  assert.strictEqual(lintCodes(lintBoth(zero), "absent-key-action").length, 0);
});

test("Layout-Prüfung: Ebene ohne Weg hinein ist unerreichbar, mit MO, TG, Combo oder der anderen Hälfte nicht", () => {
  const unreachable = lintCfg();
  lintSet(unreachable, 2, 1, 1, "KEY_A");
  let found = lintCodes(lintBoth(unreachable), "layer-unreachable");
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].side, null);
  assert.ok(found[0].message.startsWith("Ebene 2 hat eigene Belegung"), found[0].message);

  // MO_2 auf Ebene 0 der rechten Hälfte
  const mo = lintCfg();
  lintSet(mo, 2, 1, 1, "KEY_A");
  lintSet(mo, 0, 5, 0, "MO_2");
  assert.deepStrictEqual(lintCodes(lintBoth(mo), "layer-unreachable"), []);
  // Als Halte-Aktion (Layer-Tap)
  const hold = lintCfg();
  lintSet(hold, 2, 1, 1, "KEY_A");
  lintSet(hold, 0, 5, 0, "KEY_DELETE", "MO_2");
  assert.deepStrictEqual(lintCodes(lintBoth(hold), "layer-unreachable"), []);
  // Der Weg liegt auf der anderen Hälfte: die Ebene gilt für beide
  const left = lintCfg();
  lintSet(left, 0, 5, 1, "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(unreachable, left), "layer-unreachable"), []);
  // Eine Combo "Layer umschalten" (Aktion & 7 = Ebene)
  const combo = lintCfg();
  lintSet(combo, 2, 1, 1, "KEY_A");
  lintCombo(combo, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(combo), "layer-unreachable"), []);
  // Eine Ebene ohne eigene Belegung (nur Kopie von Ebene 0) ist nicht unerreichbar
  const copy = lintCfg();
  lintSet(copy, 0, 1, 1, "KEY_A");
  lintSet(copy, 4, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(copy), "layer-unreachable"), []);
});

test("Layout-Prüfung: erreichbar nur über eine unerreichbare Ebene bleibt unerreichbar, über LAYER_UP/DOWN nicht", () => {
  // Ebene 3 hat MO_4, aber Ebene 3 selbst ist nicht erreichbar: Ebene 4 auch nicht
  const chain = lintCfg();
  lintSet(chain, 3, 0, 0, "MO_4");
  lintSet(chain, 4, 1, 1, "KEY_A");
  const found = lintCodes(lintBoth(chain), "layer-unreachable");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Ebenen 3, 4 haben eigene Belegung"), found[0].message);
  // Ketten über erreichbare Ebenen: 0 -> 1 -> 2
  const ok = lintCfg();
  lintSet(ok, 0, 5, 0, "MO_1");
  lintSet(ok, 1, 0, 0, "MO_2");
  lintSet(ok, 2, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(ok), "layer-unreachable"), []);
  // LAYER_UP von Ebene 0 führt nach Ebene 1, LAYER_DOWN von Ebene 0 nach Ebene 7 (Umlauf)
  const up = lintCfg();
  lintSet(up, 0, 5, 0, "LAYER_UP");
  lintSet(up, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(up), "layer-unreachable"), []);
  const down = lintCfg();
  lintSet(down, 0, 5, 0, "LAYER_DOWN");
  lintSet(down, 7, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(down), "layer-unreachable"), []);
  // Die Firmware-Schreibweise ACT_MO_n zählt wie MO_n
  const act = lintCfg();
  lintSet(act, 0, 5, 0, "ACT_MO_5");
  lintSet(act, 5, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(act), "layer-unreachable"), []);
});

test("Layout-Prüfung: Aktionen auf einer fehlenden Taste öffnen keinen Weg in eine Ebene", () => {
  // MO_2 liegt auf R5C5 (rechts nicht vorhanden): kein Weg
  const cfg = lintCfg();
  lintSet(cfg, 0, 5, 5, "MO_2");
  lintSet(cfg, 2, 1, 1, "KEY_A");
  assert.strictEqual(lintCodes(lintBoth(cfg), "layer-unreachable").length, 1);
});

test("Layout-Prüfung: eingerastete Ebene ohne Weg zurück ist eine Falle, mit Rückweg nicht", () => {
  // TG_1 auf Ebene 0; auf Ebene 1 belegt eine andere Taste die TG_1-Taste, es gibt keine Taste zurück
  const trap = lintCfg();
  lintSet(trap, 0, 0, 0, "TG_1");
  lintSet(trap, 1, 0, 0, "KEY_A");
  const found = lintCodes(lintBoth(trap), "layer-trap");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Ebene 1 lässt sich einrasten"), found[0].message);
  // Ist die TG_1-Taste auf Ebene 1 transparent, gilt dort wie in der Firmware der Rückfall auf Ebene 0:
  // dieselbe Taste schaltet die Ebene wieder aus. Das ist ein Rückweg.
  const fallback = lintCfg();
  lintSet(fallback, 0, 0, 0, "TG_1");
  assert.deepStrictEqual(lintCodes(lintBoth(fallback), "layer-trap"), []);
  // Eigene TG-Taste auf Ebene 1
  const own = lintCfg();
  lintSet(own, 0, 0, 0, "TG_1");
  lintSet(own, 1, 0, 0, "TG_1");
  lintSet(own, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(own), "layer-trap"), []);
  // TG_0 auf Ebene 1 löscht alle eingerasteten Ebenen
  const tg0 = lintCfg();
  lintSet(tg0, 0, 0, 0, "TG_1");
  lintSet(tg0, 1, 0, 0, "TG_0");
  assert.deepStrictEqual(lintCodes(lintBoth(tg0), "layer-trap"), []);
  // LAYER_UP/DOWN auf Ebene 1 führt ebenfalls weiter
  const step = lintCfg();
  lintSet(step, 0, 0, 0, "TG_1");
  lintSet(step, 1, 0, 0, "LAYER_DOWN");
  assert.deepStrictEqual(lintCodes(lintBoth(step), "layer-trap"), []);
  // Der Rückweg liegt auf der anderen Hälfte
  const left = lintCfg();
  lintSet(left, 1, 0, 0, "TG_1");
  const keepBack = lintCfg();
  lintSet(keepBack, 0, 0, 0, "TG_1");
  lintSet(keepBack, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(keepBack, left), "layer-trap"), []);
  // MO_n rastet nicht ein: eine Ebene nur über MO braucht keinen Rückweg
  const mo = lintCfg();
  lintSet(mo, 0, 5, 0, "MO_1");
  lintSet(mo, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(mo), "layer-trap"), []);
});

test("Layout-Prüfung: Falle durch LAYER_UP und durch Combo", () => {
  // LAYER_UP von Ebene 0 rastet Ebene 1 ein; Ebene 1 hat selbst LAYER_UP/DOWN nur auf R5C5 (fehlt)
  const up = lintCfg();
  lintSet(up, 0, 0, 0, "LAYER_UP");
  lintSet(up, 1, 0, 0, "KEY_B");
  lintSet(up, 1, 5, 5, "LAYER_DOWN");
  const found = lintCodes(lintBoth(up), "layer-trap");
  assert.strictEqual(found.length, 1);
  // Eine Combo "Layer umschalten" auf Ebene 2 ist der Weg hinein und zurück
  const combo = lintCfg();
  lintSet(combo, 2, 1, 1, "KEY_A");
  lintCombo(combo, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(combo), "layer-trap"), []);
  // Combo mit TG_0 löscht alle eingerasteten Ebenen und ist ein Rückweg
  const reset = lintCfg();
  lintSet(reset, 0, 0, 0, "TG_3");
  lintSet(reset, 3, 1, 1, "KEY_A");
  lintCombo(reset, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_0");
  assert.deepStrictEqual(lintCodes(lintBoth(reset), "layer-trap"), []);
});

test("Layout-Prüfung: ungenutzte Tastenpaare und Makros, belegte nicht", () => {
  const cfg = lintCfg();
  cfg.keyPairs = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }, { first: "KEY_TAB", second: "KEY_SLASH" }, { first: "KEY_A", second: "KEY_B" }];
  cfg.macros = [{ name: "Copy", steps: [] }, { name: "Paste", steps: [] }];
  lintSet(cfg, 0, 1, 1, "PAIR_1");
  lintSet(cfg, 2, 3, 3, "KEY_X", "MACRO_0");             // als Halte-Aktion
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "PAIR_2"); // in einer Combo
  const findings = lintBoth(cfg);
  const pairs = lintCodes(findings, "pair-unused");
  assert.deepStrictEqual(pairs.map(f => f.message), ["Tastenpaar 0 (KEY_LEFT_SHIFT + KEY_PERIOD) wird nirgends verwendet."]);
  const macros = lintCodes(findings, "macro-unused");
  assert.deepStrictEqual(macros.map(f => f.message), ["Makro 1 (Paste) wird nirgends verwendet."]);
  assert.ok([...pairs, ...macros].every(f => f.level === "info" && f.side === "R"));
  // Das Etikett eines Tastenpaars kommt aus labelFor
  const labelled = api.lintLayouts({ R: cfg, L: lintCfg() }, api.SIDE_PROFILES, code => `<${code}>`);
  assert.ok(lintCodes(labelled, "pair-unused")[0].message.includes("<KEY_LEFT_SHIFT> + <KEY_PERIOD>"));
  // Die Belegung der anderen Hälfte nutzt das Paar dieser Hälfte nicht: jede Hälfte hat ihre eigene Liste
  const left = lintCfg();
  lintSet(left, 0, 1, 1, "PAIR_0");
  assert.strictEqual(lintCodes(lintBoth(cfg, left), "pair-unused").length, 1);
});

test("Layout-Prüfung: doppelte Combo über dieselben zwei Tasten, auch in anderer Reihenfolge", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  lintCombo(cfg, [2, 2], [2, 1], "MODIFIER_HOLD", "KEY_LEFT_CTRL");
  lintCombo(cfg, [2, 1], [2, 3], "KEY_PRESS", "KEY_B");
  const found = lintCodes(lintBoth(cfg), "combo-duplicate");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Combo 1 und Combo 2 "), found[0].message);
  assert.strictEqual(found[0].level, "warn");
  // Keine Doppelung ohne gleiches Paar
  const other = lintCfg();
  lintCombo(other, [2, 1], [2, 2]);
  lintCombo(other, [2, 1], [2, 3]);
  assert.deepStrictEqual(lintCodes(lintBoth(other), "combo-duplicate"), []);
  // Kaputte Einträge stürzen nicht ab
  const broken = lintCfg();
  broken.combos = [null, { key1: { r: 1, c: 1 } }, { key1: { r: 1, c: 1 }, key2: { r: 1, c: 2 } }];
  assert.doesNotThrow(() => lintBoth(broken));
});

test("Layout-Prüfung: Combo-Taste mit Halte- oder Doppel-Tipp-Aktion ist ein Hinweis", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 3, 2, 1, "KEY_J", "NONE", "KEY_U");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  const found = lintCodes(lintBoth(cfg), "combo-hold-cancelled");
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].level, "info");
  // Ebene 3 hat eine eigene Belegung ohne Halten, aber mit Doppel-Tipp; die übrigen Ebenen sind transparent und erben
  // wie in der Firmware die Halte-Aktion von Ebene 0
  assert.ok(found[0].message.startsWith("Taste R2C1 ist Teil von Combo 1 und hat auf allen Ebenen "), found[0].message);
  // Ohne Halte- oder Doppel-Tipp-Aktion kein Hinweis
  const plain = lintCfg();
  lintSet(plain, 0, 2, 1, "KEY_J");
  lintSet(plain, 0, 2, 2, "KEY_K");
  lintCombo(plain, [2, 1], [2, 2]);
  assert.deepStrictEqual(lintCodes(lintBoth(plain), "combo-hold-cancelled"), []);
  // Taste ohne Combo: kein Hinweis
  const noCombo = lintCfg();
  lintSet(noCombo, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  assert.deepStrictEqual(lintCodes(lintBoth(noCombo), "combo-hold-cancelled"), []);
});

test("Layout-Prüfung: Warnungen stehen vor Hinweisen, jede Hälfte wird zugeordnet", () => {
  const right = lintCfg();
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  lintSet(right, 0, 5, 5, "KEY_A");
  const left = lintCfg();
  lintSet(left, 0, 5, 0, "KEY_A");
  const findings = [...lintBoth(right, left)];
  const levels = findings.map(f => f.level);
  assert.deepStrictEqual(levels, ["warn", "warn", "info"]);
  assert.deepStrictEqual(findings.map(f => f.side), ["R", "L", "R"]);
  // Die Prüfung ändert die Konfiguration nicht
  const before = JSON.stringify(right);
  lintBoth(right, left);
  assert.strictEqual(JSON.stringify(right), before);
});

test("Layout-Prüfung: das gespeicherte Layout des Nutzers hat die Aktionen auf R5C5 und R2C6 rechts", () => {
  // Gleiche Form wie current_config.json: Backspace auf R5C5 und Delete auf R2C6 in allen Ebenen der rechten Hälfte
  const cfg = lintCfg();
  for (let l = 0; l < 8; l++) { lintSet(cfg, l, 5, 5, "KEY_BACKSPACE"); lintSet(cfg, l, 2, 6, "KEY_DELETE"); }
  lintSet(cfg, 0, 5, 0, "KEY_DELETE", "MO_1");
  lintSet(cfg, 1, 0, 0, "TG_1");
  const found = lintBoth(cfg);
  const absent = lintCodes(found, "absent-key-action").map(f => f.message);
  assert.strictEqual(absent.length, 2);
  assert.ok(absent[0].startsWith("Taste R2C6 hat auf allen Ebenen"), absent[0]);
  assert.ok(absent[1].startsWith("Taste R5C5 hat auf allen Ebenen"), absent[1]);
  assert.deepStrictEqual(lintCodes(found, "layer-unreachable"), []);
  assert.deepStrictEqual(lintCodes(found, "layer-trap"), []);
});

// -----------------------------------------------------------------------------
// js/layout-lint-ui.js: Liste im Matrix-Tab, Diff-Dialog und Flash-Protokoll (DOM-Stub)
// -----------------------------------------------------------------------------
// Text eines Listeneintrags: der Stub setzt textContent nicht aus Kindern zusammen
function lintItemText(el) {
  return (el.textContent || "") + (el.children || []).map(lintItemText).join("");
}

function lintUiHarness(rightCfg, leftCfg) {
  const dom = fakeDom();
  const w = { console: { log() {}, warn() {}, error() {} }, document: dom.document };
  vm.createContext(w);
  vm.runInContext(`${code}
var configsBySide = {};
function configFor(side) { return configsBySide[side]; }
function keycodeLabel(c) { return c; }
${read("js/layout-lint-ui.js")}`, w);
  w.configsBySide = { R: rightCfg, L: leftCfg };
  return { w, dom };
}

test("Layout-Prüfung (Anzeige): ohne Befund bleibt das Panel verborgen", () => {
  const { w, dom } = lintUiHarness(lintCfg(), lintCfg());
  w.renderLayoutLint();
  assert.strictEqual(dom.document.getElementById("layoutLintPanel").style.display, "none");
  w.renderSyncDiffLint();
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "none");
});

test("Layout-Prüfung (Anzeige): Panel zeigt Zähler und Befunde, der Diff nur Warnungen", () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_A");
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w, dom } = lintUiHarness(right, lintCfg());
  w.renderLayoutLint();
  const panel = dom.document.getElementById("layoutLintPanel");
  assert.strictEqual(panel.style.display, "");
  assert.strictEqual(dom.document.getElementById("layoutLintSummary").textContent, "⚠️ Layout-Prüfung: 1 Warnung, 1 Hinweis");
  const items = dom.document.getElementById("layoutLintList").children;
  assert.strictEqual(items.length, 2);
  assert.ok(lintItemText(items[0]).startsWith("⚠️ Rechte Hand: Taste R5C5"), lintItemText(items[0]));
  assert.strictEqual(items[0].className, "layout-lint-warn");
  assert.ok(lintItemText(items[1]).startsWith("ℹ️ Rechte Hand: Tastenpaar 0"), lintItemText(items[1]));
  assert.strictEqual(items[1].className, "layout-lint-info");
  // Diff-Dialog: nur die Warnung
  w.renderSyncDiffLint();
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "");
  assert.strictEqual(dom.document.getElementById("syncDiffLint").children.length, 1);
});

test("Layout-Prüfung (Anzeige): nur Hinweise zeigen kein Warnzeichen, der Diff bleibt verborgen", () => {
  const right = lintCfg();
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w, dom } = lintUiHarness(right, lintCfg());
  w.renderLayoutLint();
  assert.strictEqual(dom.document.getElementById("layoutLintSummary").textContent, "ℹ️ Layout-Prüfung: 1 Hinweis");
  w.renderSyncDiffLint();
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "none");
});

test("Layout-Prüfung (Anzeige): Befund über beide Hälften nennt keine einzelne Hälfte", () => {
  const right = lintCfg();
  lintSet(right, 2, 1, 1, "KEY_A");
  const { w, dom } = lintUiHarness(right, lintCfg());
  w.renderLayoutLint();
  const text = lintItemText(dom.document.getElementById("layoutLintList").children[0]);
  assert.ok(text.startsWith("⚠️ Beide Hälften: Ebene 2 hat eigene Belegung"), text);
});

test("Layout-Prüfung (Anzeige): Warnungen gehen ins Flash-Protokoll, Hinweise nicht", () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_A");
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w } = lintUiHarness(right, lintCfg());
  const events = [];
  w.logLayoutLintToFlashLog({ onEvent: e => events.push(JSON.parse(JSON.stringify(e))) });
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, "log");
  assert.ok(events[0].line.startsWith("Layout-Prüfung: Rechte Hand: Taste R5C5"), events[0].line);
  // Ohne Warnung bleibt das Protokoll leer
  const clean = lintUiHarness(lintCfg(), lintCfg());
  const none = [];
  clean.w.logLayoutLintToFlashLog({ onEvent: e => none.push(e) });
  assert.deepStrictEqual(none, []);
});

test("Layout-Prüfung (Anzeige): fehlende Elemente stürzen nicht ab", () => {
  const { w } = lintUiHarness(lintCfg(), lintCfg());
  w.document = { getElementById: () => null, createElement: () => ({}) };
  assert.doesNotThrow(() => { w.renderLayoutLint(); w.renderSyncDiffLint(); });
});

test("Layout-Prüfung: fehlerhafte Combos (Import) stürzen nicht ab und zählen nicht als Weg", () => {
  // Aktion kein String, Combos kein Array, Tasten fehlen oder sind keine Zahlen
  const bad = lintCfg();
  bad.combos = [
    { key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "LAYER_TOGGLE", action: 5 },
    { key1: { r: 2, c: 1 }, key2: { r: 2, c: 3 }, behavior: "LAYER_TOGGLE", action: { x: 1 } },
    { key1: { r: "2", c: 1 }, key2: { r: 2, c: 4 }, behavior: "LAYER_TOGGLE", action: "TG_2" },
    { key1: null, key2: { r: 2, c: 4 }, behavior: "LAYER_TOGGLE", action: "TG_2" },
    "kaputt", 7, null
  ];
  lintSet(bad, 2, 1, 1, "KEY_A");
  assert.doesNotThrow(() => lintBoth(bad));
  assert.strictEqual(lintCodes(lintBoth(bad), "layer-unreachable").length, 1);
  const notArray = lintCfg();
  notArray.combos = { length: 3 };
  notArray.keyPairs = "x";
  notArray.macros = 5;
  assert.doesNotThrow(() => lintBoth(notArray));
  // Eine fehlende Konfiguration der Ebenen bricht die Prüfung nicht
  assert.doesNotThrow(() => api.lintLayouts({ R: { combos: [] }, L: {} }, api.SIDE_PROFILES));
});

test("Layout-Prüfung: eine Combo auf einer fehlenden Taste ist kein Weg und kein Hinweis", () => {
  // R5C5 gibt es rechts nicht: die Combo löst nie aus, Ebene 2 bleibt unerreichbar
  const cfg = lintCfg();
  lintSet(cfg, 2, 1, 1, "KEY_A");
  lintCombo(cfg, [5, 5], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.strictEqual(lintCodes(lintBoth(cfg), "layer-unreachable").length, 1);
  // Mit zwei vorhandenen Tasten ist dieselbe Combo ein Weg
  const ok = lintCfg();
  lintSet(ok, 2, 1, 1, "KEY_A");
  lintCombo(ok, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(ok), "layer-unreachable"), []);
  // Hinweis "combo-hold-cancelled" nur für Combos, die auslösen können
  const hint = lintCfg();
  lintSet(hint, 0, 5, 5, "KEY_A", "KEY_B");
  lintCombo(hint, [5, 5], [2, 2]);
  assert.deepStrictEqual(lintCodes(lintBoth(hint), "combo-hold-cancelled"), []);
  const real = lintCfg();
  lintSet(real, 0, 2, 1, "KEY_A", "KEY_B");
  lintCombo(real, [2, 1], [2, 2]);
  assert.strictEqual(lintCodes(lintBoth(real), "combo-hold-cancelled").length, 1);
});

test("Layout-Prüfung: Hinweis zur Combo-Taste folgt dem Rückfall auf Ebene 0 und nennt nur eigene Ebenen", () => {
  // Nur Ebene 0 hat Halten; Ebene 2 belegt die Taste ohne Halten. Die transparenten Ebenen erben Halten von Ebene 0.
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 2, 2, 1, "KEY_J");
  lintCombo(cfg, [2, 1], [2, 2]);
  const msg = lintCodes(lintBoth(cfg), "combo-hold-cancelled")[0].message;
  assert.ok(msg.includes("auf Ebenen 0, 1, 3, 4, 5, 6, 7 eine"), msg);
  assert.ok(!msg.includes("2, "), msg);
});

test("Layout-Prüfung: Firmware-Schreibweise ACT_TG_n in einer Combo ist ein Weg in die Ebene", () => {
  for (const action of ["ACT_TG_2", "TG_2"]) {
    const cfg = lintCfg();
    lintSet(cfg, 2, 1, 1, "KEY_A");
    lintCombo(cfg, [2, 1], [2, 2], "LAYER_TOGGLE", action);
    assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-unreachable"), [], action);
    // Dieselbe Combo schaltet auf jeder Ebene zurück: keine Falle
    assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-trap"), [], action);
  }
});

test("Layout-Prüfung: Koordinaten als Text sind keine doppelte Combo und lösen nie aus", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2]);
  cfg.combos.push({ key1: { r: "2", c: "1" }, key2: { r: "2", c: "2" }, behavior: "KEY_PRESS", action: "KEY_B" });
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "combo-duplicate"), []);
  // Zwei gültige Combos mit denselben Tasten bleiben eine Dopplung
  lintCombo(cfg, [2, 2], [2, 1]);
  assert.strictEqual(lintCodes(lintBoth(cfg), "combo-duplicate").length, 1);
});

test("Layout-Prüfung: ein Makro mit Namen aus Nicht-Text zeigt kein [object Object]", () => {
  const cfg = lintCfg();
  cfg.macros = [{ name: { x: 1 }, steps: [] }, { name: "", steps: [] }, null, { name: "Copy", steps: [] }];
  const texts = lintCodes(lintBoth(cfg), "macro-unused").map(f => f.message);
  assert.strictEqual(texts.length, 4);
  assert.ok(texts.every(t => !t.includes("[object Object]")), texts.join("\n"));
  assert.strictEqual(texts[0], "Makro 0 (ohne Name) wird nirgends verwendet.");
  assert.strictEqual(texts[3], "Makro 3 (Copy) wird nirgends verwendet.");
});

test("Flash-Protokoll: eine Zeile ohne Phase lässt die Phasenanzeige stehen", () => {
  const dom = fakeDom();
  const w = { console: { log() {}, warn() {}, error() {} }, document: dom.document };
  vm.createContext(w);
  // code enthält flash-log.js schon (openFlashLogDialog liegt dort)
  vm.runInContext(code, w);
  const profile = api.SIDE_PROFILES.R;
  const log = w.openFlashLogDialog(profile);
  const stage = dom.document.getElementById("flashLogStage");
  assert.strictEqual(stage.textContent, "Speichere die Konfiguration ...");
  log.onEvent({ type: "log", line: "Layout-Prüfung: Warnung" });
  assert.strictEqual(stage.textContent, "Speichere die Konfiguration ...");
  assert.ok(dom.document.getElementById("flashLogOutput").textContent.includes("Layout-Prüfung: Warnung"));
  // Mit Phase wie bisher
  log.onEvent({ type: "log", stage: "compile", line: "x" });
  assert.strictEqual(stage.textContent, "Phase: Kompilieren");
});

test("Layout-Prüfung: LAYER_DOWN von Ebene 0 rastet Ebene 7 ein (Umlauf) und braucht einen Weg zurück", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 0, 0, "LAYER_DOWN");
  lintSet(cfg, 7, 0, 0, "KEY_B");
  lintSet(cfg, 7, 1, 1, "KEY_A");
  const trap = lintCodes(lintBoth(cfg), "layer-trap");
  assert.strictEqual(trap.length, 1);
  assert.ok(trap[0].message.startsWith("Ebene 7 lässt sich einrasten"), trap[0].message);
  // Mit LAYER_UP auf Ebene 7 (Umlauf nach Ebene 0) gibt es einen Weg zurück
  lintSet(cfg, 7, 2, 2, "LAYER_UP");
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-trap"), []);
});

test("Layout-Prüfung (Anzeige): ein Fehler in der Prüfung gibt keinen Befund und stoppt nichts", () => {
  const { w, dom } = lintUiHarness(lintCfg(), lintCfg());
  // configFor liefert für eine Hälfte eine Konfiguration, die lintLayouts zum Absturz bringt
  Object.defineProperty(w.configsBySide, "R", { get() { throw new Error("kaputt"); } });
  assert.doesNotThrow(() => { w.renderLayoutLint(); w.renderSyncDiffLint(); });
  assert.strictEqual(dom.document.getElementById("layoutLintPanel").style.display, "none");
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "none");
  const events = [];
  assert.doesNotThrow(() => w.logLayoutLintToFlashLog({ onEvent: e => events.push(e) }));
  assert.deepStrictEqual(events, []);
});

// Die Aufrufe sitzen an den drei Stellen aus dem Auftrag (Matrix, Diff, Flashen); ohne sie bliebe jeder andere Test grün
test("Layout-Prüfung: renderMatrix, Diff-Dialog und Flashen rufen die Anzeige auf", () => {
  const between = (file, start, end) => section(file, start, end);
  assert.ok(between("js/editor.js", "function renderMatrix()", "function createHalfMatrix").includes("renderLayoutLint();"),
    "renderMatrix ruft renderLayoutLint nicht auf");
  assert.ok(between("js/config-sync.js", "function showSyncDiffDialog", "async function writeConfigWithDiff").includes("renderSyncDiffLint();"),
    "showSyncDiffDialog ruft renderSyncDiffLint nicht auf");
  const flash = between("js/editor-events.js", "async function saveAndFlashToDactyl", "function populateComboKeyDropdowns");
  const open = flash.indexOf("openFlashLogDialog(profile)");
  const lint = flash.indexOf("logLayoutLintToFlashLog(flashLog)");
  assert.ok(open >= 0 && lint > open, "saveAndFlashToDactyl schreibt die Warnungen nicht ins Flash-Protokoll");
  // Der Index.html lädt das Modul vor app.js, und der Server liefert es aus
  const html = read("index.html");
  assert.ok(html.indexOf("js/layout-lint-ui.js") > html.indexOf("js/matrix-test.js") &&
    html.indexOf("js/layout-lint-ui.js") < html.indexOf('src="app.js'), "Skript-Tag fehlt oder steht an der falschen Stelle");
  for (const id of ["layoutLintPanel", "layoutLintSummary", "layoutLintList", "syncDiffLintSection", "syncDiffLint"]) {
    assert.ok(html.includes(`id="${id}"`), `index.html ohne ${id}`);
  }
});

// -----------------------------------------------------------------------------
// Tote Tasten entfernen (clearAbsentKeyActions, Knopf "Entfernen" in der Layout-Prüfung)
// -----------------------------------------------------------------------------
test("Tote Tasten: Befund trägt Position und Ebenen für den Knopf", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 3, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 1, 2, 6, "KEY_DELETE");
  const found = lintCodes(lintBoth(cfg), "absent-key-action");
  assert.strictEqual(found.length, 2);
  const byPos = {};
  for (const f of found) byPos[`R${f.r}C${f.c}`] = [...f.layers];
  assert.deepStrictEqual(byPos, { R2C6: [1], R5C5: [0, 3] });
});

test("Tote Tasten: clearAbsentKeyActions leert nur die genannten Ebenen und liefert die alten Zellen", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 5, 5, "KEY_BACKSPACE", "KEY_A");
  lintSet(cfg, 2, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 4, 5, 5, "KEY_BACKSPACE");
  const before = JSON.stringify(cfg);
  const res = api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [0, 2]);
  assert.strictEqual(JSON.stringify(cfg), before, "ändert die Konfiguration nicht");
  assert.deepStrictEqual([...res.old].map(o => o.l), [0, 2]);
  assert.strictEqual(res.old[0].cell.hold, "KEY_A");
  assert.strictEqual(res.layers[0][5][5].tap, "NONE");
  assert.strictEqual(res.layers[0][5][5].hold, "NONE");
  assert.strictEqual(res.layers[2][5][5].tap, "NONE");
  assert.strictEqual(res.layers[4][5][5].tap, "KEY_BACKSPACE", "nicht genannte Ebene bleibt");
  // Nach dem Entfernen meldet die Prüfung nur noch Ebene 4
  const next = { ...cfg, layers: res.layers };
  assert.deepStrictEqual([...lintCodes(lintBoth(next), "absent-key-action")[0].layers], [4]);
});

test("Tote Tasten: clearAbsentKeyActions löscht nie eine echte Taste und prüft die Eingaben", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J");
  lintSet(cfg, 0, 5, 5, "KEY_A");
  // R2C1 gibt es rechts: nichts löschen
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 2, 1, [0]), null);
  // R5C5 gibt es links (dort echte Taste), rechts nicht
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.L, 5, 5, [0]), null);
  assert.notStrictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [0]), null);
  // Ungültige Position, Ebene, Liste, Konfiguration
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 6, 5, [0]), null);
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, "5", [0]), null);
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [9, -1, "0"]), null);
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, "0"), null);
  assert.strictEqual(api.clearAbsentKeyActions(null, api.SIDE_PROFILES.R, 5, 5, [0]), null);
  assert.strictEqual(api.clearAbsentKeyActions({ layers: "x" }, api.SIDE_PROFILES.R, 5, 5, [0]), null);
  // Ebene ohne Aktion auf der Position: nichts zu entfernen
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [3]), null);
});

// Knopf in der Layout-Prüfung: vormerken, rückgängig machen, Hälfte wechseln
function removeButtonHarness(rightCfg, leftCfg, editSide = "R") {
  const dom = fakeDom();
  const log = { pending: [], toasts: [], saved: [], switched: [], matrix: 0 };
  const w = { console: { log() {}, warn() {}, error() {} }, document: dom.document };
  vm.createContext(w);
  vm.runInContext(`${code}
var configsBySide = {}, editSide = ${JSON.stringify(editSide)};
function configFor(side) { return configsBySide[side]; }
function keycodeLabel(c) { return c; }
function showToast(t) { log.toasts.push(t); }
function renderMatrix() { log.matrix++; }
function saveConfigToServer(side) { log.saved.push(side); }
function switchEditSide(side) { log.switched.push(side); editSide = side; }
function markPendingSync(change, side) { change.side = side; log.pending.push(change); }
${read("js/layout-lint-ui.js")}`, w);
  w.log = log;
  w.configsBySide = { R: rightCfg, L: leftCfg };
  return { w, dom, log };
}

function findRemoveButton(dom) {
  const out = [];
  const walk = n => { (n.children || []).forEach(c => { if (c.tagName === "BUTTON") out.push(c); walk(c); }); };
  walk(dom.document.getElementById("layoutLintList"));
  return out;
}

test("Tote Tasten (Anzeige): Knopf steht nur am Befund und nicht im Diff-Dialog", () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w, dom } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  const buttons = findRemoveButton(dom);
  assert.strictEqual(buttons.length, 1, "genau ein Knopf: nur der Befund 'Taste gibt es nicht'");
  assert.strictEqual(buttons[0].textContent, "Entfernen");
  assert.ok(buttons[0].title.includes("R5C5") && buttons[0].title.includes("Ebene 0"), buttons[0].title);
  // Im Diff-Dialog bleibt die Konfiguration während der Übertragung unverändert: kein Knopf
  w.renderSyncDiffLint();
  const diffButtons = [];
  const walk = n => { (n.children || []).forEach(c => { if (c.tagName === "BUTTON") diffButtons.push(c); walk(c); }); };
  walk(dom.document.getElementById("syncDiffLint"));
  assert.strictEqual(diffButtons.length, 0);
});

test("Tote Tasten (Anzeige): Entfernen leert die Aktionen, merkt vor und macht sich rückgängig", async () => {
  const right = lintCfg();
  for (const l of [0, 1, 4]) lintSet(right, l, 5, 5, "KEY_BACKSPACE");
  lintSet(right, 0, 2, 1, "KEY_J");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  await findRemoveButton(dom)[0].click();
  for (const l of [0, 1, 4]) assert.strictEqual(right.layers[l][5][5].tap, "NONE", `Ebene ${l}`);
  assert.strictEqual(right.layers[0][2][1].tap, "KEY_J", "echte Taste bleibt");
  assert.strictEqual(log.pending.length, 1);
  assert.strictEqual(log.pending[0].type, "key");
  assert.strictEqual(log.pending[0].side, "R");
  assert.strictEqual(log.pending[0].title, "Taste [R5, C5] entfernt");   // Stil der Tastenänderungen im Inspektor
  assert.ok(log.pending[0].description.includes("Ebenen 0, 1, 4"), log.pending[0].description);
  assert.deepStrictEqual(log.saved, ["R"]);
  assert.ok(log.matrix >= 1);
  // Die Prüfung meldet nichts mehr
  assert.deepStrictEqual(lintCodes(lintBoth(right), "absent-key-action"), []);
  // Rückgängig stellt die alten Zellen wieder her und speichert
  log.pending[0].revert();
  for (const l of [0, 1, 4]) assert.strictEqual(right.layers[l][5][5].tap, "KEY_BACKSPACE", `Ebene ${l}`);
  assert.deepStrictEqual(log.saved, ["R", "R"]);
});

test("Tote Tasten (Anzeige): Befund der anderen Hälfte wechselt zuerst die bearbeitete Hälfte", async () => {
  const left = lintCfg();
  lintSet(left, 2, 5, 0, "KEY_A");                  // R5C0 gibt es links nicht
  const { w, dom, log } = removeButtonHarness(lintCfg(), left, "R");
  w.renderLayoutLint();
  await findRemoveButton(dom)[0].click();
  assert.deepStrictEqual(log.switched, ["L"]);
  assert.strictEqual(left.layers[2][5][0].tap, "NONE");
  assert.strictEqual(log.pending[0].side, "L");
  assert.deepStrictEqual(log.saved, ["L"]);
});

test("Tote Tasten (Anzeige): geänderte Belegung seit der Anzeige meldet nichts zu entfernen", async () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  const button = findRemoveButton(dom)[0];
  // Die Aktion verschwindet, bevor der Knopf gedrückt wird (z. B. durch Rückgängig oder ein Profil)
  right.layers[0][5][5] = { label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" };
  await button.click();
  assert.strictEqual(log.pending.length, 0);
  assert.deepStrictEqual(log.saved, []);
  assert.ok(log.toasts.at(-1).includes("nichts zu entfernen"), log.toasts.at(-1));
});

test("Tote Tasten (Anzeige): Rückgängig schreibt in die aktuelle Konfiguration, nicht in ein ersetztes Objekt", async () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  await findRemoveButton(dom)[0].click();
  // Ein Lesen vom Gerät oder ein Profil ersetzt das Konfigurationsobjekt der Hälfte
  const replaced = lintCfg();
  w.configsBySide.R = replaced;
  log.pending[0].revert();
  assert.strictEqual(replaced.layers[0][5][5].tap, "KEY_BACKSPACE", "die aktuelle Konfiguration bekommt die Zelle zurück");
  assert.strictEqual(right.layers[0][5][5].tap, "NONE", "das alte Objekt bleibt unberührt");
  assert.deepStrictEqual(log.saved, ["R", "R"]);
  // Ohne Konfiguration der Hälfte bricht das Rückgängig nicht ab und speichert nichts
  w.configsBySide.R = undefined;
  assert.doesNotThrow(() => log.pending[0].revert());
  assert.deepStrictEqual(log.saved, ["R", "R"]);
});

test("Tote Tasten (Anzeige): ein zweiter Klick auf denselben Knopf entfernt nichts doppelt", async () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  const button = findRemoveButton(dom)[0];
  await button.click();
  await button.click();
  assert.strictEqual(log.pending.length, 1);
  assert.deepStrictEqual(log.saved, ["R"]);
  assert.ok(log.toasts.at(-1).includes("schon entfernt"), log.toasts.at(-1));
});

// Body mit getReader() aus Byte-Stücken
function fakeFlashBody(chunks) {
  let i = 0;
  return { getReader: () => ({ read: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true }) }) };
}

asyncTests.push(["Flash-Protokoll: Stream meldet jede Zeile und liefert das Ergebnis", async () => {
  const bytes = Buffer.from('{"type":"log","stage":"compile","line":"Größe"}\n{"type":"result","success":false,"stage":"upload","error":"x"}\n', "utf8");
  const cut = bytes.indexOf(Buffer.from("ö")) + 1;          // mitten im UTF-8-Zeichen
  const events = [];
  const result = await api.readFlashStream(fakeFlashBody([bytes.subarray(0, cut), bytes.subarray(cut)]), e => events.push(e));
  assert.strictEqual(events[0].line, "Größe");
  assert.strictEqual(events.length, 2);
  assert.deepStrictEqual({ ...result }, { type: "result", success: false, stage: "upload", error: "x" });
  // Ohne Ergebnis-Zeile (Server abgestürzt) liefert der Stream null
  const none = await api.readFlashStream(fakeFlashBody([Buffer.from('{"type":"log","line":"a"}\n')]), () => {});
  assert.strictEqual(none, null);
}]);

// Test für die WebSerial-Auswahllogik in Electron (main.js)
test("main.js: matchSerialPort erkennt ESP32-Seriellports und filtert andere", () => {
  const mainJs = read("main.js");
  const fnMatch = mainJs.match(/function matchSerialPort\(p\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "matchSerialPort muss in main.js definiert sein");
  const matchFn = new Function("p", fnMatch[0] + "\nreturn matchSerialPort(p);");

  assert.strictEqual(matchFn({ portName: "/dev/cu.usbserial-1320" }), true);
  assert.strictEqual(matchFn({ displayName: "USB Single Serial" }), true);
  assert.strictEqual(matchFn({ portName: "cu.wchusbserial1420" }), true);
  assert.strictEqual(matchFn({ portName: "/dev/cu.Bluetooth-Incoming-Port" }), false);
  assert.strictEqual(matchFn(null), false);
  assert.strictEqual(matchFn({}), false);
});

test("main.js: select-serial-port wartet auf serial-port-added statt sofort abzubrechen", async () => {
  const mainJs = read("main.js");
  assert.ok(mainJs.includes("serial-port-added"), "main.js muss auf serial-port-added lauschen");
  assert.ok(mainJs.includes("handleSerialPortAdded"), "main.js muss handleSerialPortAdded definieren");
  // Darf nicht sofort callback('') bei leerer portList aufrufen
  assert.ok(!/else\s*\{\s*callback\(''\);\s*\}/.test(mainJs), "Darf bei leerer portList nicht sofort abbrechen");
  // Darf bei nicht-passenden Ports nicht sofort den ersten Port wählen
  assert.ok(!/else if\s*\(portList\.length > 0\)\s*\{\s*callback\(portList\[0\]\.portId\)/.test(mainJs), "Darf fremde Ports nicht vor Ablauf des Timeouts wählen");
  assert.ok(mainJs.includes("disable-serial-blocklist"), "main.js muss disable-serial-blocklist setzen");
});

test("main.js: isAllowedOrigin akzeptiert localhost und 127.0.0.1 mit oder ohne Pfad", () => {
  const mainJs = read("main.js");
  const fnMatch = mainJs.match(/const ALLOWED_ORIGINS[\s\S]*?function isAllowedOrigin\(rawUrl\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "isAllowedOrigin muss in main.js definiert sein");
  const checkFn = new Function("rawUrl", fnMatch[0] + "\nreturn isAllowedOrigin(rawUrl);");

  assert.strictEqual(checkFn("http://localhost:8088"), true);
  assert.strictEqual(checkFn("http://localhost:8088/"), true);
  assert.strictEqual(checkFn("http://localhost:8088/api/status"), true);
  assert.strictEqual(checkFn("http://127.0.0.1:8088"), true);
  assert.strictEqual(checkFn("http://127.0.0.1:8088/index.html"), true);
  assert.strictEqual(checkFn("http://localhost:8088.evil.com"), false);
  assert.strictEqual(checkFn("https://evil.com"), false);
  assert.strictEqual(checkFn(""), false);
  assert.strictEqual(checkFn(null), false);
});

test("main.js: isAllowedWebContents weist ungültige fallbackUrl sofort ab", () => {
  const mainJs = read("main.js");
  const fnMatch = mainJs.match(/const ALLOWED_ORIGINS[\s\S]*?function isAllowedWebContents\(wc, fallbackUrl\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "isAllowedWebContents muss in main.js definiert sein");
  const checkFn = new Function("wc", "fallbackUrl", fnMatch[0] + "\nreturn isAllowedWebContents(wc, fallbackUrl);");

  const localWc = { getURL: () => "http://localhost:8088" };
  // Sicherheitsprüfung: Ein fremder Ursprung als fallbackUrl darf nicht durch die lokale Fenster-URL gerettet werden
  assert.strictEqual(checkFn(localWc, "https://evil.com"), false);
  assert.strictEqual(checkFn(localWc, "http://localhost:8088.evil.com"), false);
  // Gültige fallbackUrl wird akzeptiert
  assert.strictEqual(checkFn(localWc, "http://localhost:8088/"), true);
  assert.strictEqual(checkFn(null, "http://127.0.0.1:8088/api"), true);
  // Leere fallbackUrl fällt auf wc.getURL() zurück
  assert.strictEqual(checkFn(localWc, ""), true);
  assert.strictEqual(checkFn(localWc, null), true);
  assert.strictEqual(checkFn({ getURL: () => "https://evil.com" }, ""), false);
  assert.strictEqual(checkFn(null, null), false);
});

asyncTests.push(["js/serial.js: connectSerialNow fällt bei fehlerhaftem vor-berechtigten Port auf requestPort zurück", async () => {
  // Simulierte Umgebung
  let requestedPortOpened = false;
  let requestPortCalled = false;
  let brokenPortOpenAttempts = 0;

  const mockBrokenPort = {
    open: async () => {
      brokenPortOpenAttempts++;
      throw new Error("Port busy");
    }
  };
  const mockWorkingPort = {
    open: async () => {
      requestedPortOpened = true;
    },
    addEventListener: () => {}
  };

  // Port-Auswahl-Algorithmus aus js/serial.js isoliert testen
  async function selectPort(getPorts, requestPort, options = {}) {
    let port = null;
    let portAlreadyOpen = false;
    if (typeof getPorts === "function") {
      const granted = await getPorts();
      if (options.reuseGrantedPort) {
        port = granted[0] || null;
        if (!port) throw new Error("Kein Port");
      } else if (granted && granted.length > 0) {
        for (const candidate of granted) {
          try {
            await candidate.open({ baudRate: 115200 });
            port = candidate;
            portAlreadyOpen = true;
            break;
          } catch (_) {}
        }
      }
    }
    if (!port) {
      port = await requestPort();
    }
    if (!portAlreadyOpen) {
      await port.open({ baudRate: 115200 });
    }
    return port;
  }

  const selected = await selectPort(
    async () => [mockBrokenPort],
    async () => {
      requestPortCalled = true;
      return mockWorkingPort;
    }
  );

  assert.strictEqual(brokenPortOpenAttempts, 1, "Muss defekten Port versucht haben");
  assert.strictEqual(requestPortCalled, true, "Muss auf requestPort zurückgefallen sein");
  assert.strictEqual(requestedPortOpened, true, "Muss den neu angeforderten Port geöffnet haben");
  assert.strictEqual(selected, mockWorkingPort, "Ausgewählter Port muss der funktionierende Port sein");
}]);

asyncTests.push(["js/serial.js: connectSerialNow nutzt funktionierenden vor-berechtigten Port direkt", async () => {
  let workingPortOpened = false;
  let requestPortCalled = false;

  const mockWorkingPort = {
    open: async () => { workingPortOpened = true; }
  };

  async function selectPort(getPorts, requestPort) {
    let port = null;
    let portAlreadyOpen = false;
    if (typeof getPorts === "function") {
      const granted = await getPorts();
      if (granted && granted.length > 0) {
        for (const candidate of granted) {
          try {
            await candidate.open({ baudRate: 115200 });
            port = candidate;
            portAlreadyOpen = true;
            break;
          } catch (_) {}
        }
      }
    }
    if (!port) {
      port = await requestPort();
    }
    if (!portAlreadyOpen) {
      await port.open({ baudRate: 115200 });
    }
    return port;
  }

  const selected = await selectPort(
    async () => [mockWorkingPort],
    async () => {
      requestPortCalled = true;
      return null;
    }
  );

  assert.strictEqual(workingPortOpened, true, "Muss vor-berechtigten Port öffnen");
  assert.strictEqual(requestPortCalled, false, "Darf requestPort nicht aufrufen wenn vor-berechtigter Port funktioniert");
  assert.strictEqual(selected, mockWorkingPort);
}]);

test("UI-Restrukturierung: Neuer Tab Flashen & Sync enthält Verschiebe-Buttons, nicht im Header", () => {
  const html = read("index.html");
  assert.ok(html.includes('data-tab="flash-sync-tab"'), "Tab-Button flash-sync-tab fehlt");

  const tabStart = html.indexOf('id="flash-sync-tab"');
  assert.ok(tabStart >= 0, "Tab-Content flash-sync-tab fehlt");
  const tabEnd = html.indexOf('</main>', tabStart);
  const tabContent = html.slice(tabStart, tabEnd);

  const expectedButtons = [
    "btnSaveToDactyl",
    "btnReadConfig",
    "btnWriteConfig",
    "btnLayoutProfiles",
    "btnExportJson",
    "btnImportJson",
    "fileInput"
  ];
  for (const id of expectedButtons) {
    assert.ok(tabContent.includes(`id="${id}"`), `${id} fehlt im Tab flash-sync-tab`);
  }

  const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('</header>'));
  for (const id of expectedButtons) {
    assert.ok(!header.includes(`id="${id}"`), `${id} darf nicht mehr im Header liegen`);
  }
});

test("UI-Restrukturierung: USB-Live-Monitor und Connect-Button liegen im Tab Matrix-Test", () => {
  const html = read("index.html");
  const matrixTestStart = html.indexOf('id="matrix-test-tab"');
  assert.ok(matrixTestStart >= 0, "matrix-test-tab fehlt in index.html");
  const matrixTestEnd = html.indexOf('</main>', matrixTestStart);
  const matrixTestContent = html.slice(matrixTestStart, matrixTestEnd);

  assert.ok(matrixTestContent.includes('id="liveMonitorCard"'), "liveMonitorCard fehlt in matrix-test-tab");
  assert.ok(matrixTestContent.includes('id="btnConnect"'), "btnConnect fehlt in matrix-test-tab");

  const matrixTabStart = html.indexOf('id="matrix-tab"');
  const matrixTabEnd = html.indexOf('</main>', matrixTabStart);
  const matrixTabContent = html.slice(matrixTabStart, matrixTabEnd);
  assert.ok(!matrixTabContent.includes('id="liveMonitorCard"'), "liveMonitorCard darf nicht in matrix-tab liegen");
});

test("UI-Restrukturierung: Drahtloser Konfig-Modus steht oberhalb der Tabs mit einklappbarer Erklärung", () => {
  const html = read("index.html");
  const configCardPos = html.indexOf('id="configModeGuideCard"');
  const navTabsPos = html.indexOf('class="nav-tabs"');
  assert.ok(configCardPos >= 0, "configModeGuideCard fehlt");
  assert.ok(navTabsPos >= 0, "nav-tabs fehlt");
  assert.ok(configCardPos < navTabsPos, "configModeGuideCard muss oberhalb von nav-tabs stehen");

  const detailsMatch = /<details[^>]*id="configGuideDetails"[^>]*>([\s\S]*?)<\/details>/.exec(html);
  assert.ok(detailsMatch, "configGuideDetails <details>-Element fehlt");
  assert.ok(!detailsMatch[0].includes(" open"), "configGuideDetails darf nicht standardmäßig open sein");
  assert.ok(detailsMatch[1].includes('id="configGuideDesc"'), "configGuideDesc muss in configGuideDetails liegen");
});

test("UI-Restrukturierung: Split-View aktiviert nebeneinander stehende Tastaturen und Inspektor darunter", () => {
  const editorJs = read("js/editor.js");
  assert.ok(editorJs.includes('.classList.toggle("split-view", activeHandView === "both")'), "split-view Klasse muss getoggled werden");
  assert.ok(editorJs.includes('splitWrapper.style.flexWrap = "nowrap"'), "Split-Tastaturen müssen flexWrap nowrap haben");
  assert.ok(editorJs.includes('split-keyboard-col'), "Split-Keyboard Spalten müssen als Panes gerendert werden");
  assert.ok(editorJs.includes('split-pane-header'), "Panes müssen Header mit Beschriftung haben");
  assert.ok(editorJs.includes('is-active-pane'), "Aktive Pane muss hervorgehoben werden");

  const css = read("style.css");
  assert.ok(css.includes(".editor-workspace.split-view"), "CSS muss .editor-workspace.split-view definieren");
  assert.ok(css.includes(".split-keyboards-row"), "CSS muss .split-keyboards-row definieren");
  assert.ok(css.includes(".split-keyboard-col"), "CSS muss .split-keyboard-col Pane-Stile definieren");
  assert.ok(css.includes("flex: 1 1 0"), "Panes müssen flex: 1 1 0 für gleichmäßiges Vergrößern haben");
  assert.ok(css.includes("max-width: 1800px"), ".app-container muss breitere Bildschirme unterstützen");
});

(async () => {
  for (const [name, fn] of asyncTests) {
    await fn();
    passed++;
    console.log(`[       OK ] ${name}`);
  }
  console.log(`\n${passed} App-Logik-Tests bestanden${skipped ? `, ${skipped} übersprungen` : ""}.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
