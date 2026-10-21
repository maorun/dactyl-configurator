# ESP32 Arduino Core HID & USB/BLE Reference

Dieses Dokument fasst die internen Datenstrukturen, Report-Deskriptoren und APIs der ESP32 Arduino Core Bibliotheken (`BLE`, `USB`, `USBHost` unter `/Users/mdriemel/Library/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/`) zusammen, sodass die externen Quellcodedateien nicht wiederholt eingelesen werden müssen.

---

## 1. Hardware-Unterschied: Classic ESP32 vs. ESP32-S2/S3

- **Classic ESP32 (WEMOS LOLIN32 Lite / `ESP32-D0WDQ6-V3`):**
  - **Kein natives USB-OTG** (`SOC_USB_OTG_SUPPORTED == 0`).
  - USB-Anschluss läuft rein über den onboard UART-Bridge-Chip (CH340 oder CP2102) mit Standard Serial (`115200` Baud).
  - HID-Funktionalität (Tastatur, Maus, Media) läuft drahtlos über **BLE HID** (Bluedroid Stack via `BLEHIDDevice`).
- **ESP32-S2 / ESP32-S3:**
  - Besitzen native USB-OTG-Hardware (`SOC_USB_OTG_SUPPORTED == 1`).
  - Nutzen `libraries/USB` mit TinyUSB (`USBHIDMouse`, `USBHIDKeyboard`, `USBHostHIDMouse`).

---

## 2. ESP32 BLE HID Core (`libraries/BLE/src/BLEHIDDevice.cpp`, `HIDTypes.h`)

### Service & Characteristic Architektur
- `BLEHIDDevice` erzeugt den Standard GATT HID Service (`0x1812`).
- **Input Reports (`hid->inputReport(uint8_t reportId)`):**
  - Characteristic Properties: `READ | NOTIFY`.
  - Hängt automatisch einen `BLE2902` CCCD (Client Characteristic Configuration Descriptor) an, über den der Host (macOS/Windows) Notifications aktiviert (`0x0001`).
  - Report Reference Descriptor (UUID `0x2908`): 2 Bytes `[reportId, 0x01]` (`0x01` = Input Report).
- **Output Reports (`hid->outputReport(uint8_t reportId)`):**
  - Characteristic Properties: `READ | WRITE | WRITE_NR`.
  - Report Reference Descriptor (UUID `0x2908`): 2 Bytes `[reportId, 0x02]` (`0x02` = Output Report, z. B. Tastatur-LEDs Num/Caps/Scroll Lock).
- **Report Map (`hid->reportMap(uint8_t* desc, size_t len)`):**
  - Characteristic UUID `0x2A4B`. Enthält den rohen binären HID Report Descriptor für alle definierten Report IDs.
- **Advertising Konfiguration:**
  - Service UUID: `hid->hidService()->getUUID()`.
  - Appearance: `HID_KEYBOARD` (`0x03C1`), `HID_MOUSE` (`0x03C2`) oder `0x03C0` (Generic HID).
  - Wichtig: Bei Composite Devices (Tastatur + Maus) Appearance auf `HID_KEYBOARD` setzen; macOS liest die Teilgeräte aus dem Report Map Descriptor aus.

---

## 3. TinyUSB & USB-HID Report-Formate (`libraries/USB/src/USBHIDMouse.cpp`)

### Relative Mouse Report (`hid_mouse_report_t` / `HIDMouseRel`)
- Standard-Format für relative Mausbewegungen (Report ID 3 in BLE & TinyUSB):
  - Byte 0: `uint8_t buttons` (Bit 0 = Left, Bit 1 = Right, Bit 2 = Middle, Bit 3 = Backward, Bit 4 = Forward).
  - Byte 1: `int8_t x` (-127 bis 127).
  - Byte 2: `int8_t y` (-127 bis 127).
  - Byte 3: `int8_t wheel` (-127 bis 127, vertikales Scrollrad).
  - (Optional in TinyUSB): `int8_t pan` (horizontales Scrollen).

### Absolute Mouse Report (`hid_abs_mouse_report_t` / `HIDMouseAbs`)
- Für Grafiktabletts oder Touchscreens:
  - Byte 0: `uint8_t buttons`
  - Byte 1–2: `int16_t x` (0 bis 32767 bzw. -32768 bis 32767)
  - Byte 3–4: `int16_t y`
  - Byte 5: `int8_t wheel`
  - Byte 6: `int8_t pan`

