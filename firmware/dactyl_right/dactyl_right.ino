#include <BleKeyboard.h>
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

// Überlebt ESP.restart() im RTC-Slow-Memory, wird aber beim Kaltstart ignoriert
RTC_NOINIT_ATTR uint32_t rtcConfigModeMagic;

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);
BLECharacteristic *pConfigCharacteristic = nullptr;
volatile bool isConfigMode = false;
volatile bool isBleTransitioning = false;
volatile bool exitConfigRequested = false;
volatile bool enterConfigRequested = false;

class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    String val = pChar->getValue().c_str();
    handleConfigCommand(val, true);
  }
};

class ConfigServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    Serial.println("[CONFIG BLE] Web-App verbunden!");
  }
  void onDisconnect(BLEServer *pServer) override {
    Serial.println("[CONFIG BLE] Web-App getrennt.");
    if (!isBleTransitioning && !exitConfigRequested) {
      pServer->getAdvertising()->start();
    }
  }
};

class DactylBleKeyboard : public BleKeyboard {
public:
  DactylBleKeyboard(std::string name, std::string mfr, uint8_t batt)
    : BleKeyboard(name, mfr, batt) {}

  void onConnect(BLEServer *pServer) override {
    BleKeyboard::onConnect(pServer);
  }

  void onDisconnect(BLEServer *pServer) override {
    if (isBleTransitioning || enterConfigRequested || exitConfigRequested) {
      return;
    }
    if (pServer->getConnectedCount() <= 1) {
      // BleKeyboard::onDisconnect setzt connected = false und startet Advertising neu
      BleKeyboard::onDisconnect(pServer);
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
    Serial.println("BLE HID + Config Service bereit.");
  }
};

DactylBleKeyboard bleKeyboard("Dactyl Keyboard", "Dactyl DIY", 100);

// 6 Zeilen (Rows)
const int ROW_PINS[6] = {13, 14, 27, 26, 33, 32};
const int NUM_ROWS = 6;

// 7 Spalten (Columns) - von links nach rechts
const int COL_PINS[7] = {23, 19, 18, 17, 16, 4, 25};
const int NUM_COLS = 7;

// QWERTY / QWERTZ Basis-Belegung für die rechte Hand (Dactyl Manuform)
// Finger: 6 Spalten (Col 0..5), R4C0 existiert nicht
// Daumen: R5C0 (T1+T2), R2C6 (Mitte links), R5C4 (Unten links), R5C3 (2U Mitte), R5C2 (2U Rechts)
// Layer Action Codes (Values >= 0x100)
#define ACT_MO_BASE 0x100
#define ACT_MO_0  0x100
#define ACT_MO_1  0x101
#define ACT_MO_2  0x102
#define ACT_MO_3  0x103
#define ACT_MO_4  0x104
#define ACT_MO_5  0x105
#define ACT_MO_6  0x106
#define ACT_MO_7  0x107

#define ACT_TG_BASE 0x110
#define ACT_TG_0  0x110
#define ACT_TG_1  0x111
#define ACT_TG_2  0x112
#define ACT_TG_3  0x113
#define ACT_TG_4  0x114
#define ACT_TG_5  0x115
#define ACT_TG_6  0x116
#define ACT_TG_7  0x117
#define ACT_LAYER_UP   0x118
#define ACT_LAYER_DOWN 0x119

#define ACT_MEDIA_PLAY_PAUSE     0x120
#define ACT_MEDIA_MUTE           0x121
#define ACT_MEDIA_VOLUME_UP      0x122
#define ACT_MEDIA_VOLUME_DOWN    0x123
#define ACT_MEDIA_NEXT_TRACK     0x124
#define ACT_MEDIA_PREVIOUS_TRACK 0x125
#define ACT_MEDIA_STOP           0x126
#define ACT_MAC_GLOBE            0x127

#define NUM_LAYERS 8

// [[[START_SETTINGS]]]
String deviceName = "Dactyl Keyboard";
uint8_t debounceMs = 5;
uint16_t comboTimeoutMs = 40;
uint32_t standbyTimeoutMinutes = 5;    // Stufe 1: 5 Min bis Standby (80 MHz, gedrosselter Scan, BLE bleibt an)
uint32_t deepSleepTimeoutMinutes = 60; // Stufe 2: 60 Min (1h) bis Deep Sleep (~10 µA)
// [[[END_SETTINGS]]]

#define MAX_COMBOS 16

// Reine NVS-persistierte Combo-Definition (exakt 6 Bytes, kompatibel mit bisherigen NVS-Daten)
struct KeyCombo {
  uint8_t r1, c1;
  uint8_t r2, c2;
  uint8_t behavior; // 0 = KEY_PRESS, 1 = MODIFIER_HOLD, 2 = LAYER_TOGGLE
  uint16_t action;
};

// Separater flüchtiger Runtime-Zustand für Tasten-Chording
struct ComboRuntime {
  bool active;
  unsigned long lastReleaseTime;
};
ComboRuntime comboRuntime[MAX_COMBOS];

// [[[START_COMBOS]]]
uint8_t numCombos = 2;
KeyCombo userCombos[MAX_COMBOS] = {
  { 2, 1, 2, 2, 0, KEY_ESC },       // J + K -> Escape
  { 2, 1, 2, 3, 1, KEY_LEFT_CTRL }  // J + L -> Ctrl
};
// [[[END_COMBOS]]]

unsigned long lastActivityTime = 0;
bool isStandby = false;

void exitConfigMode();
void enterConfigMode();
void toggleConfigMode();
void checkUserCombos();

void enterConfigMode() {
  if (isConfigMode) return;
  isBleTransitioning = true;
  enterConfigRequested = false;

  bleKeyboard.releaseAll();
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

bool keyState[6][7] = {false};
uint16_t pressedAction[6][7] = {0};
unsigned long keyPressTime[6][7] = {0};
bool keySentToHost[6][7] = {false};
bool momentaryLayers[NUM_LAYERS] = {false};
bool toggleLayers[NUM_LAYERS] = {false};

uint8_t getActiveLayer() {
  if (momentaryLayers[0]) return 0; // Momentary Layer 0 zwingt temporär Base-Layer
  for (int l = NUM_LAYERS - 1; l > 0; l--) {
    if (momentaryLayers[l] || toggleLayers[l]) return l;
  }
  return 0;
}

void saveKeymapToNVS() {
  preferences.begin("dactyl", false);
  preferences.putBytes("keymap", KEYMAP, sizeof(KEYMAP));
  preferences.putString("fw_build", String(__DATE__ " " __TIME__));
  preferences.end();
  Serial.println("NVS: Keymap gespeichert.");
}

void loadKeymapFromNVS() {
  preferences.begin("dactyl", false);
  String lastBuild = preferences.getString("fw_build", "");
  String currentBuild = String(__DATE__ " " __TIME__);

  if (lastBuild != currentBuild) {
    Serial.printf("NVS: Neue Firmware geflasht (%s != %s). Synchronisiere NVS mit Firmware-Defaults.\n", lastBuild.c_str(), currentBuild.c_str());
    preferences.putBytes("keymap", KEYMAP, sizeof(KEYMAP));
    preferences.putString("fw_build", currentBuild);
  } else if (preferences.isKey("keymap")) {
    size_t sz = preferences.getBytesLength("keymap");
    if (sz == sizeof(KEYMAP)) {
      preferences.getBytes("keymap", KEYMAP, sizeof(KEYMAP));
      Serial.println("NVS: Gespeicherte Keymap geladen.");
    }
  }
  for (int i = 0; i < NUM_LAYERS; i++) {
    String k = "name_" + String(i);
    if (preferences.isKey(k.c_str())) {
      layerNames[i] = preferences.getString(k.c_str());
      Serial.printf("NVS: Layer %d Name geladen: %s\n", i, layerNames[i].c_str());
    }
  }
  if (preferences.isKey("standby_timeout")) {
    standbyTimeoutMinutes = preferences.getUInt("standby_timeout", 5);
  } else {
    standbyTimeoutMinutes = 5;
  }
  if (preferences.isKey("sleep_timeout")) {
    deepSleepTimeoutMinutes = preferences.getUInt("sleep_timeout", 60);
  } else {
    deepSleepTimeoutMinutes = 60;
  }
  if (preferences.isKey("dev_name")) {
    deviceName = preferences.getString("dev_name", "Dactyl Keyboard");
  }
  if (preferences.isKey("debounce")) {
    debounceMs = preferences.getUChar("debounce", 5);
  }
  if (preferences.isKey("combo_to")) {
    comboTimeoutMs = preferences.getUShort("combo_to", 40);
  }
  if (preferences.isKey("num_combos")) {
    uint8_t n = preferences.getUChar("num_combos", 0);
    if (n <= MAX_COMBOS && preferences.isKey("combos_data")) {
      size_t sz = preferences.getBytesLength("combos_data");
      if (sz == n * sizeof(KeyCombo)) {
        numCombos = n;
        preferences.getBytes("combos_data", userCombos, sz);
        for (int i = 0; i < MAX_COMBOS; i++) {
          comboRuntime[i].active = false;
          comboRuntime[i].lastReleaseTime = 0;
        }
        Serial.printf("NVS: %d Combos geladen.\n", numCombos);
      }
    }
  }
  Serial.printf("NVS: Timeouts & Settings geladen: Standby=%u Min, DeepSleep=%u Min, Debounce=%u ms, ComboTO=%u ms, Name='%s'\n",
    standbyTimeoutMinutes, deepSleepTimeoutMinutes, debounceMs, comboTimeoutMs, deviceName.c_str());
  preferences.end();
}

void saveStandbyTimeoutToNVS(uint32_t timeout) {
  standbyTimeoutMinutes = timeout;
  preferences.begin("dactyl", false);
  preferences.putUInt("standby_timeout", timeout);
  preferences.end();
  Serial.printf("NVS: Standby-Timeout gespeichert: %u Min\n", timeout);
}

void saveSleepTimeoutToNVS(uint32_t timeout) {
  deepSleepTimeoutMinutes = timeout;
  preferences.begin("dactyl", false);
  preferences.putUInt("sleep_timeout", timeout);
  preferences.end();
  Serial.printf("NVS: Deep-Sleep-Timeout gespeichert: %u Min\n", timeout);
}

void saveDeviceNameToNVS(String name) {
  deviceName = name;
  preferences.begin("dactyl", false);
  preferences.putString("dev_name", name);
  preferences.end();
  Serial.printf("NVS: Gerätename gespeichert: %s\n", name.c_str());
}

void saveDebounceToNVS(uint8_t ms) {
  debounceMs = ms;
  preferences.begin("dactyl", false);
  preferences.putUChar("debounce", ms);
  preferences.end();
  Serial.printf("NVS: Debounce gespeichert: %u ms\n", ms);
}

void saveComboTimeoutToNVS(uint16_t ms) {
  comboTimeoutMs = ms;
  preferences.begin("dactyl", false);
  preferences.putUShort("combo_to", ms);
  preferences.end();
  Serial.printf("NVS: Combo-Timeout gespeichert: %u ms\n", ms);
}

void saveCombosToNVS() {
  preferences.begin("dactyl", false);
  preferences.putUChar("num_combos", numCombos);
  preferences.putBytes("combos_data", userCombos, numCombos * sizeof(KeyCombo));
  preferences.end();
  Serial.printf("NVS: %d Combos gespeichert.\n", numCombos);
}

void saveLayerNameToNVS(int idx, String name) {
  if (idx < 0 || idx >= NUM_LAYERS) return;
  layerNames[idx] = name;
  preferences.begin("dactyl", false);
  String k = "name_" + String(idx);
  preferences.putString(k.c_str(), name);
  preferences.end();
  Serial.printf("NVS: Layer %d Name gespeichert: %s\n", idx, name.c_str());
}

void sendConfigNotification(String msg, bool addDelay) {
  Serial.println(msg);
  if (pConfigCharacteristic) {
    // Im normalen Mac-Tastaturmodus keine Tastendrücke über BLE-Notifications senden (Keylogger-Schutz)
    if (!isConfigMode && (msg.startsWith("KEY_PRESS") || msg.startsWith("KEY_RELEASE"))) {
      return;
    }
    pConfigCharacteristic->setValue(msg.c_str());
    pConfigCharacteristic->notify();
    if (addDelay) {
      delay(15);
    }
  }
}

void handleConfigCommand(String cmd, bool fromBle) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Wenn der Befehl über BLE kommt und die Tastatur NICHT im Config-Modus ist:
  // Nur ENTER_CONFIG und GET_INFO erlauben (Schutz vor unautorisierten Schreibvorgängen aus der Ferne)
  if (fromBle && !isConfigMode && cmd != "ENTER_CONFIG" && cmd != "GET_INFO") {
    Serial.println("WARN: BLE-Schreibbefehl abgelehnt (nicht im Config-Modus): " + cmd);
    return;
  }

  lastActivityTime = millis();

  bool mutexTaken = false;
  if (configMutex) {
    mutexTaken = (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE);
    if (!mutexTaken) {
      Serial.println("WARN: configMutex busy, skipping command: " + cmd);
      return;
    }
  }

  if (cmd.startsWith("SET_KEY ")) {
    int l, r, c, val;
    if (sscanf(cmd.c_str(), "SET_KEY %d %d %d %d", &l, &r, &c, &val) == 4) {
      if (l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS) {
        KEYMAP[l][r][c] = (uint16_t)val;
        saveKeymapToNVS();
        sendConfigNotification("OK SET_KEY " + String(l) + " " + String(r) + " " + String(c) + " " + String(val));
      }
    }
  } else if (cmd.startsWith("SET_K ")) {
    // Schnelles RAM-Update für Batch-Sync (NVS wird am Ende einmalig mit SAVE_NVS geschrieben)
    int l, r, c, val;
    if (sscanf(cmd.c_str(), "SET_K %d %d %d %d", &l, &r, &c, &val) == 4) {
      if (l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS) {
        KEYMAP[l][r][c] = (uint16_t)val;
      }
    }
  } else if (cmd == "SAVE_NVS") {
    saveKeymapToNVS();
    sendConfigNotification("OK SAVE_NVS");
  } else if (cmd.startsWith("SET_NAME ")) {
    int spaceIdx = cmd.indexOf(' ', 9);
    int l = cmd.substring(9, spaceIdx > 0 ? spaceIdx : 10).toInt();
    String name = spaceIdx > 0 ? cmd.substring(spaceIdx + 1) : "";
    name.replace("\"", "");
    name.replace("\\", "");
    name.trim();
    if (name.length() > 31) name = name.substring(0, 31);
    if (l >= 0 && l < NUM_LAYERS && name.length() > 0) {
      saveLayerNameToNVS(l, name);
      sendConfigNotification("OK SET_NAME " + String(l) + " " + name);
    }
  } else if (cmd.startsWith("SET_STANDBY ")) {
    int t = cmd.substring(12).toInt();
    if (t >= 0 && t <= 120) {
      saveStandbyTimeoutToNVS((uint32_t)t);
      sendConfigNotification("OK SET_STANDBY " + String(t));
    }
  } else if (cmd.startsWith("SET_SLEEP ")) {
    int t = cmd.substring(10).toInt();
    if (t >= 0 && t <= 240) {
      saveSleepTimeoutToNVS((uint32_t)t);
      sendConfigNotification("OK SET_SLEEP " + String(t));
    }
  } else if (cmd.startsWith("SET_DEV_NAME ")) {
    String name = cmd.substring(13);
    name.replace("\"", "");
    name.replace("\\", "");
    name.trim();
    if (name.length() > 31) name = name.substring(0, 31);
    if (name.length() > 0) {
      saveDeviceNameToNVS(name);
      sendConfigNotification("OK SET_DEV_NAME " + name);
    }
  } else if (cmd.startsWith("SET_DEBOUNCE ")) {
    int d = cmd.substring(13).toInt();
    if (d >= 1 && d <= 50) {
      saveDebounceToNVS((uint8_t)d);
      sendConfigNotification("OK SET_DEBOUNCE " + String(d));
    }
  } else if (cmd.startsWith("SET_COMBO_TIMEOUT ")) {
    int ct = cmd.substring(18).toInt();
    if (ct >= 10 && ct <= 200) {
      saveComboTimeoutToNVS((uint16_t)ct);
      sendConfigNotification("OK SET_COMBO_TIMEOUT " + String(ct));
    }
  } else if (cmd == "CLEAR_COMBOS") {
    numCombos = 0;
    sendConfigNotification("OK CLEAR_COMBOS");
  } else if (cmd.startsWith("ADD_COMBO ")) {
    int r1, c1, r2, c2, beh, act;
    if (sscanf(cmd.c_str(), "ADD_COMBO %d %d %d %d %d %d", &r1, &c1, &r2, &c2, &beh, &act) == 6) {
      if (numCombos < MAX_COMBOS && r1 >= 0 && r1 < NUM_ROWS && c1 >= 0 && c1 < NUM_COLS &&
          r2 >= 0 && r2 < NUM_ROWS && c2 >= 0 && c2 < NUM_COLS) {
        userCombos[numCombos].r1 = (uint8_t)r1;
        userCombos[numCombos].c1 = (uint8_t)c1;
        userCombos[numCombos].r2 = (uint8_t)r2;
        userCombos[numCombos].c2 = (uint8_t)c2;
        userCombos[numCombos].behavior = (uint8_t)beh;
        userCombos[numCombos].action = (uint16_t)act;
        comboRuntime[numCombos].active = false;
        comboRuntime[numCombos].lastReleaseTime = 0;
        numCombos++;
        sendConfigNotification("OK ADD_COMBO " + String(numCombos - 1));
      }
    }
  } else if (cmd == "SAVE_COMBOS") {
    saveCombosToNVS();
    sendConfigNotification("OK SAVE_COMBOS");
  } else if (cmd == "GET_NAMES") {
    String out = "LAYER_NAMES:[";
    for (int i = 0; i < NUM_LAYERS; i++) {
      out += "\"" + layerNames[i] + "\"";
      if (i < NUM_LAYERS - 1) out += ",";
    }
    out += "]";
    sendConfigNotification(out);
  } else if (cmd == "GET_INFO") {
    uint8_t m[6];
    esp_read_mac(m, ESP_MAC_BT);
    char buf[288];
    snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"%s\",\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\",\"standby_timeout\":%u,\"sleep_timeout\":%u,\"debounce_ms\":%u,\"combo_timeout_ms\":%u,\"config_mode\":%s}",
      isConfigMode ? "Dactyl Config" : deviceName.c_str(),
      m[0], m[1], m[2], m[3], m[4], m[5],
      standbyTimeoutMinutes, deepSleepTimeoutMinutes,
      debounceMs, comboTimeoutMs,
      isConfigMode ? "true" : "false");
    sendConfigNotification(String(buf));
  } else if (cmd == "GET_CONFIG") {
    String out = "LAYER_NAMES:[";
    for (int i = 0; i < NUM_LAYERS; i++) {
      out += "\"" + layerNames[i] + "\"";
      if (i < NUM_LAYERS - 1) out += ",";
    }
    out += "]";
    sendConfigNotification(out);

    for (int l = 0; l < NUM_LAYERS; l++) {
      String lStr = "LAYER_DATA:{\"l\":" + String(l) + ",\"k\":[";
      for (int r = 0; r < NUM_ROWS; r++) {
        lStr += "[";
        for (int c = 0; c < NUM_COLS; c++) {
          lStr += String(KEYMAP[l][r][c]);
          if (c < NUM_COLS - 1) lStr += ",";
        }
        lStr += "]";
        if (r < NUM_ROWS - 1) lStr += ",";
      }
      lStr += "]}";
      sendConfigNotification(lStr, true);
    }
    sendConfigNotification("CONFIG_SYNC_DONE", true);
  } else if (cmd == "RESET_CONFIG") {
    preferences.begin("dactyl", false);
    preferences.clear();
    preferences.end();
    sendConfigNotification("OK RESET_CONFIG");
  } else if (cmd == "ENTER_CONFIG") {
    sendConfigNotification("OK ENTER_CONFIG");
    enterConfigRequested = true;
  } else if (cmd == "EXIT_CONFIG") {
    sendConfigNotification("OK EXIT_CONFIG");
    exitConfigRequested = true;
  }

