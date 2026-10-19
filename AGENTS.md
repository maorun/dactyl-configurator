# AGENTS.md — Developer & Contributor Guide for Dactyl Configurator

## Project Overview

This repository versions the firmware, web-based configurator, macOS desktop app, and operational tooling for the **Dactyl True-Wireless Split Ergonomic Mechanical Keyboard** (specifically the right hand master unit).

### Components

1. **Firmware (`firmware/dactyl_right/dactyl_right.ino`):**
   - Target Board: WEMOS LOLIN32 Lite (`esp32:esp32:lolin32-lite`, ESP32-D0WDQ6-V3).
   - Core Features: BLE HID Keyboard (`ESP32-BLE-Keyboard`), custom BLE GATT Configuration Service (`4fafc201-1fb5-459e-8fcc-c5c9c331914b`), persistent Non-Volatile Storage (NVS) via ESP32 `Preferences`, real-time USB Serial monitor/command interface (115200 baud).
   - Matrix scanning: 6 Rows (`ROW_PINS = {13, 14, 27, 26, 33, 32}`) x 7 Columns (`COL_PINS = {23, 19, 18, 17, 16, 4, 25}`). Hand-wired matrix using 1N4148 diodes (Cathode to Row, Anode to switch pin, Columns on active-low `INPUT_PULLUP`).

2. **Web Configurator (`index.html`, `style.css`, `app.js`):**
   - Modern, vanilla JavaScript SPA with zero external dependencies.
   - Real-time communication via Web Bluetooth API (`navigator.bluetooth`) and Web Serial API (`navigator.serial`).
   - Dynamic 8-layer editor (Layer 0 Base to Layer 7 Custom), layer renaming, and visual keypress feedback filtered by the active hardware layer.

3. **Desktop Application (`Dactyl Configurator.app`):**
   - Native macOS Electron app bundle located in `~/Applications/` and the project directory.
   - Automatically checks and starts the local Python backend server (`server.py`) upon launch.
   - Provides full native macOS window styling with custom high-resolution squircle app icon.

4. **Local REST Server (`server.py`):**
   - Python HTTP server on port `8088`.
   - Serves configurator web assets with strict no-cache headers.
   - Provides `/api/save_and_flash` to compile C++ defaults into `dactyl_right.ino` and flash the board via `arduino-cli`.
   - Provides `/api/config` to read and write `current_config.json`.

---

## Hardware Matrix & Key Layout (Right Hand)

### Finger Matrix
- 5 Rows (Rows 0 to 4) x 6 Columns (Cols 0 to 5).
- Note: Row 4 Column 0 (`R4C0`) does physically not exist (rendered as an invisible spacer in the UI).

### Thumb Cluster
- Dedicated 6-key custom Dactyl Manuform thumb cluster, physically all soldered to **Row 5 (Purple Wire)**:
  - `R5C6`: Top-Left (Default: Esc)
  - `R5C0`: Top-Center (Default: Cmd)
  - `R5C1`: Mid-Left (Default: Alt)
  - `R5C4`: Bottom-Left (Default: Tab)
  - `R5C3`: Mid 2U Tall (Default: Space)
  - `R5C2`: Right 2U Tall (Default: Enter)
- In the UI, the thumb cluster is ergonomically positioned **to the left** of the finger cluster for the right hand, aligning with the bottom rows where the thumb naturally rests.

---

## Action Codes & Key Mappings

Keys in the matrix use uint16 action codes:

| Code Range | Type | Behavior / Examples |
|---|---|---|
| `0x00` | None / Transparent | Transparent fallback to Layer 0 |
| `0x20` .. `0x7E` | ASCII Characters | Printable keys (`'a'`, `'1'`, `'-'`, `' '`) |
| `0x80` .. `0x87` | Modifiers | `KEY_LEFT_CTRL` (0x80), `KEY_LEFT_SHIFT` (0x81), `KEY_LEFT_ALT` (0x82), `KEY_LEFT_GUI` (0x83), etc. |
| `0xB0` .. `0xEB` | Navigation / System | `KEY_RETURN` (0xB0), `KEY_ESC` (0xB1), `KEY_BACKSPACE` (0xB2), `KEY_TAB` (0xB3), `KEY_DELETE` (0xD4), Arrows (0xD7..0xDA), CapsLock (0xC1), Insert (0xD1), PrtSc (0xCE), Numpad (0xDC..0xEB) |
| `0xC2` .. `0xCD` | Function Keys F1..F12 | `KEY_F1` (0xC2) to `KEY_F12` (0xCD) |
| `0xF0` .. `0xFB` | Function Keys F13..F24 | `KEY_F13` (0xF0) to `KEY_F24` (0xFB) |
| `0x100` .. `0x107` | Momentary Layer (`MO_0`..`MO_7`) | Activates target layer while held; `MO_0` forces drop back to Base Layer 0 |
| `0x110` .. `0x117` | Toggle Layer (`TG_0`..`TG_7`) | Toggles layer on/off; `TG_0` clears all toggled layers and resets to Base Layer 0 |
| `0x120` .. `0x126` | Media Keys | Play/Pause (0x120), Mute (0x121), Vol+ (0x122), Vol- (0x123), Next (0x124), Prev (0x125), Stop (0x126) |
| `0x127` | Apple Mac Globe / Fn Key | Emits HID Consumer Usage `0x029D` (*AC Next Keyboard Layout Select* / Globe 🌐) |

---

## Development & Build Commands

### 1. Compile Firmware
```bash
arduino-cli compile --fqbn esp32:esp32:lolin32-lite firmware/dactyl_right/dactyl_right.ino
```

### 2. Upload Firmware (USB)
```bash
arduino-cli upload -p /dev/cu.usbserial-21320 --fqbn esp32:esp32:lolin32-lite --upload-property upload.speed=115200 firmware/dactyl_right/dactyl_right.ino
```

### 3. Syntax Verification
```bash
python3 -m py_compile server.py
node -c app.js
```

### 4. Run Local Server
```bash
python3 server.py
# Server listens on http://localhost:8088
```

---

## Architecture Rules & Safety Constraints

1. **Bluetooth Advertising Packet Limits:**
   - Legacy BLE advertising packets and scan response packets are strictly limited to **31 bytes**.
   - The 128-bit `CONFIG_SERVICE_UUID` consumes 18 bytes (16 bytes payload + 2 bytes header).
   - Never add long device names to `scanResponseData`; keep device naming in `BLEDevice::init` to prevent `esp_ble_gap_config_scan_rsp_data_raw` errors (`ESP_ERR_INVALID_ARG`).

2. **Web Bluetooth on macOS:**
   - CoreBluetooth on macOS will **not** discover peripherals that are already paired/connected to macOS as an HID keyboard when scanning solely by name.
   - Always include `{ services: [CONFIG_SERVICE_UUID] }` in `navigator.bluetooth.requestDevice` filters so Chromium invokes `retrieveConnectedPeripheralsWithServices`.

3. **NVS Synchronization upon Flashing:**
   - The firmware stores keymaps in NVS to enable sub-0.1s live remapping.
   - To prevent stale NVS keymaps from overwriting newly flashed C++ defaults, `loadKeymapFromNVS()` checks `__DATE__ " " __TIME__` (`fw_build`). If a newly flashed binary is detected, it automatically syncs the new firmware defaults into NVS.

4. **Live Monitor Layer Filtering:**
   - Visual keypress indicators in the configurator must compare `pressedLayer` with `activeLayerIndex`. Keys pressed on a different layer must not highlight keycaps on the currently viewed layer.
