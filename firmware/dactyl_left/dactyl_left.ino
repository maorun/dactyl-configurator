/*
 * =============================================================================
 * Dactyl True-Wireless Split Keyboard — Linke Hand (Firmware)
 * Board: WEMOS LOLIN32 Lite (esp32:esp32:lolin32-lite, PartitionScheme=min_spiffs)
 * =============================================================================
 * Eigenständige Tastatur-Logik (DactylLogic.h): 8 Layer, Tap/Hold/Double-Tap, Combos, Key-Pairs, NVS.
 * Die aufgelösten HID-Operationen gehen per ESP-NOW an die rechte Hälfte (Master), die sie über ihre
 * BLE-HID-Verbindung an den Mac weitergibt. Ein Bluetooth-Gerät am Mac.
 *
 * Config Mode: R0C5 + R4C0 (500 ms) oder USB-Serial ENTER_CONFIG. Isolierter BLE-Server
 * "Dactyl Config L" ohne HID; Rückkehr per ESP.restart() oder nach 3 Min Inaktivität.
 */
#include "../dactyl_right/DactylKeycodes.h"
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
#include "../dactyl_right/DactylHidDescriptor.h" // MOUSE_BUTTON_* (Masken wie am Master)
#include <esp_system.h>
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <driver/gpio.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#define CONFIG_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CONFIG_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CONFIG_MODE_MAGIC          0xDAC7CF60UL

// Gespiegelte Config-Combo: innen oben (R0C5) + außen unten (R4C0)
#define CONFIG_COMBO_R1 0
#define CONFIG_COMBO_C1 5
#define CONFIG_COMBO_R2 4
#define CONFIG_COMBO_C2 0
#define DEFAULT_DEVICE_NAME "Dactyl Links"
#define CONFIG_BLE_NAME "Dactyl Config L"
#define DEVICE_SIDE "L"

#include "../dactyl_right/DactylCommon.h"
#include "DactylLeftLogic.h"
#include "DactylSplitKeyboard.h"

// Überlebt ESP.restart() im RTC-Slow-Memory, wird aber beim Kaltstart ignoriert
RTC_NOINIT_ATTR uint32_t rtcConfigModeMagic;

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);
BLECharacteristic *pConfigCharacteristic = nullptr;
volatile bool isConfigMode = false;
volatile bool isBleTransitioning = false;
volatile bool exitConfigRequested = false;
volatile bool enterConfigRequested = false;

#include "../dactyl_right/DactylConfigBleCallbacks.h"

// Sendewarteschlange zum Master und HID-Proxy mit der Schnittstelle von DactylBleComposite
static SplitSendQueue sendQueue;
DactylSplitKeyboard bleKeyboard(sendQueue);

const int NUM_ROWS = LEFT_NUM_ROWS;
const int NUM_COLS = LEFT_NUM_COLS;

// [[[START_SETTINGS]]]
String deviceName = DEFAULT_DEVICE_NAME;
uint8_t debounceMs = 5;
uint16_t comboTimeoutMs = 40;
uint16_t tappingTermMs = 200;
uint32_t standbyTimeoutMinutes = 5;    // Stufe 1: 5 Min bis Standby (80 MHz, gedrosselter Scan)
uint32_t deepSleepTimeoutMinutes = 60; // Stufe 2: 60 Min (1h) bis Deep Sleep (~10 µA)
// [[[END_SETTINGS]]]

ComboRuntime comboRuntime[MAX_COMBOS];

// [[[START_COMBOS]]]
uint8_t numCombos = 0;
KeyCombo userCombos[MAX_COMBOS] = {
  { 0, 0, 0, 0, 0, 0 }
};
// [[[END_COMBOS]]]

// [[[START_KEY_PAIRS]]]
uint8_t numKeyPairs = 0;
KeyPair userKeyPairs[MAX_KEY_PAIRS] = {
  { 0, 0 }
};
// [[[END_KEY_PAIRS]]]

