#pragma once
/*
 * DactylSplitHid.h — ESP-NOW-Protokoll zwischen linker Hälfte (Sender) und rechter Hälfte (Master).
 *
 * Die linke Hälfte löst Layer, Tap-Hold, Combos und Key-Pairs selbst auf (DactylLogic.h) und sendet
 * nur fertige HID-Operationen. Der Master führt sie auf seiner BLE-HID-Verbindung zum Mac aus.
 *
 * Eingebunden von firmware/dactyl_left/dactyl_left.ino, firmware/dactyl_right/dactyl_right.ino und
 * den Host-Tests (firmware/tests/test_split_hid.cpp). Keine Arduino- oder ESP-IDF-Abhängigkeit.
 */
#include <stdint.h>
#include <string.h>
#include "DactylKeycodes.h" // dactylAsciiToHid, KEY_LEFT_SHIFT (implizites Shift großer/gesetzter Zeichen)
#include "DactylOneShot.h"  // One-Shot-Modifier und Caps Word (Zustand auf dem Master)
#include "DactylVersion.h"  // DACTYL_FW_VERSION (SPLIT_OP_FW_VERSION)

#define SPLIT_ESPNOW_CHANNEL 1

// Wi-Fi-STA-MAC (= Basis-MAC) beider Hälften
static const uint8_t SPLIT_MASTER_MAC[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xA6};
static const uint8_t SPLIT_LEFT_MAC[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xB0};

// HID-Operationen. Neue Werte nur anhängen, damit gemischte Firmwarestände sich verstehen.
enum SplitHidOp : uint8_t {
  SPLIT_OP_HEARTBEAT = 0,     // Lebenszeichen (1 s), sonst ohne Wirkung
  SPLIT_OP_KEY_PRESS = 1,     // code = Tastatur-Code 1..255 (ASCII, Modifier, Sondertaste)
  SPLIT_OP_KEY_RELEASE = 2,
  SPLIT_OP_KEY_WRITE = 3,     // press + release
  SPLIT_OP_RELEASE_ALL = 4,   // löst alles, was die linke Hälfte gedrückt hält
  SPLIT_OP_MEDIA_PRESS = 5,   // code = 16-Bit-Media-Bitmaske (MediaKeyReport: low = [0], high = [1])
  SPLIT_OP_MEDIA_RELEASE = 6,
  SPLIT_OP_MEDIA_WRITE = 7,
  SPLIT_OP_MOUSE_PRESS = 8,   // code = Maus-Buttonmaske (1..7)
  SPLIT_OP_MOUSE_RELEASE = 9,
  SPLIT_OP_MOUSE_CLICK = 10,
  SPLIT_OP_MOUSE_SCROLL = 11, // arg = Scrollschritte (int8, ungleich 0)
  SPLIT_OP_ACTIVITY = 12,     // nur Master -> links: Tippen am Master, setzt den Inaktivitäts-Timer links zurück
  SPLIT_OP_KEY_EVENT = 13,    // Diagnose: Matrix-Position links (splitKeyEventCode), ohne HID-Wirkung
  SPLIT_OP_ONE_SHOT_PRESS = 14,   // code = One-Shot-Modifier-Maske (1..255, Bit i = KEY_LEFT_CTRL + i)
  SPLIT_OP_ONE_SHOT_RELEASE = 15,
  SPLIT_OP_CAPS_WORD_TOGGLE = 16, // Caps Word umschalten, ohne Werte
  SPLIT_OP_LAYER_STATE = 17,  // beide Richtungen: Layer-Zustand des Absenders (makeSplitLayerEvent)
  SPLIT_OP_FW_VERSION = 18,   // links -> Master: code = DACTYL_FW_VERSION (1..65535), ohne HID-Wirkung
  SPLIT_OP_COUNT = 19
};

struct __attribute__((packed)) SplitHidEvent {
  uint8_t op;
  int8_t arg;
  uint16_t code;
};
static_assert(sizeof(SplitHidEvent) == 4, "SplitHidEvent muss 4 Byte groß sein");

inline SplitHidEvent makeSplitHidEvent(uint8_t op, uint16_t code = 0, int8_t arg = 0) {
  SplitHidEvent ev;
  ev.op = op;
  ev.arg = arg;
  ev.code = code;
  return ev;
}

// Matrix-Ereignis der linken Hälfte für den Live-Monitor der App. code: Bit 15 = gedrückt,
// Bits 8..10 = aktive Ebene beim Ereignis, Bits 4..6 = Zeile, Bits 0..2 = Spalte; alle übrigen Bits 0.
#define SPLIT_KEY_EVENT_ROWS 6
#define SPLIT_KEY_EVENT_COLS 7
#define SPLIT_KEY_EVENT_MASK 0x8777

inline uint16_t splitKeyEventCode(uint8_t row, uint8_t col, bool pressed, uint8_t layer) {
  return (uint16_t)((pressed ? 0x8000 : 0) | ((layer & 7) << 8) | ((row & 7) << 4) | (col & 7));
}
inline uint8_t splitKeyEventRow(uint16_t code) { return (uint8_t)((code >> 4) & 7); }
inline uint8_t splitKeyEventCol(uint16_t code) { return (uint8_t)(code & 7); }
inline uint8_t splitKeyEventLayer(uint16_t code) { return (uint8_t)((code >> 8) & 7); }
inline bool splitKeyEventPressed(uint16_t code) { return (code & 0x8000) != 0; }

// Layer-Abgleich (Format und Ablauf im Abschnitt "Layer-Abgleich beider Hälften"): code Bits 0..7 =
// gehaltene MO-Ebenen des Absenders, Bits 9..15 = eingerastete Ebenen 1..7. arg links: 0 = REPORT (nur MO,
// Toggle-Bits 0), 1..127 = SET mit Nummer. arg < 0: Master-Paket mit zurückgemeldeter Nummer.
inline bool isValidSplitLayerEvent(const SplitHidEvent &ev) {
  if (ev.arg == 0) return (ev.code >> 8) == 0;
  return ev.arg > 0 && (ev.code & 0x0100) == 0; // Ebene 0 rastet nie ein
}
inline bool isValidSplitMasterLayerEvent(const SplitHidEvent &ev) {
  return ev.op == SPLIT_OP_LAYER_STATE && ev.arg < 0 && (ev.code & 0x0100) == 0;
}

// Wertebereich je Operation prüfen. Ungültige Pakete führt der Master nie aus.
inline bool isValidSplitHidEvent(const SplitHidEvent &ev) {
  switch (ev.op) {
    case SPLIT_OP_HEARTBEAT:
    case SPLIT_OP_RELEASE_ALL:
      return ev.code == 0 && ev.arg == 0;
    case SPLIT_OP_KEY_PRESS:
    case SPLIT_OP_KEY_RELEASE:
    case SPLIT_OP_KEY_WRITE:
      return ev.code >= 1 && ev.code <= 0xFF && ev.arg == 0;
    case SPLIT_OP_MEDIA_PRESS:
    case SPLIT_OP_MEDIA_RELEASE:
    case SPLIT_OP_MEDIA_WRITE:
      return ev.code != 0 && ev.arg == 0;
    case SPLIT_OP_MOUSE_PRESS:
    case SPLIT_OP_MOUSE_RELEASE:
    case SPLIT_OP_MOUSE_CLICK:
      return ev.code >= 1 && ev.code <= 0x07 && ev.arg == 0;
    case SPLIT_OP_MOUSE_SCROLL:
      return ev.code == 0 && ev.arg != 0;
    case SPLIT_OP_ONE_SHOT_PRESS:
    case SPLIT_OP_ONE_SHOT_RELEASE:
      return ev.code >= 1 && ev.code <= 0xFF && ev.arg == 0;
    case SPLIT_OP_CAPS_WORD_TOGGLE:
      return ev.code == 0 && ev.arg == 0;
    case SPLIT_OP_LAYER_STATE:
      return isValidSplitLayerEvent(ev);
    case SPLIT_OP_FW_VERSION:
      return ev.code != 0 && ev.arg == 0;
    case SPLIT_OP_KEY_EVENT:
      return ev.arg == 0 && (ev.code & (uint16_t)~SPLIT_KEY_EVENT_MASK) == 0 &&
             splitKeyEventRow(ev.code) < SPLIT_KEY_EVENT_ROWS && splitKeyEventCol(ev.code) < SPLIT_KEY_EVENT_COLS;
    default:
      return false;
  }
}

