# AGENTS.md — Developer & Contributor Guide for Dactyl Configurator

## Project Overview

This repository versions the firmware, web-based configurator, macOS desktop app, wiring documentation, and operational tooling for the **Dactyl True-Wireless Split Ergonomic Mechanical Keyboard** (specifically the right-hand master unit).

### Components

1. **Firmware (`firmware/dactyl_right/dactyl_right.ino`):**
   - Target Board: WEMOS LOLIN32 Lite (`esp32:esp32:lolin32-lite`, `ESP32-D0WDQ6-V3`).
   - Core Features: Composite BLE HID Keyboard (own implementation in `DactylBleComposite.h` and `DactylKeycodes.h`; no external `ESP32-BLE-Keyboard` library, which does not build against ESP32 Arduino Core 3.x), custom BLE GATT Configuration Service (`4fafc201-1fb5-459e-8fcc-c5c9c331914b`), persistent Non-Volatile Storage (NVS) via ESP32 `Preferences`, two-stage power management (Standby + Deep Sleep), and real-time USB Serial monitor/command interface (`115200` baud).
   - Split receiver: executes the `SplitHidEvent`s of the left half (ESP-NOW, `DactylSplitHid.h`) on its BLE HID connection; see "Left Half Firmware".
   - Matrix scanning: 6 Rows (`ROW_PINS = {13, 14, 27, 26, 33, 32}`) x 7 Columns (`COL_PINS = {23, 19, 18, 17, 16, 4, 25}`). Hand-wired matrix using 1N4148 diodes (Cathode/black ring to Row wire, Anode to switch pin 1, Columns soldered directly to switch pin 2 on active-low `INPUT_PULLUP`).

2. **Web Configurator (`index.html`, `style.css`, `app.js`):**
   - Vanilla JavaScript SPA with zero external runtime dependencies.
   - Real-time communication via Web Bluetooth API (`navigator.bluetooth`, including modern `getDevices()` + `watchAdvertisements()` auto-sync) and Web Serial API (`navigator.serial`).
   - Dynamic 8-layer editor (Layer 0 Base to Layer 7 Custom), layer renaming, staged offline configuration (`markPendingSync`), One-Shot Auto-Sync on hardware combo (`R4C5 + R0C0`), Config Mode status indicator (`#configModeStatusPill`), and visual keypress feedback filtered by the active hardware layer.

3. **Desktop Application (`Dactyl Configurator.app`):**
   - Native macOS app launcher in the project directory (`Dactyl Configurator.app/Contents/MacOS/Dactyl Configurator`) and `~/Applications/`.
   - Automatically checks and starts the local Python backend server (`server.py`) upon launch and opens Chrome in `--app=http://localhost:8088` mode with `--enable-features=WebBluetoothNewPermissionsBackend` and `--enable-experimental-web-platform-features` so `navigator.bluetooth.getDevices()` and `device.watchAdvertisements()` work out-of-the-box.

4. **Local REST Server (`server.py`):**
   - Python HTTP server bound strictly to `127.0.0.1:8088`. Every request requires an exact `Host` header (`localhost:8088` / `127.0.0.1:8088`, DNS-rebinding protection); POST requests with a foreign `Origin` are rejected. Static serving is limited to an allowlist (`index.html`, `app.js`, `style.css`, `js/side-profiles.js`, `js/side-state.js`, `js/side-routing.js`).
   - Configs are validated (each layer at most 6 rows x 7 keys, key cells object or code string, combo coordinates, firmware setting ranges; JSON `null` bodies return HTTP 400) and the `.ino` is rendered in memory before `current_config.json` and `dactyl_right.ino` are written atomically.
   - Ensures Homebrew paths (`/opt/homebrew/bin`, `/usr/local/bin`) are in `PATH` even when launched from macOS Finder/Dock.
   - Serves configurator web assets with no-cache headers.
   - Provides `/api/save_and_flash?side=L|R` to compile C++ defaults into the `.ino` of that half (`dactyl_right.ino` / `dactyl_left.ino`) and flash it via `arduino-cli` (`FIRMWARE_FQBN` with `PartitionScheme=min_spiffs`) at `upload.speed=115200`. The upload port is the `usbserial` port whose board answers `GET_INFO` with the matching `DEVICE_INFO.side`; without a match nothing is compiled or flashed.
   - Provides `/api/config?side=L|R` to read and write the config of a half: `current_config.json` / `current_config_left.json` (fallback `default_config.json` / `default_config_left.json`). Without `side` the right half applies; another value returns HTTP 400. On the left half, the missing keys `R4C5` / `R5C0` must not carry an action, and combos must not use them.

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

