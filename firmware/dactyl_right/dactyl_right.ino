#include "DactylKeycodes.h"
#include <esp_mac.h>
#include <esp_bt_main.h>
#include <esp_gap_ble_api.h>
#include <nvs_flash.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLESecurity.h>
#include <esp_system.h>
#include <vector>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <driver/gpio.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

/*
 * =============================================================================
 * Dactyl True-Wireless Split Keyboard — Rechte Hand (Firmware)
 * Board: WEMOS LOLIN32 Lite (ESP32-D0WDQ6-V3)
 * Device Name: "Dactyl Keyboard"
 * =============================================================================
 */

#define CONFIG_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CONFIG_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CONFIG_MODE_MAGIC          0xDAC7CF60UL

#include "DactylCommon.h"

// Überlebt ESP.restart() im RTC-Slow-Memory, wird aber beim Kaltstart ignoriert
RTC_NOINIT_ATTR uint32_t rtcConfigModeMagic;

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);
BLECharacteristic *pConfigCharacteristic = nullptr;
volatile bool isConfigMode = false;
volatile bool isBleTransitioning = false;
volatile bool exitConfigRequested = false;
volatile bool enterConfigRequested = false;

#include "DactylConfigBleCallbacks.h"
#include "DactylBleComposite.h"
#include "DactylSplitHid.h"
#include "DactylSplitCrypto.h"

class DactylBleKeyboard : public DactylBleComposite {
public:
  DactylBleKeyboard(std::string name, std::string mfr, uint8_t batt)
    : DactylBleComposite(name, mfr, batt) {}

  void onConnect(BLEServer *pServer) override {
    DactylBleComposite::onConnect(pServer);
  }

  void onDisconnect(BLEServer *pServer) override {
    if (isBleTransitioning || enterConfigRequested || exitConfigRequested) {
      return;
    }
    if (pServer->getConnectedCount() <= 1) {
      DactylBleComposite::onDisconnect(pServer);
    }
  }

protected:
  void onStarted(BLEServer *pServer) override {
    BLEService *pConfigService = pServer->createService(CONFIG_SERVICE_UUID);
    pConfigCharacteristic = pConfigService->createCharacteristic(
      CONFIG_CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_NOTIFY
    );
    pConfigCharacteristic->setCallbacks(new ConfigCallbacks());
    pConfigCharacteristic->addDescriptor(new BLE2902());
    pConfigService->start();

    // WICHTIG: Im normalen Keyboard-Modus KEINE CONFIG_SERVICE_UUID im Scan-Response senden,
    // damit Chrome watchAdvertisements() nicht fälschlicherweise im Tastaturmodus triggert
    // und der Mac die Tastatur als reines HID-Peripheral sieht!
    Serial.println("BLE HID (Keyboard + Media + Mouse) + Config Service bereit.");
  }
};

// Gemeinsamer HID-Report beider Hälften mit Besitz pro Hälfte (DactylSplitHid.h)
SplitArbitratedKeyboard<DactylBleKeyboard> bleKeyboard("Dactyl Keyboard", "Dactyl DIY", 100);

// 6 Zeilen (Rows)
const int ROW_PINS[6] = {13, 14, 27, 26, 33, 32};
const int NUM_ROWS = 6;

// 7 Spalten (Columns) - von links nach rechts
const int COL_PINS[7] = {23, 19, 18, 17, 16, 4, 25};
const int NUM_COLS = 7;

// QWERTY / QWERTZ Basis-Belegung für die rechte Hand (Dactyl Manuform)
// Finger: 6 Spalten (Col 0..5), R4C0 existiert nicht
// Daumen: R5C0 (T1+T2), R2C6 (Mitte links), R5C4 (Unten links), R5C3 (2U Mitte), R5C2 (2U Rechts)

// [[[START_SETTINGS]]]
String deviceName = "Dactyl Keyboard";
uint8_t debounceMs = 5;
uint16_t comboTimeoutMs = 40;
uint16_t tappingTermMs = 200;
uint32_t standbyTimeoutMinutes = 5;    // Stufe 1: 5 Min bis Standby (80 MHz, gedrosselter Scan, BLE bleibt an)
uint32_t deepSleepTimeoutMinutes = 60; // Stufe 2: 60 Min (1h) bis Deep Sleep (~10 µA)
// [[[END_SETTINGS]]]

ComboRuntime comboRuntime[MAX_COMBOS];

// [[[START_COMBOS]]]
uint8_t numCombos = 2;
KeyCombo userCombos[MAX_COMBOS] = {
  { 2, 1, 2, 2, 0, KEY_ESC },       // J + K -> Escape
  { 2, 1, 2, 3, 1, KEY_LEFT_CTRL }  // J + L -> Ctrl
};
// [[[END_COMBOS]]]


// [[[START_KEY_PAIRS]]]
uint8_t numKeyPairs = 0;
KeyPair userKeyPairs[MAX_KEY_PAIRS] = {
  { 0, 0 }
};
// [[[END_KEY_PAIRS]]]

// [[[START_MACROS]]]
uint8_t numMacros = 0;
uint8_t macroLengths[MAX_MACROS] = { 0 };
MacroStep userMacros[MAX_MACROS][MAX_MACRO_STEPS] = {
  { { 0, 0, 0 } }
};
// [[[END_MACROS]]]

unsigned long lastActivityTime = 0;
bool isStandby = false;

void exitConfigMode();
void enterConfigMode();
void toggleConfigMode();
void checkUserCombos();
void stopMacro(bool releaseKeys);
void sendSplitLayerRelease();

