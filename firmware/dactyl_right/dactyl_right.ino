#include <BleKeyboard.h>
#include <esp_mac.h>
#include <nvs_flash.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
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

void handleConfigCommand(String cmd);
void sendConfigNotification(String msg, bool addDelay = false);
BLECharacteristic *pConfigCharacteristic = nullptr;
volatile bool isConfigMode = false;
volatile bool isBleTransitioning = false;
volatile bool exitConfigRequested = false;

class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    String val = pChar->getValue().c_str();
    handleConfigCommand(val);
  }
};

class DactylBleKeyboard : public BleKeyboard {
public:
  DactylBleKeyboard(std::string name, std::string mfr, uint8_t batt)
    : BleKeyboard(name, mfr, batt) {}

  void onConnect(BLEServer *pServer) override {
    if (!isConfigMode) {
      BleKeyboard::onConnect(pServer);
    }
    if (!isBleTransitioning) {
      pServer->getAdvertising()->start();
    }
  }

  void onDisconnect(BLEServer *pServer) override {
    if (!isConfigMode) {
      if (pServer->getConnectedCount() == 0) {
        BleKeyboard::onDisconnect(pServer);
      } else if (!isBleTransitioning) {
        pServer->getAdvertising()->start();
      }
    } else if (!isBleTransitioning) {
      pServer->getAdvertising()->start();
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

    BLEAdvertising *pAdv = pServer->getAdvertising();
    BLEAdvertisementData scanResponseData;
    scanResponseData.setCompleteServices(BLEUUID(CONFIG_SERVICE_UUID));
    pAdv->setScanResponseData(scanResponseData);
    pAdv->setScanResponse(true);
    Serial.println("BLE Config Service aktiv! UUID: " CONFIG_SERVICE_UUID);
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

#define ACT_MEDIA_PLAY_PAUSE     0x120
#define ACT_MEDIA_MUTE           0x121
#define ACT_MEDIA_VOLUME_UP      0x122
#define ACT_MEDIA_VOLUME_DOWN    0x123
#define ACT_MEDIA_NEXT_TRACK     0x124
#define ACT_MEDIA_PREVIOUS_TRACK 0x125
#define ACT_MEDIA_STOP           0x126
#define ACT_MAC_GLOBE            0x127

#define NUM_LAYERS 8

#define BATTERY_PIN 35

uint32_t standbyTimeoutMinutes = 5;    // Stufe 1: 5 Min bis Standby (80 MHz, gedrosselter Scan, BLE bleibt an)
uint32_t deepSleepTimeoutMinutes = 60; // Stufe 2: 60 Min (1h) bis Deep Sleep (~10 µA)
unsigned long lastActivityTime = 0;
bool isStandby = false;

void exitConfigMode();
void enterConfigMode();
void toggleConfigMode();

void enterConfigMode() {
  if (isConfigMode) return;
  isBleTransitioning = true;
  isConfigMode = true;
  lastActivityTime = millis();

  bleKeyboard.releaseAll();
  Serial.println("\n=============================================");
  Serial.println("  [CONFIG MODE] AKTIVIERT!");
  Serial.println("  Tastatur sendet als 'Dactyl Config'");
  Serial.println("  macOS getrennt -> Web-App kann drahtlos koppeln");
  Serial.println("=============================================");

  BLEServer *pServer = BLEDevice::getServer();
  if (pServer) {
    // 1. Alle aktiven Verbindungen trennen (z. B. macOS HID)
    std::vector<uint16_t> peers;
    for (auto const& peer : pServer->getPeerDevices(false)) {
      peers.push_back(peer.first);
    }
    for (uint16_t id : peers) {
      pServer->disconnect(id);
    }

    // 2. Altes HID-Advertising stoppen
    BLEAdvertising *pAdv = pServer->getAdvertising();
    pAdv->stop();

    // 3. Reines Config-Advertising starten (ohne HID Keyboard Service!)
    // WICHTIG: BLE 4.2 Pakete dürfen max 31 Bytes groß sein!
    // advData: Flags (3B) + Name (15B) = 18B <= 31B
    BLEAdvertisementData advData;
    advData.setFlags(0x06);
    advData.setName("Dactyl Config");

    // scanData: 128-Bit CONFIG_SERVICE_UUID (18B) <= 31B
    BLEAdvertisementData scanData;
    scanData.setCompleteServices(BLEUUID(CONFIG_SERVICE_UUID));

    pAdv->setAppearance(0x0000); // Generic (Kein Keyboard!)
    pAdv->setAdvertisementData(advData);
    pAdv->setScanResponseData(scanData);
    pAdv->setScanResponse(true);
    pAdv->start();
  }
  isBleTransitioning = false;
}

void exitConfigMode() {
  if (!isConfigMode) return;
  isBleTransitioning = true;
  isConfigMode = false;
  exitConfigRequested = false;
  lastActivityTime = millis();

  bleKeyboard.releaseAll();
  Serial.println("\n=============================================");
  Serial.println("  [CONFIG MODE] BEENDET -> Tastaturmodus aktiv");
  Serial.println("  Tastatur sendet wieder als 'Dactyl Keyboard'");
  Serial.println("=============================================");

  BLEServer *pServer = BLEDevice::getServer();
  if (pServer) {
    // 1. Config Client trennen (Web App)
    std::vector<uint16_t> peers;
    for (auto const& peer : pServer->getPeerDevices(false)) {
      peers.push_back(peer.first);
    }
    for (uint16_t id : peers) {
      pServer->disconnect(id);
    }

    // 2. Config-Advertising stoppen
    BLEAdvertising *pAdv = pServer->getAdvertising();
    pAdv->stop();

    // 3. Normales Tastatur-Advertising wiederherstellen (HID Service 0x1812)
    // advData: Flags (3B) + Appearance (4B) + 16-Bit HID UUID 0x1812 (4B) = 11B <= 31B
    BLEAdvertisementData advData;
    advData.setFlags(0x06);
    advData.setAppearance(HID_KEYBOARD);
    advData.setCompleteServices(BLEUUID((uint16_t)0x1812));

    // scanData: 128-Bit CONFIG_SERVICE_UUID (18B) <= 31B (ohne setName, exakt wie in onStarted)
    BLEAdvertisementData scanData;
    scanData.setCompleteServices(BLEUUID(CONFIG_SERVICE_UUID));

    pAdv->setAppearance(HID_KEYBOARD);
    pAdv->setAdvertisementData(advData);
    pAdv->setScanResponseData(scanData);
    pAdv->setScanResponse(true);
    pAdv->start();
  }
  isBleTransitioning = false;
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

float getBatteryVoltage() {
  uint32_t rawSum = 0;
  const int SAMPLES = 8;
  for (int i = 0; i < SAMPLES; i++) {
    rawSum += analogRead(BATTERY_PIN);
    delayMicroseconds(50);
  }
  float rawAvg = (float)rawSum / (float)SAMPLES;
  // ESP32 ADC: 12-Bit (0..4095), 3.3V Referenz, 2:1 Spannungsteiler auf WEMOS LOLIN Boards
  float voltage = (rawAvg / 4095.0f) * 3.3f * 2.0f;
  return voltage;
}

uint8_t calculateBatteryPercentage(float voltage) {
  // Wenn kein Akku an Pin 35 anliegt (z. B. reiner USB-Betrieb oder unbeschaltet < 1.0V)
  if (voltage < 1.0f) return 100;
  if (voltage >= 4.18f) return 100;
  if (voltage <= 3.30f) return 0;
  int pct = (int)((voltage - 3.30f) / (4.18f - 3.30f) * 100.0f);
  if (pct > 100) pct = 100;
  if (pct < 0) pct = 0;
  return (uint8_t)pct;
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
String layerNames[NUM_LAYERS] = {
  "Base", "Nav & Pfeile", "Symbole", "Numpad",
  "Function", "Media", "Shortcuts", "Custom"
};

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
  Serial.printf("NVS: Timeouts geladen: Standby=%u Min, DeepSleep=%u Min\n", standbyTimeoutMinutes, deepSleepTimeoutMinutes);
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
    pConfigCharacteristic->setValue(msg.c_str());
    pConfigCharacteristic->notify();
    if (addDelay) {
      delay(15);
    }
  }
}

void handleConfigCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

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
    float v = getBatteryVoltage();
    uint8_t pct = calculateBatteryPercentage(v);
    char buf[192];
    snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"Dactyl Keyboard\",\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\",\"battery\":%d,\"voltage\":%.2f,\"standby_timeout\":%u,\"sleep_timeout\":%u}",
      m[0], m[1], m[2], m[3], m[4], m[5], pct, v, standbyTimeoutMinutes, deepSleepTimeoutMinutes);
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
  } else if (cmd == "EXIT_CONFIG") {
    sendConfigNotification("OK EXIT_CONFIG");
    exitConfigRequested = true;
  }

