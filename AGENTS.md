# AGENTS.md — Developer & Contributor Guide for Dactyl Configurator

## Project Overview

This repository versions the firmware, web-based configurator, macOS desktop app, wiring documentation, and operational tooling for the **Dactyl True-Wireless Split Ergonomic Mechanical Keyboard** (specifically the right-hand master unit).

### Components

1. **Firmware (`firmware/dactyl_right/dactyl_right.ino`):**
   - Target Board: WEMOS LOLIN32 Lite (`esp32:esp32:lolin32-lite`, `ESP32-D0WDQ6-V3`).
   - Core Features: Composite BLE HID Keyboard (own implementation in `DactylBleComposite.h` and `DactylKeycodes.h`; no external `ESP32-BLE-Keyboard` library, which does not build against ESP32 Arduino Core 3.x), custom BLE GATT Configuration Service (`4fafc201-1fb5-459e-8fcc-c5c9c331914b`), persistent Non-Volatile Storage (NVS) via ESP32 `Preferences`, two-stage power management (Standby + Deep Sleep), and real-time USB Serial monitor/command interface (`115200` baud).
   - Split receiver: executes the `SplitHidEvent`s of the left half (ESP-NOW, `DactylSplitHid.h`) on its BLE HID connection; see "Left Half Firmware".
   - Matrix scanning: 6 Rows (`ROW_PINS = {13, 14, 27, 26, 33, 32}`) x 7 Columns (`COL_PINS = {23, 19, 18, 17, 16, 4, 25}`). Hand-wired matrix using 1N4148 diodes (Cathode/black ring to Row wire, Anode to switch pin 1, Columns soldered directly to switch pin 2 on active-low `INPUT_PULLUP`).

2. **Web Configurator (`index.html`, `style.css`, `app.js`, `js/`):**
   - Vanilla JavaScript SPA with zero external runtime dependencies.
   - Classic scripts that share one global scope, loaded in the order of `index.html`; `app.js` loads last and starts the app on `DOMContentLoaded`. A new module needs a `<script>` tag in `index.html` and an entry in `APP_MODULES` (`server.py`).
   - Modules: `js/keycodes.js` (keycodes, action codes, key pair and special character helpers), `js/config-model.js` (limits, validation, normalization, matrix test and typing statistics; no DOM), `js/editor.js` (layer tools, keycode selects and search, matrix, inspector, combo table), `js/key-pairs-ui.js`, `js/macros-ui.js` (macro list and step editor), `js/layout-profiles-ui.js` (dialog "Profile": save, load and delete named layouts of the edited half, and load an automatic backup; loading is a snapshot pending change with the flags `pairs` and `macros`, like an import), `js/flash-log.js` (NDJSON reader and live dialog of the flash output), `js/editor-events.js` (event listeners, combo deletion, flash), `js/ble.js`, `js/serial.js` (incl. `handleSerialLine`), `js/live-monitor.js`, `js/heatmap.js`, `js/matrix-test.js`, `js/keyboard-hooks.js`, `js/config-sync.js` (`writeConfigToESP32`, `readConfigFromESP32`). `app.js` keeps the global state, the initialization, the config mode indicator, pending changes and the server save.
   - Real-time communication via Web Bluetooth API (`navigator.bluetooth`, including modern `getDevices()` + `watchAdvertisements()` auto-sync) and Web Serial API (`navigator.serial`).
   - Dynamic 8-layer editor (Layer 0 Base to Layer 7 Custom), layer renaming, staged offline configuration (`markPendingSync`), One-Shot Auto-Sync on hardware combo (`R4C5 + R0C0`), Config Mode status indicator (`#configModeStatusPill`), and visual keypress feedback filtered by the active hardware layer.

3. **Desktop Application (`Dactyl Configurator.app`):**
   - Native macOS app launcher in the project directory (`Dactyl Configurator.app/Contents/MacOS/Dactyl Configurator`) and `~/Applications/`. The installed Electron bundle contains `server.py`, the web UI and the firmware sources; see "3a. Rebuild the Desktop App".
   - Automatically checks and starts the local Python backend server (`server.py`) upon launch and opens Chrome in `--app=http://localhost:8088` mode with `--enable-features=WebBluetoothNewPermissionsBackend` and `--enable-experimental-web-platform-features` so `navigator.bluetooth.getDevices()` and `device.watchAdvertisements()` work out-of-the-box.