unsigned long lastActivityTime = 0;
bool isStandby = false;

void exitConfigMode();
void enterConfigMode();
void checkUserCombos();
void serviceSendQueue();
void flushSendQueue(unsigned long maxMs);

// Im Gegensatz zur rechten Hälfte gibt es keinen macOS-HID-Bond: Config Mode startet per Soft-Reboot
// in einem isolierten BLE-Stack, Keyboard Mode nutzt kein BLE (nur ESP-NOW).
void enterConfigMode() {
  if (isConfigMode) return;
  isBleTransitioning = true;
  enterConfigRequested = false;

  bleKeyboard.releaseAll();
  Serial.println("\n=============================================");
  Serial.println("  [CONFIG MODE] AKTIVIERT -> Starte Config-BLE...");
  Serial.println("=============================================");
  sendConfigNotification("MODE:CONFIG");
  // RELEASE_ALL noch an den Master übertragen, bevor ESP-NOW mit dem Neustart endet
  flushSendQueue(300);

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
  Serial.println("[BLE] Starte Tastaturmodus neu...");
  Serial.flush();
  ESP.restart();
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

  // Alles lösen, was die linke Hälfte am Master gedrückt hält, und kurz auf die Zustellung warten
  bleKeyboard.releaseAll();
  flushSendQueue(300);
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);

  // 1. Zeilen als OUTPUT HIGH halten (3.3V); Zeilen-GPIOs sind keine RTC-Pins -> gpio_hold
  for (int r = 0; r < NUM_ROWS; r++) {
    gpio_num_t pin = (gpio_num_t)LEFT_ROW_PINS[r];
    pinMode(LEFT_ROW_PINS[r], OUTPUT);
    digitalWrite(LEFT_ROW_PINS[r], HIGH);
    gpio_hold_en(pin);
  }
  gpio_deep_sleep_hold_en();

  // 2. Spalten als RTC-Eingänge mit PULLDOWN (0V). Tastendruck: Zeile HIGH -> Schalter -> Diode -> Spalte HIGH
  uint64_t ext1_mask = 0;
  for (int c = 0; c < NUM_COLS; c++) {
    gpio_num_t pin = (gpio_num_t)LEFT_COL_PINS[c];
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

// QWERTZ-Basis-Belegung für die linke Hand. Spalten außen (C0) -> innen (C5), C6 nur Daumen.
// Wie rechts sind die Codes US-ASCII; macOS mit deutschem Layout bildet z. B. 'y' auf Z, 'z' auf Y ab.
// R4C5 existiert physisch nicht. Daumen (Row 5): C3 ganz links, C6 oben rechts, C5 oben mittig,
//   C4 rechts mittig, C1 unten rechts, C2 unten mittig; R5C0 existiert nicht.
// [[[START_KEYMAP]]]
uint16_t KEYMAP[NUM_LAYERS][6][7] = {
  // Layer 0 (Base)
  {
    { KEY_ESC         , '1'             , '2'             , '3'             , '4'             , '5'             , 0                },
    { KEY_TAB         , 'q'             , 'w'             , 'e'             , 'r'             , 't'             , 0                },
    { KEY_CAPS_LOCK   , 'a'             , 's'             , 'd'             , 'f'             , 'g'             , 0                },
    { KEY_LEFT_SHIFT  , 'y'             , 'x'             , 'c'             , 'v'             , 'b'             , 0                },
    { KEY_LEFT_CTRL   , '`'             , KEY_LEFT_ALT    , KEY_LEFT_GUI    , ACT_MO_1        , 0               , 0                },
    { 0               , KEY_BACKSPACE   , KEY_DELETE      , KEY_LEFT_CTRL   , ' '             , KEY_LEFT_GUI    , KEY_LEFT_ALT     }
  },

  // Layer 1 (Nav & Pfeile)
  {
    { ACT_TG_0        , KEY_F1          , KEY_F2          , KEY_F3          , KEY_F4          , KEY_F5          , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                },
    { 0               , 0               , 0               , 0               , 0               , 0               , 0                }
  },

  // Layer 2..7: transparent (Fallback auf Layer 0)
  {}, {}, {}, {}, {}, {}
};
// [[[END_KEYMAP]]]

// Halte-Aktionen (Mod-Tap / Layer-Tap): 0 = keine, sonst Aktion beim Halten
// [[[START_HOLDMAP]]]
uint16_t HOLDMAP[NUM_LAYERS][6][7] = {};
// [[[END_HOLDMAP]]]

// Doppel-Tipp-Aktionen (Tap-Dance): 0 = keine
// [[[START_DTAPMAP]]]
uint16_t DTAPMAP[NUM_LAYERS][6][7] = {};
// [[[END_DTAPMAP]]]

// [[[START_DEFAULTS_ID]]]
#define KEYMAP_DEFAULTS_ID 0UL
// [[[END_DEFAULTS_ID]]]

bool keyState[6][7] = {false};
uint16_t pressedAction[6][7] = {0};
unsigned long keyPressTime[6][7] = {0};
bool keySentToHost[6][7] = {false};
bool momentaryLayers[NUM_LAYERS] = {false};
bool toggleLayers[NUM_LAYERS] = {false};

#include "../dactyl_right/DactylLogic.h"
#include "../dactyl_right/DactylConfigBle.h"

// -----------------------------------------------------------------------------
// ESP-NOW-Sender
// -----------------------------------------------------------------------------
static bool espNowReady = false;
static uint32_t droppedReported = 0;
static EspNowRestartGuard restartGuard;
#define HEARTBEAT_INTERVAL_MS 1000

// Vom Sende-Callback (Wi-Fi-Task) geschrieben, in loop() gelesen. Der Callback schreibt zuerst
// den Status und danach die Nummer; loop() liest in umgekehrter Reihenfolge.
static volatile bool lastSendOk = false;
static volatile uint32_t callbackSeq = 0;

// Vom Empfangs-Callback (Wi-Fi-Task) gesetzt: Am Master wurde getippt (SPLIT_OP_ACTIVITY)
static volatile bool masterActivityReceived = false;

static void onEspNowSent(const esp_now_send_info_t *info, esp_now_send_status_t status) {
  (void)info;
  lastSendOk = (status == ESP_NOW_SEND_SUCCESS);
  callbackSeq = callbackSeq + 1;
}

// Läuft auf dem Wi-Fi-Task: nur prüfen und vormerken; loop() setzt den Inaktivitäts-Timer zurück
static void onEspNowRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (info == nullptr || !parseSplitActivityPacket(info->src_addr, data, len)) return;
  masterActivityReceived = true;
}

