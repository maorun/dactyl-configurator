# AGENTS.md — Developer & Contributor Guide for Dactyl Configurator

## Project Overview

This repository versions the firmware, web-based configurator, macOS desktop app, wiring documentation, and operational tooling for the **Dactyl True-Wireless Split Ergonomic Mechanical Keyboard** (specifically the right-hand master unit).

### Components

1. **Firmware (`firmware/dactyl_right/dactyl_right.ino`):**
   - Target Board: WEMOS LOLIN32 Lite (`esp32:esp32:lolin32-lite`, `ESP32-D0WDQ6-V3`).
   - Core Features: BLE HID Keyboard (`ESP32-BLE-Keyboard`), custom BLE GATT Configuration Service (`4fafc201-1fb5-459e-8fcc-c5c9c331914b`), persistent Non-Volatile Storage (NVS) via ESP32 `Preferences`, two-stage power management (Standby + Deep Sleep), and real-time USB Serial monitor/command interface (`115200` baud).
   - Matrix scanning: 6 Rows (`ROW_PINS = {13, 14, 27, 26, 33, 32}`) x 7 Columns (`COL_PINS = {23, 19, 18, 17, 16, 4, 25}`). Hand-wired matrix using 1N4148 diodes (Cathode/black ring to Row wire, Anode to switch pin 1, Columns soldered directly to switch pin 2 on active-low `INPUT_PULLUP`).

2. **Web Configurator (`index.html`, `style.css`, `app.js`):**
   - Vanilla JavaScript SPA with zero external runtime dependencies.
   - Real-time communication via Web Bluetooth API (`navigator.bluetooth`, including modern `getDevices()` + `watchAdvertisements()` auto-sync) and Web Serial API (`navigator.serial`).
   - Dynamic 8-layer editor (Layer 0 Base to Layer 7 Custom), layer renaming, staged offline configuration (`markPendingSync`), One-Shot Auto-Sync on hardware combo (`R4C5 + R0C0`), Config Mode status indicator (`#configModeStatusPill`), and visual keypress feedback filtered by the active hardware layer.

3. **Desktop Application (`Dactyl Configurator.app`):**
   - Native macOS app launcher in the project directory (`Dactyl Configurator.app/Contents/MacOS/Dactyl Configurator`) and `~/Applications/`.
   - Automatically checks and starts the local Python backend server (`server.py`) upon launch and opens Chrome in `--app=http://localhost:8088` mode with `--enable-features=WebBluetoothNewPermissionsBackend` and `--enable-experimental-web-platform-features` so `navigator.bluetooth.getDevices()` and `device.watchAdvertisements()` work out-of-the-box.

4. **Local REST Server (`server.py`):**
   - Python HTTP server bound strictly to `127.0.0.1:8088` with Host/Origin CSRF validation.
   - Ensures Homebrew paths (`/opt/homebrew/bin`, `/usr/local/bin`) are in `PATH` even when launched from macOS Finder/Dock.
   - Serves configurator web assets with no-cache headers.
   - Provides `/api/save_and_flash` to compile C++ defaults into `dactyl_right.ino` and flash the board via `arduino-cli` at `upload.speed=115200`.
   - Provides `/api/config` to read and write `current_config.json`.

5. **Wiring Diagrams (`docs/lolin32_lite_wiring.svg`, `docs/lolin32_lite_wiring.png`):**
   - Physical Left-Side (Pins 1–13) and Right-Side (Pins 1–13) board pinout and wire color assignment for the WEMOS LOLIN32 Lite.

---

## Physical Pinout & Wire Colors (WEMOS LOLIN32 Lite)