4. **Local REST Server (`server.py`):**
   - Python HTTP server bound strictly to `127.0.0.1:8088`. Every request requires an exact `Host` header (`localhost:8088` / `127.0.0.1:8088`, DNS-rebinding protection); POST requests with a foreign `Origin` are rejected. Static serving is limited to an allowlist (`index.html`, `app.js`, `style.css`, the `js/side-*.js` files, including `js/side-right.js` and `js/side-left.js`, and the app modules in `APP_MODULES`).
   - Configs are validated (each layer at most 6 rows x 7 keys, key cells object or code string, combo coordinates, firmware setting ranges; JSON `null` bodies return HTTP 400) and the `.ino` is rendered in memory before `current_config.json` and `dactyl_right.ino` are written atomically.
   - Ensures Homebrew paths (`/opt/homebrew/bin`, `/usr/local/bin`) are in `PATH` even when launched from macOS Finder/Dock.
   - Serves configurator web assets with no-cache headers.
   - Provides `/api/save_and_flash?side=L|R` to compile C++ defaults into the `.ino` of that half (`dactyl_right.ino` / `dactyl_left.ino`) and flash it via `arduino-cli` (`FIRMWARE_FQBN` with `PartitionScheme=min_spiffs`) at `upload.speed=115200`. The upload port is the `usbserial` port whose board answers `GET_INFO` with the matching `DEVICE_INFO.side`; without a match nothing is compiled or flashed.
   - `/api/save_and_flash` streams NDJSON with `&stream=1`. Details: `FEATURES.md`, section "Flash log stream".
   - Provides `/api/config?side=L|R` to read and write the config of a half: `current_config.json` / `current_config_left.json` (fallback `default_config.json` / `default_config_left.json`). Without `side` the right half applies; another value returns HTTP 400. On the left half, the missing keys `R4C5` / `R5C0` must not carry an action, and combos must not use them.
   - `/api/backups?side=L|R` keeps automatic backups of a half. Details: `FEATURES.md`, section "Automatic backups".
   - `/api/profiles?side=L|R` keeps named layout profiles of a half. Details: `FEATURES.md`, section "Layout profiles".

5. **Wiring Diagrams (`docs/lolin32_lite_wiring.svg`, `docs/lolin32_lite_wiring.png`):**
   - The PNG is a manual render of the SVG (1600 x 1020, for example with headless Chrome `--screenshot`, window size 1600,1020). No test compares them, because file times are unreliable in a checkout. After each SVG change, render the PNG again.
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

## Left Half Firmware (`firmware/dactyl_left/`)

### Architecture
- The left half is a standalone keyboard brain: own 8-layer keymap (tap/hold/double-tap), combos, key pairs, NVS and config mode. It runs the **same** `firmware/dactyl_right/DactylLogic.h` (included via `../dactyl_right/`; `arduino-cli` resolves relative includes). Never copy logic into `dactyl_left.ino`.
- Layer activation spans both halves (`SPLIT_OP_LAYER_STATE`, see "Layer sync"). Combos do not span both halves.
- The left half has no HID service. `DactylSplitKeyboard` (`firmware/dactyl_left/DactylSplitKeyboard.h`) is its `bleKeyboard`: it offers the methods `DactylLogic.h` calls and queues each call as a `SplitHidEvent` to the master. The master executes it on its BLE HID connection. macOS sees one keyboard.
- `isConnected()` on the left is true only if a send callback succeeded within `SPLIT_LINK_DOWN_MS` (2 s). The left half sends `SPLIT_OP_HEARTBEAT` every second, so the link state stays current without key presses. Like a disconnected Mac, a missing master makes `DactylLogic.h` send nothing, also no releases. The master releases left inputs only after `SPLIT_LINK_TIMEOUT_MS` (3 s); when the link returns inside that gap, `DactylSplitKeyboard::onSendResult` queues `RELEASE_ALL` so no released key stays held.
- Shared headers in `firmware/dactyl_right/`: `DactylCommon.h` (action codes, `KeyCombo`, `KeyPair`), `DactylConfigBleCallbacks.h` + `DactylConfigBle.h` (isolated config-mode BLE server, name from `CONFIG_BLE_NAME`), `DactylSplitHid.h` (protocol). `DactylLogic.h` takes `CONFIG_COMBO_R1/C1/R2/C2`, `DEFAULT_DEVICE_NAME` and `CONFIG_BLE_NAME` as overridable macros; the right half uses the defaults.

