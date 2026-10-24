// Unit-Tests für js/side-profiles.js und js/side-state.js: Profile gegen die Firmware-Quellen prüfen.
// Ausführen: node tests/test_side_profiles.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(read("js/side-profiles.js"), ctx);
vm.runInContext(read("js/side-state.js"), ctx);
vm.runInContext(read("js/side-routing.js"), ctx);
const D = ctx.Dactyl;
const { L, R } = D.SIDE_PROFILES;

const leftIno = read("firmware/dactyl_left/dactyl_left.ino");
const leftLogic = read("firmware/dactyl_left/DactylLeftLogic.h");
const rightIno = read("firmware/dactyl_right/dactyl_right.ino");
const logic = read("firmware/dactyl_right/DactylLogic.h");

// Tests laufen nacheinander; async-Tests werden abgewartet, ein Fehler beendet den Lauf mit Exit-Code 1
let passed = 0;
const queue = [];
function test(name, fn) {
  queue.push({ name, fn });
}
async function runAll() {
  for (const { name, fn } of queue) {
    await fn();
    passed++;
    console.log(`[       OK ] ${name}`);
  }
  console.log(`\n${passed} Seitenprofil-Tests bestanden.`);
}

const define = (src, name) => {
  const m = src.match(new RegExp(`#define ${name}\\s+(.+)`));
  assert.ok(m, `#define ${name} fehlt`);
  return m[1].trim().replace(/^"(.*)"$/, "$1");
};
const pins = (src, name) => src.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}"))[1]
  .split(",").map(v => Number(v.trim()));

test("Links: Config-Combo, BLE-Name, Gerätename und Hälfte entsprechen dactyl_left.ino", () => {
  const combo = [
    { r: Number(define(leftIno, "CONFIG_COMBO_R1")), c: Number(define(leftIno, "CONFIG_COMBO_C1")) },
    { r: Number(define(leftIno, "CONFIG_COMBO_R2")), c: Number(define(leftIno, "CONFIG_COMBO_C2")) }
  ];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.configCombo)), combo);
  assert.strictEqual(L.bleName, define(leftIno, "CONFIG_BLE_NAME"));
  assert.strictEqual(L.deviceName, define(leftIno, "DEFAULT_DEVICE_NAME"));
  assert.strictEqual(define(leftIno, "DEVICE_SIDE"), "L");
});

test("Rechts: Standard-Makros in DactylLogic.h entsprechen dem Profil", () => {
  const block = logic.slice(logic.indexOf("#ifndef CONFIG_COMBO_R1"), logic.indexOf("#endif", logic.indexOf("#ifndef CONFIG_COMBO_R1")));
  const combo = [
    { r: Number(define(block, "CONFIG_COMBO_R1")), c: Number(define(block, "CONFIG_COMBO_C1")) },
    { r: Number(define(block, "CONFIG_COMBO_R2")), c: Number(define(block, "CONFIG_COMBO_C2")) }
  ];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(R.configCombo)), combo);
  assert.strictEqual(R.bleName, define(logic, "CONFIG_BLE_NAME"));
  assert.strictEqual(R.deviceName, define(logic, "DEFAULT_DEVICE_NAME"));
  assert.strictEqual(define(logic, "DEVICE_SIDE"), "R");
});

test("Leitungen: GPIOs entsprechen den Pin-Tabellen beider Firmwares", () => {
  assert.deepStrictEqual([...L.rowWires.map(w => w.gpio)], pins(leftLogic, "LEFT_ROW_PINS"));
  assert.deepStrictEqual([...L.colWires.map(w => w.gpio)], pins(leftLogic, "LEFT_COL_PINS"));
  assert.deepStrictEqual([...R.rowWires.map(w => w.gpio)], pins(rightIno, "ROW_PINS"));
  assert.deepStrictEqual([...R.colWires.map(w => w.gpio)], pins(rightIno, "COL_PINS"));
});

test("Fehlende Tasten: rechts R4C0/R5C5, links R4C5/R5C0", () => {
  assert.ok(!D.isPhysicalKey(R, 4, 0) && !D.isPhysicalKey(R, 5, 5));
  assert.ok(D.isPhysicalKey(R, 4, 5) && D.isPhysicalKey(R, 5, 0));
  assert.ok(!D.isPhysicalKey(L, 4, 5) && !D.isPhysicalKey(L, 5, 0));
  assert.ok(D.isPhysicalKey(L, 4, 0) && D.isPhysicalKey(L, 5, 5));
  assert.ok(!D.isPhysicalKey(null, 0, 0));
});