---

## 4. USB Host Mouse Erkennungslogik (`libraries/USB/src/USBHostHIDMouse.cpp`)

- **Unterscheidung Maus vs. Gamepad/Joystick:**
  - Prüft im Report Descriptor Usage Page `0x01` (Generic Desktop):
    - Usage `0x04` (Joystick), `0x05` (Gamepad), `0x08` (Multi-axis Controller) -> Ignorieren (nicht als Maus behandeln).
    - Usage `0x39` (Desktop Hat Switch) -> Gamepad-Merkmal.
    - Usage `0x02` (Mouse) oder Interface Protocol `0x02` (Mouse Boot Protocol) -> Als Maus initialisieren.
- **X/Y-Auflösungserkennung (`desc_probe_mouse_layout`):**
  - Erkennt, ob die Maus 8-Bit oder 16-Bit Koordinaten sendet:
    - Wenn `REPORT_SIZE >= 16`, werden X und Y als 2-Byte Integers gepackt.
    - Wichtig: Verhindert, dass das Scrollrad-Byte bei modernen High-DPI-Mäusen an der falschen Byte-Position gelesen wird.
  - Prüft, ob ein `REPORT_ID` Prefix (Tag `0x84`) vor den Payload-Daten vorhanden ist.

---

## 5. ESP-NOW Split-Kommunikation (`libraries/ESP_NOW/src/ESP32_NOW.h`, `esp_now.h`)

ESP-NOW ist das latenzarme (< 5 ms) 2.4-GHz-Protokoll von Espressif für die drahtlose Verbindung der beiden Tastaturhälften (Linke Hand -> Rechte Master-Hand).

### C++ OOP API (`ESP32_NOW.h` ab Core 3.x)
- **Singleton `ESP_NOW` (`ESP_NOW_Class`):**
  - `ESP_NOW.begin(const uint8_t *pmk = nullptr)`: Aktiviert den Wi-Fi-Treiber im Station-Modus (`WIFI_STA`) und ruft `esp_now_init()` auf.
  - `ESP_NOW.end()`: Trennt alle Peers und ruft `esp_now_deinit()` auf.
  - `ESP_NOW.onNewPeer(cb, arg)`: Automatischer Registrierungs-Callback bei eingehenden Broadcasts.
- **Peer-Klasse `ESP_NOW_Peer`:**
  - Kapselt die Peer-MAC-Adresse, Wi-Fi-Kanal, Interface (`WIFI_IF_STA`) und optionale LMK-Verschlüsselung (16 Bytes AES).
  - Virtuelle Callbacks zum Überschreiben:
    - `virtual void onReceive(const uint8_t *data, size_t len, bool broadcast)`
    - `virtual void onSent(bool success)`
  - Senden: `peer.send(data, len)`. Maximale Payload-Länge: **250 Bytes** (`ESP_NOW_MAX_DATA_LEN`).

### Low-Level C-API (`esp_now.h` in ESP-IDF v5 / Core 3.x)
- **Initialisierung:**
  ```cpp
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  if (esp_now_init() != ESP_OK) { /* Error */ }
  ```
- **Callbacks:**
  - Receive-Callback-Signatur in IDF v5 / Core 3.x:
    `void onDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *incomingData, int len)`
    - `recv_info->src_addr`: 6-Byte Quell-MAC-Adresse.
  - Send-Callback:
    `void onDataSent(const uint8_t *mac_addr, esp_now_send_status_t status)` (`ESP_NOW_SEND_SUCCESS` / `ESP_NOW_SEND_FAIL`).
- **Peer-Registrierung:**
  ```cpp
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, targetMac, 6);
  peerInfo.channel = 1; // Fester Wi-Fi-Kanal
  peerInfo.ifidx = WIFI_IF_STA;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
  ```

### Deterministisches Peer-Addressing (Split Keyboard)
- **Rechte Master-Hand:**
  - Base-MAC: `2E:BC:BB:81:61:A6`
  - Wi-Fi STA MAC: `2E:BC:BB:81:61:A6` (ESP-NOW Receiver auf Kanal 1)
  - Bluetooth MAC: `2E:BC:BB:81:61:A8` (BLE HID Verbindung zu macOS)
