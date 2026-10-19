#include <BleKeyboard.h>
#include <esp_mac.h>
#include <nvs_flash.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

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
BLECharacteristic *pConfigCharacteristic = nullptr;

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
    BleKeyboard::onConnect(pServer);
    // Advertising sofort wieder starten, damit Web-Bluetooth im Browser den ESP32 auch während aktiver Mac-Verbindung findet!
    pServer->getAdvertising()->start();
  }

  void onDisconnect(BLEServer *pServer) override {
    if (pServer->getConnectedCount() == 0) {
      BleKeyboard::onDisconnect(pServer);
    } else {
      // Mindestens ein Client (z.B. Mac HID) ist noch verbunden!
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
    { KEY_F6          , KEY_F7          , KEY_F8          , KEY_F9          , KEY_F10         , KEY_F11         , 0                },
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
  preferences.end();
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

void sendConfigNotification(String msg, bool addDelay = false) {
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
    char buf[128];
    snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"Dactyl Keyboard\",\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\",\"battery\":100}",
      m[0], m[1], m[2], m[3], m[4], m[5]);
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
  }

  if (mutexTaken) xSemaphoreGive(configMutex);
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Brownout-Detektor deaktivieren (verhindert Reboot bei BLE Stromspitzen)
  Serial.begin(115200);
  delay(400);

  configMutex = xSemaphoreCreateMutex();

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
              if (bleKeyboard.isConnected()) {
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
              if (bleKeyboard.isConnected()) {
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
              if (action == 0x127 && bleKeyboard.isConnected()) {
                bleKeyboard.release(KEY_MEDIA_GLOBE);
              }
            } else if (action > 0 && action <= 0xFF) {
              if (bleKeyboard.isConnected()) {
                bleKeyboard.release((uint8_t)action);
              }
            }
          }
        }
      }

      pinMode(ROW_PINS[r], INPUT);
    }
    xSemaphoreGive(configMutex);
  }

  // Seriellen Puffer auf App-Befehle prüfen
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    handleConfigCommand(cmd);
  }

  delay(10);
}