  if (mutexTaken) xSemaphoreGive(configMutex);
}

void startConfigModeBle() {
  Serial.println("=============================================");
  Serial.println("  [CONFIG MODE] Isolierter BLE-Config-Server");
  Serial.println("  Name: 'Dactyl Config' (Ohne HID / Ohne SMP)");
  Serial.println("=============================================");

  BLEDevice::init("Dactyl Config");

  // Wichtig: Keine Verschlüsselung/Bonding im Config-Modus erzwingen!
  // Da bleKeyboard.begin() nicht aufgerufen wurde, ist m_securityEnabled ohnehin false;
  // zusätzlich deaktivieren wir ForceAuthentication explizit, damit der gespeicherte
  // macOS HID-Bond in Bluedroid unangetastet bleibt.
  BLESecurity *pSecurity = new BLESecurity();
  pSecurity->setForceAuthentication(false);
  delete pSecurity;

  esp_bd_addr_t randAddr;
  esp_read_mac(randAddr, ESP_MAC_BT);
  randAddr[0] |= 0xC0;
  randAddr[5] |= 0xC0;
  randAddr[4] ^= 0x55;

  esp_err_t errSet = esp_ble_gap_set_rand_addr(randAddr);
  Serial.printf("[CONFIG BLE] Random-MAC: %02X:%02X:%02X:%02X:%02X:%02X (rc=%d)\n",
    randAddr[0], randAddr[1], randAddr[2], randAddr[3], randAddr[4], randAddr[5], errSet);

  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ConfigServerCallbacks());

  BLEService *pConfigService = pServer->createService(CONFIG_SERVICE_UUID);
  pConfigCharacteristic = pConfigService->createCharacteristic(
    CONFIG_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pConfigCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE);
  pConfigCharacteristic->setCallbacks(new ConfigCallbacks());
  pConfigCharacteristic->addDescriptor(new BLE2902());
  pConfigService->start();

  BLEAdvertising *pAdv = pServer->getAdvertising();
  pAdv->setDeviceAddress(randAddr, BLE_ADDR_TYPE_RANDOM);
  esp_ble_gap_set_device_name("Dactyl Config");

  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName("Dactyl Config");

  BLEAdvertisementData scanData;
  scanData.setCompleteServices(BLEUUID(CONFIG_SERVICE_UUID));

  pAdv->setAppearance(0x0000);
  pAdv->setAdvertisementData(advData);
  pAdv->setScanResponseData(scanData);
  pAdv->setScanResponse(true);
  pAdv->start();

  Serial.println("MODE:CONFIG");
  Serial.println("[CONFIG BLE] Advertising als 'Dactyl Config' aktiv!");
  Serial.flush();
}

