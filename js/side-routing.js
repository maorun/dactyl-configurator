// =============================================================================
// Zuordnung von Befehlen und Bestätigungen zur Tastaturhälfte
// =============================================================================
// Reine Funktionen ohne DOM und ohne Verbindungsobjekte. app.js übergibt den Verbindungszustand als
// { bleUp, bleSide, serialUp, serialSide }. Getestet in tests/test_side_profiles.js.
(function (root) {
  "use strict";

  const NUM_LAYERS = 8;

  // Hälfte der aktiven Verbindung (BLE bevorzugt), null ohne Verbindung oder bei unbekannter USB-Hälfte
  function connectedSide(conn) {
    if (conn.bleUp) return conn.bleSide || null;
    if (conn.serialUp) return conn.serialSide || null;
    return null;
  }

  // Weg für einen Befehl an side: "ble", "usb" oder null (keine Verbindung zu dieser Hälfte)
  function routeCommand(side, conn) {
    if (!side) return null;
    if (conn.bleUp && conn.bleSide === side) return "ble";
    if (conn.serialUp && conn.serialSide === side) return "usb";
    return null;
  }

  // Welche wartenden Bestätigungen ein Trennen von USB verwirft. Ohne BLE: alle der USB-Hälfte (alle, wenn die
  // Hälfte noch unbekannt ist). Mit BLE: nur die einer anderen Hälfte; ein laufender BLE-Sync bleibt unberührt.
  // Rückgabe: { reject: false } oder { reject: true, side }
  function usbDisconnectAckScope(conn) {
    if (!conn.bleUp) return { reject: true, side: conn.serialSide || null };
    if (conn.serialSide && conn.serialSide !== conn.bleSide) return { reject: true, side: conn.serialSide };
    return { reject: false };
  }

  // Wartende Firmware-Bestätigungen ("OK <CMD>" / "ERR ... <CMD>"). Jeder Eintrag trägt die Hälfte, von der die
  // Antwort kommen muss (null = jede). timers ersetzt setTimeout/clearTimeout in Tests.
  function createAckRegistry(timers) {
    const t = timers || { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
    const pending = [];

    // Löst mit true (OK), false (ERR oder verworfen) oder null (Timeout) auf
    function wait(okPrefix, timeoutMs = 2500, side = null) {
      return new Promise((resolve) => {
        const entry = { okPrefix, resolve, timer: null, side };
        entry.timer = t.set(() => {
          const i = pending.indexOf(entry);
          if (i !== -1) pending.splice(i, 1);
          resolve(null);
        }, timeoutMs);
        pending.push(entry);
      });
    }

    // Ordnet eine Zeile der ältesten passenden Bestätigung zu. side = Hälfte der Zeile (null = unbekannt)
    function resolveLine(line, side = null) {
      if (!line.startsWith("OK ") && !line.startsWith("ERR ")) return;
      const isOk = line.startsWith("OK ");
      for (let i = 0; i < pending.length; i++) {
        const entry = pending[i];
        // Eine Antwort der anderen Hälfte (BLE und USB gleichzeitig) bestätigt keinen Befehl dieser Hälfte
        if (side && entry.side && entry.side !== side) continue;
        // OK <CMD> ... bzw. ERR <GRUND> <CMD>... (ERR BUSY/ARGS/NVS/UNKNOWN enthalten den Befehlsnamen)
        const matches = isOk ? line.startsWith(`OK ${entry.okPrefix}`) : line.includes(entry.okPrefix);
        if (matches) {
          t.clear(entry.timer);
          pending.splice(i, 1);
          entry.resolve(isOk);
          return;
        }
      }
    }

    // Verwirft wartende Bestätigungen; mit side nur die dieser Hälfte (und die ohne Hälfte)
    function reject(reason, side = null) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const entry = pending[i];
        if (side && entry.side && entry.side !== side) continue;
        pending.splice(i, 1);
        t.clear(entry.timer);
        console.warn("Bestätigung verworfen:", entry.okPrefix, reason);
        entry.resolve(false);
      }
    }

    return { wait, resolveLine, reject, size: () => pending.length };
  }

  // Wiederholt action alle intervalMs, bis done() true liefert oder timeoutMs vergangen sind (erster Versuch
  // sofort). Für GET_INFO nach dem Öffnen des USB-Ports: das Öffnen startet das Board neu, die erste Anfrage
  // geht dann verloren. Rückgabe: Funktion zum Abbrechen.
  function retryUntil(done, action, intervalMs, timeoutMs, timers) {
    const t = timers || { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
    let elapsed = 0;
    let timer = null;
    let stopped = false;
    const step = () => {
      if (stopped || done() || elapsed > timeoutMs) return;
      action();
      elapsed += intervalMs;
      timer = t.set(step, intervalMs);
    };
    step();
    return () => {
      stopped = true;
      if (timer !== null) t.clear(timer);
    };
  }

  // SPLIT_KEY-Zeile des Masters: Matrix-Ereignis der Sender-Hälfte, per ESP-NOW empfangen.
  // Nur eine Zeile vom Master zählt. Rückgabe { side, r, c, pressed, layer } oder null.
  function parseSplitKeyLine(line, lineSide) {
    const D = root.Dactyl;
    if (typeof line !== "string" || !line.startsWith("SPLIT_KEY:")) return null;
    if (lineSide !== D.getMasterSide()) return null;
    const side = D.getSplitSenderSide();
    if (!side) return null;
    let evt;
    try {
      evt = JSON.parse(line.substring(10));
    } catch (_) {
      return null;
    }
    if (!evt || typeof evt !== "object") return null;
    const { r, c, layer } = evt;
    if (!D.isWiredSwitch(D.SIDE_PROFILES[side], r, c)) return null;
    if (!Number.isInteger(layer) || layer < 0 || layer >= NUM_LAYERS) return null;
    if (evt.pressed !== 0 && evt.pressed !== 1) return null;
    return { side, r, c, pressed: evt.pressed === 1, layer };
  }

  // SPLIT_KEY-Releases werden nicht wiederholt und können verloren gehen. Eine gedrückte Taste ohne Release
  // gilt nach staleMs als losgelassen (onStale), damit Live-Monitor und Combo-Anzeige nicht hängen bleiben.
  // Eine länger gehaltene Taste verliert dann nur ihre Hervorhebung. timers ersetzt setTimeout in Tests.
  const SPLIT_KEY_STALE_MS = 5000;
  function createSplitKeyTracker(onStale, staleMs = SPLIT_KEY_STALE_MS, timers) {
    const t = timers || { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
    const held = new Map();
    function release(id) {
      if (!held.has(id)) return false;
      t.clear(held.get(id));
      held.delete(id);
      return true;
    }
    function press(id) {
      release(id);
      held.set(id, t.set(() => {
        held.delete(id);
        onStale(id);
      }, staleMs));
    }
    return { press, release, size: () => held.size };
  }

  root.Dactyl = Object.assign(root.Dactyl || {}, {
    parseSplitKeyLine, createSplitKeyTracker, SPLIT_KEY_STALE_MS,
    connectedSide, routeCommand, usbDisconnectAckScope, createAckRegistry, retryUntil
  });
})(typeof window !== "undefined" ? window : globalThis);