test("Verlötete Schalter: Spalte 6 nur im Daumen, ungültige Werte abgelehnt", () => {
  for (const p of [L, R]) {
    assert.ok(!D.isWiredSwitch(p, 0, 6));
    assert.ok(D.isWiredSwitch(p, 5, 6));
    assert.ok(!D.isWiredSwitch(p, 6, 0));
    assert.ok(!D.isWiredSwitch(p, -1, 0));
    assert.ok(!D.isWiredSwitch(p, 0, -1));
    assert.ok(!D.isWiredSwitch(p, "1", 1));
  }
});

test("Daumen-Cluster: 6 Tasten in Zeile 5 ohne fehlende Position, jede einmal", () => {
  for (const p of [L, R]) {
    const ids = p.thumbDefs.map(d => `${d.r}_${d.c}`);
    assert.strictEqual(ids.length, 6);
    assert.strictEqual(new Set(ids).size, 6);
    for (const d of p.thumbDefs) {
      assert.strictEqual(d.r, 5);
      assert.ok(D.isPhysicalKey(p, d.r, d.c), `${p.id} R${d.r}C${d.c}`);
    }
  }
});

test("Config-Combo-Tasten existieren physisch", () => {
  for (const p of [L, R]) {
    for (const k of p.configCombo) {
      assert.ok(D.isPhysicalKey(p, k.r, k.c));
      assert.ok(D.isConfigComboKey(p, k.r, k.c));
    }
  }
  assert.ok(!D.isConfigComboKey(L, 0, 0));
  assert.ok(!D.isConfigComboKey(R, 0, 5));
});

test("Hälfte aus dem BLE-Namen: nur 'Dactyl Config L' ist links", () => {
  assert.strictEqual(D.sideFromBleName("Dactyl Config L"), "L");
  assert.strictEqual(D.sideFromBleName("Dactyl Config"), "R");
  assert.strictEqual(D.sideFromBleName("Dactyl Keyboard"), "R");
  assert.strictEqual(D.sideFromBleName(""), "R");
  assert.strictEqual(D.sideFromBleName("Dactyl Config LX"), "R");
});

test("Hälfte aus DEVICE_INFO: fehlendes Feld ist rechts, Unbekanntes ist null", () => {
  assert.strictEqual(D.sideFromDeviceInfo({ side: "L" }), "L");
  assert.strictEqual(D.sideFromDeviceInfo({ side: "R" }), "R");
  assert.strictEqual(D.sideFromDeviceInfo({ name: "Dactyl Keyboard" }), "R");
  assert.strictEqual(D.sideFromDeviceInfo({ side: "X" }), null);
  assert.strictEqual(D.sideFromDeviceInfo({ side: "__proto__" }), null);
  assert.strictEqual(D.sideFromDeviceInfo(null), null);
  assert.strictEqual(D.sideFromDeviceInfo("L"), null);
});

// Firmware-Codes der linken Standard-Belegung in App-Codes übersetzen
const FW_TO_APP = {
  KEY_ESC: "KEY_ESC", KEY_TAB: "KEY_TAB", KEY_CAPS_LOCK: "KEY_CAPS_LOCK", KEY_LEFT_SHIFT: "KEY_LEFT_SHIFT",
  KEY_LEFT_CTRL: "KEY_LEFT_CTRL", KEY_LEFT_ALT: "KEY_LEFT_ALT", KEY_LEFT_GUI: "KEY_LEFT_GUI",
  KEY_BACKSPACE: "KEY_BACKSPACE", KEY_DELETE: "KEY_DELETE", ACT_MO_1: "MO_1", ACT_TG_0: "TG_0",
  "' '": "KEY_SPACE", "'`'": "KEY_GRAVE", "0": "NONE"
};
const fwToApp = tok => {
  if (FW_TO_APP[tok]) return FW_TO_APP[tok];
  let m = /^'([a-z0-9])'$/.exec(tok);
  if (m) return `KEY_${m[1].toUpperCase()}`;
  m = /^KEY_F(\d+)$/.exec(tok);
  if (m) return tok;
  throw new Error(`Unbekannter Firmware-Code ${tok}`);
};

test("Linke Standard-Belegung entspricht KEYMAP in dactyl_left.ino", () => {
  const block = leftIno.slice(leftIno.indexOf("// [[[START_KEYMAP]]]"), leftIno.indexOf("// [[[END_KEYMAP]]]"));
  const rows = [...block.matchAll(/^\s*\{\s*([^{}]+?)\s*\},?\s*$/gm)].map(m => m[1].split(",").map(t => t.trim()));
  assert.strictEqual(rows.length, 12); // Layer 0 und 1 mit je 6 Zeilen, Layer 2..7 leer
  const layers = L.defaultConfig.layers;
  rows.forEach((row, i) => {
    const l = Math.floor(i / 6), r = i % 6;
    assert.deepStrictEqual([...layers[l][r].map(k => k.tap)], row.map(fwToApp), `Layer ${l} Zeile ${r}`);
  });
  for (let l = 2; l < 8; l++) assert.ok(layers[l].every(row => row.every(k => k.tap === "NONE")));
});