### Split HID protocol (`DactylSplitHid.h`)
- `SplitHidEvent { uint8_t op; int8_t arg; uint16_t code; }`, 4 bytes, packed, little endian. ESP-NOW channel 1, encrypted (CCMP, see "ESP-NOW encryption"), left `2E:BC:BB:81:61:B0` -> master `2E:BC:BB:81:61:A6`.
- Ops: `HEARTBEAT`, `KEY_PRESS/RELEASE/WRITE` (code 1..255), `RELEASE_ALL`, `MEDIA_PRESS/RELEASE/WRITE` (16-bit media mask, `MediaKeyReport` low = `[0]`), `MOUSE_PRESS/RELEASE/CLICK` (mask 1..7), `MOUSE_SCROLL` (`arg` != 0), `ACTIVITY` (master -> left only, see "Config mode, NVS, power"), `KEY_EVENT` (diagnostics), `ONE_SHOT_PRESS/RELEASE` (mask 1..255), `CAPS_WORD_TOGGLE` (see "One-Shot Modifiers and Caps Word"), `LAYER_STATE` (both directions, see "Layer sync"), `FW_VERSION` (left -> master, see "Firmware version"), `TAP_PENDING` (left -> master) and `TAP_FLUSH` (master -> left only, see "Double-tap across both halves"). Append new ops only; never renumber.
- `parseSplitHidPacket()` checks sender MAC, length and the value range of each op; it rejects `ACTIVITY` and `TAP_FLUSH` (master -> left only). The master runs it in the Wi-Fi task callback and only queues valid events (64-entry SPSC ring, `SplitRxQueue`); `loop()` executes them.
- Details: `FEATURES.md`, section "Split HID protocol". Read it only before you change this feature.
- Keep the arbitration rule: an input is released in the HID report only when neither half holds it (`SplitArbitratedKeyboard`).
- `MOUSE_SCROLL` is never retried. `KEY_EVENT` and `SPLIT_KEY` go only over USB serial, never over BLE (keylogger protection).

### Layer sync (`SPLIT_OP_LAYER_STATE`)
- Details: `FEATURES.md`, section "Layer sync". Read it only before you change this feature.
- Both halves need a firmware with `LAYER_STATE`. Flash both halves.

### Double-tap across both halves (`SPLIT_OP_TAP_PENDING`, `SPLIT_OP_TAP_FLUSH`)
- Details: `FEATURES.md`, section "Double-tap across both halves". Read it only before you change this feature.

### Send queue (`DactylLeftLogic.h`)
- Details: `FEATURES.md`, section "Send queue". Read it only before you change this feature.

### Config mode, NVS, power
- Details: `FEATURES.md`, section "Config mode, NVS, power". Read it only before you change this feature.
- The left half keeps 240 MHz in standby. A `setCpuFrequencyMhz()` change while Wi-Fi runs made every ESP-NOW send fail (hardware finding). Do not add such a change on the left half.

### Firmware version (`DactylVersion.h`)
- Details: `FEATURES.md`, section "Firmware version". Read it only before you change this feature.
- Increase `DACTYL_FW_VERSION` (`firmware/dactyl_right/DactylVersion.h`) with each change to the split protocol, the config commands or the NVS format.

### Split link status (`SPLIT_LINK`, `left_link`)
- Details: `FEATURES.md`, section "Split link status". Read it only before you change this feature.

### Wiring (diodes on columns, columns on RTC pins)
- **Diodes are on the columns** (cathode/black ring to the column wire). The scan drives one column `LOW` and reads the rows with `INPUT_PULLUP`. All columns must be RTC GPIOs for the Ext1 wakeup (`test_columns_are_rtc_wakeup_capable`).
- `esp_base_mac_addr_set(LEFT_BASE_MAC)` runs before Wi-Fi/BLE start. Without it, the board uses its eFuse MAC.

| Wire | Left function | GPIO | Board pin |
|---|---|---|---|
| 🟡 Yellow (row) | Row 0 (top) | 23 | Right 3 |
| 🟠 Orange (row) | Row 1 | 19 | Right 1 |
| 🟢 Green (row) | Row 2 | 18 | Left 13 |
| 🟤 Brown (row) | Row 3 | 17 | Left 12 |
| 🔵 Blue (row) | Row 4 | 16 | Left 11 |
| 🟣 Purple (row) | Row 5 (thumbs) | 4 | Left 5 |
| 🟣 Purple (col) | Col 0 (outer left) | 13 | Left 8 |
| 🟤 Brown (col) | Col 1, thumb bottom right | 14 | Left 9 |
| 🟢 Green (col) | Col 2, thumb bottom center | 27 | Right 6 |
| 🟠 Orange (col) | Col 3, thumb far left | 26 | Right 5 |
| 🟡 Yellow (col) | Col 4, thumb center right | 33 | Right 8 |
| 🔴 Red (col) | Col 5 (inner right), thumb top center | 32 | Right 7 |
| 🔵 Blue (col) | Col 6 (thumb only), thumb top right | 25 | Right 4 |
| ⚪ Gray | BAT_SENSE (not used yet) | 35 | Right 11 |

### ESP-NOW encryption (`DactylSplitCrypto.h`)
- Details: `FEATURES.md`, section "ESP-NOW encryption". Read it only before you change this feature.
- `firmware/dactyl_right/DactylSplitKey.h` is local state (in `.gitignore`, mode 0600). Create it with `bash scripts/generate-split-key.sh`. Both halves need the same key.
- Without the key file the build stops with `#error`. After a lost half or a leaked key, generate a new key and flash both halves.