void setup() {
  // RX-Puffer auf 4KB vergrößern für zuverlässige USB-Batch-Synchronisierung (SET_K x 336)
  Serial.setRxBufferSize(4096);
  Serial.begin(115200);
  delay(200);

  // Prüfen, ob wir per Soft-Reboot gezielt in den isolierten Config-Modus gewechselt sind
  esp_reset_reason_t resetReason = esp_reset_reason();
  bool bootIntoConfigMode = (resetReason == ESP_RST_SW && rtcConfigModeMagic == CONFIG_MODE_MAGIC);
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
  }
}

bool wasComboRecentlyActive(uint8_t r, uint8_t c) {
  unsigned long now = millis();
  for (uint8_t i = 0; i < numCombos; i++) {
    if ((userCombos[i].r1 == r && userCombos[i].c1 == c) ||
        (userCombos[i].r2 == r && userCombos[i].c2 == c)) {
      if (comboRuntime[i].active) return true;
      if (comboRuntime[i].lastReleaseTime > 0 && (now - comboRuntime[i].lastReleaseTime < 300)) {
        // Nur unterdrücken, wenn der Tastendruck VOR oder WÄHREND des Chords gestartet wurde.
        // Ein NEUER Tastendruck nach dem Chord (keyPressTime > lastReleaseTime) ist legitim und wird nicht blockiert!
        if (keyPressTime[r][c] <= comboRuntime[i].lastReleaseTime) {
          return true;
        }
      }
    }
  }
  return false;
}