// Prüft Absender, Länge und Inhalt eines empfangenen Pakets. Nur ein gültiges Paket landet in out.
inline bool parseSplitHidPacket(const uint8_t *srcMac, const uint8_t *data, int len, SplitHidEvent &out) {
  if (srcMac == nullptr || data == nullptr) return false;
  if (memcmp(srcMac, SPLIT_LEFT_MAC, sizeof(SPLIT_LEFT_MAC)) != 0) return false;
  if (len != (int)sizeof(SplitHidEvent)) return false;
  SplitHidEvent ev;
  memcpy(&ev, data, sizeof(ev));
  if (!isValidSplitHidEvent(ev)) return false;
  out = ev;
  return true;
}

// -----------------------------------------------------------------------------
// Rückrichtung Master -> links: Aktivität für synchronisierte Inaktivitäts-Timer
// -----------------------------------------------------------------------------
// Der Master meldet eigenes Tippen höchstens alle SPLIT_ACTIVITY_INTERVAL_MS. Links setzt ein gültiges
// ACTIVITY-Paket den Timer für Standby und Deep Sleep zurück, ohne HID-Wirkung. Kein Retry: Ein verlorenes
// Paket verschiebt das Einschlafen nur um ein Intervall.
#define SPLIT_ACTIVITY_INTERVAL_MS 10000

// Prüft ein Paket an die linke Hälfte: nur vom Master, ACTIVITY ohne Werte oder ein Master-LAYER_STATE
// (arg < 0, der Master führt die Toggles)
inline bool parseSplitMasterPacket(const uint8_t *srcMac, const uint8_t *data, int len, SplitHidEvent &out) {
  if (srcMac == nullptr || data == nullptr) return false;
  if (memcmp(srcMac, SPLIT_MASTER_MAC, sizeof(SPLIT_MASTER_MAC)) != 0) return false;
  if (len != (int)sizeof(SplitHidEvent)) return false;
  SplitHidEvent ev;
  memcpy(&ev, data, sizeof(ev));
  bool ok = (ev.op == SPLIT_OP_ACTIVITY && ev.code == 0 && ev.arg == 0) ||
            isValidSplitMasterLayerEvent(ev);
  if (!ok) return false;
  out = ev;
  return true;
}

// Drosselung auf dem Master. Eine Taste innerhalb des Intervalls bleibt vorgemerkt und geht nach seinem
// Ablauf raus, damit die letzte Aktivität die linke Hälfte erreicht.
struct SplitActivityThrottle {
  bool pending;
  bool sentOnce;
  unsigned long lastSentMs;
};

inline void splitActivityReset(SplitActivityThrottle &t) {
  memset(&t, 0, sizeof(t));
}

inline void splitActivityNote(SplitActivityThrottle &t) {
  t.pending = true;
}

// Liefert true, wenn jetzt ein ACTIVITY-Paket zu senden ist (und merkt den Versand vor)
inline bool splitActivityTake(SplitActivityThrottle &t, unsigned long nowMs) {
  if (!t.pending) return false;
  if (t.sentOnce && (nowMs - t.lastSentMs) < SPLIT_ACTIVITY_INTERVAL_MS) return false;
  t.pending = false;
  t.sentOnce = true;
  t.lastSentMs = nowMs;
  return true;
}

// Ergebnis von esp_now_send für ein genommenes ACTIVITY-Paket: bei einem Fehler bleibt die Vormerkung
// stehen, das Paket geht nach dem Intervall erneut raus (ohne neuen Tastendruck)
inline void splitActivitySendResult(SplitActivityThrottle &t, bool sent) {
  if (!sent) t.pending = true;
}

// Matrix-Wechsel am Master: eigene Aktivität (Inaktivitäts-Timer) und Vormerkung für die linke Hälfte
inline void splitNoteLocalKeyChange(SplitActivityThrottle &t, unsigned long nowMs, unsigned long &lastActivityMs) {
  lastActivityMs = nowMs;
  splitActivityNote(t);
}

// Scrollen hat keinen Zustand: ein doppelt zugestelltes Retry-Paket scrollte doppelt. Ein verlorener
// Scrollschritt ist harmloser, deshalb wiederholt die linke Hälfte MOUSE_SCROLL nicht. Ein doppeltes
// KEY_EVENT zählte in Heatmap und Statistik doppelt; ein verlorenes kostet nur eine Anzeige.
// CAPS_WORD_TOGGLE schaltet um: ein Duplikat nähme das Umschalten zurück, ein verlorenes Paket tippt man neu.
inline bool splitEventRetryable(const SplitHidEvent &ev) {
  return ev.op != SPLIT_OP_MOUSE_SCROLL && ev.op != SPLIT_OP_KEY_EVENT && ev.op != SPLIT_OP_CAPS_WORD_TOGGLE;
}

// -----------------------------------------------------------------------------
// Layer-Abgleich beider Hälften (SPLIT_OP_LAYER_STATE)
// -----------------------------------------------------------------------------
// Jede Hälfte sendet ihren Zustand bei jeder Änderung und spätestens alle SPLIT_LAYER_REFRESH_MS. Die
// MO-Ebenen gehören dem Absender; der Empfänger hält sie als entfernte MO-Ebenen (remoteMomentaryLayers in
// DactylLogic.h). Die TG-Ebenen führt der Master: jedes Master-Paket setzt sie links.
// Links sendet nach einer eigenen Toggle-Änderung ein SET mit einer neuen Nummer (1..127) und bleibt dabei
// (auch beim Auffrischen und nach restartEspNow), bis ein Master-Paket diese Nummer zurückmeldet oder
// SPLIT_LAYER_SET_TIMEOUT_MS vergangen sind. Der Master übernimmt das SET und meldet die Nummer in jedem
// eigenen Paket zurück. Bis zur Rückmeldung übernimmt links keine Master-Toggles: ein Paket, das der Master
// vor dem SET gesendet hat, nähme die Änderung sonst zurück. Die Nummer unterscheidet die Rückmeldung von
// einem älteren Paket mit zufällig gleichen Toggles. Die Frist begrenzt den Fall einer verlorenen
// Rückmeldung. Schalten beide Hälften gleichzeitig um, gilt danach auf beiden das SET der linken Hälfte.
// Links wiederholt die Sendewarteschlange ein Paket. Der Master hat keinen Retry: er sendet jede Änderung
// nach SPLIT_LAYER_REPEAT_MS ein zweites Mal (gleicher Zustand, Duplikate sind harmlos), sonst hielte ein
// verlorenes Paket eine entfernte MO-Ebene bis zum Auffrischen.
// Beide Hälften brauchen eine Firmware mit LAYER_STATE: eine ältere Gegenseite verwirft das Paket, und jede
// Hälfte behält ihre eigenen Ebenen (Verhalten vor dem Abgleich). Der Heartbeat bleibt deshalb unverändert.
#define SPLIT_LAYER_REFRESH_MS 1000
#define SPLIT_LAYER_REPEAT_MS 30
// Ohne Layer-Paket so lange verfallen die entfernten MO-Ebenen (andere Hälfte aus oder im Deep Sleep)
#define SPLIT_LAYER_REMOTE_TIMEOUT_MS 3000
// Höchste Dauer eines offenen SET links. Deckt die Retries der Sendewarteschlange (4 x 200 ms Timeout) und
// ein Auffrischen ab. restartEspNow startet die Frist neu, damit ein Toggle aus dem Ausfall den Master erreicht.
#define SPLIT_LAYER_SET_TIMEOUT_MS 2000
// Nummern eines linken SET: 1..SPLIT_LAYER_SEQ_MAX (arg > 0). Master-Pakete tragen arg < 0 mit der
// zurückgemeldeten Nummer in den Bits 0..6 (0 = noch keine).
#define SPLIT_LAYER_SEQ_MAX 127