### Build & flash (both halves use `min_spiffs`)
- BLE + ESP-NOW do not fit into the default 1.25 MB app partition (`text section exceeds available space`). Both halves use `PartitionScheme=min_spiffs` (1.875 MB app, NVS offset `0x9000` unchanged, so keymaps and the macOS bond survive the switch). `server.py` (`FIRMWARE_FQBN`) and CI use the same FQBN.
- Identify each board by its boot log before flashing; the USB port names change between plug-ins.
- Generate the ESP-NOW key once before the first compile: `bash scripts/generate-split-key.sh` (see "ESP-NOW encryption").

```bash
/opt/homebrew/bin/arduino-cli compile --fqbn esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs firmware/dactyl_left
/opt/homebrew/bin/arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs,UploadSpeed=115200 firmware/dactyl_left
```

### App support for both halves (`js/side-profiles.js`, `js/side-right.js`, `js/side-left.js`, `js/side-state.js`)
- Details: `FEATURES.md`, section "App support for both halves". Read it only before you change this feature.
- Do not add side-specific logic or `"R"`/`"L"` literals to `app.js` or the other app modules. Read the value from the profile, or add a profile field.

---

## Action Codes & Key Mappings

Keys in the matrix use `uint16_t` action codes:

| Code Range | Type | Behavior / Examples |
|---|---|---|
| `0x00` | None / Transparent | Transparent fallback to Layer 0 |
| `0x20` .. `0x7E` | ASCII Characters | Printable keys (`'a'`, `'1'`, `'-'`, `' '`) |
| `0x80` .. `0x87` | Modifiers | `KEY_LEFT_CTRL` (0x80), `KEY_LEFT_SHIFT` (0x81), `KEY_LEFT_ALT` (0x82), `KEY_LEFT_GUI` (0x83), etc. |
| `0xB0` .. `0xEB` | Navigation / System | `KEY_RETURN` (0xB0), `KEY_ESC` (0xB1), `KEY_BACKSPACE` (0xB2), `KEY_TAB` (0xB3), `KEY_DELETE` (0xD4), Arrows (0xD7..0xDA), CapsLock (0xC1), Insert (0xD1), PrtSc (0xCE), Numpad (0xDC..0xEB) |
| `0xEC` | ISO Key (`KEY_NON_US_BACKSLASH`) | HID usage `0x64` between left Shift and Z; `§` / `±` with the macOS layout "U.S." |
| `0xC2` .. `0xCD` | Function Keys F1..F12 | `KEY_F1` (0xC2) to `KEY_F12` (0xCD) |
| `0xF0` .. `0xFB` | Function Keys F13..F24 | `KEY_F13` (0xF0) to `KEY_F24` (0xFB) |
| `0x100` .. `0x107` | Momentary Layer (`MO_0`..`MO_7`) | Activates target layer while held; `MO_0` forces temporary return to Base Layer 0 |
| `0x110` .. `0x117` | Toggle Layer (`TG_0`..`TG_7`) | Toggles layer on/off; `TG_0` clears all toggled layers and resets to Base Layer 0 |
| `0x118` | Layer +1 Up (`LAYER_UP`) | `ACT_LAYER_UP` (`0x118`) steps +1 to next layer (wrapping `7 -> 0`) |
| `0x119` | Layer -1 Down (`LAYER_DOWN`) | `ACT_LAYER_DOWN` (`0x119`) steps -1 to previous layer (wrapping `0 -> 7`) |
| `0x120` .. `0x126` | Media Keys | Play/Pause (0x120), Mute (0x121), Vol+ (0x122), Vol- (0x123), Next (0x124), Prev (0x125), Stop (0x126) |
| `0x127` | Apple Mac Globe / Fn Key | Emits HID Consumer Usage `0x029D` (*AC Next Keyboard Layout Select* / Globe 🌐) |
| `0x130` .. `0x134` | Mouse Actions | Left Click (0x130), Right Click (0x131), Middle Click (0x132), Scroll Up (0x133), Scroll Down (0x134) via Composite BLE HID Report ID 3 |
| `0x140` .. `0x14F` | Key Pair (`PAIR_0`..`PAIR_15`) | Presses two keyboard codes at the same time (e.g. `Alt` + `*` = `°` with the macOS layout "U.S."); index into `userKeyPairs[]` |
| `0x150` .. `0x156` | Umlaut (`UMLAUT_AE`, `UMLAUT_OE`, `UMLAUT_UE`, `UMLAUT_AE_UPPER`, `UMLAUT_OE_UPPER`, `UMLAUT_UE_UPPER`, `UMLAUT_SZ`) | Dead key `Alt` + `u`, then the vowel; `ß` = `Alt` + `s` (macOS layout "U.S.") |
| `0x160` .. `0x167` | One-Shot Modifier (`OSM_LCTRL`, `OSM_LSHIFT`, `OSM_LALT`, `OSM_LGUI`, `OSM_RCTRL`, `OSM_RSHIFT`, `OSM_RALT`, `OSM_RGUI`) | Bit `i` = modifier `KEY_LEFT_CTRL + i`; see "One-Shot Modifiers and Caps Word" |
| `0x168` | Caps Word (`CAPS_WORD`) | Toggles Caps Word; see "One-Shot Modifiers and Caps Word" |
| `0x170` .. `0x17F` | Macro (`MACRO_0`..`MACRO_15`) | Plays a sequence of tap, down, up and pause steps; index into `userMacros[]`; see "Macros" |