test("Linke Standard-Belegung: fehlende Tasten tragen keine Aktion", () => {
  for (const layer of L.defaultConfig.layers) {
    assert.strictEqual(layer[4][5].tap, "NONE");
    assert.strictEqual(layer[5][0].tap, "NONE");
  }
});

test("default_config_left.json entspricht der linken Standard-Belegung im Profil", () => {
  const file = JSON.parse(read("default_config_left.json"));
  assert.deepStrictEqual(file.layers, JSON.parse(JSON.stringify(L.defaultConfig.layers)));
  assert.strictEqual(file.settings.deviceName, L.deviceName);
});

test("Fehlende Tasten: links verboten (wie server.py), rechts nur für Combos", () => {
  const layer = () => Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ tap: "NONE", hold: "NONE", dtap: "NONE" })));
  const l = layer();
  l[5][0] = { tap: "KEY_LEFT_GUI", hold: "NONE", dtap: "NONE" };
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [l] })], ["R5C0 (Ebene 0)"]);
  const h = layer();
  h[4][5] = { tap: "NONE", hold: "MO_1", dtap: "NONE" };
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [layer(), h] })], ["R4C5 (Ebene 1)"]);
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [[[], [], [], [], [], ["KEY_A"]]] })], ["R5C0 (Ebene 0)"]);
  // Rechte Vorlage: Aktion auf R5C5 bleibt erlaubt, wie validate_config für side=R
  const r = layer();
  r[5][5] = { tap: "KEY_BACKSPACE", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(D.absentKeyViolations(R, { layers: [r] }).length, 0);
  const combo = (a, b) => ({ key1: a, key2: b });
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [], combos: [combo({ r: 0, c: 0 }, { r: 4, c: 5 })] })], ["Combo 1 (R4C5)"]);
  assert.deepStrictEqual([...D.absentKeyViolations(R, { layers: [], combos: [combo({ r: 4, c: 0 }, { r: 0, c: 0 })] })], ["Combo 1 (R4C0)"]);
  assert.strictEqual(D.absentKeyViolations(L, { layers: [], combos: [combo({ r: 4, c: 0 }, { r: 0, c: 0 })] }).length, 0);
  assert.strictEqual(D.absentKeyViolations(L, JSON.parse(read("default_config_left.json"))).length, 0);
  assert.strictEqual(D.absentKeyViolations(R, JSON.parse(read("default_config.json"))).length, 0);
  assert.strictEqual(D.absentKeyViolations(null, { layers: [l] }).length, 0);
});

test("Layout-Presets nur für die rechte Hand", () => {
  assert.strictEqual(R.presets, true);
  assert.strictEqual(L.presets, false);
});

test("Zustand pro Hälfte: getrennte Configs und Änderungen, nur bekannte Felder", () => {
  const store = D.createSideStore(["R", "L"], side => ({ config: { side } }));
  assert.strictEqual(store.get("L").config.side, "L");
  store.get("L").pendingChanges.push({ id: "a" });
  assert.strictEqual(store.get("R").pendingChanges.length, 0);
  assert.notStrictEqual(store.get("R").pendingChanges, store.get("L").pendingChanges);
  store.save("R", { config: { v: 2 }, unknown: 1, side: "L" });
  assert.strictEqual(store.get("R").config.v, 2);
  assert.strictEqual(store.get("R").side, "R");
  assert.ok(!("unknown" in store.get("R")));
  assert.ok(store.has("L") && !store.has("X") && !store.has("__proto__"));
  assert.throws(() => store.get("X"), /Unbekannte Tastaturhälfte/);
});

// -----------------------------------------------------------------------------
// js/side-routing.js: Befehle und Bestätigungen gehören zu einer Hälfte
// -----------------------------------------------------------------------------
const conn = (o) => Object.assign({ bleUp: false, bleSide: null, serialUp: false, serialSide: null }, o);

test("Routing: Befehle gehen nur an eine Verbindung der passenden Hälfte, BLE zuerst", () => {
  assert.strictEqual(D.routeCommand("L", conn({ bleUp: true, bleSide: "L" })), "ble");
  assert.strictEqual(D.routeCommand("R", conn({ bleUp: true, bleSide: "L" })), null);
  assert.strictEqual(D.routeCommand("L", conn({ serialUp: true, serialSide: "L" })), "usb");
  assert.strictEqual(D.routeCommand("L", conn({ serialUp: true, serialSide: null })), null); // Hälfte unbekannt
  assert.strictEqual(D.routeCommand("R", conn({ bleUp: true, bleSide: "L", serialUp: true, serialSide: "R" })), "usb");
  assert.strictEqual(D.routeCommand("L", conn({ bleUp: true, bleSide: "L", serialUp: true, serialSide: "L" })), "ble");
  assert.strictEqual(D.routeCommand(null, conn({ bleUp: true, bleSide: "L" })), null);
  assert.strictEqual(D.routeCommand("L", conn({ serialUp: false, serialSide: "L" })), null);
});