## Left Half Firmware (`firmware/dactyl_left/`)

### Architecture
- The left half is a standalone keyboard brain: own 8-layer keymap (tap/hold/double-tap), combos, key pairs, NVS and config mode. It runs the **same** `firmware/dactyl_right/DactylLogic.h` (included via `../dactyl_right/`; `arduino-cli` resolves relative includes). Never copy logic into `dactyl_left.ino`.
- Layers and combos do not span both halves. A left `MO_1` only changes the left layer.
- The left half has no HID service. `DactylSplitKeyboard` (`firmware/dactyl_left/DactylSplitKeyboard.h`) is its `bleKeyboard`: it offers the methods `DactylLogic.h` calls and queues each call as a `SplitHidEvent` to the master. The master executes it on its BLE HID connection. macOS sees one keyboard.
- `isConnected()` on the left is true only if a send callback succeeded within `SPLIT_LINK_DOWN_MS` (2 s). The left half sends `SPLIT_OP_HEARTBEAT` every second, so the link state stays current without key presses. Like a disconnected Mac, a missing master makes `DactylLogic.h` send nothing, also no releases. The master releases left inputs only after `SPLIT_LINK_TIMEOUT_MS` (3 s); when the link returns inside that gap, `DactylSplitKeyboard::onSendResult` queues `RELEASE_ALL` so no released key stays held.
- Shared headers in `firmware/dactyl_right/`: `DactylCommon.h` (action codes, `KeyCombo`, `KeyPair`), `DactylConfigBleCallbacks.h` + `DactylConfigBle.h` (isolated config-mode BLE server, name from `CONFIG_BLE_NAME`), `DactylSplitHid.h` (protocol). `DactylLogic.h` takes `CONFIG_COMBO_R1/C1/R2/C2`, `DEFAULT_DEVICE_NAME` and `CONFIG_BLE_NAME` as overridable macros; the right half uses the defaults.

### Split HID protocol (`DactylSplitHid.h`)
- `SplitHidEvent { uint8_t op; int8_t arg; uint16_t code; }`, 4 bytes, packed, little endian. ESP-NOW channel 1, unencrypted, left `2E:BC:BB:81:61:B0` -> master `2E:BC:BB:81:61:A6`.
- Ops: `HEARTBEAT`, `KEY_PRESS/RELEASE/WRITE` (code 1..255), `RELEASE_ALL`, `MEDIA_PRESS/RELEASE/WRITE` (16-bit media mask, `MediaKeyReport` low = `[0]`), `MOUSE_PRESS/RELEASE/CLICK` (mask 1..7), `MOUSE_SCROLL` (`arg` != 0). Append new ops only; never renumber.
- `parseSplitHidPacket()` checks sender MAC, length and the value range of each op. The master runs it in the Wi-Fi task callback and only queues valid events (64-entry SPSC ring, `SplitRxQueue`); `loop()` executes them.
- The master's `bleKeyboard` is `SplitArbitratedKeyboard<DactylBleKeyboard>`: it tracks what each half holds in the shared HID report. An input is released in the report only when neither half holds it, so a right Shift release keeps a left Shift held. Uppercase and shifted ASCII codes (`'A'`, `'!'`) press Shift implicitly, and their release clears the Shift bit in the report; when the other half still needs Shift (it holds `KEY_LEFT_SHIFT` or a shifted code), the arbiter re-presses Shift in the same batched report. A release of `KEY_LEFT_SHIFT` keeps Shift in the report while the other half holds a shifted code. A right `releaseAll()` (combos, config combo) clears only right inputs and re-presses left ones inside one batched report (`beginReportBatch` / `endReportBatch` in `DactylBleComposite.h`).
- Left-side tracking (`SplitLeftHeld`): press only sets, release only clears, so retry duplicates of `*_PRESS` / `*_RELEASE` / `RELEASE_ALL` are harmless. `KEY_WRITE`, `MEDIA_WRITE` and `MOUSE_CLICK` are not idempotent: the left half therefore sends `write()` and `mouseClick()` as `PRESS` + `RELEASE` and skips a one-shot action on an input it holds itself. `MOUSE_SCROLL` is never retried (`splitEventRetryable`); a lost scroll step is better than a doubled one. The master still accepts the `*_WRITE` / `MOUSE_CLICK` ops (append-only protocol); `KEY_WRITE` of a held code and `MOUSE_CLICK` of a held button are ignored. `RELEASE_ALL`, the link timeout (`SPLIT_LINK_TIMEOUT_MS`, 3 s without packets) and a receive-ring overflow release **only** the inputs held by the left half. On an overflow, `splitProcessRx` first drains the ring and releases afterwards, so a press queued before the dropped release cannot stay held.
- `splitProcessRx()` holds the gating: without a Mac connection or in config mode the master executes nothing but keeps the link alive. On the transition to "no host" it clears both halves and the report, so no key is stuck after the Mac reconnects; physically held keys must be pressed again.
- The left half sends `RELEASE_ALL` right after ESP-NOW starts (boot, wake, return from config mode). Its acknowledgement also marks the link as up without waiting for the first heartbeat.
- The master prints each executed event as `SPLIT_HID:{"op":..,"code":..,"arg":..}`; the app ignores unknown serial lines.