### Left Header Row (Top to Bottom, Pins 1 to 13)
- **Pin 1 (`GND`)**: Ground — ⚫ **Schwarz**.
- **Pin 2 (`3V3`)**: 3.3V Logic Power — 🔴 **Rot**.
- **Pin 3 (`IO0`)** / **Pin 4 (`IO2`)**: Unused (boot-strapping pins).
- **Pin 5 (`IO4` / `GPIO 4`)**: **Col 5** (Spalte 5 ganz rechts — `ß`, `Ü`, `Ä`, `Shift`, `Alt` / `R4C5`) — 🟣 **Lila**.
- **Pin 6 (`IO5`)** / **Pin 7 (`IO12`)**: Unused.
- **Pin 8 (`IO13` / `GPIO 13`)**: **Row 0** (Zahlenreihe ganz oben — `6`, `7`, `8`, `9`, `0`, `ß` / `R0C0`) — 🟡 **Gelb**.
- **Pin 9 (`IO14` / `GPIO 14`)**: **Row 1** (Obere Buchstabenreihe — `Z`, `U`, `I`, `O`, `P`, `Ü`) — 🟠 **Orange**.
- **Pin 10 (`IO15`)**: Unused.
- **Pin 11 (`IO16` / `GPIO 16`)**: **Col 4** (5. Spalte von links — `0`, `P`, `Ö`, `-`, `→`, Thumb `R5C4`) — 🔵 **Blau**.
- **Pin 12 (`IO17` / `GPIO 17`)**: **Col 3** (4. Spalte von links — `9`, `O`, `L`, `.`, `↑`, Thumb `R5C3` 2U) — 🟤 **Braun**.
- **Pin 13 (`IO18` / `GPIO 18`)**: **Col 2** (3. Spalte von links — `8`, `I`, `K`, `,`, `↓`, Thumb `R5C2` 2U) — 🟢 **Grün**.

### Right Header Row (Top to Bottom, Pins 1 to 13)
- **Pin 1 (`IO19` / `GPIO 19`)**: **Col 1** (2. Spalte von links — `7`, `U`, `J`, `M`, `←`, Thumb `R5C1`) — 🟠 **Orange**.
- **Pin 2 (`IO22` / `GPIO 22`)**: Internal onboard blue status LED (unused by matrix).
- **Pin 3 (`IO23` / `GPIO 23`)**: **Col 0** (Spalte ganz links innen — `6`, `Z`, `H`, `N`, Thumb `R5C0`) — 🟡 **Gelb**.
- **Pin 4 (`IO25` / `GPIO 25`)**: **Col 6** (Daumen-Spalte oben links für `R5C6` / `Esc`) — 🔴 **Rot**.
- **Pin 5 (`IO26` / `GPIO 26`)**: **Row 3** (Untere Buchstabenreihe — `N`, `M`, `,`, `.`, `-`, `Shift`) — 🟤 **Braun**.
- **Pin 6 (`IO27` / `GPIO 27`)**: **Row 2** (Home Row Grundreihe — `H`, `J`, `K`, `L`, `Ö`, `Ä`) — 🟢 **Grün**.
- **Pin 7 (`IO32` / `GPIO 32`)**: **Row 5** (Daumen-Cluster — gemeinsame Zeile aller 6 Daumentasten) — 🟣 **Lila**.
- **Pin 8 (`IO33` / `GPIO 33`)**: **Row 4** (Unterste Finger-Reihe — `←`, `↓`, `↑`, `→`, `R4C5`) — 🔵 **Blau**.
- **Pin 9 (`EN`)**: Chip Enable / Reset.
- **Pin 10 (`IO34` / `GPI34`)**: Unused (input-only).
- **Pin 11 (`IO35` / `GPI35`)**: **BAT_SENSE** (12-bit ADC LiPo voltage measurement directly on LiPo `+`) — ⚪ **Grau / Weiß**.
- **Pin 12 (`IO36` / `VP`)** / **Pin 13 (`IO39` / `VN`)**: Unused (input-only).

---

## Hardware Matrix & Key Layout (Right Hand)

### Finger Matrix
- 5 Rows (Rows 0 to 4) x 6 Columns (Cols 0 to 5).
- Row 4 Column 0 (`R4C0`) does physically not exist (rendered as an invisible spacer in the UI).

### Thumb Cluster (6 Physical Keys)
- Dedicated 6-key custom Dactyl Manuform thumb cluster, physically all wired to **Row 5 (`GPIO 32`, Purple Wire)**:
  - `R5C6`: Top-Left (Col 6 = `GPIO 25` Red Wire, Default: `Esc`)
  - `R5C0`: Top-Center above `R5C3` (Col 0 = `GPIO 23`, Default: `Cmd`)
  - `R5C1`: Mid-Left below `R5C6` (Col 1 = `GPIO 19`, Default: `Alt`)
  - `R5C4`: Bottom-Left below `R5C1` (Col 4 = `GPIO 16`, Default: `Tab`)
  - `R5C3`: Mid 2U Tall (Col 3 = `GPIO 17`, Default: `Space`)
  - `R5C2`: Right 2U Tall (Col 2 = `GPIO 18`, Default: `Enter`)