- **Linke Slave-Hand:**
  - Base-MAC: `2E:BC:BB:81:61:B0`
  - Wi-Fi STA MAC: `2E:BC:BB:81:61:B0` (ESP-NOW Transmitter)
  - Ziel-Peer: `2E:BC:BB:81:61:A6` (ohne Scan sofort nach Boot erreichbar)
- **Paket-Struktur (`SplitKeyEvent`, 4 Bytes):**
  ```cpp
  struct __attribute__((packed)) SplitKeyEvent {
    uint8_t row;      // 0..5
    uint8_t col;      // 0..6
    bool isPressed;   // true = Down, false = Up
    uint8_t flags;    // 0 = Normal, 1 = Battery Alert, 2 = Ping
  };
  ```

---

## 6. BLE Core & Advertising Mechanik (`libraries/BLE/src/`)

### 1. BLEDevice (`BLEDevice.h / .cpp`)
- `BLEDevice::init(std::string name)`: Initialisiert Bluedroid und den BT-Controller.
- `BLEDevice::createServer()`: Erzeugt die GATT-Server-Instanz.
- `BLEDevice::getAdvertising()`: Liefert das globale Advertising-Objekt.
- MAC-Adresse:
  - Basis-MAC wird vor `BLEDevice::init()` mit `esp_base_mac_addr_set(base_mac)` festgelegt.
  - Bluetooth-MAC = Base-MAC + 2 (auslesbar per `esp_read_mac(mac, ESP_MAC_BT)`).

### 2. BLEServer (`BLEServer.h / .cpp`)
- Callbacks: `BLEServerCallbacks` mit `onConnect(pServer)` und `onDisconnect(pServer)`.
- `pServer->getConnectedCount()`: Anzahl aktiver GATT-Verbindungen.
- `pServer->disconnect(uint16_t connId)`: Verbindung asynchron trennen (`ESP_GATTS_DISCONNECT_EVT` feuert ~20–50 ms verzögert auf dem BTC-Task).

### 3. BLEAdvertising (`BLEAdvertising.h / .cpp`)
- Legacy BLE 4.2 Advertising-PDU-Limit: **31 Bytes** für Advertising-Data (`advData`) und Scan-Response (`scanData`).
- `pAdv->addServiceUUID(uuid)`: Fügt die UUID hinzu (128-Bit-UUID = 18 Bytes inkl. Header!).
- `pAdv->setScanResponse(true)`: Teilt Payload auf Advertising- und Scan-Response-Paket auf.
- `pAdv->reset()`: Löscht gesetzte Advertisement-Daten im Speicher, setzt aber nicht den Controller GAP `own_addr_type` zurück.

---

## 7. Wi-Fi / ESP-NOW & Bluetooth Koexistenz auf Classic ESP32

Beim Dactyl Split-Keyboard nutzt die rechte Master-Hand:
1. **ESP-NOW** zum Empfangen von Tastendrücken der linken Hand.
2. **BLE HID** zum Senden von Tastatur-/Maus-Reports an macOS.

### Technische Koexistenz-Regeln:
- **Gemeinsame 2.4-GHz-Radio-Hardware:** Wi-Fi und Bluetooth teilen sich denselben HF-Transceiver.
- **Hardware-Coexistence-Arbiter (`esp_coex`):** ESP-IDF steuert das Time-Sharing zwischen Wi-Fi und Bluetooth automatisch auf Hardware-Ebene.
- **Kanal-Festlegung:** Der Wi-Fi-Kanal für ESP-NOW muss fest eingestellt werden (z. B. Kanal 1, 6 oder 11 via `WiFi.channel(1)` oder `esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE)`), da Frequenz-Hopping zu Paketverlusten im ESP-NOW-Empfang führen kann.
- **Paket-Design für Split-Tastatur:**
  - Linke Hand sendet kompakte Events (z. B. 4 Bytes: `[row, col, isPressed, flags]`).
  - Schneller Transfer (< 2 ms Airtime) minimiert Radio-Kollisionen mit aktiven BLE-GATT-Transfers.