### Key Pairs (`userKeyPairs`)
- Details: `FEATURES.md`, section "Key Pairs". Read it only before you change this feature.

### Macros (`userMacros`)
- Details: `FEATURES.md`, section "Macros". Read it only before you change this feature.
- Codes in `DactylCommon.h` (`ACT_MACRO_BASE`, `MACRO_STEP_*`), `server.py` (`MACRO_STEP_TYPES`) and `js/keycodes.js` must match; tests compare them.

### macOS layout "U.S." and special characters (`DE_MAC_CHARS`, umlauts)
- Details: `FEATURES.md`, section "macOS layout "U.S." and special characters". Read it only before you change this feature.
- The Mac uses the input source "U.S.". App labels, presets and templates must use US labels.

### One-Shot Modifiers and Caps Word (`DactylOneShot.h`)
- Details: `FEATURES.md`, section "One-Shot Modifiers and Caps Word". Read it only before you change this feature.

### Mod-Tap / Layer-Tap (`HOLDMAP`)
- Details: `FEATURES.md`, section "Mod-Tap / Layer-Tap". Read it only before you change this feature.

### Tap-Dance / Double-Tap (`DTAPMAP`)
- Details: `FEATURES.md`, section "Tap-Dance / Double-Tap". Read it only before you change this feature.

---

## Wireless Bluetooth Config Mode & Staged One-Shot Auto-Sync

- Config mode uses a static random BLE address, because macOS bonds to the public address. `exitConfigMode()` restarts the board.
- Every change goes through `markPendingSync`; the app then sends the full configuration (`requestLiveSync`, `js/config-sync.js`). Never send a single `SET_KEY`, `SET_NAME` or `SET_*` setting command for a live edit: the full sync keeps the device equal to the app.
- Details: `FEATURES.md`, section "Configuration and Sync". Read it only before you change this feature.

---

## Roadmap and Features (`ROADMAP.md`, `FEATURES.md`)

- `ROADMAP.md` lists only open work, in priority bands. Each entry has a `Rank` line with the model, the scores and the effort. Follow the rules at the top of `ROADMAP.md` and "Rules for ranking".
- Rate each new idea and insert it at its rank. Do not append it at the end. Mark an unrated entry with `Estimate`.
- The pull request that completes an entry removes it from `ROADMAP.md` and adds or updates the section in `FEATURES.md`.
- `FEATURES.md` holds the behavior and the details of the implemented features. Read only the section of the feature that you change. Do not load the whole file.
- When you implement or change a feature, update its section in `FEATURES.md`. Keep only short invariants and pointers in this file.

## Code Review Rule: LOW Findings

- Fix each finding from a code review in the current work, `LOW` included. Add a regression test for each fix, and check that the test fails without the fix.
- Verify each finding against the code before you change it. Reject a finding with a short technical reason if the code does not confirm it.
- Do not record open findings in `ROADMAP.md`. This rule also applies to a finding that the user defers and to a hardware check that needs the physical keyboard.
- Name each deferred finding and each open hardware check in the final report and in the pull request description. Write each one with file and line, the problem, the consequence and the recommended correction.
- A review cycle counts as clean when no `BLOCKER`, `HIGH` or `MEDIUM` finding remains. Fix the `LOW` findings of that last cycle too, but start no further cycle only for them. A `LOW` fix that changes code runs the relevant tests again.

## Development & Build Commands

### 0. Firmware Code Layout
- `firmware/dactyl_right/DactylLogic.h` contains all hardware-independent logic (layer resolution, tap-hold, combos, action dispatch, config command parser, NVS persistence). It is included by `dactyl_right.ino` **and** by `firmware/tests/test_firmware_logic.cpp`, so unit tests execute production code. Never copy logic into the test file.
- `dactyl_right.ino` keeps hardware setup, BLE stack transitions, matrix scanning, and power management.
- `firmware/dactyl_right/DactylHidDescriptor.h` holds the report IDs and the composite HID report descriptor. It has no BLE stack dependency, so the unit tests check it (`firmware/tests/HIDTypes.h` is the host-build replacement for the core header).
- `firmware/dactyl_right/DactylKeycodes.h` defines the keycodes, `KeyReport`, `MediaKeyReport` (incl. Mac Globe `{0, 4}`), and the ASCII-to-HID mapping. The firmware builds with only the ESP32 core libraries (`BLE`, `Preferences`); CI pins `esp32:esp32@3.3.12`.

### 1. Compile Firmware
```bash
/opt/homebrew/bin/arduino-cli compile --fqbn esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs firmware/dactyl_right/dactyl_right.ino
```