- Note: `R5C5` does not physically exist on the 6-key thumb cluster and must not be rendered in `thumbDefs`.
- In the UI, the thumb cluster is ergonomically positioned **to the left** of the finger cluster for the right hand.

---

## Action Codes & Key Mappings

Keys in the matrix use `uint16_t` action codes:

| Code Range | Type | Behavior / Examples |
|---|---|---|
| `0x00` | None / Transparent | Transparent fallback to Layer 0 |
| `0x20` .. `0x7E` | ASCII Characters | Printable keys (`'a'`, `'1'`, `'-'`, `' '`) |
| `0x80` .. `0x87` | Modifiers | `KEY_LEFT_CTRL` (0x80), `KEY_LEFT_SHIFT` (0x81), `KEY_LEFT_ALT` (0x82), `KEY_LEFT_GUI` (0x83), etc. |
| `0xB0` .. `0xEB` | Navigation / System | `KEY_RETURN` (0xB0), `KEY_ESC` (0xB1), `KEY_BACKSPACE` (0xB2), `KEY_TAB` (0xB3), `KEY_DELETE` (0xD4), Arrows (0xD7..0xDA), CapsLock (0xC1), Insert (0xD1), PrtSc (0xCE), Numpad (0xDC..0xEB) |
| `0xC2` .. `0xCD` | Function Keys F1..F12 | `KEY_F1` (0xC2) to `KEY_F12` (0xCD) |
| `0xF0` .. `0xFB` | Function Keys F13..F24 | `KEY_F13` (0xF0) to `KEY_F24` (0xFB) |
| `0x100` .. `0x107` | Momentary Layer (`MO_0`..`MO_7`) | Activates target layer while held; `MO_0` forces temporary return to Base Layer 0 |
| `0x110` .. `0x117` | Toggle Layer (`TG_0`..`TG_7`) | Toggles layer on/off; `TG_0` clears all toggled layers and resets to Base Layer 0 |
| `0x118` | Layer +1 Up (`LAYER_UP`) | `ACT_LAYER_UP` (`0x118`) steps +1 to next layer (wrapping `7 -> 0`) |
| `0x119` | Layer -1 Down (`LAYER_DOWN`) | `ACT_LAYER_DOWN` (`0x119`) steps -1 to previous layer (wrapping `0 -> 7`) |
| `0x120` .. `0x126` | Media Keys | Play/Pause (0x120), Mute (0x121), Vol+ (0x122), Vol- (0x123), Next (0x124), Prev (0x125), Stop (0x126) |
| `0x127` | Apple Mac Globe / Fn Key | Emits HID Consumer Usage `0x029D` (*AC Next Keyboard Layout Select* / Globe 🌐) |

---

## Wireless Bluetooth Config Mode & Staged One-Shot Auto-Sync

### 1. Why macOS Previously Reconnected During Config Mode
- On macOS, `bluetoothd` bonds to the keyboard's Public BLE MAC (`2E:BC:BB:81:61:A8`) and locks the HID service (`0x1812`), blocking Web-Bluetooth GATT connections.
- Even if the ESP32 drops `0x1812` from its advertising packet, macOS `bluetoothd` immediately auto-reconnects at the L2CAP/GATT level whenever connectable advertisements appear from the **same bonded Public MAC address**.
- Additionally, `pServer->disconnect(id)` in ESP32 Bluedroid is asynchronous (`ESP_GATTS_DISCONNECT_EVT` fires ~20–50 ms later on the BTC task). Calling `pAdv->start()` before the disconnect event finishes causes `onDisconnect` to race with advertising reconfiguration.

### 2. Static Random BLE Address in `enterConfigMode()`
- Triggered by holding hardware matrix switches **`R4C5 + R0C0` for 500 ms** (100% layer-independent) or via serial command `ENTER_CONFIG`.
- `enterConfigMode()` sets `isBleTransitioning = true`, stops advertising first (`pAdv->stop()`), disconnects all peers, and waits up to 350 ms until `pServer->getConnectedCount() == 0`.
- It then calls `pAdv->reset()` and configures a deterministic **Static Random BLE Address** (`configRandAddr[0] |= 0xC0; configRandAddr[5] ^= 0x55;` via `pAdv->setDeviceAddress(configRandAddr, BLE_ADDR_TYPE_RANDOM)`), separated by 25 ms GAP synchronization delays before `pAdv->start()`.
- In `exitConfigMode()`, Bluedroid's `pAdv->reset()` cannot clear GAP `own_addr_type` from `BLE_ADDR_TYPE_RANDOM` back to `BLE_ADDR_TYPE_PUBLIC` without restarting the controller stack. Therefore, `exitConfigMode()` cleanly disconnects peers and invokes `ESP.restart()` (~200ms reboot), restoring hardware state and the bonded Public MAC (`2E:BC:BB:81:61:A8`), allowing macOS to reconnect immediately.