struct SplitLayerSync {
  uint8_t sentMomentary;
  uint8_t sentToggles;
  bool everSent;
  bool forceSend;
  bool repeatPending;
  unsigned long lastSentMs;
  // Links: eigenes SET, das der Master noch nicht zurückgemeldet hat, seine Nummer und der Fristbeginn.
  // setUnsent: das SET ist offen, aber noch nie eingereiht (volle Warteschlange)
  bool setPending;
  bool setUnsent;
  uint8_t setSeq;
  uint8_t lastSeq;
  unsigned long setSinceMs;
  // Master: Nummer des zuletzt übernommenen linken SET (Rückmeldung) und die zuletzt gesendete
  uint8_t echoSeq;
  uint8_t sentEchoSeq;
};

// seed: Startwert der Nummern links (esp_random). Nach einem Neustart der linken Hälfte meldet der Master
// evtl. noch eine Nummer aus der Zeit davor zurück; ein zufälliger Start macht eine Verwechslung selten.
inline void splitLayerReset(SplitLayerSync &s, uint32_t seed = 0) {
  memset(&s, 0, sizeof(s));
  s.lastSeq = (uint8_t)(seed % SPLIT_LAYER_SEQ_MAX);
}

// Nächstes Paket sofort senden (Master: Link zur linken Hälfte gerade aufgebaut; links: restartEspNow).
// Ein offenes SET bleibt offen, seine Frist beginnt neu, und es geht mit dem nächsten Paket erneut raus.
inline void splitLayerForce(SplitLayerSync &s, unsigned long nowMs) {
  s.forceSend = true;
  s.setSinceMs = nowMs;
}

// Links: REPORT (arg 0) oder SET mit Nummer seq (1..127)
inline SplitHidEvent makeSplitLayerEvent(uint8_t momentary, uint8_t toggles, bool set, uint8_t seq = 1) {
  uint16_t code = set ? (uint16_t)(momentary | ((toggles & 0xFE) << 8)) : momentary;
  int8_t arg = set ? (int8_t)(seq & SPLIT_LAYER_SEQ_MAX) : (int8_t)0;
  return makeSplitHidEvent(SPLIT_OP_LAYER_STATE, code, arg);
}
// Master: immer mit Toggles, arg < 0 mit der zurückgemeldeten Nummer
inline SplitHidEvent makeSplitMasterLayerEvent(uint8_t momentary, uint8_t toggles, uint8_t echoSeq) {
  return makeSplitHidEvent(SPLIT_OP_LAYER_STATE, (uint16_t)(momentary | ((toggles & 0xFE) << 8)),
                           (int8_t)(0x80 | (echoSeq & SPLIT_LAYER_SEQ_MAX)));
}
inline uint8_t splitLayerMomentary(const SplitHidEvent &ev) { return (uint8_t)(ev.code & 0xFF); }
inline uint8_t splitLayerToggles(const SplitHidEvent &ev) { return (uint8_t)(ev.code >> 8); }
// Trägt das Paket Toggles, die der Empfänger übernimmt (linkes SET oder Master-Paket)
inline bool splitLayerIsSet(const SplitHidEvent &ev) { return ev.arg != 0; }
inline bool splitLayerFromMaster(const SplitHidEvent &ev) { return ev.arg < 0; }
inline uint8_t splitLayerSeq(const SplitHidEvent &ev) { return (uint8_t)(ev.arg & SPLIT_LAYER_SEQ_MAX); }

// Liefert true und das Paket, wenn sich der Zustand geändert hat, ein Senden erzwungen ist, die
// Wiederholung (Master) oder das Auffrischen fällig ist. refreshAllowed = false: kein Auffrischen.
inline bool splitLayerTake(SplitLayerSync &s, uint8_t momentary, uint8_t toggles, bool master,
                           unsigned long nowMs, bool refreshAllowed, SplitHidEvent &out) {
  toggles &= 0xFE;
  // Ein nie gesendetes SET, dessen Toggle-Änderung schon zurückgenommen ist, entfällt: es sendete sonst
  // den alten Stand als SET und nähme eine spätere Änderung des Masters zurück
  if (!master && s.setUnsent && toggles == s.sentToggles) {
    s.setPending = false;
    s.setUnsent = false;
  }
  bool togglesChanged = s.everSent && toggles != s.sentToggles;
  bool changed = !s.everSent || s.forceSend || momentary != s.sentMomentary || toggles != s.sentToggles ||
                 (master && s.echoSeq != s.sentEchoSeq);
  unsigned long since = nowMs - s.lastSentMs;
  bool due = (s.repeatPending && since >= SPLIT_LAYER_REPEAT_MS) ||
             (refreshAllowed && since >= SPLIT_LAYER_REFRESH_MS);
  if (!changed && !due) return false;
  if (master) {
    out = makeSplitMasterLayerEvent(momentary, toggles, s.echoSeq);
    s.sentEchoSeq = s.echoSeq;
  } else {
    // Links setzt nur eine eigene Toggle-Änderung, mit neuer Nummer; das erste Paket nach dem Start
    // meldet nur, damit links die Toggles des Masters übernimmt
    if (togglesChanged) {
      s.lastSeq = (uint8_t)(s.lastSeq % SPLIT_LAYER_SEQ_MAX + 1);
      s.setPending = true;
      s.setSeq = s.lastSeq;
      s.setSinceMs = nowMs;
    }
    out = makeSplitLayerEvent(momentary, toggles, s.setPending, s.setSeq);
  }
  s.repeatPending = master && changed;
  s.forceSend = false;
  s.sentMomentary = momentary;
  s.sentToggles = toggles;
  s.everSent = true;
  s.lastSentMs = nowMs;
  return true;
}

// Links: true, wenn die Toggles eines Master-Pakets jetzt gelten. Ein offenes SET sperrt sie, bis der Master
// seine Nummer zurückmeldet oder die Frist abläuft; beides schließt das SET ab.
inline bool splitLayerAcceptMasterToggles(SplitLayerSync &s, const SplitHidEvent &ev, unsigned long nowMs) {
  if (!s.setPending) return true;
  if (splitLayerSeq(ev) != s.setSeq && (nowMs - s.setSinceMs) < SPLIT_LAYER_SET_TIMEOUT_MS) return false;
  s.setPending = false;
  return true;
}

// Übernommene Toggles gelten als gesendet: die Hälfte meldet sie nicht als eigene Änderung zurück
inline void splitLayerNoteAdoptedToggles(SplitLayerSync &s, uint8_t toggles) {
  s.sentToggles = (uint8_t)(toggles & 0xFE);
}

// Eigenen Zustand senden, wenn fällig. send(ev) liefert true, wenn das Paket eingereiht oder gesendet ist.
// Ein Fehlschlag stellt den Stand vor splitLayerTake wieder her (der nächste Aufruf sendet neu); ein dabei
// geöffnetes SET bleibt offen, damit kein Master-Paket die eigene Toggle-Änderung vorher überschreibt. Der
// Nummernzähler geht zurück: der nächste Versuch vergibt dieselbe Nummer (sie war noch nie unterwegs).
template <class SendFn>
bool splitLayerSendIfDue(SplitLayerSync &s, uint8_t momentary, uint8_t toggles, bool master, unsigned long nowMs,
                         bool refreshAllowed, SendFn send) {
  SplitLayerSync before = s;
  SplitHidEvent ev;
  if (!splitLayerTake(s, momentary, toggles, master, nowMs, refreshAllowed, ev)) return false;
  if (send(ev)) {
    s.setUnsent = false;
    return true;
  }
  SplitLayerSync taken = s;
  s = before;
  // War ein gesendetes SET ohne Rückmeldung offen, bleibt es unverändert offen: der Master kennt seine
  // Nummer, und seine Rückmeldung schließt es. Sonst bleibt ein neu geöffnetes SET offen (blockiert
  // Master-Toggles), gilt aber als nie gesendet und entfällt bei Rücknahme der Toggle-Änderung.
  if (!before.setPending || before.setUnsent) {
    s.setPending = taken.setPending;
    s.setSeq = taken.setSeq;
    s.setSinceMs = taken.setSinceMs;
    s.setUnsent = taken.setPending;
  }
  return false;
}