bool isComboCandidateKey(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    if ((userCombos[i].r1 == r && userCombos[i].c1 == c) ||
        (userCombos[i].r2 == r && userCombos[i].c2 == c)) {
      return true;
    }
  }
  return false;
}

void checkUserCombos() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < numCombos; i++) {
    uint8_t r1 = userCombos[i].r1;
    uint8_t c1 = userCombos[i].c1;
    uint8_t r2 = userCombos[i].r2;
    uint8_t c2 = userCombos[i].c2;

    bool bothPressed = keyState[r1][c1] && keyState[r2][c2];
    if (bothPressed && !comboRuntime[i].active) {
      // Beide Tasten müssen innerhalb des konfigurierbaren comboTimeoutMs gedrückt worden sein!
      // Wenn eine Taste schon lange gehalten wurde und man dann schnell tippt, ist es KEINE Combo!
      unsigned long t1 = keyPressTime[r1][c1];
      unsigned long t2 = keyPressTime[r2][c2];
      bool inWindow = ((unsigned long)(t1 - t2) <= comboTimeoutMs) || ((unsigned long)(t2 - t1) <= comboTimeoutMs);

      if (inWindow) {
        comboRuntime[i].active = true;
        // Beide Tasten als an Host gesendet markieren (Finding #4), damit lingernde Tasten nach dem Chord
        // nicht nach Ablauf der 300ms Grace Period versehentlich als Einzeltaste nachfeuern!
        keySentToHost[r1][c1] = true;
        keySentToHost[r2][c2] = true;

        // Sofort Einzeltasten auf Mac loslassen, damit der Combo-Chord die Einzeltasten überschreibt
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.releaseAll();
        }
        uint16_t act = userCombos[i].action;
        if (userCombos[i].behavior == 0) { // KEY_PRESS
          if (!isConfigMode && bleKeyboard.isConnected()) {
            if (act >= 0x120 && act <= 0x127) {
              if (act == 0x120) bleKeyboard.write(KEY_MEDIA_PLAY_PAUSE);
              else if (act == 0x121) bleKeyboard.write(KEY_MEDIA_MUTE);
              else if (act == 0x122) bleKeyboard.write(KEY_MEDIA_VOLUME_UP);
              else if (act == 0x123) bleKeyboard.write(KEY_MEDIA_VOLUME_DOWN);
              else if (act == 0x124) bleKeyboard.write(KEY_MEDIA_NEXT_TRACK);
              else if (act == 0x125) bleKeyboard.write(KEY_MEDIA_PREVIOUS_TRACK);
              else if (act == 0x126) bleKeyboard.write(KEY_MEDIA_STOP);
              else if (act == 0x127) { bleKeyboard.press(KEY_MEDIA_GLOBE); delay(10); bleKeyboard.release(KEY_MEDIA_GLOBE); }
            } else if (act <= 0xFF) {
              bleKeyboard.write((uint8_t)act);
            }
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
          if (!isConfigMode && bleKeyboard.isConnected()) {
            if (act <= 0xFF) bleKeyboard.press((uint8_t)act);
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 2) { // LAYER_TOGGLE
          uint8_t l = act & 0x07;
          if (l == 0) {
            for (int j = 1; j < NUM_LAYERS; j++) toggleLayers[j] = false;
          } else if (l < NUM_LAYERS) {
            toggleLayers[l] = !toggleLayers[l];
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        }
      }
    } else if (!bothPressed && comboRuntime[i].active) {
      comboRuntime[i].active = false;
      comboRuntime[i].lastReleaseTime = now;
      if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
        uint16_t act = userCombos[i].action;
        if (!isConfigMode && bleKeyboard.isConnected()) {
          if (act <= 0xFF) bleKeyboard.release((uint8_t)act);
        }
      }
    }
  }
}