### 2. Upload Firmware (USB)
> **Important:** The CH340 USB-serial bridge on the WEMOS LOLIN32 Lite can fail stub verification at the default `921600` baud on macOS. Always specify `UploadSpeed=115200` (or `--upload-property upload.speed=115200`).
```bash
/opt/homebrew/bin/arduino-cli upload -p /dev/cu.usbserial-21320 --fqbn esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs,UploadSpeed=115200 firmware/dactyl_right/dactyl_right.ino
```

### 3. Tests, Syntax & XML Verification
```bash
python3 tests/test_server.py          # Codegen, validation, HTTP host/origin/static allowlist
node tests/test_app_logic.js          # web app action codes, sanitizing, config validation
node tests/test_side_profiles.js      # side profiles vs. firmware sources, per-half state, side routing and acks
bash firmware/tests/run_tests.sh      # DactylLogic.h, DactylLeftLogic.h, DactylSplitHid.h, left proxy
python3 -m py_compile server.py
node --check app.js && node --check main.js && for f in js/*.js; do node --check "$f"; done
xmllint --noout docs/lolin32_lite_wiring.svg
```

### 3a. Rebuild the Desktop App
```bash
npm run build:app   # copies main.js, server.py, web UI, default configs and firmware into ~/Applications/Dactyl Configurator.app and re-signs it ad hoc
npm run rebuild:app # quits the running app, runs build:app, starts the app again and verifies the new server.py
```
- `rebuild:app` (`scripts/rebuild-app.sh`) quits the app with `osascript` (so `before-quit` stops `server.py`), waits up to 20 s until the app has quit and port 8088 is free, runs `build-app.sh`, opens the app and waits up to 30 s for a new PID on port 8088 that answers HTTP 200. `main.js` reuses a server that already listens on 8088, so the script refuses to continue while a server without the app holds the port. It never kills a process; it fails if the app does not quit, the port stays busy or the build fails. Run it from the main checkout: the bundle gets the files of the calling checkout, so a call from a worktree installs that branch and prints a warning. A failed `osascript` (for example a denied Automation permission) stops the script with a message.
- The bundle (`Contents/Resources/app`) is self-contained: `main.js`, `package.json`, `server.py`, `index.html`, `app.js`, `style.css`, `js/*.js`, `default_config*.json` and `firmware/dactyl_right` + `firmware/dactyl_left`. `build-app.sh` builds it in `app.new`, moves the old directory to a backup next to the bundle (`.<App>.app-dir.old`, outside the signed bundle, because codesign seals everything inside), moves `app.new` in, signs and verifies; only then it deletes the backup. A failed move or signature, `SIGINT` or `SIGTERM` restores the old directory; a backup left by a killed run is restored at the next start. No stale file stays, and the bundle is never without a valid app. `main.js` starts the `server.py` next to itself (`__dirname`); it has no checkout path. Run `build:app` after every change to these files; quit the app first (the script refuses while it runs). `DACTYL_APP=<path>` selects another bundle.
- The signed bundle stays unchanged at runtime. `main.js` passes `DACTYL_DATA_DIR` (`~/Library/Application Support/dactyl-configurator/data`) to `server.py`. There it writes `current_config*.json` and a copy of both sketches; "Auf Dactyl flashen" renders the bundle `.ino` into that copy and compiles it. Each flash copies the bundle firmware again, so an app update also updates the compiled sources. `sync_firmware_sources` builds each sketch in a temp directory (directories made writable) and then replaces both old sketches together; a failure restores both. Files that a newer bundle removed do not stay, and leftover temp directories of a killed run are removed. A rendered `.ino` stays (a flash renders the `.ino` of its half from the bundle template); without one, the bundle template is copied. Without `DACTYL_DATA_DIR` (`python3 server.py` in the checkout), `server.py` uses its own directory as before. On the first build, `build-app.sh` copies `current_config*.json` from the checkout into the data directory; it never overwrites an existing file there (`DACTYL_DATA_DIR` overrides the path for tests).
- After a change to `server.py` or the web UI, run `npm run rebuild:app`. The app starts `server.py` itself and stops it on quit (`before-quit` in `main.js`). Do not stop the server process by hand. After the restart, verify that the PID on port 8088 changed and that the changed path answers.

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
   - Full configuration syncs must use `SET_K <l> <r> <c> <tap> [hold [dtap]]` (RAM-only update) followed by a single `SAVE_NVS` command at the end, avoiding 336 individual NVS flash writes and reducing sync time to ~1.5 seconds. The app no longer sends `SET_KEY` or `SET_NAME` for single edits (see "Full live sync"); the firmware still accepts `SET_KEY <l> <r> <c> <tap> [hold [dtap]]`. A missing `hold` or `dtap` argument clears that action; more than six values return `ERR ARGS`.
   - Every command reports its result: `OK <CMD> ...` on success, otherwise `ERR BUSY <cmd>`, `ERR ARGS <cmd>`, `ERR NVS <CMD>`, or `ERR UNKNOWN <cmd>`. `SET_K` sends no `OK`, only `ERR`. The app treats a sync as successful only after `OK SAVE_NVS`, `OK SAVE_COMBOS` and `OK SAVE_PAIRS`, and clears only the pending changes that the sync transmitted. `SET_TAPPING_TERM` is optional in the full sync (`buildSettingCommands`): firmware without it answers `ERR UNKNOWN`, the app shows a flash hint and continues. The progress bar counts the steps with `countSyncSteps`. The text above it (`#autoSyncProgressLabel`, `syncProgressLabel`) shows `Übertrage an <half>: <done> / <total> Schritte`, then "Übertragung abgeschlossen" or "Übertragung abgebrochen"; it makes clear that the bar shows the transfer, not a wait for more changes.

   - Layout diff before "Auf ESP32 speichern" (`writeConfigWithDiff`). Details: `FEATURES.md`, section "Layout diff".