  if (mutexTaken) xSemaphoreGive(configMutex);
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Brownout-Detektor deaktivieren (verhindert Reboot bei BLE Stromspitzen)
  Serial.begin(115200);
  delay(400);

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

  // Batterie-Messung initialisieren (Pin 35, 11dB Attenuation für 0..3.3V Messbereich)
  pinMode(BATTERY_PIN, INPUT);
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);

  lastActivityTime = millis();

  Serial.println("\n=============================================");
  Serial.println("  Dactyl True-Wireless (Rechte Hand)");
  Serial.println("  Bluetooth-Name: 'Dactyl Keyboard'");
  Serial.println("=============================================");

  // 1. MAC-Adresse: Bewährte MAC-Adresse für Dactyl Keyboard (2E:BC:BB:81:61:A8)
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_BASE);
  mac[5] ^= 0x42;
  mac[0] |= 0x02;
  esp_base_mac_addr_set(mac);

  Serial.printf("Bluetooth-MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  // 2. NVS initialisieren (erhält Pairing-Keys nach dem ersten Verbinden)
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
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

  // 5. Bluetooth BLE HID Server starten
  Serial.println("Initialisiere BleKeyboard..."); Serial.flush();
  bleKeyboard.begin();
  Serial.println("Bluetooth aktiv! Advertising läuft."); Serial.flush();
}