static bool setupEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(SPLIT_ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);

  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  Serial.printf("Wi-Fi-STA-MAC: %02X:%02X:%02X:%02X:%02X:%02X (Soll 2E:BC:BB:81:61:B0)\n",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  if (esp_now_init() != ESP_OK) {
    Serial.println("ERR ESPNOW_INIT");
    return false;
  }
  esp_now_register_send_cb(onEspNowSent);
  // Ohne Empfang schläft links weiter nach eigener Inaktivität ein (Verhalten vor ACTIVITY)
  if (esp_now_register_recv_cb(onEspNowRecv) != ESP_OK) Serial.println("ERR ESPNOW_RECV_CB");

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, SPLIT_MASTER_MAC, sizeof(SPLIT_MASTER_MAC));
  peer.channel = SPLIT_ESPNOW_CHANNEL;
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("ERR ESPNOW_PEER");
    return false;
  }
  espNowReady = true;
  Serial.println("ESP-NOW bereit (Kanal 1, Ziel 2E:BC:BB:81:61:A6)");
  // Nach einem Neustart hält der Master evtl. noch Eingaben dieser Hälfte (kein Link-Timeout bei kurzem
  // Reboot). RELEASE_ALL löst sie; die Bestätigung meldet zugleich den Link, ohne auf den Heartbeat zu warten.
  // releaseAll() leert auch die gehaltenen Eingaben des Proxys (nach restartEspNow nicht leer).
  bleKeyboard.releaseAll();
  return true;
}