void enterConfigMode() {
  if (isConfigMode) return;
  isBleTransitioning = true;
  enterConfigRequested = false;

  stopMacro(false);
  bleKeyboard.releaseAll();
  sendSplitLayerRelease();
  Serial.println("\n=============================================");
  Serial.println("  [CONFIG MODE] AKTIVIERT -> Starte Config-BLE...");
  Serial.println("=============================================");
  sendConfigNotification("MODE:CONFIG");
  delay(80);

  BLEServer *pServer = BLEDevice::getServer();
  if (pServer) {
    // 1. Zuerst altes HID-Advertising stoppen
    pServer->getAdvertising()->stop();
    delay(25);

    // 2. Aktive macOS HID-Verbindung sauber trennen
    std::vector<uint16_t> peers;
    for (auto const& peer : pServer->getPeerDevices(false)) {
      peers.push_back(peer.first);
    }
    for (uint16_t id : peers) {
      pServer->disconnect(id);
    }

    // 3. Warten, bis der asynchrone HCI Disconnect abgeschlossen ist
    for (int i = 0; i < 35 && pServer->getConnectedCount() > 0; i++) {
      delay(10);
    }
    delay(60);
  }

  // 4. Bluedroid sauber beenden, damit die gültigen macOS HID-Bonding-Keys
  //    garantiert ins NVS geschrieben werden, BEVOR wir in den unverschlüsselten Config-Modus booten!
  esp_bluedroid_disable();
  delay(60);

  // 5. RTC-Flag setzen und sauber neu starten (~200ms).
  //    Dadurch startet der Config-Modus in einem komplett isolierten BLE-Stack
  //    OHNE HID-Service (0x1812) und OHNE BLESecurity (m_forceSecurity = false),
  //    sodass die macOS-Kopplung niemals durch Chrome/Web-Bluetooth überschrieben wird!
  rtcConfigModeMagic = CONFIG_MODE_MAGIC;
  Serial.println("[BLE] Starte isolierten Config-Mode-Stack...");
  Serial.flush();
  ESP.restart();
}

void exitConfigMode() {
  if (!isConfigMode) return;
  isBleTransitioning = true;
  isConfigMode = false;
  exitConfigRequested = false;
  rtcConfigModeMagic = 0;

  Serial.println("\n=============================================");
  Serial.println("  [CONFIG MODE] BEENDET -> Starte Tastatur neu");
  Serial.println("=============================================");
  sendConfigNotification("MODE:KEYBOARD");
  delay(120);

  BLEServer *pServer = BLEDevice::getServer();
  if (pServer) {
    pServer->getAdvertising()->stop();
    std::vector<uint16_t> peers;
    for (auto const& peer : pServer->getPeerDevices(false)) {
      peers.push_back(peer.first);
    }
    for (uint16_t id : peers) {
      pServer->disconnect(id);
    }
    for (int i = 0; i < 25 && pServer->getConnectedCount() > 0; i++) {
      delay(10);
    }
    delay(50);
  }

  // WICHTIG: Im Config-Modus KEIN esp_bluedroid_disable() aufrufen, damit Bluedroid
  // niemals leere/unverschlüsselte Security-Tabellen über den gespeicherten Mac-Bond ins NVS schreibt!
  Serial.println("[BLE] Starte sauberen Neustart für Mac-HID-Verbindung...");
  Serial.flush();
  ESP.restart();
}

void toggleConfigMode() {
  if (isConfigMode) {
    exitConfigMode();
  } else {
    enterConfigMode();
  }
}

void exitStandby() {
  if (isStandby) {
    isStandby = false;
    setCpuFrequencyMhz(240);
    Serial.println("[POWER] Standby beendet -> CPU wieder auf 240 MHz");
  }
}

void enterStandby() {
  if (!isStandby) {
    isStandby = true;
    setCpuFrequencyMhz(80);
    Serial.println("[POWER] Inaktivität erreicht -> Standby aktiv (CPU 80 MHz, gedrosselter Matrix-Scan)");
  }
}

void enterDeepSleep() {
  Serial.println("\n[POWER] Inaktivitäts-Timeout erreicht! Gehe in Deep Sleep...");
  Serial.flush();

  sendConfigNotification("SLEEP_STARTING");
  // Laufendes Makro beenden und seine Codes am Mac loslassen, bevor die Verbindung endet
  stopMacro(true);
  sendSplitLayerRelease();
  delay(30);

  // 1. Spalten als OUTPUT HIGH halten (3.3V) - sowoh für RTC als auch normale GPIOs
  for (int c = 0; c < NUM_COLS; c++) {
    gpio_num_t pin = (gpio_num_t)COL_PINS[c];
    if (rtc_gpio_is_valid_gpio(pin)) {
      rtc_gpio_init(pin);
      rtc_gpio_set_direction(pin, RTC_GPIO_MODE_OUTPUT_ONLY);
      rtc_gpio_set_level(pin, 1);
      rtc_gpio_hold_en(pin);
    } else {
      pinMode(COL_PINS[c], OUTPUT);
      digitalWrite(COL_PINS[c], HIGH);
      gpio_hold_en(pin);
    }
  }
  gpio_deep_sleep_hold_en();

  // 2. Zeilen als RTC-Eingänge mit PULLDOWN (0V)
  uint64_t ext1_mask = 0;
  for (int r = 0; r < NUM_ROWS; r++) {
    gpio_num_t pin = (gpio_num_t)ROW_PINS[r];
    rtc_gpio_init(pin);
    rtc_gpio_set_direction(pin, RTC_GPIO_MODE_INPUT_ONLY);
    rtc_gpio_pulldown_en(pin);
    rtc_gpio_pullup_dis(pin);
    rtc_gpio_hold_en(pin);
    ext1_mask |= (1ULL << pin);
  }

  // 3. Ext1 Wakeup aktivieren (ANY_HIGH)
  esp_sleep_enable_ext1_wakeup(ext1_mask, ESP_EXT1_WAKEUP_ANY_HIGH);

  Serial.println("[POWER] Deep Sleep aktiv. Drücke eine beliebige Taste zum Aufwachen!");
  Serial.flush();

  esp_deep_sleep_start();
}