### Send queue (`DactylLeftLogic.h`)
- 64-entry queue, one packet in flight. A failed send (callback status, `esp_now_send` error or 200 ms callback timeout) is retried up to 3 times after `ESPNOW_RETRY_DELAY_MS` (30 ms); the order is kept.
- The send callback is matched by a callback counter: each send expects "counter before send + 1" (`queueMarkSent` / `queueCallbackIsCurrent`). Only a callback that arrives more than 230 ms late, after the retry was sent, is credited to the retry.
- A full queue drops the new event (`ESPNOW_QUEUE_FULL`). While the link is up, a dropped release stays held until the next `RELEASE_ALL` (config mode entry, deep sleep or reboot of the left half).

### Config mode, NVS, power
- Config mode: hold **`R0C5 + R4C0`** (mirrored: inner top + outer bottom) for 500 ms, or USB serial `ENTER_CONFIG`. The left half sends `RELEASE_ALL`, reboots into an isolated BLE server `Dactyl Config L` (static random address, no HID, no bonding) and returns via `ESP.restart()` or after 3 min inactivity. In config mode ESP-NOW is off.
- NVS: same `loadKeymapFromNVS()` / `saveKeymapToNVS()` / `handleConfigCommand()` as the right half, on the left chip. `KEYMAP_DEFAULTS_ID 0` in the repository.
- `DEVICE_INFO` contains `"side":"L"` (macro `DEVICE_SIDE`, default `"R"` in `DactylLogic.h`). App and server identify the half at a USB port with it; firmware without the field counts as right.
- Power: standby after 5 min (80 MHz, slower scan), deep sleep after 60 min. Before deep sleep: `RELEASE_ALL`, ESP-NOW off, rows held `HIGH` (`gpio_hold_en`), columns as RTC inputs with pull-down, Ext1 `ANY_HIGH` on the columns. A key press drives row -> switch -> diode -> column high.
- Known limit: sleeps are not synchronized. A left key wakes only the left half; a sleeping master receives nothing until a right key wakes it.
- Default layout: QWERTZ positions on the left hand (US-ASCII codes like the right half; with the macOS layout "U.S." the `'y'` on the Z position prints `y`). `R4C5` and `R5C0` do not exist physically.

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

### Build & flash (both halves use `min_spiffs`)
- BLE + ESP-NOW do not fit into the default 1.25 MB app partition (`text section exceeds available space`). Both halves use `PartitionScheme=min_spiffs` (1.875 MB app, NVS offset `0x9000` unchanged, so keymaps and the macOS bond survive the switch). `server.py` (`FIRMWARE_FQBN`) and CI use the same FQBN.
- Identify each board by its boot log before flashing; the USB port names change between plug-ins.

```bash
/opt/homebrew/bin/arduino-cli compile --fqbn esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs firmware/dactyl_left
/opt/homebrew/bin/arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs,UploadSpeed=115200 firmware/dactyl_left
```