test("Routing: verbundene Hälfte bevorzugt BLE", () => {
  assert.strictEqual(D.connectedSide(conn({})), null);
  assert.strictEqual(D.connectedSide(conn({ bleUp: true, bleSide: "L", serialUp: true, serialSide: "R" })), "L");
  assert.strictEqual(D.connectedSide(conn({ serialUp: true, serialSide: "R" })), "R");
  assert.strictEqual(D.connectedSide(conn({ serialUp: true })), null);
});

test("USB trennen: ein laufender BLE-Sync derselben Hälfte bleibt bestehen", () => {
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ serialSide: "L" })) }, { reject: true, side: "L" });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ serialSide: null })) }, { reject: true, side: null });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ bleUp: true, bleSide: "L", serialSide: "L" })) }, { reject: false });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ bleUp: true, bleSide: "L", serialSide: null })) }, { reject: false });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ bleUp: true, bleSide: "L", serialSide: "R" })) }, { reject: true, side: "R" });
});

// Steuerbare Timer für die Bestätigungen
function fakeTimers() {
  let id = 0;
  const pending = new Map();
  return {
    set: (fn, ms) => { pending.set(++id, fn); return id; },
    clear: (i) => { pending.delete(i); },
    fireAll: () => { const fns = [...pending.values()]; pending.clear(); fns.forEach(f => f()); },
    count: () => pending.size
  };
}

test("Bestätigungen: Antwort der anderen Hälfte bestätigt nichts", async () => {
  const t = fakeTimers();
  const acks = D.createAckRegistry(t);
  const left = acks.wait("SAVE_NVS", 1000, "L");
  acks.resolveLine("OK SAVE_NVS", "R");          // rechte Hälfte über USB
  assert.strictEqual(acks.size(), 1);
  acks.resolveLine("OK SAVE_NVS", "L");
  assert.strictEqual(await left, true);
  assert.strictEqual(t.count(), 0);
  const any = acks.wait("SET_NAME 3", 1000, null);
  acks.resolveLine("ERR NVS SET_NAME 3", "R");   // Bestätigung ohne Hälfte nimmt jede Antwort
  assert.strictEqual(await any, false);
  const unknownLine = acks.wait("ADD_PAIR", 1000, "L");
  acks.resolveLine("OK ADD_PAIR 0", null);       // Zeile ohne bekannte Hälfte (USB vor DEVICE_INFO)
  assert.strictEqual(await unknownLine, true);
  acks.resolveLine("STATUS: ok", "L");           // keine OK/ERR-Zeile
});

test("Bestätigungen: Verwerfen pro Hälfte und Timeout", async () => {
  const t = fakeTimers();
  const acks = D.createAckRegistry(t);
  const l = acks.wait("SAVE_NVS", 1000, "L");
  const r = acks.wait("SAVE_NVS", 1000, "R");
  const n = acks.wait("EXIT_CONFIG", 1000, null);
  acks.reject("USB getrennt", "R");
  assert.strictEqual(await r, false);
  assert.strictEqual(await n, false);            // ohne Hälfte: wird mit verworfen
  assert.strictEqual(acks.size(), 1);
  t.fireAll();
  assert.strictEqual(await l, null);             // Timeout
  assert.strictEqual(acks.size(), 0);
});

test("GET_INFO-Wiederholung: bis die Hälfte bekannt ist, höchstens bis zum Timeout", () => {
  const t = fakeTimers();
  let sent = 0;
  let side = null;
  D.retryUntil(() => side !== null, () => sent++, 500, 5000, t);
  assert.strictEqual(sent, 1);                   // erster Versuch sofort
  t.fireAll();
  t.fireAll();
  assert.strictEqual(sent, 3);
  side = "L";
  t.fireAll();
  assert.strictEqual(sent, 3);                   // DEVICE_INFO kam: keine weitere Anfrage
  assert.strictEqual(t.count(), 0);
  sent = 0;
  D.retryUntil(() => false, () => sent++, 500, 5000, t);
  for (let i = 0; i < 20; i++) t.fireAll();
  assert.strictEqual(sent, 11);                  // 0 .. 5000 ms in 500-ms-Schritten
  sent = 0;
  const stop = D.retryUntil(() => false, () => sent++, 500, 5000, t);
  stop();
  t.fireAll();
  assert.strictEqual(sent, 1);
  assert.strictEqual(t.count(), 0);
});

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