// Paket ohne eigene MO-Ebenen vor Config Mode und Deep Sleep. Der Master behält seine Toggles; links trägt
// ein offenes SET mit, damit ein eigener Toggle kurz vor dem Neustart den Master noch erreicht. Geht das
// Paket verloren, verfallen die Ebenen nach SPLIT_LAYER_REMOTE_TIMEOUT_MS.
inline SplitHidEvent splitLayerReleaseEvent(const SplitLayerSync &s, uint8_t toggles, bool master) {
  if (master) return makeSplitMasterLayerEvent(0, toggles, s.echoSeq);
  return makeSplitLayerEvent(0, toggles, s.setPending, s.setSeq);
}

// Briefkasten Empfangs-Callback (Wi-Fi-Task) -> loop() der linken Hälfte. Das Paket trägt den ganzen
// Zustand: das neueste gilt, ältere dürfen entfallen. Seqlock: der Callback setzt seq ungerade, schreibt und
// setzt seq gerade. loop() verwirft einen Lesevorgang bei ungeradem oder geändertem seq und liest neu.
struct SplitLayerMailbox {
  volatile uint16_t code;
  volatile int8_t arg;
  volatile uint32_t seq;
};

inline void splitLayerMailboxPut(SplitLayerMailbox &m, const SplitHidEvent &ev) {
  m.seq = m.seq + 1;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  m.code = ev.code;
  m.arg = ev.arg;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  m.seq = m.seq + 1;
}

// Liefert true und das neueste Paket, wenn seit seenSeq eines vollständig eingetroffen ist. Ein Schreiben
// während des Lesens liefert false; der nächste loop()-Durchlauf liest es.
inline bool splitLayerMailboxTake(SplitLayerMailbox &m, uint32_t &seenSeq, SplitHidEvent &out) {
  for (int attempt = 0; attempt < 4; attempt++) {
    uint32_t s1 = m.seq;
    if (s1 & 1) continue;
    if (s1 == seenSeq) return false;
    __atomic_thread_fence(__ATOMIC_SEQ_CST);
    SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_LAYER_STATE, m.code, m.arg);
    __atomic_thread_fence(__ATOMIC_SEQ_CST);
    if (m.seq != s1) continue;
    seenSeq = s1;
    out = ev;
    return true;
  }
  return false;
}

// Alles bisher Eingetroffene verwerfen (restartEspNow: ein Paket von davor gilt nicht mehr)
inline void splitLayerMailboxDiscard(SplitLayerMailbox &m, uint32_t &seenSeq) {
  seenSeq = m.seq & ~1u;
}

// Entfernte MO-Ebenen einer Hälfte mit Verfall (SPLIT_LAYER_REMOTE_TIMEOUT_MS ohne Layer-Paket)
struct SplitRemoteLayers {
  uint8_t momentary;
  unsigned long lastRxMs;
};

inline void splitRemoteLayersReset(SplitRemoteLayers &r) {
  memset(&r, 0, sizeof(r));
}

inline void splitRemoteLayersApply(SplitRemoteLayers &r, const SplitHidEvent &ev, unsigned long nowMs) {
  r.momentary = splitLayerMomentary(ev);
  r.lastRxMs = nowMs;
}

// Liefert true, wenn die entfernten MO-Ebenen gerade verfallen sind
inline bool splitRemoteLayersExpire(SplitRemoteLayers &r, unsigned long nowMs) {
  if (!r.momentary || (nowMs - r.lastRxMs) < SPLIT_LAYER_REMOTE_TIMEOUT_MS) return false;
  r.momentary = 0;
  return true;
}

// Master nach splitProcessRx: bei Link-Aufbau sofort senden, bei Link-Ausfall die linken MO-Ebenen lösen,
// sonst nach dem Verfall. Liefert true, wenn sie jetzt 0 sind und die aktive Ebene neu zu bestimmen ist.
inline bool splitLayerMasterAfterRx(SplitLayerSync &s, SplitRemoteLayers &r, bool linkWasUp, bool linkUp,
                                    bool linkLost, unsigned long nowMs) {
  if (!linkWasUp && linkUp) splitLayerForce(s, nowMs);
  if (linkLost) {
    bool held = r.momentary != 0;
    splitRemoteLayersReset(r);
    return held;
  }
  return splitRemoteLayersExpire(r, nowMs);
}

// Master: Paket der linken Hälfte auswerten. Ihre MO-Ebenen gelten immer. Ein SET mit neuer Nummer liefert
// true (der Aufrufer übernimmt die Toggles), und seine Nummer geht mit dem nächsten Master-Paket zurück. Ein
// SET mit der schon übernommenen Nummer (Retry, Auffrischen vor der Rückmeldung) ändert nichts: es nähme
// sonst eine spätere Toggle-Änderung des Masters zurück. Ein REPORT löscht die gemerkte Nummer: links ist
// dann kein SET offen (auch das erste Paket nach einem Neustart links ist ein REPORT), und ein späteres SET
// mit zufällig derselben Nummer gilt als neu. Die Sendewarteschlange links hält die Reihenfolge, deshalb
// kommt ein altes SET nie nach dem REPORT an.
inline bool splitLayerMasterReceive(SplitLayerSync &s, SplitRemoteLayers &r, const SplitHidEvent &ev,
                                    unsigned long nowMs) {
  splitRemoteLayersApply(r, ev, nowMs);
  if (!splitLayerIsSet(ev)) {
    s.echoSeq = 0;
    return false;
  }
  if (splitLayerSeq(ev) == s.echoSeq) return false;
  s.echoSeq = splitLayerSeq(ev);
  return true;
}

// Links: Paket des Masters auswerten. Seine MO-Ebenen gelten immer, seine Toggles nur ohne offenes eigenes
// SET (splitLayerAcceptMasterToggles). Liefert true, wenn seine Toggles gelten; der Aufrufer übernimmt sie.
inline bool splitLayerLeftReceive(SplitLayerSync &s, SplitRemoteLayers &r, const SplitHidEvent &ev, unsigned long nowMs) {
  splitRemoteLayersApply(r, ev, nowMs);
  bool adopt = splitLayerAcceptMasterToggles(s, ev, nowMs);
  if (adopt) splitLayerNoteAdoptedToggles(s, splitLayerToggles(ev));
  return adopt;
}

// Links nach (Neu-)Start von ESP-NOW: sofort senden (ein offenes SET bleibt offen, neue Frist), entfernte
// MO-Ebenen und ein Paket aus der Zeit davor verwerfen. Der Aufrufer setzt danach die aktive Ebene neu.
inline void splitLayerLeftRestart(SplitLayerSync &s, SplitRemoteLayers &r, SplitLayerMailbox &m, uint32_t &seenSeq,
                                  unsigned long nowMs) {
  splitLayerForce(s, nowMs);
  splitRemoteLayersReset(r);
  splitLayerMailboxDiscard(m, seenSeq);
}

inline uint16_t splitMediaBits(const uint8_t report[2]) {
  return (uint16_t)(report[0] | (report[1] << 8));
}

inline void splitMediaReport(uint16_t bits, uint8_t report[2]) {
  report[0] = (uint8_t)(bits & 0xFF);
  report[1] = (uint8_t)(bits >> 8);
}

// -----------------------------------------------------------------------------
// Master: Zustand der gehaltenen Eingaben je Hälfte
// -----------------------------------------------------------------------------
// Ein Retry der linken Seite kann ein Paket doppelt zustellen; ein Press setzt nur den Zustand, ein Release
// löst nur Gedrücktes. Bleiben die Pakete SPLIT_LINK_TIMEOUT_MS lang aus, löst der Master genau die linken
// Eingaben (keine hängende Taste bei Funkausfall).
#define SPLIT_LINK_TIMEOUT_MS 3000