2a. **BLE Command Authorization:**
   - In keyboard mode, BLE accepts only `GET_INFO`. Config mode is entered only through the physical `R4C5 + R0C0` combo or USB serial `ENTER_CONFIG`. The config characteristic is intentionally unauthenticated during the time-limited (3 min) config mode; this risk was explicitly accepted to preserve the macOS bonding design.
   - Macros raise the impact of this accepted risk: in config mode, a nearby BLE client can store a macro (up to 32 steps) on a key, for example a typed terminal command. Before macros, a client could only remap single keys and key pairs. The config mode stays time-limited (3 min) and starts only through the physical combo or USB.
   - ESP-NOW between the halves is encrypted with CCMP and a shared key (`DactylSplitCrypto.h`). A transmitter without the key cannot forge an encrypted frame. The ESP-IDF documentation does not state whether an encrypted peer also accepts an unencrypted frame from its MAC. Until a hardware check confirms that the master drops unencrypted frames, treat injection with a spoofed MAC as not excluded. The checks below stay as a second line of defense. Before the encryption, the master executed HID operations from any sender with the left MAC `2E:BC:BB:81:61:B0`; a nearby transmitter that spoofed this MAC could inject keystrokes. `parseSplitHidPacket()` limits the impact to valid HID operations; ESP-NOW never carries config commands. In the other direction, a transmitter that spoofs the master MAC can keep the left half awake with `SPLIT_OP_ACTIVITY` (battery drain only, no HID effect). With `SPLIT_OP_LAYER_STATE`, a transmitter that spoofs either MAC can change the active layer of the other half (MO layers and toggles), so the following keys of that half send the actions of another layer. `isValidSplitLayerEvent()` and `isValidSplitMasterLayerEvent()` limit the packet to layer state; it carries no keycodes and no config commands. A spoofed left MAC can also send `SPLIT_OP_FW_VERSION` with any version: it changes only `left_fw` and the app hint "Beide Hälften flashen" (no HID effect, no activity, no config). Likewise, a spoofed left MAC can keep the master awake with `SPLIT_OP_KEY_EVENT`, also without a Mac connection (battery drain and at most `SPLIT_KEY_EVENTS_PER_RX` serial lines per `loop()`, no HID effect). A spoofed left MAC that repeats `SPLIT_OP_TAP_PENDING 1` delays each right key by at most `SPLIT_TAP_FLUSH_TIMEOUT_MS` (50 ms, no HID effect); a spoofed master MAC that sends `SPLIT_OP_TAP_FLUSH` only sends a waiting left tap early. The encryption removes these risks only if the hardware check confirms that unencrypted frames are dropped. They remain if the key leaks.

3. **NVS Synchronization upon Flashing:**
   - A persisted combo count of `0` (after `CLEAR_COMBOS` + `SAVE_COMBOS`) overrides the compiled-in combos at boot.
   - `loadKeymapFromNVS()` compares an FNV-1a fingerprint (`defaults_fp`) of the compiled-in `KEYMAP` + `HOLDMAP` defaults and `KEYMAP_DEFAULTS_ID` with the value stored in NVS. The repository keeps `KEYMAP_DEFAULTS_ID 0UL`; "Auf Dactyl flashen" (`/api/save_and_flash`) writes a new random non-zero ID, so a flash from the app always overwrites `keymap`/`holdmap` with the app layout. A plain re-flash from the repository (e.g. `arduino-cli upload`, same defaults and ID 0) keeps the user's on-device key assignment.
   - `defaults_fp` is written last and only after both `keymap` and `holdmap` were written completely, so a failed write is retried at the next boot. After `RESET_CONFIG` the next boot restores the compiled-in defaults.
   - Devices with the old `fw_build` key keep their keymap on a repository flash; a migration flash from the app (ID != 0) applies the app layout.
   - Never flash from the repository to "sync" a layout: use the app (BLE sync or "Auf Dactyl flashen").

