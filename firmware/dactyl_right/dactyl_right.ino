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

#include "DactylBleComposite.h"

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

#define ACT_MOUSE_LEFT           0x130
#define ACT_MOUSE_RIGHT          0x131
#define ACT_MOUSE_MIDDLE         0x132
#define ACT_MOUSE_WHEEL_UP       0x133
#define ACT_MOUSE_WHEEL_DOWN     0x134

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

// Halte-Aktionen (Mod-Tap / Layer-Tap): 0 = keine Halte-Aktion, sonst Aktion beim Festhalten > TAPPING_TERM_MS
// [[[START_HOLDMAP]]]
uint16_t HOLDMAP[NUM_LAYERS][6][7] = {};
// [[[END_HOLDMAP]]]

bool keyState[6][7] = {false};
uint16_t pressedAction[6][7] = {0};
unsigned long keyPressTime[6][7] = {0};
bool keySentToHost[6][7] = {false};
bool momentaryLayers[NUM_LAYERS] = {false};
bool toggleLayers[NUM_LAYERS] = {false};

#include "DactylLogic.h"

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
          onMatrixKeyChange(r, c, isPressed);
        }
      }

      pinMode(ROW_PINS[r], INPUT);
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
    feedSerialChar((char)Serial.read(), serialRxBuf);
  }

  delay(isStandby ? 40 : debounceMs);
}