struct SplitHeldSet {
  uint8_t keys[32];     // Bitfeld für Tastatur-Codes 0..255
  uint16_t media;       // Media-Bitmaske
  uint8_t mouse;        // Maus-Buttons
  uint8_t oneShot;      // gehaltene One-Shot-Modifier-Tasten (kein HID-Report, nur Zustand)
};

inline void splitSetClear(SplitHeldSet &s) {
  memset(&s, 0, sizeof(s));
}

inline bool splitSetHasKey(const SplitHeldSet &s, uint8_t code) {
  return (s.keys[code >> 3] >> (code & 7)) & 1;
}

inline void splitSetKey(SplitHeldSet &s, uint8_t code, bool held) {
  uint8_t bit = (uint8_t)(1u << (code & 7));
  if (held) s.keys[code >> 3] |= bit;
  else s.keys[code >> 3] &= (uint8_t)~bit;
}

inline bool splitSetAny(const SplitHeldSet &s) {
  for (uint8_t b : s.keys) if (b) return true;
  return s.media != 0 || s.mouse != 0 || s.oneShot != 0;
}

struct SplitLeftHeld {
  SplitHeldSet set;
  unsigned long lastRxMs;
  bool linkUp;
  // Firmwarestand der linken Hälfte aus SPLIT_OP_FW_VERSION; 0 = unbekannt (kein Paket seit dem Link-Aufbau)
  uint16_t fw;
  // Beginn des Links: Fenster für splitLeftFwStatus
  unsigned long fwSinceMs;
  // Link-Statistik für die App (SPLIT_LINK, DEVICE_INFO.left_link); splitHeldReset setzt sie zurück
  unsigned long linkChangedMs;   // letzter Wechsel des Links (auf/ab)
  bool everUp;                   // seit dem Start kam mindestens ein Paket
  uint32_t linkLosses;           // Link-Timeouts
  uint32_t rxDropped;            // verworfene Pakete bei vollem Empfangsring
  uint32_t keyDropped;           // KEY_EVENTs über SPLIT_KEY_EVENTS_PER_RX (nicht gemeldet)
};

inline void splitCountAdd(uint32_t &counter, uint32_t n) {
  counter = (n > 0xFFFFFFFFu - counter) ? 0xFFFFFFFFu : counter + n;
}

inline void splitHeldReset(SplitLeftHeld &h) {
  memset(&h, 0, sizeof(h));
}

inline bool splitHeldKey(const SplitLeftHeld &h, uint8_t code) {
  return splitSetHasKey(h.set, code);
}

inline bool splitHeldAny(const SplitLeftHeld &h) {
  return splitSetAny(h.set);
}

// HID-Ausgabe, die der Master für jede Operation der linken Hälfte ausführt
struct SplitHidSink {
  virtual void leftKeyPress(uint8_t code) = 0;
  virtual void leftKeyRelease(uint8_t code) = 0;
  virtual void leftMediaPress(uint16_t bits) = 0;
  virtual void leftMediaRelease(uint16_t bits) = 0;
  virtual void leftMousePress(uint8_t buttons) = 0;
  virtual void leftMouseRelease(uint8_t buttons) = 0;
  virtual void leftMouseClick(uint8_t buttons) = 0;
  virtual void leftMouseScroll(int8_t steps) = 0;
  // arm = false: Loslassen durch RELEASE_ALL oder Link-Ausfall merkt nichts vor
  virtual void leftOneShotPress(uint8_t mask) = 0;
  virtual void leftOneShotRelease(uint8_t mask, bool arm) = 0;
  virtual void leftCapsWordToggle() = 0;
  virtual ~SplitHidSink() {}
};

// Löst alles, was die linke Hälfte gedrückt hält, und nur das
inline void splitReleaseHeld(SplitLeftHeld &h, SplitHidSink &sink) {
  SplitHeldSet held = h.set;
  splitSetClear(h.set);
  for (int code = 1; code < 256; code++) {
    if (splitSetHasKey(held, (uint8_t)code)) sink.leftKeyRelease((uint8_t)code);
  }
  for (int bit = 0; bit < 16; bit++) {
    if (held.media & (1u << bit)) sink.leftMediaRelease((uint16_t)(1u << bit));
  }
  if (held.mouse) sink.leftMouseRelease(held.mouse);
  if (held.oneShot) sink.leftOneShotRelease(held.oneShot, false);
}

// Firmwarestand der linken Hälfte (SPLIT_OP_FW_VERSION). Die linke Hälfte sendet ihn mit dem ersten
// Lebenszeichen nach dem Start von ESP-NOW und danach mit jedem SPLIT_FW_VERSION_EVERY-ten
// (queueHeartbeat in DactylLeftLogic.h). Bleibt er SPLIT_FW_DETECT_MS nach dem Link-Aufbau aus, sendet die
// linke Hälfte keine Version: ihre Firmware ist älter als SPLIT_OP_FW_VERSION.
#define SPLIT_FW_VERSION_EVERY 5
// Länger als zwei Abstände (2 x 5 s): eine verlorene Meldung ergibt kein falsches "alt"
#define SPLIT_FW_DETECT_MS 12000UL

// Für jedes gültige Paket der linken Hälfte, vor der Auswertung: Link-Zustand und Firmwarestand.
// Ein neuer Link setzt den Stand zurück: Flashen der linken Hälfte dauert länger als SPLIT_LINK_TIMEOUT_MS.
inline void splitNoteLeftRx(SplitLeftHeld &h, const SplitHidEvent &ev, unsigned long nowMs) {
  if (!h.linkUp) {
    h.fw = 0;
    h.fwSinceMs = nowMs;
    h.linkChangedMs = nowMs;
    h.everUp = true;
  }
  if (ev.op == SPLIT_OP_FW_VERSION) h.fw = ev.code;
  h.lastRxMs = nowMs;
  h.linkUp = true;
}

// Stand für DEVICE_INFO.left_fw und SPLIT_FW: > 0 = DACTYL_FW_VERSION links, 0 = unbekannt (kein Link oder
// Fenster läuft), -1 = Link ohne Version (linke Firmware älter als SPLIT_OP_FW_VERSION).
// GET_INFO über BLE ruft das im BLE-Task auf: nowMs kann vor einem fwSinceMs liegen, das loop() gerade schrieb.
inline int32_t splitLeftFwStatus(const SplitLeftHeld &h, unsigned long nowMs) {
  if (!h.linkUp) return 0;
  if (h.fw) return h.fw;
  long elapsed = (long)(nowMs - h.fwSinceMs);
  return elapsed >= (long)SPLIT_FW_DETECT_MS ? -1 : 0;
}

