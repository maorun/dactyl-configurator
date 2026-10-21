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