void loop() {
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 2500) {
    lastHeartbeat = millis();
    Serial.printf("STATUS: BLE verbunden=%d | Matrix aktiv\n", bleKeyboard.isConnected());
    Serial.flush();
  }

  // Regelmäßige Batterie-Aktualisierung (alle 30s)
  static unsigned long lastBatteryCheck = 0;
  if (millis() - lastBatteryCheck > 30000) {
    lastBatteryCheck = millis();
    float v = getBatteryVoltage();
    uint8_t pct = calculateBatteryPercentage(v);
    if (bleKeyboard.isConnected()) {
      bleKeyboard.setBatteryLevel(pct);
    }
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
                bleKeyboard.press((uint8_t)action);
              }
            }
          } else {
            uint16_t action = pressedAction[r][c];
            pressedAction[r][c] = 0;

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
                bleKeyboard.release((uint8_t)action);
              }
            }
          }
        }
      }

      pinMode(ROW_PINS[r], INPUT);
    }

    // Hardware-Combo R0C0 + R4C5 (500ms gehalten) für drahtlosen Config-Modus
    static unsigned long comboStartTime = 0;
    if (keyState[0][0] && keyState[4][5]) {
      if (comboStartTime == 0) {
        comboStartTime = millis();
      } else if (millis() - comboStartTime >= 500) {
        comboStartTime = 0;
        toggleConfigMode();

        // Release-Events senden & States zurücksetzen, damit UI nicht hängen bleibt
        pressedAction[0][0] = 0;
        pressedAction[4][5] = 0;
        keyState[0][0] = false;
        keyState[4][5] = false;
        sendConfigNotification("KEY_RELEASE:{\"r\":0,\"c\":0}");
        sendConfigNotification("KEY_RELEASE:{\"r\":4,\"c\":5}");

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
      }
    } else {
      comboStartTime = 0;
    }

    xSemaphoreGive(configMutex);
  }

  // Deferriertes Beenden des Config-Modus aus loopTask
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

  // Seriellen Puffer auf App-Befehle prüfen
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    handleConfigCommand(cmd);
  }

  delay(isStandby ? 40 : 10);
}