// Führt ein bereits geprüftes Ereignis aus. Liefert true, wenn eine HID-Ausgabe erfolgte.
// Der Zustand wird vor dem Aufruf der Senke aktualisiert, damit die Senke den neuen Besitz sieht.
inline bool splitApplyHidEvent(SplitLeftHeld &h, const SplitHidEvent &ev, unsigned long nowMs, SplitHidSink &sink) {
  h.lastRxMs = nowMs;
  h.linkUp = true;
  SplitHeldSet &s = h.set;
  uint8_t code8 = (uint8_t)ev.code;
  switch (ev.op) {
    case SPLIT_OP_HEARTBEAT:
      return false;
    case SPLIT_OP_KEY_PRESS:
      if (splitSetHasKey(s, code8)) return false;
      splitSetKey(s, code8, true);
      sink.leftKeyPress(code8);
      return true;
    case SPLIT_OP_KEY_RELEASE:
      if (!splitSetHasKey(s, code8)) return false;
      splitSetKey(s, code8, false);
      sink.leftKeyRelease(code8);
      return true;
    case SPLIT_OP_KEY_WRITE:
      // Ein bereits gehaltener Code wird nicht getippt, sonst löste das Release die gehaltene Taste
      if (splitSetHasKey(s, code8)) return false;
      sink.leftKeyPress(code8);
      sink.leftKeyRelease(code8);
      return true;
    case SPLIT_OP_RELEASE_ALL:
      if (!splitSetAny(s)) return false;
      splitReleaseHeld(h, sink);
      return true;
    case SPLIT_OP_MEDIA_PRESS: {
      uint16_t add = ev.code & (uint16_t)~s.media;
      if (!add) return false;
      s.media |= add;
      sink.leftMediaPress(add);
      return true;
    }
    case SPLIT_OP_MEDIA_RELEASE: {
      uint16_t rel = ev.code & s.media;
      if (!rel) return false;
      s.media &= (uint16_t)~rel;
      sink.leftMediaRelease(rel);
      return true;
    }
    case SPLIT_OP_MEDIA_WRITE:
      if (ev.code & s.media) return false;
      sink.leftMediaPress(ev.code);
      sink.leftMediaRelease(ev.code);
      return true;
    case SPLIT_OP_MOUSE_PRESS: {
      uint8_t add = (uint8_t)(code8 & ~s.mouse);
      if (!add) return false;
      s.mouse |= add;
      sink.leftMousePress(add);
      return true;
    }
    case SPLIT_OP_MOUSE_RELEASE: {
      uint8_t rel = (uint8_t)(code8 & s.mouse);
      if (!rel) return false;
      s.mouse &= (uint8_t)~rel;
      sink.leftMouseRelease(rel);
      return true;
    }
    case SPLIT_OP_MOUSE_CLICK:
      if (code8 & s.mouse) return false;
      sink.leftMouseClick(code8);
      return true;
    case SPLIT_OP_MOUSE_SCROLL:
      sink.leftMouseScroll(ev.arg);
      return true;
    case SPLIT_OP_ONE_SHOT_PRESS: {
      uint8_t add = (uint8_t)(code8 & ~s.oneShot);
      if (!add) return false;
      s.oneShot |= add;
      sink.leftOneShotPress(add);
      return true;
    }
    case SPLIT_OP_ONE_SHOT_RELEASE: {
      uint8_t rel = (uint8_t)(code8 & s.oneShot);
      if (!rel) return false;
      s.oneShot &= (uint8_t)~rel;
      sink.leftOneShotRelease(rel, true);
      return true;
    }
    case SPLIT_OP_CAPS_WORD_TOGGLE:
      sink.leftCapsWordToggle();
      return true;
    default:
      return false;
  }
}

// Regelmäßig aus loop() aufrufen. Liefert true, wenn der Link gerade ausgefallen ist.
inline bool splitCheckLinkTimeout(SplitLeftHeld &h, unsigned long nowMs, SplitHidSink &sink) {
  if (!h.linkUp || (nowMs - h.lastRxMs) < SPLIT_LINK_TIMEOUT_MS) return false;
  h.linkUp = false;
  h.linkChangedMs = h.lastRxMs; // der Link ist seit dem letzten Paket weg, nicht erst seit der Erkennung
  splitCountAdd(h.linkLosses, 1);
  splitReleaseHeld(h, sink);
  return true;
}

// Link-Meldung an die App (SPLIT_LINK-Zeile): ein Wechsel des Links sofort, geänderte Zähler höchstens alle
// SPLIT_LINK_REPORT_MS (eine Flut verworfener Pakete erzeugt keine Flut von Serial-Zeilen, jede kostet loop()
// etwa 4 ms bei 115200 Baud).
#define SPLIT_LINK_REPORT_MS 1000UL

struct SplitLinkReporter {
  bool reported;          // schon einmal gemeldet
  bool up;
  uint32_t losses, rxDropped, keyDropped;
  unsigned long lastMs;
};

// JSON für SPLIT_LINK und DEVICE_INFO.left_link; "ms" = Zeit seit dem letzten Wechsel (0 ohne Link-Historie).
// GET_INFO über BLE ruft das im BLE-Task auf: ein linkChangedMs, das loop() gerade schrieb, liegt nach nowMs
// (weniger als SPLIT_LINK_SKEW_MS) und ergibt 0 statt einer riesigen Zahl. Sonst gilt das Alter unsigned,
// auch über 24,8 Tage hinaus (millis() läuft nach 49,7 Tagen über).
#define SPLIT_LINK_SKEW_MS 256UL
inline int splitLeftLinkJson(char *buf, size_t size, const SplitLeftHeld &h, unsigned long nowMs) {
  unsigned long since = h.everUp ? (nowMs - h.linkChangedMs) : 0;
  if (since > 0xFFFFFFFFUL - SPLIT_LINK_SKEW_MS) since = 0;
  return snprintf(buf, size, "{\"up\":%d,\"ms\":%lu,\"ever\":%d,\"losses\":%lu,\"rx_dropped\":%lu,\"key_dropped\":%lu}",
                  h.linkUp ? 1 : 0, (unsigned long)since, h.everUp ? 1 : 0, (unsigned long)h.linkLosses,
                  (unsigned long)h.rxDropped, (unsigned long)h.keyDropped);
}

inline bool splitLinkReportDue(SplitLinkReporter &r, const SplitLeftHeld &h, unsigned long nowMs) {
  bool changed = !r.reported || r.up != h.linkUp;
  bool counters = r.losses != h.linkLosses || r.rxDropped != h.rxDropped || r.keyDropped != h.keyDropped;
  if (!changed && !(counters && (nowMs - r.lastMs) >= SPLIT_LINK_REPORT_MS)) return false;
  r.reported = true;
  r.up = h.linkUp;
  r.losses = h.linkLosses;
  r.rxDropped = h.rxDropped;
  r.keyDropped = h.keyDropped;
  r.lastMs = nowMs;
  return true;
}

// -----------------------------------------------------------------------------
// Master: gemeinsamer HID-Report mit Besitz pro Hälfte
// -----------------------------------------------------------------------------
// Beide Hälften teilen sich einen HID-Report. Eine Eingabe wird dort erst gelöst, wenn keine Hälfte sie
// mehr hält; releaseAll() der rechten Seite lässt linke Eingaben gedrückt (ein Report, kein kurzes Loslassen).
//
// Hid ist die BLE-HID-Klasse (DactylBleComposite) oder ein Test-Double. Benötigt: press/release/write für
// uint8_t und const uint8_t[2], mousePress, mouseRelease, mouseClick, mouseScroll, releaseAll,
// beginReportBatch und endReportBatch (Reports sammeln und einmal senden).
// Rechte Seite: DactylLogic.h ruft press/release/write/releaseAll/mouse* auf. Linke Seite: SplitHidSink.
template <class Hid>
class SplitArbitratedKeyboard : public Hid, public SplitHidSink {
public:
  using Hid::Hid;

  // Gehaltene Eingaben der linken Hälfte inkl. Link-Zustand (für splitApplyHidEvent)
  SplitLeftHeld splitLeft = {};

  // One-Shot-Modifier und Caps Word beider Hälften (DactylOneShot.h)
  OneShotState oneShot = {};