### App support for both halves (`js/side-profiles.js`, `js/side-state.js`)
- Everything that differs between the halves lives in `SIDE_PROFILES` (`js/side-profiles.js`): BLE config name, default device name, config combo, missing keys, thumb cluster layout, row/column wires, diode hint, heatmap storage key, left default config. Do not add side-specific logic to `app.js`; the right half will move out of `app.js` into the same structure later.
- The hand switcher selects the edited half. `currentConfig` and `pendingChanges` in `app.js` always belong to it; the other half is kept in `sideStore` (`js/side-state.js`). Heatmap counters and the matrix test exist per half. The displayed layer is shared.
- The left half gets changes on the same paths as the right half: BLE one-shot auto-sync after `R0C5 + R4C0` (`Dactyl Config L`), BLE live editing in config mode, USB serial sync and "Auf Dactyl flashen".
- Every connection knows its half: BLE from the config name (`Dactyl.sideFromBleName`, confirmed by `DEVICE_INFO`), USB from `DEVICE_INFO.side`. After opening the USB port the app repeats `GET_INFO` every 500 ms (max. 5 s), because opening the port resets the board. `sendDeviceCommand(cmd, side)` sends only to a connection of that half; otherwise the change stays pending for that half. `writeConfigToESP32` syncs the half of the connection, not the displayed half. Acks carry the half, so a reply from the other half never confirms a command; unplugging USB does not cancel a running BLE sync of the same half.
- `js/side-routing.js` holds this routing as pure functions (`routeCommand`, `connectedSide`, `usbDisconnectAckScope`, `createAckRegistry`, `retryUntil`); `app.js` passes its connection state. `tests/test_side_profiles.js` tests them.
- `flash_firmware` checks the port side again right before the upload; a port that changed during the compile is not flashed.
- Revert closures of pending changes write to `currentConfig`; a change recorded for the non-edited half has no revert.
- `validateConfigShape(cfg, profile)` applies the absent-key rules of `server.py` before an import or a loaded config replaces the state (`Dactyl.absentKeyViolations`): left keys `R4C5`/`R5C0` must not carry an action, no combo may use an absent key. Layout presets (`PRESETS`) are right-hand layouts; the profile flag `presets: false` disables them for the left half.
- `tests/test_side_profiles.js` checks the profiles against the firmware sources (combo, names, pins, `KEYMAP` of `dactyl_left.ino`, `default_config_left.json`).

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

### Key Pairs (`userKeyPairs`)
- A key pair holds two keyboard codes `1..255` (ASCII, modifiers, special keys). It is pressed first-then-second and released in reverse order. It works as a tap action and as a hold action, also for combo candidates.
- The app stores the list in `keyPairs` (`{ first, second }`, max. 16); `server.py` renders it between `[[[START_KEY_PAIRS]]]` / `[[[END_KEY_PAIRS]]]`. Layer, media, mouse and pair codes are rejected as members.
- Commands: `CLEAR_PAIRS`, `ADD_PAIR <first> <second>` (appends the next index), `SAVE_PAIRS` (NVS keys `num_pairs`, `pairs_data`). A persisted count of `0` overrides the compiled-in list at boot. An unassigned index sends nothing.
- When `loadKeymapFromNVS()` applies new app defaults over a stored keymap, it removes `num_pairs`/`pairs_data`, because the new keymap references the compiled-in pairs. A plain repository flash keeps the stored pairs.
- `CLEAR_PAIRS` first releases every pair that is held at the host; the physical release of that key then sends nothing.
- Every pair can be deleted in the app. Keys reference pairs by index, so `removeKeyPairAt` renumbers the references in all layers (tap, hold, double-tap) and in combo actions: references to the deleted pair become `NONE`, higher indices move down by one. The deletion is a snapshot pending change; the next full sync sends the renumbered keys (`SET_K`) and the new pair list.

### macOS layout "U.S." and special characters (`DE_MAC_CHARS`, umlauts)
- The Mac uses the input source "U.S.". The firmware sends US HID codes, and macOS prints the US character. App labels, presets and templates must use US labels (`KEY_SEMICOLON` = `;`, never `Ö`).
- `DE_MAC_CHARS` in `app.js` (picker group "Sonderzeichen (macOS US)") lists special characters. ASCII entries store the character itself (`+`, `~`, `<`; Shift implicit via `dactylAsciiToHid`). `§` is the ISO key `KEY_NON_US_BACKSLASH` (`0xEC`, HID `0x64`).
- Umlauts use their own actions `UMLAUT_AE` .. `UMLAUT_SZ` (`0x150` .. `0x156`, `ACT_UMLAUT_*` in `DactylCommon.h`). `sendUmlaut()` taps the dead key `Alt` + `u` and then the vowel (`'A'` for `Ä`, Shift implicit); `ß` is `Alt` + `s`. The sequence is sent once on press (also as forced hold, buffered combo candidate and combo `KEY_PRESS`); the release sends nothing. Umlauts are not key pair members.
- The `.ino` defaults of both halves still contain German-layout codes (`;` for `ö`). A repository flash keeps the NVS keymap, so they do not reach the device. The preset "Deutsch QWERTZ (macOS US-Layout)" and `default_config*.json` use the umlaut actions.
- Option characters (`° € ´`) need a key pair (`Alt` + key). Their select value `CHAR_PAIR_<i>` is never stored: on "Änderung übernehmen", `resolveCharPairActions` reuses an equal pair or appends one (pending change) and writes `PAIR_<n>`. With 16 pairs a new one is rejected. A key with a new pair is only staged, because the device knows the pair only after the next sync.
- Combo actions show only the single-code characters (combos do not support pairs). A search field above each action select filters its options (`applySelectFilter`).