void loop() {
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 2500) {
    lastHeartbeat = millis();
    int bleConn = isConfigMode
      ? ((BLEDevice::getServer() && BLEDevice::getServer()->getConnectedCount() > 0) ? 1 : 0)
      : (bleKeyboard.isConnected() ? 1 : 0);
    Serial.printf("STATUS: BLE verbunden=%d | ConfigMode=%d | Matrix aktiv\n", bleConn, isConfigMode ? 1 : 0);
    Serial.flush();
  }

  // Matrix-Scan
  bool scanMutexTaken = false;
  if (configMutex) {
    scanMutexTaken = (xSemaphoreTake(configMutex, pdMS_TO_TICKS(20)) == pdTRUE);
  }

  if (scanMutexTaken) {
    for (int r = 0; r < NUM_ROWS; r++) {
      pinMode(ROW_PINS[r], OUTPUT);
      digitalWrite(ROW_PINS[r], LOW);
      delayMicroseconds(30);

      for (int c = 0; c < NUM_COLS; c++) {
        bool isPressed = (digitalRead(COL_PINS[c]) == LOW);

        if (isPressed != keyState[r][c]) {
          keyState[r][c] = isPressed;
          lastActivityTime = millis();
          exitStandby();

          if (isPressed) {
            keyPressTime[r][c] = millis();
            keySentToHost[r][c] = false;
            uint8_t currentLayer = getActiveLayer();
            uint16_t action = KEYMAP[currentLayer][r][c];
            if (action == 0) {
              action = KEYMAP[0][r][c]; // Transparent fallback to base layer
            }
            pressedAction[r][c] = action;

            if (action >= 0x100 && action <= 0x107) {
              uint8_t l = action - 0x100;
              if (l < NUM_LAYERS) momentaryLayers[l] = true;
              uint8_t newL = getActiveLayer();
              char buf[128];
              snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"MO_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, l, action, currentLayer, newL);
              sendConfigNotification(String(buf));
              Serial.printf("LAYER: MO(%d) aktiv -> Layer %d\n", l, newL);
            } else if (action >= 0x110 && action <= 0x117) {
              uint8_t l = action - 0x110;
              if (l == 0) {
                // TG_0 setzt alle getoggelten Ebenen zurück und wechselt fest auf Layer 0
                for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
              } else if (l < NUM_LAYERS) {
                toggleLayers[l] = !toggleLayers[l];
              }
              uint8_t newL = getActiveLayer();
              char buf[128];
              snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"TG_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, l, action, currentLayer, newL);
              sendConfigNotification(String(buf));
              Serial.printf("LAYER: TG(%d) -> Layer %d\n", l, newL);
            } else if (action == ACT_LAYER_UP || action == ACT_LAYER_DOWN) {
              uint8_t targetL = (action == ACT_LAYER_UP)
                ? ((currentLayer + 1) % NUM_LAYERS)
                : ((currentLayer == 0) ? (NUM_LAYERS - 1) : (currentLayer - 1));
              for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
              if (targetL > 0 && targetL < NUM_LAYERS) {
                toggleLayers[targetL] = true;
              }
              uint8_t newL = getActiveLayer();
              const char* actName = (action == ACT_LAYER_UP) ? "LAYER_UP" : "LAYER_DOWN";
              char buf[128];
              snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, actName, action, currentLayer, newL);
              sendConfigNotification(String(buf));
              Serial.printf("LAYER: %s -> Layer %d\n", actName, newL);
            } else if (action >= 0x120 && action <= 0x127) {
              const char* mediaName = "MEDIA";
              if (!isConfigMode && bleKeyboard.isConnected()) {
                if (action == 0x120) { mediaName = "Play/Pause"; bleKeyboard.write(KEY_MEDIA_PLAY_PAUSE); }
                else if (action == 0x121) { mediaName = "Mute"; bleKeyboard.write(KEY_MEDIA_MUTE); }
                else if (action == 0x122) { mediaName = "Vol+"; bleKeyboard.write(KEY_MEDIA_VOLUME_UP); }
                else if (action == 0x123) { mediaName = "Vol-"; bleKeyboard.write(KEY_MEDIA_VOLUME_DOWN); }
                else if (action == 0x124) { mediaName = "Next"; bleKeyboard.write(KEY_MEDIA_NEXT_TRACK); }
                else if (action == 0x125) { mediaName = "Prev"; bleKeyboard.write(KEY_MEDIA_PREVIOUS_TRACK); }
                else if (action == 0x126) { mediaName = "Stop"; bleKeyboard.write(KEY_MEDIA_STOP); }
                else if (action == 0x127) { mediaName = "Mac Globe (Fn)"; bleKeyboard.press(KEY_MEDIA_GLOBE); }
              }
              char buf[128];
              snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, mediaName, action, currentLayer);
              sendConfigNotification(String(buf));
              Serial.printf("Media-Taste gedrückt: [R%d, C%d] (L%d) -> %s (0x%02X)\n", r, c, currentLayer, mediaName, action);
            } else if (action > 0 && action <= 0xFF) {
              String keyLabel = "";
              if (action >= 'a' && action <= 'z') keyLabel = String((char)toupper(action));
              else if (action >= 32 && action <= 126 && action != '"' && action != '\\') keyLabel = String((char)action);
              else if (action >= KEY_F1 && action <= KEY_F12) keyLabel = "F" + String(action - KEY_F1 + 1);
              else if (action >= KEY_F13 && action <= KEY_F24) keyLabel = "F" + String(action - KEY_F13 + 13);
              else if (action == KEY_RETURN) keyLabel = "Enter";
              else if (action == KEY_ESC) keyLabel = "Esc";
              else if (action == KEY_BACKSPACE) keyLabel = "Bksp";
              else if (action == KEY_TAB) keyLabel = "Tab";
              else if (action == KEY_DELETE) keyLabel = "Del";
              else if (action == KEY_CAPS_LOCK) keyLabel = "Caps";
              else if (action == KEY_INSERT) keyLabel = "Ins";
              else if (action == KEY_PRTSC) keyLabel = "PrtSc";
              else if (action == KEY_UP_ARROW) keyLabel = "Up";
              else if (action == KEY_DOWN_ARROW) keyLabel = "Down";
              else if (action == KEY_LEFT_ARROW) keyLabel = "Left";
              else if (action == KEY_RIGHT_ARROW) keyLabel = "Right";
              else if (action >= KEY_NUM_1 && action <= KEY_NUM_9) keyLabel = "Num" + String(action - KEY_NUM_1 + 1);
              else if (action == KEY_NUM_0) keyLabel = "Num0";
              else keyLabel = "Key" + String(action);

              char buf[128];
              snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, keyLabel.c_str(), action, currentLayer);
              sendConfigNotification(String(buf));
              Serial.printf("Taste gedrückt: [R%d, C%d] (L%d) -> '%s' (0x%02X)\n", r, c, currentLayer, keyLabel.c_str(), action);
              if (!isConfigMode && bleKeyboard.isConnected()) {
                // Wenn die Taste Teil einer definierten Combo ist, puffern wir das Senden um comboTimeoutMs,
                // damit beim Drücken des Chords (z. B. J+K) kein Buchstabe vorab gesendet wird!
                if (!isComboCandidateKey(r, c) && !(keyState[0][0] && keyState[4][5] && ((r == 0 && c == 0) || (r == 4 && c == 5)))) {
                  bleKeyboard.press((uint8_t)action);
                  keySentToHost[r][c] = true;
                }
              }
            }
          } else {
            uint16_t action = pressedAction[r][c];
            pressedAction[r][c] = 0;
            keyPressTime[r][c] = 0;

            char buf[64];
            snprintf(buf, sizeof(buf), "KEY_RELEASE:{\"r\":%d,\"c\":%d}", r, c);
            sendConfigNotification(String(buf));

            if (action >= 0x100 && action <= 0x107) {
              uint8_t l = action - 0x100;
              if (l < NUM_LAYERS) momentaryLayers[l] = false;
              Serial.printf("LAYER: MO(%d) gelöst -> Layer %d\n", l, getActiveLayer());
            } else if (action >= 0x120 && action <= 0x127) {
              if (!isConfigMode && action == 0x127 && bleKeyboard.isConnected()) {
                bleKeyboard.release(KEY_MEDIA_GLOBE);
              }
            } else if (action > 0 && action <= 0xFF) {
              if (!isConfigMode && bleKeyboard.isConnected()) {
                if (keySentToHost[r][c]) {
                  bleKeyboard.release((uint8_t)action);
                  keySentToHost[r][c] = false;
                } else if (!wasComboRecentlyActive(r, c) && !(r == 0 && c == 0) && !(r == 4 && c == 5)) {
                  // Wenn die Taste vor Ablauf des Combo-Timeouts losgelassen wurde (schneller Einzeltipp)
                  // UND nicht gerade Teil einer ausgelösten Combo war:
                  bleKeyboard.press((uint8_t)action);
                  delay(5);
                  bleKeyboard.release((uint8_t)action);
                }
              }
            }
          }
        }
      }

      pinMode(ROW_PINS[r], INPUT);
    }

    // Benutzerdefinierte Tasten-Chords / Combos prüfen (Item 10)
    checkUserCombos();

    // Gepufferte Combo-Kandidaten senden, falls Zeitfenster (comboTimeoutMs) ohne zweiten Tastendruck abgelaufen ist
    if (!isConfigMode && bleKeyboard.isConnected()) {
      unsigned long now = millis();
      for (int r = 0; r < NUM_ROWS; r++) {
        for (int c = 0; c < NUM_COLS; c++) {
          if (keyState[r][c] && !keySentToHost[r][c] && isComboCandidateKey(r, c)) {
            if ((unsigned long)(now - keyPressTime[r][c]) >= comboTimeoutMs) {
              uint16_t act = pressedAction[r][c];
              if (act > 0 && act <= 0xFF) {
                bleKeyboard.press((uint8_t)act);
                keySentToHost[r][c] = true;
              }
            }
          }
        }
      }
    }

    // Hardware-Combo R0C0 + R4C5 (500ms gehalten) für drahtlosen Config-Modus (Item 11)
    static unsigned long comboStartTime = 0;
    if (keyState[0][0] && keyState[4][5]) {
      if (comboStartTime == 0) {
        comboStartTime = millis();
        // Item 11: Sofort Tasten auf Mac loslassen, damit während der 500ms kein Auto-Repeat "666..." getippt wird
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
    char c = (char)Serial.read();
    if (c == '\n') {
      handleConfigCommand(serialRxBuf, false);
      serialRxBuf = "";
    } else if (c != '\r') {
      if (serialRxBuf.length() < 256) {
        serialRxBuf += c;
      }
    }
  }

  delay(isStandby ? 40 : debounceMs);
}