  // --- Rechte Hälfte (DactylLogic.h) ---
  size_t press(uint8_t k) {
    uint8_t mods = oneShotModsForKey(oneShot, heldOneShot(), k, altInReport());
    splitSetKey(right, k, true);
    return pressWithMods(k, mods);
  }
  size_t release(uint8_t k) {
    splitSetKey(right, k, false);
    if (splitSetHasKey(splitLeft.set, k)) return 1;
    return releaseKeepingShift(k, splitLeft.set);
  }
  size_t write(uint8_t k) {
    size_t p = press(k);
    release(k);
    return p;
  }
  size_t press(const uint8_t k[2]) {
    right.media |= splitMediaBits(k);
    return Hid::press(k);
  }
  size_t release(const uint8_t k[2]) {
    uint16_t bits = splitMediaBits(k);
    right.media &= (uint16_t)~bits;
    uint16_t rel = bits & (uint16_t)~splitLeft.set.media;
    if (!rel) return 1;
    uint8_t r[2];
    splitMediaReport(rel, r);
    return Hid::release(r);
  }
  size_t write(const uint8_t k[2]) {
    size_t p = press(k);
    release(k);
    return p;
  }
  void mousePress(uint8_t b) {
    uint8_t mods = oneShotModsForInput(oneShot, heldOneShot(), altInReport());
    right.mouse |= b;
    uint8_t added = beginMods(mods);
    Hid::mousePress(b);
    endMods(added);
  }
  void mouseRelease(uint8_t b) {
    right.mouse &= (uint8_t)~b;
    uint8_t rel = (uint8_t)(b & ~splitLeft.set.mouse);
    if (rel) Hid::mouseRelease(rel);
  }
  void mouseClick(uint8_t b) {
    // Ein Klick löste einen von der anderen Hälfte gehaltenen Button
    if (b & splitLeft.set.mouse) return;
    uint8_t mods = oneShotModsForInput(oneShot, heldOneShot(), altInReport());
    uint8_t added = beginMods(mods);
    Hid::mouseClick(b);
    endMods(added);
  }
  void oneShotPress(uint8_t mask) {
    uint8_t add = (uint8_t)(mask & ~right.oneShot);
    right.oneShot |= add;
    if (add) oneShotKeyDown(oneShot, add);
  }
  void oneShotRelease(uint8_t mask) {
    uint8_t rel = (uint8_t)(mask & right.oneShot);
    right.oneShot &= (uint8_t)~rel;
    if (rel) oneShotKeyUp(oneShot, rel, true);
  }
  void capsWordToggle() { oneShot.capsWord = !oneShot.capsWord; }
  void releaseAll() {
    // Eine gehaltene One-Shot-Taste gilt danach als gelöst, ohne etwas vorzumerken (Combo hat sie verbraucht)
    if (right.oneShot) oneShotKeyUp(oneShot, right.oneShot, false);
    splitSetClear(right);
    if (!splitSetAny(splitLeft.set)) {
      Hid::releaseAll();
      return;
    }
    Hid::beginReportBatch();
    Hid::releaseAll();
    pressSet(splitLeft.set);
    Hid::endReportBatch();
  }

  // Ohne Host (Mac getrennt) alle Zustände und den Report leeren. Physisch gehaltene Tasten müssen danach
  // neu gedrückt werden; das verhindert hängende Tasten nach dem Wiederverbinden.
  void splitResetForHostLoss() {
    splitSetClear(right);
    splitSetClear(splitLeft.set);
    oneShotReset(oneShot);
    Hid::releaseAll();
  }

  const SplitHeldSet &rightHeld() const { return right; }

  // --- Linke Hälfte (SplitHidSink, Zustand ist vorher aktualisiert) ---
  void leftKeyPress(uint8_t code) override {
    pressWithMods(code, oneShotModsForKey(oneShot, heldOneShot(), code, altInReport()));
  }
  void leftKeyRelease(uint8_t code) override {
    if (!splitSetHasKey(right, code)) releaseKeepingShift(code, right);
  }
  void leftMediaPress(uint16_t bits) override {
    uint8_t r[2];
    splitMediaReport(bits, r);
    Hid::press(r);
  }
  void leftMediaRelease(uint16_t bits) override {
    uint16_t rel = bits & (uint16_t)~right.media;
    if (!rel) return;
    uint8_t r[2];
    splitMediaReport(rel, r);
    Hid::release(r);
  }
  void leftMousePress(uint8_t b) override {
    uint8_t added = beginMods(oneShotModsForInput(oneShot, heldOneShot(), altInReport()));
    Hid::mousePress(b);
    endMods(added);
  }
  void leftMouseRelease(uint8_t b) override {
    uint8_t rel = (uint8_t)(b & ~right.mouse);
    if (rel) Hid::mouseRelease(rel);
  }
  void leftMouseClick(uint8_t b) override {
    if (b & right.mouse) return;
    uint8_t added = beginMods(oneShotModsForInput(oneShot, heldOneShot(), altInReport()));
    Hid::mouseClick(b);
    endMods(added);
  }
  void leftMouseScroll(int8_t steps) override { Hid::mouseScroll(steps); }
  void leftOneShotPress(uint8_t mask) override { oneShotKeyDown(oneShot, mask); }
  void leftOneShotRelease(uint8_t mask, bool arm) override { oneShotKeyUp(oneShot, mask, arm); }
  void leftCapsWordToggle() override { oneShot.capsWord = !oneShot.capsWord; }

private:
  SplitHeldSet right = {};

  uint8_t heldOneShot() const { return (uint8_t)(right.oneShot | splitLeft.set.oneShot); }

  // Modifier, die eine Hälfte im Report hält (Modifier-Tasten, implizites Shift gesetzter Zeichen)
  uint8_t reportMods() const {
    uint8_t m = 0;
    for (uint8_t i = 0; i < 8; i++) {
      uint8_t code = (uint8_t)(KEY_LEFT_CTRL + i);
      if (splitSetHasKey(right, code) || splitSetHasKey(splitLeft.set, code)) m |= (uint8_t)(1u << i);
    }
    if (needsShift(right) || needsShift(splitLeft.set)) m |= ONE_SHOT_SHIFT_BIT;
    return m;
  }
  // Alt im Report: Tottaste einer Umlaut-Folge oder Tastenpaar mit Alt. Solche Drücke verbrauchen nichts.
  bool altInReport() const {
    return (reportMods() & (uint8_t)((1u << (KEY_LEFT_ALT - KEY_LEFT_CTRL)) | (1u << (KEY_RIGHT_ALT - KEY_LEFT_CTRL)))) != 0;
  }
  // Startet einen Report mit den One-Shot-Modifiern, die noch nicht im Report sind. Liefert diese Bits.
  uint8_t beginMods(uint8_t mods) {
    uint8_t added = (uint8_t)(mods & ~reportMods());
    if (!added) return 0;
    Hid::beginReportBatch();
    for (uint8_t i = 0; i < 8; i++) {
      if (added & (1u << i)) Hid::press((uint8_t)(KEY_LEFT_CTRL + i));
    }
    return added;
  }
  // Sendet den Report mit Modifier und Druck, danach einen Report ohne die Bits rel
  void endMods(uint8_t added, uint8_t rel) {
    if (!added) return;
    Hid::endReportBatch();
    if (!rel) return;
    Hid::beginReportBatch();
    for (uint8_t i = 0; i < 8; i++) {
      if (rel & (1u << i)) Hid::release((uint8_t)(KEY_LEFT_CTRL + i));
    }
    Hid::endReportBatch();
  }
  void endMods(uint8_t added) { endMods(added, added); }
  // Ein gesetztes Zeichen ('A') hält Shift selbst: sein eigenes Release löst es später
  size_t pressWithMods(uint8_t k, uint8_t mods) {
    uint8_t added = beginMods(mods);
    size_t n = Hid::press(k);
    endMods(added, (uint8_t)(added & ~(impliesShift(k) ? ONE_SHOT_SHIFT_BIT : 0)));
    return n;
  }

  // Große und gesetzte ASCII-Zeichen ('A', '!') drücken implizit Shift; ihr Release löscht im Report das
  // Shift-Bit (DactylBleComposite::release), auch wenn die andere Hälfte Shift noch braucht.
  static bool impliesShift(uint8_t code) {
    return code < 0x80 && (dactylAsciiToHid(code) & DACTYL_ASCII_SHIFT);
  }
  static bool needsShift(const SplitHeldSet &s) {
    if (splitSetHasKey(s, KEY_LEFT_SHIFT)) return true;
    for (int code = 1; code < 0x80; code++) {
      if (splitSetHasKey(s, (uint8_t)code) && impliesShift((uint8_t)code)) return true;
    }
    return false;
  }
  // Release, das ein von other gehaltenes Shift erhält: linkes Shift bleibt im Report, solange other ein
  // gesetztes Zeichen hält; ein gesetztes Zeichen stellt Shift in demselben Report wieder her.
  size_t releaseKeepingShift(uint8_t code, const SplitHeldSet &other) {
    if (code == KEY_LEFT_SHIFT && needsShift(other)) return 1;
    if (!impliesShift(code) || !needsShift(other)) return Hid::release(code);
    Hid::beginReportBatch();
    size_t n = Hid::release(code);
    Hid::press(KEY_LEFT_SHIFT);
    Hid::endReportBatch();
    return n;
  }