// Neustart des Funk-Stacks, wenn jeder Versand scheitert (shouldRestartEspNow). Die Warteschlange wird
// geleert; setupEspNow() stellt Kanal und Peer her und reiht RELEASE_ALL ein.
static void restartEspNow() {
  Serial.println("ESPNOW_RESTART");
  espNowReady = false;
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);
  delay(20);
  queueReset(sendQueue);
  restartGuardOnRestart(restartGuard, millis());
  if (!setupEspNow()) {
    // Ohne ESP-NOW sendet diese Hälfte nichts mehr; die Keymap liegt in NVS
    Serial.println("[ESPNOW] Neustart fehlgeschlagen -> Board-Neustart");
    Serial.flush();
    ESP.restart();
  }
}

static void reportOutcome(SendOutcome outcome, unsigned long nowMs) {
  restartGuardOnOutcome(restartGuard, outcome, nowMs);
  if (outcome == SEND_RETRY) Serial.println("ESPNOW_RETRY");
  else if (outcome == SEND_DROPPED) Serial.println("ESPNOW_FAIL");
}

// Ergebnis des laufenden Pakets auswerten und das nächste Paket senden
void serviceSendQueue() {
  if (!espNowReady) return;
  unsigned long now = millis();
  uint32_t seq = callbackSeq;
  bool ok = lastSendOk;
  if (queueCallbackIsCurrent(sendQueue, seq)) {
    bleKeyboard.onSendResult(ok, now);
    reportOutcome(queueOnSendResult(sendQueue, ok, now), now);
  } else if (queueTimedOut(sendQueue, now)) {
    reportOutcome(queueOnSendResult(sendQueue, false, now), now);
  }

  SplitHidEvent ev;
  if (queueNextToSend(sendQueue, now, ev)) {
    uint32_t seqBeforeSend = callbackSeq;
    if (esp_now_send(SPLIT_MASTER_MAC, (const uint8_t *)&ev, sizeof(ev)) == ESP_OK) {
      queueMarkSent(sendQueue, seqBeforeSend);
    } else {
      reportOutcome(queueOnSendResult(sendQueue, false, now), now);
    }
  }

  uint32_t dropped = bleKeyboard.droppedEvents();
  if (dropped != droppedReported) {
    Serial.printf("ESPNOW_QUEUE_FULL (%lu verworfen)\n", (unsigned long)(dropped - droppedReported));
    droppedReported = dropped;
  }
}

// Wartet höchstens maxMs, bis die Warteschlange leer ist. Ohne ESP-NOW gibt es nichts zu senden.
void flushSendQueue(unsigned long maxMs) {
  if (!espNowReady) return;
  unsigned long t = millis();
  while (sendQueue.count > 0 && millis() - t < maxMs) {
    serviceSendQueue();
    delay(5);
  }
}

// Lebenszeichen für den Master; auch die Grundlage für isConnected() ohne Tastendruck
static void sendHeartbeatIfDue() {
  static unsigned long lastHeartbeatMs = 0;
  if (millis() - lastHeartbeatMs < HEARTBEAT_INTERVAL_MS) return;
  lastHeartbeatMs = millis();
  if (sendQueue.count == 0) queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
}