### 3. Staged One-Shot Auto-Sync (`getDevices()` + `watchAdvertisements()`)
- Users can edit keys, presets, layer names, and sleep timeouts in the app **while typing normally on macOS** (`markPendingSync` stages changes locally without blocking alerts).
- Once `"Dactyl Config"` has been paired once in the app via `navigator.bluetooth.requestDevice`, `initModernBleAutoSync()` monitors it in the background using `navigator.bluetooth.getDevices()` and `device.watchAdvertisements()`.
- When the user presses **`R4C5 + R0C0` (0.5 s)** on the keyboard:
  1. The ESP32 enters Config Mode and advertises `"Dactyl Config"` on its Static Random MAC.
  2. The app receives `advertisementreceived` and connects automatically (`connectToBleDevice(dev, true)`).
  3. With **One-Shot Auto-Sync** enabled (`#chkAutoSyncOnCombo`, checked by default), the app immediately runs `writeConfigToESP32({ autoDisconnectAfter: true })`, sending all keys via fast RAM updates (`SET_K <l> <r> <c> <val>`) followed by a single `SAVE_NVS` flash commit, and then sends `EXIT_CONFIG` and disconnects.
  4. The ESP32 immediately returns to normal Mac keyboard mode.

---

## Development & Build Commands

### 1. Compile Firmware
```bash
/opt/homebrew/bin/arduino-cli compile --fqbn esp32:esp32:lolin32-lite firmware/dactyl_right/dactyl_right.ino
```

### 2. Upload Firmware (USB)
> **Important:** The CH340 USB-serial bridge on the WEMOS LOLIN32 Lite can fail stub verification at the default `921600` baud on macOS. Always specify `UploadSpeed=115200` (or `--upload-property upload.speed=115200`).
```bash
/opt/homebrew/bin/arduino-cli upload -p /dev/cu.usbserial-21320 --fqbn esp32:esp32:lolin32-lite:UploadSpeed=115200 firmware/dactyl_right/dactyl_right.ino
```

### 3. Syntax & XML Verification
```bash
python3 -m py_compile server.py
node --check app.js
xmllint --noout docs/lolin32_lite_wiring.svg
```

### 4. Run Local Server
```bash
python3 server.py
# Server listens on http://127.0.0.1:8088
```

---

## Architecture Rules & Safety Constraints

1. **Bluetooth Advertising Packet Limits:**
   - Legacy BLE 4.2 advertising packets and scan response packets are strictly limited to **31 bytes**.
   - The 128-bit `CONFIG_SERVICE_UUID` consumes 18 bytes (16 bytes payload + 2 bytes header).
   - Never combine a 128-bit UUID and a full device name in the same 31-byte PDU; in Config Mode, place Flags + Name (`"Dactyl Config"`, 18 B total) in `advData` and `CONFIG_SERVICE_UUID` (18 B) in `scanData`.

2. **Batch NVS Writes (`SET_K` + `SAVE_NVS`):**
   - Full configuration syncs must use `SET_K <l> <r> <c> <val>` (RAM-only update) followed by a single `SAVE_NVS` command at the end, avoiding 336 individual NVS flash writes and reducing sync time to ~1.5 seconds. Single interactive key edits in live mode continue to use `SET_KEY`.

3. **NVS Synchronization upon Flashing:**
   - `loadKeymapFromNVS()` compares `fw_build` (`__DATE__ " " __TIME__`). When a newly compiled firmware binary is flashed via USB, it automatically writes the new C++ `KEYMAP` defaults to NVS.

4. **Live Monitor Layer Filtering:**
   - Visual keypress indicators in the configurator must compare `pressedLayer` with `activeLayerIndex`. Keys pressed on a different layer must not highlight keycaps on the currently viewed layer.
