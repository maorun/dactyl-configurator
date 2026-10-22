// Unit-Tests für die DOM-freien Hilfsfunktionen in app.js (Action-Codes, Sanitizing, Config-Validierung).
// Ausführen: node tests/test_app_logic.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

// Schneidet die reinen Logik-Abschnitte aus app.js aus (ohne DOM-/Browser-Zugriffe)
function section(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Abschnitt nicht gefunden: ${startMarker}`);
  return src.slice(start, end);
}

const code = [
  section("const DEFAULT_LAYER_NAMES", "// BLE GATT"),
  section("const ACTION_TO_NUMERIC", "// Standard-Konfiguration"),
  section("// Matrix- und Firmware-Grenzen", "// State"),
  section("// Alte Configs speichern Modifier-Halte-Aktionen", "function fillKeycodeSelect")
].join("\n");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${code}
this.api = { keyToNumericActions, sanitizeCommandText, clampSetting, validateConfigShape,
             normalizeConfig, isPhysicalKey, findDefinitionByCode, actionCodeToNumeric, SETTINGS_RANGES,
             LEGACY_HOLD_CODES, normalizeHoldCode, holdSublabel,
             isWiredSwitch, createMatrixTest, markMatrixKeyTested, summarizeMatrixTest,
             MATRIX_ROW_WIRES, MATRIX_COL_WIRES };`, ctx);
const api = ctx.api;

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`[       OK ] ${name}`);
}

test("Mod-Tap: Tap und Hold werden als Zahlencodes gesendet", () => {
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_SPACE", hold: "MOD_LCTRL" }) }, { tapCode: 32, holdCode: 0x80 });
  // Hold ohne Tap wirkt wie eine normale Taste
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "MO_1" }) }, { tapCode: 0x101, holdCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions(undefined) }, { tapCode: 0, holdCode: 0 });
  // Beliebige Halte-Aktion: Tap A / Halten B, Media, Maus, Toggle-Layer
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "KEY_B" }) }, { tapCode: 97, holdCode: 98 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "MEDIA_MUTE" }) }, { tapCode: 97, holdCode: 0x121 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "MOUSE_LEFT" }) }, { tapCode: 97, holdCode: 0x130 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "TG_2" }) }, { tapCode: 97, holdCode: 0x112 });
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
  }));
});

test("Config-Normalisierung: Namen, Einstellungen und Zellen werden bereinigt", () => {
  const n = api.normalizeConfig({
    layers: [[[{ tap: "KEY_A", label: 1 }]]],
    layerNames: ["A\nB"],
    settings: { debounceMs: 0, deviceName: "Dac\"tyl" },
    combos: [{ key1: { r: 9, c: 0 }, key2: { r: 0, c: 0 } }]
  });
  assert.strictEqual(n.layerNames.length, 8);
  assert.strictEqual(n.layerNames[0], "AB");
  assert.strictEqual(n.layerNames[1], "Nav & Pfeile");
  assert.strictEqual(n.settings.debounceMs, 1);
  assert.strictEqual(n.settings.deviceName, "Dactyl");
  assert.strictEqual(n.layers[0][0][0].label, "");
  assert.strictEqual(n.layers[0][0][0].hold, "NONE");
  assert.strictEqual(n.combos.length, 0);
});

test("Physische Tasten: R4C0 und R5C5 existieren nicht", () => {
  assert.ok(!api.isPhysicalKey(4, 0));
  assert.ok(!api.isPhysicalKey(5, 5));
  assert.ok(api.isPhysicalKey(5, 6));
  assert.ok(api.isPhysicalKey(0, 0));
});

test("Matrix-Test: 35 verlötete Schalter (29 Finger + 6 Daumen ohne R4C0/R5C5)", () => {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (api.isWiredSwitch(r, c)) n++;
  assert.strictEqual(n, 35);
  assert.ok(!api.isWiredSwitch(4, 0));
  assert.ok(!api.isWiredSwitch(5, 5));
  assert.ok(!api.isWiredSwitch(0, 6)); // Col 6 nur im Daumen-Cluster
  assert.ok(api.isWiredSwitch(5, 6));
  assert.strictEqual(api.summarizeMatrixTest(api.createMatrixTest()).total, 35);
});

test("Matrix-Test: Tasten werden einmalig und nur innerhalb der Matrix gezählt", () => {
  const t = api.createMatrixTest();
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), true);
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 6, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 1, "1"), false);
  assert.strictEqual(api.summarizeMatrixTest(t).tested, 1);
});

test("Matrix-Test: Zeilen und Spalten ohne Treffer gelten als verdächtig", () => {
  const t = api.createMatrixTest();
  // Ohne Tastendruck keine Verdachtsmeldung
  assert.deepStrictEqual([...api.summarizeMatrixTest(t).suspectRows], []);
  // Alle Tasten außer Row 3 drücken
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (r !== 3) api.markMatrixKeyTested(t, r, c);
  const s = api.summarizeMatrixTest(t);
  assert.deepStrictEqual([...s.suspectRows], [3]);
  assert.deepStrictEqual([...s.suspectCols], []);
  assert.strictEqual(s.tested, 35 - 6);
  // Fehlende Spalte 6 (nur R5C6) wird erkannt
  const t2 = api.createMatrixTest();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) api.markMatrixKeyTested(t2, r, c);
  assert.deepStrictEqual([...api.summarizeMatrixTest(t2).suspectCols], [6]);
});

test("Matrix-Test: Leitungsliste entspricht ROW_PINS/COL_PINS der Firmware", () => {
  const ino = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "dactyl_right.ino"), "utf8");
  const pins = name => ino.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}"))[1].split(",").map(v => Number(v.trim()));
  assert.deepStrictEqual([...api.MATRIX_ROW_WIRES.map(w => w.gpio)], pins("ROW_PINS"));
  assert.deepStrictEqual([...api.MATRIX_COL_WIRES.map(w => w.gpio)], pins("COL_PINS"));
});

console.log(`\n${passed} app.js-Tests bestanden.`);