void setup() {
  // RX-Puffer auf 4KB vergrößern für zuverlässige USB-Batch-Synchronisierung (SET_K x 336)
  Serial.setRxBufferSize(4096);
  Serial.begin(115200);
  delay(200);

  esp_reset_reason_t resetReason = esp_reset_reason();
  bool bootIntoConfigMode = shouldBootIntoConfigMode(resetReason, rtcConfigModeMagic);
  rtcConfigModeMagic = 0;
  isConfigMode = bootIntoConfigMode;

  // Deep-Sleep-Holds aufheben & RTC-Pins zurücksetzen
  gpio_deep_sleep_hold_dis();
  for (int r = 0; r < NUM_ROWS; r++) {
    gpio_hold_dis((gpio_num_t)LEFT_ROW_PINS[r]);
  }
  for (int c = 0; c < NUM_COLS; c++) {
    gpio_num_t pin = (gpio_num_t)LEFT_COL_PINS[c];
    rtc_gpio_hold_dis(pin);
    rtc_gpio_deinit(pin);
  }

  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT1) {
    Serial.println("[POWER] Aufgewacht aus Deep Sleep durch Tastendruck!");
  }

  configMutex = xSemaphoreCreateMutex();
  lastActivityTime = millis();
  queueReset(sendQueue);
  restartGuardReset(restartGuard);
  resetLeftKeys();

  Serial.println("\n=============================================");
  Serial.println("  Dactyl True-Wireless (Linke Hand)");
  Serial.printf("  Modus: %s\n", isConfigMode ? "CONFIG MODE ('" CONFIG_BLE_NAME "')" : "KEYBOARD MODE (ESP-NOW -> Master)");
  Serial.println("=============================================");

  // 1. Feste Basis-MAC vor dem Wi-Fi-/BLE-Start (Wi-Fi-STA = Basis, BT = Basis + 2)
  esp_base_mac_addr_set(LEFT_BASE_MAC);

  // 2. NVS initialisieren
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    Serial.println("[NVS] WARN: NVS partition full or new version found, erasing...");
    nvs_flash_erase();
    nvs_flash_init();
  }
  loadKeymapFromNVS();

  // 3. Zeilen lesen mit Pull-up; Spalten hochohmig, bis sie im Scan auf LOW gehen
  for (int r = 0; r < NUM_ROWS; r++) {
    pinMode(LEFT_ROW_PINS[r], INPUT_PULLUP);
  }
  for (int c = 0; c < NUM_COLS; c++) {
    pinMode(LEFT_COL_PINS[c], INPUT);
  }

  // 4. Config Mode: isolierter BLE-Server. Keyboard Mode: nur ESP-NOW zum Master
  if (isConfigMode) {
    startConfigModeBle();
  } else {
    setupEspNow();
    Serial.println("MODE:KEYBOARD");
  }
}