  void pressSet(const SplitHeldSet &s) {
    for (int code = 1; code < 256; code++) {
      if (splitSetHasKey(s, (uint8_t)code)) Hid::press((uint8_t)code);
    }
    if (s.media) {
      uint8_t r[2];
      splitMediaReport(s.media, r);
      Hid::press(r);
    }
    if (s.mouse) Hid::mousePress(s.mouse);
  }
};

// -----------------------------------------------------------------------------
// Empfangsring Wi-Fi-Task -> loop() (Single Producer, Single Consumer)
// -----------------------------------------------------------------------------
#define SPLIT_RX_QUEUE_SIZE 64 // Zweierpotenz, damit der Index-Überlauf korrekt bleibt

struct SplitRxQueue {
  SplitHidEvent items[SPLIT_RX_QUEUE_SIZE];
  volatile uint32_t head; // schreibt nur der Wi-Fi-Task
  volatile uint32_t tail; // schreibt nur loop()
  volatile uint32_t dropped;
};
static_assert((SPLIT_RX_QUEUE_SIZE & (SPLIT_RX_QUEUE_SIZE - 1)) == 0, "SPLIT_RX_QUEUE_SIZE muss eine Zweierpotenz sein");

inline void splitRxReset(SplitRxQueue &q) {
  q.head = 0;
  q.tail = 0;
  q.dropped = 0;
}

inline bool splitRxPush(SplitRxQueue &q, const SplitHidEvent &ev) {
  uint32_t head = q.head;
  if (head - q.tail >= SPLIT_RX_QUEUE_SIZE) {
    q.dropped = q.dropped + 1;
    return false;
  }
  q.items[head % SPLIT_RX_QUEUE_SIZE] = ev;
  __atomic_thread_fence(__ATOMIC_RELEASE);
  q.head = head + 1;
  return true;
}

inline bool splitRxPop(SplitRxQueue &q, SplitHidEvent &out) {
  uint32_t tail = q.tail;
  if (q.head == tail) return false;
  __atomic_thread_fence(__ATOMIC_ACQUIRE);
  out = q.items[tail % SPLIT_RX_QUEUE_SIZE];
  __atomic_thread_fence(__ATOMIC_RELEASE);
  q.tail = tail + 1;
  return true;
}

// -----------------------------------------------------------------------------
// Master: Empfangssteuerung (aus loop() aufgerufen)
// -----------------------------------------------------------------------------
struct SplitRxReport {
  uint8_t applied;      // ausgeführte Ereignisse (für Aktivität und Ausgabe)
  uint8_t keyEvents;    // empfangene KEY_EVENTs (Aktivität: auch eine linke Taste mit Aktion 0)
  uint8_t keyEventsDropped; // KEY_EVENTs über SPLIT_KEY_EVENTS_PER_RX, nicht gemeldet (eine Sammelzeile)
  bool linkLost;        // Link gerade ausgefallen, linke Eingaben gelöst
  bool overflow;        // Empfangsring war voll, linke Eingaben gelöst
  bool hostLost;        // Mac-Verbindung gerade verloren, alle Eingaben gelöst
};

// Ein Ereignis wird je ausgeführter HID-Operation gemeldet (Ausgabe/Aktivität in der Firmware)
typedef void (*SplitRxAppliedFn)(const SplitHidEvent &ev);

// Arbeitet den Empfangsring ab. hostReady = Mac verbunden und nicht im Config Mode.
// - Ohne Host wird nichts ausgeführt; der Link gilt trotzdem als lebendig. Beim Übergang
//   "Host bereit -> nicht bereit" werden alle Zustände geleert (keine hängende Taste nach Reconnect).
// - Ein neu verworfenes Paket (voller Ring) kann ein Release gewesen sein: alle linken Eingaben lösen.
// - KEY_EVENT ist reine Diagnose: onKeyEvent meldet es auch ohne Host, es zählt nicht als ausgeführt,
//   aber in keyEvents (Aktivität). Höchstens SPLIT_KEY_EVENTS_PER_RX pro Aufruf: Jede Serial-Zeile blockiert
//   loop() (etwa 4 ms bei 115200 Baud), eine Flut mit gefälschter linker MAC soll das Tippen am Master nicht
//   bremsen. Die linke Hälfte sendet ein Paket nach dem anderen; normales Tippen bleibt weit darunter.
#define SPLIT_KEY_EVENTS_PER_RX 4
// - LAYER_STATE hat keine HID-Wirkung: onLayer übernimmt es auch ohne Host. Es zählt nicht als Aktivität,
//   denn das Auffrischen jede Sekunde hielte den Master sonst immer wach. Das Paket trägt den ganzen Zustand:
//   onLayer erhält nur das neueste Paket eines Aufrufs, höchstens eines (eine Flut mit gefälschter linker MAC
//   erzeugt höchstens eine LAYER-Zeile je loop()). Ein SET in einem überholten Paket entfällt damit; die
//   linke Hälfte sendet es weiter, bis der Master seine Nummer zurückmeldet.
// - FW_VERSION hat keine HID-Wirkung: splitNoteLeftRx setzt splitLeft.fw auch ohne Host; es zählt nicht als
//   Aktivität.
template <class Kbd>
SplitRxReport splitProcessRx(Kbd &kbd, SplitRxQueue &q, uint32_t &droppedSeen, bool &hostWasReady,
                             bool hostReady, unsigned long nowMs, SplitRxAppliedFn onApplied,
                             SplitRxAppliedFn onKeyEvent = nullptr, SplitRxAppliedFn onLayer = nullptr) {
  SplitRxReport rep = {0, 0, 0, false, false, false};
  if (!hostReady && hostWasReady) {
    kbd.splitResetForHostLoss();
    rep.hostLost = true;
  }
  hostWasReady = hostReady;

  // Zählerstand vor dem Abarbeiten lesen. Gelöst wird erst danach: Ein PRESS, der vor dem verworfenen
  // Paket im Ring lag, liefe sonst nach dem Lösen und bliebe gedrückt.
  uint32_t dropped = q.dropped;

  SplitHidEvent ev;
  SplitHidEvent layerEv = {};
  bool haveLayer = false;
  uint8_t keyEvents = 0;
  while (splitRxPop(q, ev)) {
    splitNoteLeftRx(kbd.splitLeft, ev, nowMs);
    if (ev.op == SPLIT_OP_FW_VERSION) continue;
    if (ev.op == SPLIT_OP_KEY_EVENT) {
      kbd.splitLeft.lastRxMs = nowMs;
      kbd.splitLeft.linkUp = true;
      if (rep.keyEvents < 255) rep.keyEvents++;
      if (onKeyEvent && keyEvents < SPLIT_KEY_EVENTS_PER_RX) {
        keyEvents++;
        onKeyEvent(ev);
      } else if (onKeyEvent && rep.keyEventsDropped < 255) {
        rep.keyEventsDropped++;
        splitCountAdd(kbd.splitLeft.keyDropped, 1);
      }
      continue;
    }
    if (ev.op == SPLIT_OP_LAYER_STATE) {
      kbd.splitLeft.lastRxMs = nowMs;
      kbd.splitLeft.linkUp = true;
      layerEv = ev;
      haveLayer = true;
      continue;
    }

    if (!hostReady) {
      kbd.splitLeft.lastRxMs = nowMs;
      kbd.splitLeft.linkUp = true;
      continue;
    }
    if (!splitApplyHidEvent(kbd.splitLeft, ev, nowMs, kbd)) continue;
    if (rep.applied < 255) rep.applied++;
    if (onApplied) onApplied(ev);
  }

  // Ein verworfenes Paket kann ein Release gewesen sein: Gedrücktes ist nicht mehr verlässlich
  if (dropped != droppedSeen) {
    splitCountAdd(kbd.splitLeft.rxDropped, dropped - droppedSeen);
    droppedSeen = dropped;
    rep.overflow = true;
    if (hostReady) splitReleaseHeld(kbd.splitLeft, kbd);
  }
  if (haveLayer && onLayer) onLayer(layerEv);
  if (splitCheckLinkTimeout(kbd.splitLeft, nowMs, kbd)) rep.linkLost = true;
  return rep;
}