### Mod-Tap / Layer-Tap (`HOLDMAP`)
- Each key has a tap action (`KEYMAP`) and an optional hold action (`HOLDMAP`, `0` = none), both persisted in NVS (`keymap`, `holdmap`) and generated by `server.py` between `[[[START_KEYMAP]]]` / `[[[START_HOLDMAP]]]` markers.
- A key with a hold action resolves as **hold** when it is held for `TAPPING_TERM_MS` (200 ms), also if the release is processed before the next tick, or when another key is pressed while it is undecided; otherwise its release sends the tap action. A forced hold of a combo candidate is sent to the host immediately, before the dependent key.
- A triggered combo cancels the tap-hold decision of both member keys; their individual tap or hold actions do not execute. A hold action without a tap action behaves as a normal key.
- Transparent fallback to Layer 0 applies only when tap, hold and double-tap of the active layer are all `0`.

### Tap-Dance / Double-Tap (`DTAPMAP`)
- Each key has an optional third action (`DTAPMAP`, `0` = none), persisted in NVS (`dtapmap`), generated by `server.py` between `[[[START_DTAPMAP]]]` / `[[[END_DTAPMAP]]]` (required marker), and sent by `GET_CONFIG` as `DTAP_DATA:`. A double-tap action works only together with a tap action.
- A key with a double-tap action holds back its tap: a second press within `TAPPING_TERM_MS` (200 ms) after the first release sends the double-tap action (held while the key is held). Otherwise the single tap is sent when the window expires, or immediately before another key press so the character order stays correct. Keys without a double-tap action keep sending without delay.
- Holding the key still resolves as hold; a key with double-tap but without hold action presses its tap action as a normal key when held. A triggered combo cancels a pending or active double-tap of its member keys.
- `keymapDefaultsFingerprint()` includes `DTAPMAP` only when it contains a non-zero code, so firmware updates from before Tap-Dance keep the stored layout. A missing `dtapmap` is filled with the compiled-in `DTAPMAP`.

---

## Wireless Bluetooth Config Mode & Staged One-Shot Auto-Sync

### 1. Why macOS Previously Reconnected During Config Mode
- On macOS, `bluetoothd` bonds to the keyboard's Public BLE MAC (`2E:BC:BB:81:61:A8`) and locks the HID service (`0x1812`), blocking Web-Bluetooth GATT connections.
- Even if the ESP32 drops `0x1812` from its advertising packet, macOS `bluetoothd` immediately auto-reconnects at the L2CAP/GATT level whenever connectable advertisements appear from the **same bonded Public MAC address**.
- Additionally, `pServer->disconnect(id)` in ESP32 Bluedroid is asynchronous (`ESP_GATTS_DISCONNECT_EVT` fires ~20–50 ms later on the BTC task). Calling `pAdv->start()` before the disconnect event finishes causes `onDisconnect` to race with advertising reconfiguration.

### 2. Static Random BLE Address in `enterConfigMode()`
- Triggered by holding hardware matrix switches **`R4C5 + R0C0` for 500 ms** (100% layer-independent) or via serial command `ENTER_CONFIG`.
- `enterConfigMode()` sets `isBleTransitioning = true`, stops advertising first (`pAdv->stop()`), disconnects all peers, and waits up to 350 ms until `pServer->getConnectedCount() == 0`.
- It then calls `pAdv->reset()` and configures a deterministic **Static Random BLE Address** (`randAddr[0] |= 0xC0; randAddr[5] |= 0xC0; randAddr[4] ^= 0x55;` via `esp_ble_gap_set_rand_addr(randAddr)` and `pAdv->setDeviceAddress(randAddr, BLE_ADDR_TYPE_RANDOM)`), separated by 25 ms GAP synchronization delays before `pAdv->start()`.
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