void loop() {
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 2500) {
    lastHeartbeat = millis();
    int link = isConfigMode
      ? ((BLEDevice::getServer() && BLEDevice::getServer()->getConnectedCount() > 0) ? 1 : 0)
      : (bleKeyboard.isConnected() ? 1 : 0);
    Serial.printf("STATUS: %s=%d | ConfigMode=%d | Matrix aktiv\n",
      isConfigMode ? "BLE verbunden" : "Master erreichbar", link, isConfigMode ? 1 : 0);
    Serial.flush();
  }

  // Matrix-Scan: Spalte auf LOW, Zeilen lesen (Dioden-Kathode zur Spalte)
  bool scanMutexTaken = false;
  if (configMutex) {
    scanMutexTaken = (xSemaphoreTake(configMutex, pdMS_TO_TICKS(20)) == pdTRUE);
  }

  if (scanMutexTaken) {
    unsigned long now = millis();
    for (int c = 0; c < NUM_COLS; c++) {
      pinMode(LEFT_COL_PINS[c], OUTPUT);
      digitalWrite(LEFT_COL_PINS[c], LOW);
      delayMicroseconds(30);

      for (int r = 0; r < NUM_ROWS; r++) {
        bool raw = (digitalRead(LEFT_ROW_PINS[r]) == LOW);
        if (updateLeftKey(r, c, raw, now, debounceMs) && leftKeys[r][c].stable != keyState[r][c]) {
          keyState[r][c] = leftKeys[r][c].stable;
          lastActivityTime = millis();
          exitStandby();
          onMatrixKeyChange(r, c, keyState[r][c]);
        }
      }

      pinMode(LEFT_COL_PINS[c], INPUT);
    }

    checkUserCombos();
    processDeferredKeys(millis());

    // Config-Combo R0C5 + R4C0 (500 ms gehalten)
    static unsigned long comboStartTime = 0;
    if (keyState[CONFIG_COMBO_R1][CONFIG_COMBO_C1] && keyState[CONFIG_COMBO_R2][CONFIG_COMBO_C2]) {
      if (comboStartTime == 0) {
        comboStartTime = millis();
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.releaseAll();
        }
      } else if (millis() - comboStartTime >= 500) {
        comboStartTime = 0;
        pressedAction[CONFIG_COMBO_R1][CONFIG_COMBO_C1] = 0;
        pressedAction[CONFIG_COMBO_R2][CONFIG_COMBO_C2] = 0;
        keyState[CONFIG_COMBO_R1][CONFIG_COMBO_C1] = false;
        keyState[CONFIG_COMBO_R2][CONFIG_COMBO_C2] = false;
        sendConfigNotification("KEY_RELEASE:{\"r\":" + String(CONFIG_COMBO_R1) + ",\"c\":" + String(CONFIG_COMBO_C1) + "}");
        sendConfigNotification("KEY_RELEASE:{\"r\":" + String(CONFIG_COMBO_R2) + ",\"c\":" + String(CONFIG_COMBO_C2) + "}");

        if (scanMutexTaken) {
          xSemaphoreGive(configMutex);
          scanMutexTaken = false;
        }

        // Bounded Release-Check (maximal 2000 ms)
        unsigned long releaseStart = millis();
        while (millis() - releaseStart < 2000) {
          bool p1, p2;
          pinMode(LEFT_COL_PINS[CONFIG_COMBO_C1], OUTPUT);
          digitalWrite(LEFT_COL_PINS[CONFIG_COMBO_C1], LOW);
          delayMicroseconds(30);
          p1 = (digitalRead(LEFT_ROW_PINS[CONFIG_COMBO_R1]) == LOW);
          pinMode(LEFT_COL_PINS[CONFIG_COMBO_C1], INPUT);

          pinMode(LEFT_COL_PINS[CONFIG_COMBO_C2], OUTPUT);
          digitalWrite(LEFT_COL_PINS[CONFIG_COMBO_C2], LOW);
          delayMicroseconds(30);
          p2 = (digitalRead(LEFT_ROW_PINS[CONFIG_COMBO_R2]) == LOW);
          pinMode(LEFT_COL_PINS[CONFIG_COMBO_C2], INPUT);

          if (!p1 && !p2) break;
          delay(20);
        }
        // Entprell-Zustand an die losgelassenen Tasten angleichen, damit kein Phantom-Release folgt
        resetLeftKeys();

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

  if (!isConfigMode) {
    sendHeartbeatIfDue();
    serviceSendQueue();
    // Tippen am Master zählt als Aktivität: Standby beenden, Deep Sleep verschieben
    if (masterActivityReceived) {
      masterActivityReceived = false;
      lastActivityTime = millis();
      exitStandby();
    }
    // Deep-Sleep-Vorbereitung und Config-Mode-Wechsel kehren nicht in loop() zurück
    if (espNowReady && shouldRestartEspNow(restartGuard, millis(), true)) {
      restartEspNow();
    }
  }

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

  static String serialRxBuf = "";
  while (Serial.available()) {
    feedSerialChar((char)Serial.read(), serialRxBuf);
  }

  delay(isStandby ? 40 : 1);
}