SemaphoreHandle_t configMutex = nullptr;

Preferences preferences;
// [[[START_LAYER_NAMES]]]
String layerNames[NUM_LAYERS] = {
  "Base", "Nav & Pfeile", "Symbole", "Numpad",
  "Function", "Media", "Shortcuts", "Custom"
};
// [[[END_LAYER_NAMES]]]

// [[[START_KEYMAP]]]
uint16_t KEYMAP[NUM_LAYERS][6][7] = {
  // Layer 0 (Base)
  {
    { '6'             , '7'             , '8'             , '9'             , '0'             , '-'             , 0                },
    { 'z'             , 'u'             , 'i'             , 'o'             , 'p'             , '['             , 0                },
    { 'h'             , 'j'             , 'k'             , 'l'             , ';'             , '\''            , KEY_DELETE       },
    { 'n'             , 'm'             , ','             , '.'             , '/'             , KEY_RIGHT_SHIFT , 0                },
    { 0               , KEY_LEFT_ARROW  , KEY_DOWN_ARROW  , KEY_UP_ARROW    , KEY_RIGHT_ARROW , KEY_RIGHT_ALT   , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 1 (Nav & Arrows)
  {
    { ACT_TG_0        , KEY_F7          , KEY_F8          , KEY_F9          , KEY_F10         , KEY_F11         , 0                },
    { 0               , KEY_HOME        , KEY_UP_ARROW    , KEY_END         , KEY_PAGE_UP     , 0               , 0                },
    { 0               , KEY_LEFT_ARROW  , KEY_DOWN_ARROW  , KEY_RIGHT_ARROW , KEY_PAGE_DOWN   , 0               , KEY_DELETE       },
    { 0               , 0               , 0               , 0               , 0               , KEY_RIGHT_SHIFT , 0                },
    { 0               , KEY_LEFT_ARROW  , KEY_DOWN_ARROW  , KEY_UP_ARROW    , KEY_RIGHT_ARROW , KEY_RIGHT_ALT   , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 2 (Symbols & Numbers)
  {
    { '6'             , '7'             , '8'             , '9'             , '0'             , '='             , 0                },
    { 0               , '7'             , '8'             , '9'             , '/'             , 0               , 0                },
    { 0               , '4'             , '5'             , '6'             , '-'             , 0               , KEY_DELETE       },
    { 0               , '1'             , '2'             , '3'             , '='             , KEY_RIGHT_SHIFT , 0                },
    { 0               , '0'             , '.'             , ','             , KEY_RETURN      , KEY_RIGHT_ALT   , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 3 (Numpad)
  {
    { '6'             , '7'             , '8'             , '9'             , '0'             , '='             , 0                },
    { 0               , '7'             , '8'             , '9'             , '/'             , 0               , 0                },
    { 0               , '4'             , '5'             , '6'             , '-'             , 0               , KEY_DELETE       },
    { 0               , '1'             , '2'             , '3'             , '='             , KEY_RIGHT_SHIFT , 0                },
    { 0               , '0'             , '.'             , ','             , KEY_RETURN      , KEY_RIGHT_ALT   , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 4 (Function / Media)
  {
    { KEY_F1          , KEY_F2          , KEY_F3          , KEY_F4          , KEY_F5          , KEY_F6          , 0                },
    { KEY_F7          , KEY_F8          , KEY_F9          , KEY_F10         , KEY_F11         , KEY_F12         , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , KEY_DELETE       },
    { 0               , 0               , 0               , 0               , 0               , KEY_RIGHT_SHIFT , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 5 (Media & Sound)
  {
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , KEY_UP_ARROW    , 0               , 0               , 0               , 0                },
    { 0               , KEY_LEFT_ARROW  , KEY_DOWN_ARROW  , KEY_RIGHT_ARROW , ' '             , 0               , KEY_DELETE       },
    { 0               , 0               , 0               , 0               , 0               , KEY_RIGHT_SHIFT , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 6 (Shortcuts)
  {
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , KEY_DELETE       },
    { 0               , 0               , 0               , 0               , 0               , KEY_RIGHT_SHIFT , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  },

  // Layer 7 (Custom / Gaming)
  {
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , KEY_DELETE       },
    { 0               , 0               , 0               , 0               , 0               , KEY_RIGHT_SHIFT , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { KEY_LEFT_GUI    , KEY_LEFT_ALT    , KEY_RETURN      , ' '             , KEY_TAB         , KEY_BACKSPACE   , KEY_ESC          }
  }

};
// [[[END_KEYMAP]]]

// Halte-Aktionen (Mod-Tap / Layer-Tap): 0 = keine Halte-Aktion, sonst Aktion beim Festhalten > TAPPING_TERM_MS
// Kennung der einkompilierten Default-Belegung. 0 = Repository-Stand (Flash behält die Belegung im NVS).
// "Auf Dactyl flashen" setzt hier eine neue Kennung, damit die App-Belegung das NVS immer überschreibt.
// [[[START_DEFAULTS_ID]]]
#define KEYMAP_DEFAULTS_ID 0UL
// [[[END_DEFAULTS_ID]]]

// [[[START_HOLDMAP]]]
uint16_t HOLDMAP[NUM_LAYERS][6][7] = {};
// [[[END_HOLDMAP]]]

// Doppel-Tipp-Aktionen (Tap-Dance): 0 = keine, sonst Aktion bei zwei Tipps innerhalb von TAPPING_TERM_MS
// [[[START_DTAPMAP]]]
uint16_t DTAPMAP[NUM_LAYERS][6][7] = {};
// [[[END_DTAPMAP]]]

bool keyState[6][7] = {false};
// Zuletzt gelesener Matrix-Zustand. keyState folgt ihm erst, wenn die Änderung ausgeführt ist: Wartet links ein
// Einzel-Tipp (SPLIT_OP_TAP_PENDING), hält splitLocalDefer die Änderung kurz zurück.
bool rawKeyState[6][7] = {false};
uint16_t pressedAction[6][7] = {0};
unsigned long keyPressTime[6][7] = {0};
bool keySentToHost[6][7] = {false};
bool momentaryLayers[NUM_LAYERS] = {false};
bool toggleLayers[NUM_LAYERS] = {false};

// DEVICE_INFO enthält auf dem Master auch den Firmwarestand der linken Hälfte (splitLeftFwStatus)
#define DEVICE_INFO_LEFT_FW() splitLeftFwStatus(bleKeyboard.splitLeft, millis())
// ... und die Link-Statistik der linken Hälfte ("left_link", splitLeftLinkJson)
int deviceInfoLeftLink(char *buf, size_t size);
#define DEVICE_INFO_LEFT_LINK(buf, size) deviceInfoLeftLink(buf, size)
// Repeat über beide Hälften (SPLIT_OP_REPEAT / SPLIT_OP_REPEAT_RUN): war links zuletzt, führt die linke Hälfte
// die Wiederholung aus; eine aufgezeichnete rechte Aktion macht rechts wieder zur letzten Hälfte
bool masterRepeatRemotePress(uint8_t r, uint8_t c);
void masterRepeatRemoteRelease(uint8_t r, uint8_t c);
#define REPEAT_REMOTE_PRESS(r, c) masterRepeatRemotePress(r, c)
#define REPEAT_REMOTE_RELEASE(r, c) masterRepeatRemoteRelease(r, c)
#define REPEAT_RECORDED() (bleKeyboard.splitLeft.repeatLastLeft = false)
void masterRepeatReleaseHeldPairs();
#define REPEAT_RELEASE_HELD_PAIRS() masterRepeatReleaseHeldPairs()
#include "DactylLogic.h"
#include "DactylConfigBle.h"

// ESP-NOW-Empfang der linken Hälfte: fertige HID-Operationen, ausgeführt auf bleKeyboard
// (SplitArbitratedKeyboard: Besitz pro Hälfte im gemeinsamen HID-Report)
static SplitRxQueue splitRxQueue;
static bool splitRxReady = false;
static uint32_t splitRxDroppedSeen = 0;
static bool splitHostWasReady = false;
static SplitLinkReporter splitLinkReporter;

// DEVICE_INFO.left_link. Im Config Mode und nach einem fehlgeschlagenen Start von ESP-NOW läuft der Empfang
// nicht (setupSplitReceiver nur im Tastaturmodus): "null" statt eines Stands, der "nie verbunden" vortäuscht.
int deviceInfoLeftLink(char *buf, size_t size) {
  if (isConfigMode || !splitRxReady) return snprintf(buf, size, "null");
  return splitLeftLinkJson(buf, size, bleKeyboard.splitLeft, millis());
}
// Eigenes Tippen an die linke Hälfte melden (synchronisierte Inaktivitäts-Timer, DactylSplitHid.h)
static bool splitActivityPeerReady = false;
static SplitActivityThrottle splitActivity;
// Layer-Abgleich mit der linken Hälfte (SPLIT_OP_LAYER_STATE, DactylSplitHid.h)
static SplitLayerSync splitLayerSync;
static SplitRemoteLayers splitRemoteLayers;
// REPEAT_RUN an die linke Hälfte, mit zweitem Versand nach SPLIT_REPEAT_COPY_MS (kein Retry wie links)
static SplitRepeatSender splitRepeatSender;
// Ein Loslassen oder RELEASE_ALL darf nicht verloren gehen, wenn GET_INFO den Mutex hält: es bleibt vorgemerkt
// und läuft beim nächsten Durchlauf (sonst bliebe die rechte Taste am Mac gehalten)
static SplitRepeatDeferred splitRepeatDeferred;
// Nummer des REPEAT_RUN-Drückens je Repeat-Taste rechts, für das passende Loslassen
static uint8_t masterRepeatRunSeq[NUM_ROWS][NUM_COLS] = {};

// Ein Sendefehler ändert nichts: die Kopien (und beim Drücken die Auffrischung) senden das Paket noch einmal
static void sendRepeatRun(const SplitHidEvent &ev) {
  if (!splitActivityPeerReady || isConfigMode) return;
  esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&ev, sizeof(ev));
  splitRepeatSchedule(splitRepeatSender, ev, millis());
}

bool masterRepeatRemotePress(uint8_t r, uint8_t c) {
  SplitHidEvent run;
  if (!splitRepeatRightPress(bleKeyboard.splitLeft, splitRepeatSender, run, millis())) return false;
  masterRepeatRunSeq[r][c] = (uint8_t)run.arg;
  sendRepeatRun(run);
  return true;
}

void masterRepeatRemoteRelease(uint8_t r, uint8_t c) {
  sendRepeatRun(splitRepeatRightRelease(splitRepeatSender, masterRepeatRunSeq[r][c]));
}

// Kopien eines REPEAT_RUN und die Auffrischung des offenen Drückens senden, wenn sie fällig sind
static void sendSplitRepeatCopyIfDue() {
  if (!splitActivityPeerReady || isConfigMode) return;
  SplitHidEvent ev;
  unsigned long now = millis();
  while (splitRepeatDue(splitRepeatSender, now, ev)) {
    esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&ev, sizeof(ev));
  }
  if (splitRepeatRefresh(splitRepeatSender, now, ev)) {
    esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&ev, sizeof(ev));
  }
}
// Eigene Matrix-Änderungen, die auf einen wartenden linken Einzel-Tipp warten (DactylSplitHid.h)
static SplitLocalDefer splitLocalDefer;

static void applyLocalKeyChange(uint8_t r, uint8_t c, bool pressed, unsigned long atMs) {
  keyState[r][c] = pressed;
  onMatrixKeyChange(r, c, pressed, atMs);
}

static bool leftTapPendingNow() {
  return !isConfigMode && splitLeftTapPending(bleKeyboard.splitLeft, millis());
}

// Läuft auf dem Wi-Fi-Task: nur prüfen und einreihen, kein Serial, kein BLE
static void onSplitDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  SplitHidEvent ev;
  if (info == nullptr || !parseSplitHidPacket(info->src_addr, data, len, ev)) return;
  splitRxPush(splitRxQueue, ev);
}

// Muss nach esp_base_mac_addr_set() laufen, damit die Wi-Fi-STA-MAC 2E:BC:BB:81:61:A6 ist
void setupSplitReceiver() {
  splitRxReset(splitRxQueue);
  splitHeldReset(bleKeyboard.splitLeft);
  splitRepeatSenderReset(splitRepeatSender, esp_random());
  splitRepeatDeferred = {};
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(SPLIT_ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println("[SPLIT] ERR ESPNOW_INIT");
    return;
  }
  if (esp_now_register_recv_cb(onSplitDataRecv) != ESP_OK) {
    Serial.println("[SPLIT] ERR ESPNOW_RECV_CB");
    esp_now_deinit();
    return;
  }
  // Verschlüsselte Strecke (DactylSplitCrypto.h): Pakete der linken Hälfte kommen nur mit demselben LMK an.
  // Ohne Peer empfängt der Master nichts von links (der Peer trägt den LMK) und sendet nichts zurück.
  if (esp_now_set_pmk(SPLIT_ESPNOW_PMK) != ESP_OK) {
    Serial.println("[SPLIT] ERR ESPNOW_PMK");
    esp_now_deinit(); // kein Empfang in den Ring, solange splitRxReady false ist
    return;
  }
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, SPLIT_LEFT_MAC, sizeof(SPLIT_LEFT_MAC));
  peer.channel = SPLIT_ESPNOW_CHANNEL;
  peer.ifidx = WIFI_IF_STA;
  splitPeerSetEncryption(peer.encrypt, peer.lmk);
  splitActivityReset(splitActivity);
  splitLayerReset(splitLayerSync);
  splitRemoteLayersReset(splitRemoteLayers);
  splitActivityPeerReady = (esp_now_add_peer(&peer) == ESP_OK);
  if (!splitActivityPeerReady) {
    Serial.println("[SPLIT] ERR ESPNOW_PEER (verschlüsselter Peer links)");
    esp_now_deinit();
    return;
  }
  splitRxReady = true;
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  Serial.printf("[SPLIT] ESP-NOW-Empfang bereit (Kanal %d, verschlüsselt, Wi-Fi-STA-MAC %02X:%02X:%02X:%02X:%02X:%02X)\n",
    SPLIT_ESPNOW_CHANNEL, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static void onSplitApplied(const SplitHidEvent &ev) {
  Serial.printf("SPLIT_HID:{\"op\":%u,\"code\":%u,\"arg\":%d}\n", ev.op, ev.code, ev.arg);
}

// Matrix-Position der linken Hälfte für den Live-Monitor der App (nur USB-Serial, nie über BLE)
static void onSplitKeyEvent(const SplitHidEvent &ev) {
  Serial.printf("SPLIT_KEY:{\"r\":%u,\"c\":%u,\"pressed\":%d,\"layer\":%u}\n",
    splitKeyEventRow(ev.code), splitKeyEventCol(ev.code), splitKeyEventPressed(ev.code) ? 1 : 0,
    splitKeyEventLayer(ev.code));
}

// Vor einem linken Tastendruck: zurückgehaltene eigene Tasten (nur wenn links kein Tipp mehr wartet) und wartende
// eigene Einzel-Tipps zuerst senden, damit die Zeichen in der Reihenfolge der Anschläge ankommen
static void onSplitBeforeLeftPress(const SplitHidEvent &ev) {
  (void)ev;
  // GET_INFO über BLE hält den Mutex kurz; ohne ihn bleibt die alte Reihenfolge, mit Hinweis
  if (configMutex && xSemaphoreTake(configMutex, pdMS_TO_TICKS(200)) != pdTRUE) {
    Serial.println("WARN: configMutex busy, Einzel-Tipp nicht vor linker Taste gesendet");
    return;
  }
  splitBeforeLeftPress(splitLocalDefer, leftTapPendingNow(), applyLocalKeyChange, flushAllDoubleTaps);
  if (configMutex) xSemaphoreGive(configMutex);
}

// Repeat-Taste links (SPLIT_OP_REPEAT) und RELEASE_ALL der linken Hälfte: der Master entscheidet, wer
// wiederholt (DactylSplitHid.h). Die Wiederholung rechts braucht den Mutex wie jede Ausführung einer Aktion.
struct MasterRepeatEnv {
  uint16_t lastAction() { return lastRepeatAction; }
  void localPress(uint16_t a) { repeatPress(a); }
  void localRelease(uint16_t a) { repeatRelease(a); }
  void sendRun(const SplitHidEvent &e) { sendRepeatRun(e); }
};

static bool applyRepeatLocked(const SplitHidEvent &ev) {
  if (configMutex && xSemaphoreTake(configMutex, pdMS_TO_TICKS(200)) != pdTRUE) return false;
  MasterRepeatEnv env;
  splitRepeatMasterEvent(bleKeyboard.splitLeft, splitRepeatSender, ev, millis(), env);
  if (configMutex) xSemaphoreGive(configMutex);
  return true;
}

// Vor CLEAR_PAIRS (releaseHeldKeyPairs): ein Paar lösen, das eine linke Repeat-Taste hält.
// Läuft im Befehlspfad unter configMutex, also ohne eigenen Take.
void masterRepeatReleaseHeldPairs() {
  uint16_t a = splitRepeatTakeHeldPair(bleKeyboard.splitLeft, [](uint16_t x) { return isKeyPairAction(x); });
  if (a) repeatRelease(a);
}

static void servicePendingRepeat() {
  splitRepeatServicePending(splitRepeatDeferred, applyRepeatLocked);
}

static void onSplitRepeat(const SplitHidEvent &ev) {
  if (!splitRepeatDeliver(splitRepeatDeferred, ev, applyRepeatLocked)) {
    Serial.println("WARN: configMutex busy, Repeat der linken Hälfte verzögert");
  }
}

// Layer-Zustand der linken Hälfte: ihre MO-Ebenen, mit SET auch ihre Toggle-Änderung
static void onSplitLayer(const SplitHidEvent &ev) {
  bool set = splitLayerMasterReceive(splitLayerSync, splitRemoteLayers, ev, millis());
  applyRemoteLayerState(splitLayerMomentary(ev), set, splitLayerToggles(ev));
}

// Ereignisse der linken Hälfte aus loop() ausführen (Logik: splitProcessRx in DactylSplitHid.h)
void processSplitEvents() {
  if (!splitRxReady) return;
  unsigned long now = millis();
  bool hostReady = !isConfigMode && bleKeyboard.isConnected();
  bool linkWasUp = bleKeyboard.splitLeft.linkUp;
  SplitRxReport rep = splitProcessRx(bleKeyboard, splitRxQueue, splitRxDroppedSeen, splitHostWasReady,
                                     hostReady, now, onSplitApplied, onSplitKeyEvent, onSplitLayer,
                                     onSplitBeforeLeftPress, onSplitRepeat);
  // Linke Hälfte gerade erreichbar (Start, Aufwachen): sofort den Layer-Zustand des Masters senden
  // Linke Hälfte nicht erreichbar, aus oder im Deep Sleep: ihre gehaltenen MO-Ebenen verfallen
  if (splitLayerMasterAfterRx(splitLayerSync, splitRemoteLayers, linkWasUp, bleKeyboard.splitLeft.linkUp,
                              rep.linkLost, now)) {
    applyRemoteLayerState(0, false, 0);
  }
  // Auch ein KEY_EVENT (linke Taste mit Aktion 0) hält den Master wach
  if (rep.applied || rep.keyEvents) {
    lastActivityTime = now;
    exitStandby();
  }
  // Firmwarestand links bei jeder Änderung für die App (nur USB-Serial; BLE liest DEVICE_INFO.left_fw)
  static int32_t leftFwReported = 0;
  int32_t leftFw = splitLeftFwStatus(bleKeyboard.splitLeft, now);
  if (leftFw != leftFwReported) {
    leftFwReported = leftFw;
    Serial.printf("SPLIT_FW:{\"fw\":%ld}\n", (long)leftFw);
  }
  // Link-Status und Zähler für die App (nur USB-Serial; BLE liest DEVICE_INFO.left_link)
  if (splitLinkReportDue(splitLinkReporter, bleKeyboard.splitLeft, now)) {
    char linkBuf[160];
    splitLeftLinkJson(linkBuf, sizeof(linkBuf), bleKeyboard.splitLeft, now);
    Serial.printf("SPLIT_LINK:%s\n", linkBuf);
  }
  // Ein verlorenes Release löst die App nach SPLIT_KEY_STALE_MS; die Zeile macht den Verlust sichtbar
  if (rep.keyEventsDropped) Serial.printf("SPLIT_KEY_RX_DROPPED (%u verworfen)\n", rep.keyEventsDropped);
  if (rep.hostLost) Serial.println("[SPLIT] Mac getrennt -> alle gehaltenen Eingaben gelöst");
  if (rep.overflow) Serial.println("[SPLIT] WARN: Empfangspuffer voll -> gehaltene Eingaben der linken Hälfte gelöst");
  if (rep.linkLost) Serial.println("[SPLIT] WARN: Linke Hälfte nicht erreichbar -> gehaltene Eingaben gelöst");
}

// Gedrosselt ACTIVITY an die linke Hälfte senden, damit sie beim Tippen nur rechts nicht einschläft
void sendSplitActivityIfDue() {
  if (!splitActivityPeerReady || isConfigMode) return;
  if (!splitActivityTake(splitActivity, millis())) return;
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_ACTIVITY);
  splitActivitySendResult(splitActivity, esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&ev, sizeof(ev)) == ESP_OK);
}

// Vor Config Mode und Deep Sleep: eigene MO-Ebenen links lösen (sonst erst nach dem Verfall).
// Die Toggles bleiben, die linke Hälfte führt sie weiter.
void sendSplitLayerRelease() {
  if (!splitActivityPeerReady || isConfigMode) return;
  // Ein Sendefehler ist ohne Folge: links verfallen die Ebenen nach SPLIT_LAYER_REMOTE_TIMEOUT_MS
  SplitHidEvent ev = splitLayerReleaseEvent(splitLayerSync, toggleLayerMask(), true);
  esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&ev, sizeof(ev));
}

// Layer-Zustand an die linke Hälfte, immer als SET: bei jeder Änderung (mit Wiederholung) und, solange die
// linke Hälfte erreichbar ist, jede Sekunde (ohne linke Hälfte kein Funkverkehr ohne Änderung)
void sendSplitLayerStateIfDue() {
  if (!splitActivityPeerReady || isConfigMode) return;
  splitLayerSendIfDue(splitLayerSync, localMomentaryLayerMask(), toggleLayerMask(), true, millis(),
                      bleKeyboard.splitLeft.linkUp, [](const SplitHidEvent &ev) {
                        return esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&ev, sizeof(ev)) == ESP_OK;
                      });
}

void setup() {
  // RX-Puffer auf 4KB vergrößern für zuverlässige USB-Batch-Synchronisierung (SET_K x 336)
  Serial.setRxBufferSize(4096);
  Serial.begin(115200);
  delay(200);

  // Prüfen, ob wir per Soft-Reboot gezielt in den isolierten Config-Modus gewechselt sind
  esp_reset_reason_t resetReason = esp_reset_reason();
  bool bootIntoConfigMode = shouldBootIntoConfigMode(resetReason, rtcConfigModeMagic);
  // Sofort löschen, damit jeder künftige Reset garantiert wieder im normalen Tastaturmodus startet
  rtcConfigModeMagic = 0;
  isConfigMode = bootIntoConfigMode;

  // Deep-Sleep Wakeup Hold aufheben & RTC Pins zurücksetzen
  gpio_deep_sleep_hold_dis();
  for (int c = 0; c < NUM_COLS; c++) {
    gpio_num_t pin = (gpio_num_t)COL_PINS[c];
    if (rtc_gpio_is_valid_gpio(pin)) {
      rtc_gpio_hold_dis(pin);
      rtc_gpio_deinit(pin);
    } else {
      gpio_hold_dis(pin);
    }
  }
  for (int r = 0; r < NUM_ROWS; r++) {
    gpio_num_t pin = (gpio_num_t)ROW_PINS[r];
    rtc_gpio_hold_dis(pin);
    rtc_gpio_deinit(pin);
  }

  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT1) {
    Serial.println("[POWER] Aufgewacht aus Deep Sleep durch Tastendruck!");
  }

  configMutex = xSemaphoreCreateMutex();

  lastActivityTime = millis();

  Serial.println("\n=============================================");
  Serial.println("  Dactyl True-Wireless (Rechte Hand)");
  Serial.printf("  Modus: %s\n", isConfigMode ? "CONFIG MODE ('Dactyl Config')" : "KEYBOARD MODE ('Dactyl Keyboard')");
  Serial.println("=============================================");

  // 1. MAC-Adresse: Feste, reproduzierbare Basis-MAC (Bluetooth-MAC = Base + 2: 2E:BC:BB:81:61:A8)
  // Durch feste Zuweisung bleibt die MAC auch nach Soft-Reboot (exitConfigMode) absolut stabil und driftet nicht.
  const uint8_t base_mac[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xA6};
  esp_base_mac_addr_set(base_mac);

  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_BT);
  Serial.printf("Bluetooth-MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  // 2. NVS initialisieren (erhält Pairing-Keys nach dem ersten Verbinden)
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    Serial.println("[NVS] WARN: NVS partition full or new version found, erasing...");
    nvs_flash_erase();
    nvs_flash_init();
  }

  // 2b. Gespeicherte Belegung und Namen aus NVS laden
  loadKeymapFromNVS();
  // Gespeicherten Gerätenamen (SET_DEV_NAME) für das BLE-HID-Advertising übernehmen
  bleKeyboard.setName(deviceName.c_str());

  // 3. Spalten als INPUT_PULLUP
  for (int c = 0; c < NUM_COLS; c++) {
    pinMode(COL_PINS[c], INPUT_PULLUP);
  }

  // 4. Zeilen als INPUT (hochohmig im Ruhezustand)
  for (int r = 0; r < NUM_ROWS; r++) {
    pinMode(ROW_PINS[r], INPUT);
  }

  // 5. Je nach Modus entweder isolierten Config-BLE-Server oder BLE-HID-Tastatur starten
  if (isConfigMode) {
    startConfigModeBle();
  } else {
    Serial.println("Initialisiere BleKeyboard..."); Serial.flush();
    bleKeyboard.begin();
    Serial.println("MODE:KEYBOARD");
    Serial.println("Bluetooth aktiv! Advertising läuft."); Serial.flush();
    // ESP-NOW nur im Tastaturmodus; der zeitlich begrenzte Config Mode bleibt reines BLE
    setupSplitReceiver();
  }
}

void loop() {
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 2500) {
    lastHeartbeat = millis();
    int bleConn = isConfigMode
      ? ((BLEDevice::getServer() && BLEDevice::getServer()->getConnectedCount() > 0) ? 1 : 0)
      : (bleKeyboard.isConnected() ? 1 : 0);
    // NVS-Füllstand (Einträge à 32 Byte): Makros, Combos und Paare teilen sich die 20-KB-Partition
    nvs_stats_t nvsStats = {};
    nvs_get_stats(NULL, &nvsStats);
    Serial.printf("STATUS: BLE verbunden=%d | ConfigMode=%d | Matrix aktiv | NvsUsed=%u NvsFree=%u\n", bleConn, isConfigMode ? 1 : 0,
      (unsigned)nvsStats.used_entries, (unsigned)nvsStats.free_entries);
    Serial.flush();
  }

  // Matrix-Scan
  bool scanMutexTaken = false;
  if (configMutex) {
    scanMutexTaken = (xSemaphoreTake(configMutex, pdMS_TO_TICKS(20)) == pdTRUE);
  }

  if (scanMutexTaken) {
    // Zurückgehaltene Tasten ausführen: links hat den wartenden Tipp gesendet oder die Zeitgrenze ist um
    if (splitDeferReplayDue(splitLocalDefer, leftTapPendingNow(), millis())) {
      splitDeferReplay(splitLocalDefer, applyLocalKeyChange);
    }

    for (int r = 0; r < NUM_ROWS; r++) {
      pinMode(ROW_PINS[r], OUTPUT);
      digitalWrite(ROW_PINS[r], LOW);
      delayMicroseconds(30);

      for (int c = 0; c < NUM_COLS; c++) {
        bool isPressed = (digitalRead(COL_PINS[c]) == LOW);

        if (isPressed != rawKeyState[r][c]) {
          rawKeyState[r][c] = isPressed;
          splitNoteLocalKeyChange(splitActivity, millis(), lastActivityTime);
          exitStandby();
          // Hinter einem wartenden linken Einzel-Tipp zurückhalten (Zeichenreihenfolge)
          splitDeferApplyOrHold(splitLocalDefer, r, c, isPressed, leftTapPendingNow(), millis(), applyLocalKeyChange);
        }
      }

      pinMode(ROW_PINS[r], INPUT);
    }

    // Eine Taste wurde zurückgehalten: links den wartenden Tipp einmal sofort senden lassen (kein Retry,
    // nach SPLIT_TAP_FLUSH_TIMEOUT_MS führt der Master die Taste ohnehin aus)
    if (splitDeferTakeFlushRequest(splitLocalDefer) && splitActivityPeerReady) {
      SplitHidEvent flushEv = makeSplitHidEvent(SPLIT_OP_TAP_FLUSH);
      esp_now_send(SPLIT_LEFT_MAC, (const uint8_t *)&flushEv, sizeof(flushEv));
    }

    // Benutzerdefinierte Tasten-Chords / Combos prüfen (Item 10)
    checkUserCombos();

    // Mod-Tap Tapping-Term & gepufferte Combo-Kandidaten auswerten
    processDeferredKeys(millis());

    // Hardware-Combo R0C0 + R4C5 (500ms gehalten) für drahtlosen Config-Modus (Item 11)
    static unsigned long comboStartTime = 0;
    if (keyState[0][0] && keyState[4][5]) {
      if (comboStartTime == 0) {
        comboStartTime = millis();
        // Item 11: Sofort Tasten auf Mac loslassen, damit während der 500ms kein Auto-Repeat "666..." getippt wird
        stopMacro(false);
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.releaseAll();
        }
      } else if (millis() - comboStartTime >= 500) {
        comboStartTime = 0;

        // Release-Events senden & States zurücksetzen, damit UI nicht hängen bleibt
        pressedAction[0][0] = 0;
        pressedAction[4][5] = 0;
        keyState[0][0] = false;
        keyState[4][5] = false;
        rawKeyState[0][0] = false;
        rawKeyState[4][5] = false;
        // Zurückgehaltene Änderungen gehören zur Zeit vor dem Moduswechsel
        splitDeferReset(splitLocalDefer);
        sendConfigNotification("KEY_RELEASE:{\"r\":0,\"c\":0}");
        sendConfigNotification("KEY_RELEASE:{\"r\":4,\"c\":5}");

        // configMutex vor der Release-Warteschleife freigeben (Finding #12),
        // damit andere Tasks/GATT-Befehle während des Tastenhubs nicht blockiert werden
        if (scanMutexTaken) {
          xSemaphoreGive(configMutex);
          scanMutexTaken = false;
        }

        // Bounded Release-Check (maximal 2000ms, verhindert Hängenbleiben bei prellenden Tastern)
        unsigned long releaseStart = millis();
        while (millis() - releaseStart < 2000) {
          bool r0c0_pressed = false;
          bool r4c5_pressed = false;

          pinMode(ROW_PINS[0], OUTPUT);
          digitalWrite(ROW_PINS[0], LOW);
          delayMicroseconds(30);
          r0c0_pressed = (digitalRead(COL_PINS[0]) == LOW);
          pinMode(ROW_PINS[0], INPUT);

          pinMode(ROW_PINS[4], OUTPUT);
          digitalWrite(ROW_PINS[4], LOW);
          delayMicroseconds(30);
          r4c5_pressed = (digitalRead(COL_PINS[5]) == LOW);
          pinMode(ROW_PINS[4], INPUT);

          if (!r0c0_pressed && !r4c5_pressed) break;
          delay(20);
        }

        // Modus-Wechsel nach Tastenfassung ausführen
        if (isConfigMode) {
          exitConfigRequested = true;
        } else {
          enterConfigRequested = true;
        }
      }
    } else {
      comboStartTime = 0;
    }

    if (scanMutexTaken) {
      xSemaphoreGive(configMutex);
      scanMutexTaken = false;
    }
  }

  // Ereignisse der linken Hälfte (ESP-NOW) anzeigen
  processSplitEvents();
  servicePendingRepeat();
  sendSplitRepeatCopyIfDue();
  sendSplitActivityIfDue();
  sendSplitLayerStateIfDue();

  // Deferriertes Starten/Beenden des Config-Modus aus loopTask
  if (enterConfigRequested) {
    enterConfigRequested = false;
    enterConfigMode();
  }
  if (exitConfigRequested) {
    exitConfigRequested = false;
    exitConfigMode();
  }

  // Inaktivitäts-Timeouts für Standby (Stufe 1) und Deep Sleep (Stufe 2)
  if (isConfigMode) {
    // Im Config Mode: Nach 3 Min ohne Aktion automatisch in Tastaturmodus zurückkehren
    if (millis() - lastActivityTime > (3UL * 60UL * 1000UL)) {
      Serial.println("[CONFIG MODE] 3 Min Inaktivität -> Kehre automatisch in Tastaturmodus zurück.");
      exitConfigMode();
    }
  } else {
    if (standbyTimeoutMinutes > 0 && !isStandby) {
      if (millis() - lastActivityTime > ((unsigned long)standbyTimeoutMinutes * 60UL * 1000UL)) {
        enterStandby();
      }
    }

    if (deepSleepTimeoutMinutes > 0) {
      if (millis() - lastActivityTime > ((unsigned long)deepSleepTimeoutMinutes * 60UL * 1000UL)) {
        enterDeepSleep();
      }
    }
  }

  // Seriellen Puffer nicht-blockierend leeren und vollständige Zeilen verarbeiten (Finding #2 & #13)
  static String serialRxBuf = "";
  while (Serial.available()) {
    feedSerialChar((char)Serial.read(), serialRxBuf);
  }

  delay(isStandby ? 40 : debounceMs);
}