## Code Review Rule: LOW Findings

- Do not fix `LOW` findings from code reviews directly. Record each one in `docs/ideas.md`, section "Offene LOW-Befunde aus Code-Reviews".
- Write each entry with file and line, the problem, the consequence and the recommended correction. A later dedicated run fixes these entries together, each with a regression test.
- Fix `BLOCKER`, `HIGH` and `MEDIUM` findings in the current work as usual.
- A review cycle counts as clean when no `BLOCKER`, `HIGH` or `MEDIUM` finding remains.

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
node tests/test_app_logic.js          # app.js action codes, sanitizing, config validation
node tests/test_side_profiles.js      # side profiles vs. firmware sources, per-half state, side routing and acks
bash firmware/tests/run_tests.sh      # DactylLogic.h, DactylLeftLogic.h, DactylSplitHid.h, left proxy
python3 -m py_compile server.py
node --check app.js && node --check main.js && node --check js/side-profiles.js && node --check js/side-state.js && node --check js/side-routing.js
xmllint --noout docs/lolin32_lite_wiring.svg
```

### 3a. Rebuild the Desktop App
```bash
npm run build:app   # copies main.js + package.json into ~/Applications/Dactyl Configurator.app and re-signs it ad hoc
```
- The installed Electron bundle keeps its own copy of `main.js` (BLE/serial device selection, server start). Run `build:app` after every change to `main.js`; quit the app first (the script refuses while it runs). `DACTYL_APP=<path>` selects another bundle.
- The web UI (`index.html`, `app.js`, `js/`) and `server.py` are not in the bundle; the app loads them from the main checkout at runtime. After a change to `server.py`, stop the running server process so the app starts the new one.

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
   - Full configuration syncs must use `SET_K <l> <r> <c> <tap> [hold [dtap]]` (RAM-only update) followed by a single `SAVE_NVS` command at the end, avoiding 336 individual NVS flash writes and reducing sync time to ~1.5 seconds. Single interactive key edits in live mode continue to use `SET_KEY <l> <r> <c> <tap> [hold [dtap]]`. A missing `hold` or `dtap` argument clears that action; more than six values return `ERR ARGS`.
   - Every command reports its result: `OK <CMD> ...` on success, otherwise `ERR BUSY <cmd>`, `ERR ARGS <cmd>`, `ERR NVS <CMD>`, or `ERR UNKNOWN <cmd>`. `SET_K` sends no `OK`, only `ERR`. The app treats a sync as successful only after `OK SAVE_NVS`, `OK SAVE_COMBOS` and `OK SAVE_PAIRS`, and clears only the pending changes that the sync transmitted.

2a. **BLE Command Authorization:**
   - In keyboard mode, BLE accepts only `GET_INFO`. Config mode is entered only through the physical `R4C5 + R0C0` combo or USB serial `ENTER_CONFIG`. The config characteristic is intentionally unauthenticated during the time-limited (3 min) config mode; this risk was explicitly accepted to preserve the macOS bonding design.
   - ESP-NOW between the halves is unencrypted (accepted design for latency). The master executes HID operations from any sender with the left MAC `2E:BC:BB:81:61:B0`; a nearby transmitter that spoofs this MAC can inject keystrokes. `parseSplitHidPacket()` limits the impact to valid HID operations; ESP-NOW never carries config commands.

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

4. **Live Monitor Layer Filtering:**
   - Visual keypress indicators in the configurator must compare `pressedLayer` with `activeLayerIndex`. Keys pressed on a different layer must not highlight keycaps on the currently viewed layer.

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
     - Fixed ESP-NOW Target Peer: `2E:BC:BB:81:61:A6` (Kanal 1, unverschlüsselt für <2 ms Airtime).
   - **Split Payload:** 4-Byte Struct `SplitHidEvent { uint8_t op; int8_t arg; uint16_t code; }` mit einer fertig aufgelösten HID-Operation. Die linke Hälfte löst Layer, Tap-Hold und Combos selbst auf; sie sendet keine Matrix-Positionen.
   - **Master Merging:** Der rechte Master prüft das Paket im Wi-Fi-Callback (`parseSplitHidPacket`), legt es in den Empfangsring und führt es in `loop()` über `splitProcessRx` auf seiner BLE-HID-Verbindung aus. `SplitArbitratedKeyboard` verfolgt, welche Hälfte welche Eingabe hält. Details: „Split HID protocol" unter „Left Half Firmware".