3a. **User Config Is Local State:**
   - `current_config.json` is the app's local runtime state and is listed in `.gitignore`; never commit it. `default_config.json` is the versioned template that `GET /api/config` returns when no local `current_config.json` exists. The response carries `source` (`"user"` or `"default"`); the app strips it before use. An unreadable or corrupt user config returns `{"exists": false}` without a template fallback.
   - Upgrade: checkouts from before the untracking lose their local `current_config.json` on `git pull`. Back up the file before the pull and restore it afterwards.
   - A missing `holdmap` or `dtapmap` next to a kept user `keymap` (older schema or interrupted write) is filled with the compiled-in `HOLDMAP` / `DTAPMAP`; `defaults_fp` is written only after these writes succeed.

3b. **Raw Matrix Event (`MATRIX:`):**
   - Details: `FEATURES.md`, section "Raw matrix event".
   - The firmware prints `MATRIX:` only on USB serial (`Serial.println`), never over BLE, also not in config mode: no keylogger channel and no extra BLE load next to the sync acks. The matrix test for keys with action `0` therefore needs USB; over BLE the matrix test still counts keys with an action through `KEY_PRESS`.

4. **Live Monitor Layer Filtering:**
   - Visual keypress indicators in the configurator must compare `pressedLayer` with `activeLayerIndex`. Keys pressed on a different layer must not highlight keycaps on the currently viewed layer.
   - Details: `FEATURES.md`, section "Live monitor layer filtering".

5. **Composite BLE HID Architecture (`DactylBleComposite.h`):**
   - Implements a single unified HID service with three distinct Input Reports:
     - Report ID 1: Keyboard (8 bytes: modifier bitmask, reserved, 6 scancodes array). The key array declares usages `0x00`..`0x73`, so F13..F24 (`0x68`..`0x73`) are valid.
     - Report ID 2: Consumer Control (2 bytes: 16 usages including Mac Globe `0x029D`).
     - Report ID 3: Mouse (4 bytes: buttons bitmask [Bit 0 Left, Bit 1 Right, Bit 2 Middle], X [-127..127], Y [-127..127], Wheel [-127..127]).
   - Appearance is set to `HID_KEYBOARD` (`0x03C1`).

6. **macOS Bluetooth GATT Report Map Caching:**
   - macOS caches the BLE HID Report Map upon initial device pairing.
   - When report descriptors are expanded or modified (such as adding Report ID 3 Mouse), macOS does not re-read the report map on simple reconnects. The device must be explicitly forgotten in macOS Bluetooth Settings ("Dieses Gerät ignorieren...") and re-paired once.

7. **Native Desktop Application (`Dactyl Configurator.app`):**
   - The Dactyl Configurator is a native macOS desktop application (`Dactyl Configurator.app` / Electron), not a website in a browser. Always treat and refer to it as a native desktop application.

8. **Pending Changes Inspector & Undo Drawer:**
   - Staged edits (`markPendingSync`) store rich change records (`{ type, title, description, revert }`).
   - Revert closures must capture `const targetLayer = activeLayerIndex;` at creation time to prevent mutating the wrong layer if the user switches layer tabs before clicking "Rückgängig".
   - Key revert closures update inspector inputs immediately when the reverted key is currently selected.

9. **Split Keyboard Wireless Architecture (Left Hand -> Right Hand via ESP-NOW):**
   - **Right Hand (Master / Central Hub):**
     - Base MAC: `2E:BC:BB:81:61:A6`
     - Wi-Fi STA MAC (ESP-NOW Receiver): `2E:BC:BB:81:61:A6`
     - Bluetooth MAC (macOS BLE HID Host): `2E:BC:BB:81:61:A8`
   - **Left Hand (Slave / Transmitter):**
     - Base MAC: `2E:BC:BB:81:61:B0`
     - Wi-Fi STA MAC: `2E:BC:BB:81:61:B0`
     - Fixed ESP-NOW Target Peer: `2E:BC:BB:81:61:A6` (Kanal 1, verschlüsselt mit CCMP, `DactylSplitCrypto.h`).
   - **Split Payload:** 4-Byte Struct `SplitHidEvent { uint8_t op; int8_t arg; uint16_t code; }` mit einer fertig aufgelösten HID-Operation. Die linke Hälfte löst Layer, Tap-Hold und Combos selbst auf; sie sendet keine Matrix-Positionen.
   - **Master Merging:** Der rechte Master prüft das Paket im Wi-Fi-Callback (`parseSplitHidPacket`), legt es in den Empfangsring und führt es in `loop()` über `splitProcessRx` auf seiner BLE-HID-Verbindung aus. `SplitArbitratedKeyboard` verfolgt, welche Hälfte welche Eingabe hält. Details: „Split HID protocol" unter „Left Half Firmware".
