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
   - Modules: `js/keycodes.js` (keycodes, action codes, key pair and special character helpers), `js/config-model.js` (limits, validation, normalization, matrix test and typing statistics; no DOM), `js/editor.js` (layer tools, keycode selects and search, matrix, inspector, combo table), `js/key-pairs-ui.js`, `js/macros-ui.js` (macro list and step editor), `js/layout-profiles-ui.js` (dialog "Profile": save, load and delete named layouts of the edited half; loading is a snapshot pending change with the flags `pairs` and `macros`, like an import), `js/editor-events.js` (event listeners, combo deletion, flash), `js/ble.js`, `js/serial.js` (incl. `handleSerialLine`), `js/live-monitor.js`, `js/heatmap.js`, `js/matrix-test.js`, `js/keyboard-hooks.js`, `js/config-sync.js` (`writeConfigToESP32`, `readConfigFromESP32`). `app.js` keeps the global state, the initialization, the config mode indicator, pending changes and the server save.
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
   - Provides `/api/config?side=L|R` to read and write the config of a half: `current_config.json` / `current_config_left.json` (fallback `default_config.json` / `default_config_left.json`). Without `side` the right half applies; another value returns HTTP 400. On the left half, the missing keys `R4C5` / `R5C0` must not carry an action, and combos must not use them.
   - Provides `/api/profiles?side=L|R` for named layout profiles of a half: `layout_profiles.json` / `layout_profiles_left.json` in the data directory (local state, in `.gitignore`, like the `.lock` files). The body is `{ "revision": n, "profiles": [{ name, savedAt, config }] }`, max. `MAX_PROFILES` (32). Names are unique after `str.casefold()` (the app folds each character with `toUpperCase().toLowerCase()`, maps `ẞ` to `ss` and keeps `ı`; `tests/test_app_logic.js` compares this with `casefold` for every Unicode character) and pass `sanitize_name` unchanged; each `config` passes `validate_config` of that half. A POST must carry the `revision` of its last read; another revision returns HTTP 409 (two app windows), a success returns the new `revision`. GET returns `{ profiles, revision, skipped }`: an invalid entry is skipped and named in `skipped`; the next save removes it and keeps the old file as `<file>.<timestamp>.bak`. A missing file returns an empty list; an unreadable file returns HTTP 500, so the app never overwrites it with an empty list.

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
- `SplitHidEvent { uint8_t op; int8_t arg; uint16_t code; }`, 4 bytes, packed, little endian. ESP-NOW channel 1, unencrypted, left `2E:BC:BB:81:61:B0` -> master `2E:BC:BB:81:61:A6`.
- Ops: `HEARTBEAT`, `KEY_PRESS/RELEASE/WRITE` (code 1..255), `RELEASE_ALL`, `MEDIA_PRESS/RELEASE/WRITE` (16-bit media mask, `MediaKeyReport` low = `[0]`), `MOUSE_PRESS/RELEASE/CLICK` (mask 1..7), `MOUSE_SCROLL` (`arg` != 0), `ACTIVITY` (master -> left only, see "Config mode, NVS, power"), `KEY_EVENT` (diagnostics), `ONE_SHOT_PRESS/RELEASE` (mask 1..255), `CAPS_WORD_TOGGLE` (see "One-Shot Modifiers and Caps Word") and `LAYER_STATE` (both directions, see "Layer sync"). Append new ops only; never renumber.
- `parseSplitHidPacket()` checks sender MAC, length and the value range of each op; it rejects `ACTIVITY`. The master runs it in the Wi-Fi task callback and only queues valid events (64-entry SPSC ring, `SplitRxQueue`); `loop()` executes them.
- The master's `bleKeyboard` is `SplitArbitratedKeyboard<DactylBleKeyboard>`: it tracks what each half holds in the shared HID report. An input is released in the report only when neither half holds it, so a right Shift release keeps a left Shift held. Uppercase and shifted ASCII codes (`'A'`, `'!'`) press Shift implicitly, and their release clears the Shift bit in the report; when the other half still needs Shift (it holds `KEY_LEFT_SHIFT` or a shifted code), the arbiter re-presses Shift in the same batched report. A release of `KEY_LEFT_SHIFT` keeps Shift in the report while the other half holds a shifted code. A right `releaseAll()` (combos, config combo) clears only right inputs and re-presses left ones inside one batched report (`beginReportBatch` / `endReportBatch` in `DactylBleComposite.h`).
- Left-side tracking (`SplitLeftHeld`): press only sets, release only clears, so retry duplicates of `*_PRESS` / `*_RELEASE` / `RELEASE_ALL` are harmless. `KEY_WRITE`, `MEDIA_WRITE` and `MOUSE_CLICK` are not idempotent: the left half therefore sends `write()` and `mouseClick()` as `PRESS` + `RELEASE` and skips a one-shot action on an input it holds itself. `MOUSE_SCROLL` is never retried (`splitEventRetryable`); a lost scroll step is better than a doubled one. The master still accepts the `*_WRITE` / `MOUSE_CLICK` ops (append-only protocol); `KEY_WRITE` of a held code and `MOUSE_CLICK` of a held button are ignored. `RELEASE_ALL`, the link timeout (`SPLIT_LINK_TIMEOUT_MS`, 3 s without packets) and a receive-ring overflow release **only** the inputs held by the left half. On an overflow, `splitProcessRx` first drains the ring and releases afterwards, so a press queued before the dropped release cannot stay held.
- `splitProcessRx()` holds the gating: without a Mac connection or in config mode the master executes nothing but keeps the link alive. On the transition to "no host" it clears both halves and the report, so no key is stuck after the Mac reconnects; physically held keys must be pressed again.
- The left half sends `RELEASE_ALL` right after ESP-NOW starts (boot, wake, return from config mode). Its acknowledgement also marks the link as up without waiting for the first heartbeat.
- The master prints each executed event as `SPLIT_HID:{"op":..,"code":..,"arg":..}`; the app ignores unknown serial lines.
- Live-monitor diagnostics: after the HID events of a left matrix change, the left half queues `SPLIT_OP_KEY_EVENT` (13) with `splitKeyEventCode(row, col, pressed, layer)` (bit 15 pressed, bits 8..10 layer before the action, bits 4..6 row, bits 0..2 column). It is queued only while the link is up and only while the send queue is at most half full (`queueKeyEventDiagnostic` / `queuePushDiagnostic`, `SPLIT_DIAG_QUEUE_LIMIT`), and it is never retried. A diagnostic event dropped at that limit is counted and reported as serial line `SPLIT_KEY_DROPPED (n verworfen)`; a dropped `KEY_EVENT` does not count toward the ESP-NOW restart. The master has no HID effect for it: `splitProcessRx` reports it through `onKeyEvent`, also without a Mac connection, at most `SPLIT_KEY_EVENTS_PER_RX` (4) per call (a flood from a spoofed left MAC must not block `loop()` with serial output; the excess is counted and printed as one line `SPLIT_KEY_RX_DROPPED (n verworfen)`; the left half's own send-side line is `SPLIT_KEY_DROPPED`), and it does not count as applied. It counts in `SplitRxReport.keyEvents` and resets the master's `lastActivityTime`, so a left key with action `0` keeps the master awake. The master prints it only on USB serial as `SPLIT_KEY:{"r":..,"c":..,"pressed":0|1,"layer":..}`; it never goes over BLE (keylogger protection). The app accepts `SPLIT_KEY` only from the master (`Dactyl.parseSplitKeyLine`, `js/side-routing.js`), assigns it to `Dactyl.getSplitSenderSide()` and drives the live monitor, heatmap and matrix test of the left half. A `SPLIT_KEY` release can be lost, so a press without release is released in the UI after `Dactyl.SPLIT_KEY_STALE_MS` (5 s, `createSplitKeyTracker`). A key with action `0` also sends `SPLIT_KEY`.

### Layer sync (`SPLIT_OP_LAYER_STATE`)
- An `MO_n`, `TG_n`, `LAYER_UP` or `LAYER_DOWN` on one half activates the layer on both halves. Each half resolves its own keys on the shared layer.
- Packet: `code` bits 0..7 = held MO layers of the sender, bits 9..15 = toggled layers 1..7. Left `arg`: 0 = `REPORT` (MO only, toggle bits 0), 1..127 = `SET` with a sequence number (the master takes the toggles). Master `arg` < 0: the packet always carries the toggles, bits 0..6 echo the number of the last left `SET` it took (0 = none). Built with `makeSplitLayerEvent` / `makeSplitMasterLayerEvent`, checked by `isValidSplitLayerEvent` (left) and `isValidSplitMasterLayerEvent` (master).
- MO layers belong to the sender. The receiver keeps them in `remoteMomentaryLayers` (`DactylLogic.h`); `getActiveLayer()` treats them like its own MO layers, a remote `MO_0` also forces layer 0. They expire after `SPLIT_LAYER_REMOTE_TIMEOUT_MS` (3 s) without a layer packet (other half off or in deep sleep).
- Toggles are one shared state in `toggleLayers[]`. The master leads. The left half sends `SET` with a new number after its own toggle change and keeps sending it (also in the refresh and in the release packet) until a master packet echoes that number or `SPLIT_LAYER_SET_TIMEOUT_MS` (2 s) pass (`setPending`, `splitLayerAcceptMasterToggles`). Until then it ignores master toggles, so an older master packet does not undo the change, also one with equal toggles. A failed queue push keeps the open `SET` and its number for the next attempt (`splitLayerSendIfDue`); a `SET` that was never queued ends when the toggle reverts before the next attempt (`setUnsent`). `restartEspNow` keeps an open `SET`, starts its time limit again and discards a mailbox packet from before the restart (`splitLayerLeftRestart`). The first left packet after boot or wake-up is a `REPORT`, so the left half takes the master toggles. The number starts at a random value (`esp_random`), so an echo from before a reboot rarely matches.
- Send (`SplitLayerSync`, `splitLayerTake`, `splitLayerSendIfDue`): each half sends on each change and every `SPLIT_LAYER_REFRESH_MS` (1 s). The left half queues it in the send queue (retry there; refresh only while the queue is at most half full, `SPLIT_DIAG_QUEUE_LIMIT`; a full queue restores the state and sends again in the next pass). The heartbeat stays unchanged, so a master without `LAYER_STATE` keeps the link up. The master has no retry: it sends each change a second time after `SPLIT_LAYER_REPEAT_MS` (30 ms), a failed `esp_now_send` restores the state; it refreshes only while the left link is up and sends at once when the link comes up (`splitLayerMasterAfterRx`).
- Release: before config mode and deep sleep each half sends its state without MO layers (`splitLayerReleaseEvent`; left: `queueSplitLayerRelease`, with an open `SET`, drains a full queue first with `queuePushAfterDrain`; master: `sendSplitLayerRelease`). The master also clears the left MO layers on the link timeout (`splitLayerMasterAfterRx`). The master receives through `splitLayerMasterReceive`, the left half through `splitLayerLeftReceive`. The master takes a left `SET` only with a new number; a retry or refresh with the number it already took changes nothing, so it cannot undo a later master toggle. A left `REPORT` clears the stored number: the left half then has no open `SET`, and its first packet after a reboot is a `REPORT`, so a later `SET` with the same number counts as new. The left send queue keeps the order, so an old `SET` never arrives after that `REPORT`.
- Receive: the master gets it through `splitProcessRx` (`onLayer`, also without a Mac connection; it does not count as activity, so the refresh does not keep the master awake). `onLayer` gets only the newest layer packet of each call, at most once, so a flood from a spoofed left MAC prints at most one `LAYER` line per `loop()`. The left half checks it with `parseSplitMasterPacket()` (master MAC, `ACTIVITY` or a master `LAYER_STATE`) and passes it through a mailbox (`SplitLayerMailbox`, seqlock, newest packet wins) to `loop()`.
- `applyRemoteLayerState()` prints `LAYER: SPLIT -> Layer <n>` when the active layer changes. The app follows every `LAYER:` line and every `KEY_PRESS.target_layer`, also from the non-edited half, because the displayed layer is shared.
- Mixed firmware: both halves need a firmware with `LAYER_STATE`. An older half rejects op 17 as invalid; each half then keeps its own layers, as before the sync. Flash both halves.
- Known limit: a key that is held while the layer changes keeps its action (the release uses `pressedAction`). A combo `LAYER_TOGGLE` also syncs, because it changes `toggleLayers[]`.

### Send queue (`DactylLeftLogic.h`)
- 64-entry queue, one packet in flight. A failed send (callback status, `esp_now_send` error or 200 ms callback timeout) is retried up to 3 times after `ESPNOW_RETRY_DELAY_MS` (30 ms); the order is kept.
- The send callback is matched by a callback counter: each send expects "counter before send + 1" (`queueMarkSent` / `queueCallbackIsCurrent`). Only a callback that arrives more than 230 ms late, after the retry was sent, is credited to the retry.
- A full queue drops the new event (`ESPNOW_QUEUE_FULL`). While the link is up, a dropped release stays held until the next `RELEASE_ALL` (config mode entry, deep sleep or reboot of the left half).
- ESP-NOW restart (`EspNowRestartGuard`, `shouldRestartEspNow`): after `ESPNOW_RESTART_DROPS` (5) dropped events in a row and `ESPNOW_RESTART_DOWN_MS` (5 s) since the first drop, `restartEspNow()` resets the queue, deinitializes ESP-NOW and Wi-Fi and runs `setupEspNow()` again, which queues `RELEASE_ALL`. Serial line `ESPNOW_RESTART`. The backoff starts at `ESPNOW_RESTART_BACKOFF_MS` (30 s) and doubles with each restart without a delivery up to `ESPNOW_RESTART_BACKOFF_MAX_MS` (8 min), so a master that is off or in deep sleep does not cost a restart every 30 s; a delivery resets it. `espNowRestartAllowed()` blocks a restart in config mode, while deep sleep is due and without ESP-NOW. A key held during a restart stays pressed in `DactylLogic.h` but is released at the master (`RELEASE_ALL`); press it again to send it. A failed `setupEspNow()` restarts the board. The guard is a safeguard for a send failure with unknown cause, not a fix of the cause.

### Config mode, NVS, power
- Config mode: hold **`R0C5 + R4C0`** (mirrored: inner top + outer bottom) for 500 ms, or USB serial `ENTER_CONFIG`. The left half sends `RELEASE_ALL`, reboots into an isolated BLE server `Dactyl Config L` (static random address, no HID, no bonding) and returns via `ESP.restart()` or after 3 min inactivity. In config mode ESP-NOW is off.
- NVS: same `loadKeymapFromNVS()` / `saveKeymapToNVS()` / `handleConfigCommand()` as the right half, on the left chip. `KEYMAP_DEFAULTS_ID 0` in the repository.
- `DEVICE_INFO` contains `"side":"L"` (macro `DEVICE_SIDE`, default `"R"` in `DactylLogic.h`). App and server identify the half at a USB port with it; firmware without the field counts as right.
- Power: standby after 5 min (slower scan), deep sleep after 60 min. The left half keeps 240 MHz in standby: a `setCpuFrequencyMhz()` change while Wi-Fi runs made every ESP-NOW send fail until `ESPNOW_RESTART`, so the first keys after wake-up were lost (hardware finding). The master still switches to 80 MHz; its ESP-NOW receive works in standby. Before deep sleep: `RELEASE_ALL`, ESP-NOW off, rows held `HIGH` (`gpio_hold_en`), columns as RTC inputs with pull-down, Ext1 `ANY_HIGH` on the columns. A key press drives row -> switch -> diode -> column high.
- Synchronized inactivity timers: each applied left event resets the master's `lastActivityTime`. In the other direction, a right key press queues `SPLIT_OP_ACTIVITY` to the left MAC (`SplitActivityThrottle` via `splitNoteLocalKeyChange`, at most one packet per `SPLIT_ACTIVITY_INTERVAL_MS` = 10 s, the last press inside an interval is sent after it). A failed `esp_now_send` keeps the note (`splitActivitySendResult`), so the packet goes out again after the interval. The left half checks it with `parseSplitMasterPacket()` (master MAC, length, `code`/`arg` 0 for `ACTIVITY`) and resets its timer for standby and deep sleep (`consumeMasterActivity`), without HID effect. A failed registration of the receive callback prints `ERR ESPNOW_RECV_CB` and shows `ActivityRx=0` in the `STATUS` line; sending still works. Each half keeps its own timeout values in NVS.
- Known limit: a half in deep sleep receives no radio packets. A left key wakes only the left half; a sleeping master receives nothing until a right key wakes it.
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

### App support for both halves (`js/side-profiles.js`, `js/side-right.js`, `js/side-left.js`, `js/side-state.js`)
- Each half has its own profile file: `js/side-right.js` and `js/side-left.js`. It registers itself with `Dactyl.registerSideProfile` from `js/side-profiles.js`. `index.html` loads the shared core first, then the profiles; the first profile is the first entry of `SIDE_IDS`.
- A profile holds everything that differs between the halves: BLE config name, default device name, config combo, missing keys, thumb cluster layout, row/column wires, diode hint, heatmap storage key, default config, layout presets (`presets`, `null` = none), live-monitor scancode table (`scancodeMap`, `null` = none), hand button (`handView`), matrix CSS class (`cssClass`), position in the split view (`displayOrder`) and export file prefix (`exportPrefix`).
- The right profile has `master: true`. `Dactyl.getMasterSide()` is the start half, the half of firmware without `DEVICE_INFO.side`, and the half of an unknown config name.
- Do not add side-specific logic or `"R"`/`"L"` literals to `app.js` or the other app modules. Read the value from the profile, or add a profile field.
- The hand switcher selects the edited half. `currentConfig` and `pendingChanges` in `app.js` always belong to it; the other half is kept in `sideStore` (`js/side-state.js`). Heatmap counters and the matrix test exist per half. The displayed layer is shared.
- The left half gets changes on the same paths as the right half: BLE one-shot auto-sync after `R0C5 + R4C0` (`Dactyl Config L`), BLE live editing in config mode, USB serial sync and "Auf Dactyl flashen".
- Every connection knows its half: BLE from the config name (`Dactyl.sideFromBleName`, confirmed by `DEVICE_INFO`), USB from `DEVICE_INFO.side`. After opening the USB port the app repeats `GET_INFO` every 500 ms (max. 5 s), because opening the port resets the board. `sendDeviceCommand(cmd, side)` sends only to a connection of that half; otherwise the change stays pending for that half. `writeConfigToESP32` syncs the half of the connection, not the displayed half. Acks carry the half, so a reply from the other half never confirms a command; unplugging USB does not cancel a running BLE sync of the same half.
- `js/side-routing.js` holds this routing as pure functions (`routeCommand`, `connectedSide`, `usbDisconnectAckScope`, `createAckRegistry`, `retryUntil`); `js/ble.js` (`connectionState`) passes the connection state. `tests/test_side_profiles.js` tests them.
- `flash_firmware` checks the port side again right before the upload; a port that changed during the compile is not flashed.
- Revert closures of pending changes write to `currentConfig`; a change recorded for the non-edited half has no revert.
- `validateConfigShape(cfg, profile)` applies the absent-key rules of `server.py` before an import or a loaded config replaces the state (`Dactyl.absentKeyViolations`): left keys `R4C5`/`R5C0` must not carry an action, no combo may use an absent key. Layout presets are right-hand layouts in `presets` of the right profile; the left profile has `presets: null`, which disables the preset button.
- `tests/test_side_profiles.js` checks the profiles against the firmware sources (combo, names, pins, `KEYMAP` of `dactyl_left.ino`, `default_config_left.json`) and against `index.html` (hand buttons, preset options).

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
- A key pair holds two keyboard codes `1..255` (ASCII, modifiers, special keys). It is pressed first-then-second and released in reverse order. It works as a tap action and as a hold action, also for combo candidates.
- The app stores the list in `keyPairs` (`{ first, second }`, max. 16); `server.py` renders it between `[[[START_KEY_PAIRS]]]` / `[[[END_KEY_PAIRS]]]`. Layer, media, mouse and pair codes are rejected as members.
- Commands: `CLEAR_PAIRS`, `ADD_PAIR <first> <second>` (appends the next index), `SAVE_PAIRS` (NVS keys `num_pairs`, `pairs_data`). A persisted count of `0` overrides the compiled-in list at boot. An unassigned index sends nothing.
- When `loadKeymapFromNVS()` applies new app defaults over a stored keymap, it removes `num_pairs`/`pairs_data`, because the new keymap references the compiled-in pairs. A plain repository flash keeps the stored pairs.
- `CLEAR_PAIRS` first releases every pair that is held at the host; the physical release of that key then sends nothing.
- Every pair can be deleted in the app. Keys reference pairs by index, so `removeKeyPairAt` renumbers the references in all layers (tap, hold, double-tap) and in combo actions: references to the deleted pair become `NONE`, higher indices move down by one. The deletion is a snapshot pending change; the next full sync sends the renumbered keys (`SET_K`) and the new pair list.

### Macros (`userMacros`)
- A macro is a list of at most 32 steps (`MacroStep { type, code, ms }`, 4 bytes): `tap` (press, release in the next step), `down` (press and hold), `up` (release) with a keyboard code `1..255`, and `pause` with `1..5000` ms. Max. 16 macros. Codes in `DactylCommon.h` (`ACT_MACRO_BASE`, `MACRO_STEP_*`), `server.py` (`MACRO_STEP_TYPES`) and `js/keycodes.js` must match; tests compare them.
- Non-blocking: `startMacro()` sends the first step on press; `macroTick()` in `processDeferredKeys()` sends at most one HID event per `loop()` pass, with `MACRO_STEP_GAP_MS` (5 ms) between two events. At the end, every code that a `down` step still holds is released. A `pause` as the last step runs to its end before the macro ends. Only one macro runs at a time; a press while a macro runs (also of another macro key) starts nothing. The key release sends nothing. Each executed step resets `lastActivityTime`, so standby does not slow a long macro.
- Works as tap, hold and double-tap action and as a buffered combo candidate. Combos do not support macros: `ADD_COMBO` rejects macro codes, `server.py` and `validateConfigShape` reject them as combo actions. Macros are not key pair or step members.
- Cancel: `CLEAR_MACROS`, `ADD_MACRO`, `ADD_MACRO_STEP` and deep sleep (right) release the open codes; a triggered combo, the config combo, config mode entry, deep sleep (left) and `restartEspNow` stop the macro before their `releaseAll()`. Without a host connection or in config mode, `macroTick` ends the macro without sending (like every key).
- Left half: `MACRO_OUTPUT_READY()` is `queueHasRoomForMacro(sendQueue)` (`DactylLeftLogic.h`). A step waits while fewer than `MACRO_QUEUE_RESERVE` (16) of the 64 queue entries are free, so a long macro never drops an event and never takes the room of the user's own keys.
- Known limit: an `up` step of a modifier also releases it at the host when the user holds the same modifier physically.
- Commands: `CLEAR_MACROS`, `ADD_MACRO` (appends an empty macro, `OK ADD_MACRO <idx>`), `ADD_MACRO_STEP <type> <code> <ms>` (appends to the last macro, `OK ADD_MACRO_STEP <idx> <n>`; one step per command because lines are limited to 256 characters), `SAVE_MACROS`. Invalid values return `ERR ARGS`. The app syncs macros after the key pairs; firmware without macros answers `ERR UNKNOWN CLEAR_MACROS`, and the app shows a flash hint and skips the phase.
- NVS: `num_macros`, `macro_lens` (one byte per macro) and `macros_data` (only the used steps, packed). A persisted count of `0` overrides the compiled-in list; data with a wrong length is ignored. `saveMacrosToNVS()` removes `num_macros` first and writes it last, only after `macro_lens` and `macros_data` succeeded: an interrupted or failed write loads the compiled-in macros at the next boot, never a mix; the previously stored set is lost in that case (accepted trade-off, the app syncs the full list again). New app defaults over a stored keymap remove the three keys (like key pairs). Full macros need about 66 of about 500 NVS entries (`min_spiffs`, 20 KB). The `STATUS` line of both halves shows `NvsUsed=<n> NvsFree=<n>`.
- `server.py` renders `macros` (`[{ name, steps: [{ type, code | ms }] }]`) between `[[[START_MACROS]]]` / `[[[END_MACROS]]]`. The `name` stays in the app; the firmware knows only the index.
- App: section "Makros" in the combos tab. Saving or deleting a macro is a snapshot pending change with the flag `macros`; a connected half gets it with the next full live sync (see "Full live sync"). An import and a loaded layout profile also set `macros`. Deleting renumbers the references in all layers (`removeMacroAt`); its undo (`restoreMacroAt`) inserts the macro again, moves higher references back and restores only the cleared positions that are still empty, so later key changes stay. `normalizeConfig` replaces an invalid macro with an empty one and keeps the indices.
- `GET_CONFIG` and the layout diff contain no macros, like combos and key pairs; the diff can show "no change" while the macros on the device differ.

### macOS layout "U.S." and special characters (`DE_MAC_CHARS`, umlauts)
- The Mac uses the input source "U.S.". The firmware sends US HID codes, and macOS prints the US character. App labels, presets and templates must use US labels (`KEY_SEMICOLON` = `;`, never `Ö`).
- `DE_MAC_CHARS` in `js/keycodes.js` (picker group "Sonderzeichen (macOS US)") lists special characters. ASCII entries store the character itself (`+`, `~`, `<`; Shift implicit via `dactylAsciiToHid`). `§` is the ISO key `KEY_NON_US_BACKSLASH` (`0xEC`, HID `0x64`). This assumes the macOS keyboard type ISO; with ANSI, macOS swaps HID `0x35` and `0x64`, and `§` does not appear on the ISO key.
- Umlauts use their own actions `UMLAUT_AE` .. `UMLAUT_SZ` (`0x150` .. `0x156`, `ACT_UMLAUT_*` in `DactylCommon.h`). `sendUmlaut()` taps the dead key `Alt` + `u` and then the vowel (`'A'` for `Ä`, Shift implicit); `ß` is `Alt` + `s`. The sequence is sent once on press (also as forced hold, buffered combo candidate and combo `KEY_PRESS`); the release sends nothing. Modifiers that this half holds at the host (keys, key pairs, `MODIFIER_HOLD` combos; a held shifted ASCII code counts as left Shift; members of an active combo do not count) are released before the sequence and pressed again after it (`heldModifierMask`). On the left half, every step is a separate `PRESS`/`RELEASE` event; the `delay(5)` only delays the queueing, so the dead key needs a hardware check. Umlauts are not key pair members.
- The `.ino` defaults of both halves still contain German-layout codes (`;` for `ö`). A repository flash keeps the NVS keymap, so they do not reach the device. The preset "Deutsch QWERTZ (macOS US-Layout)" and `default_config*.json` use the umlaut actions.
- Option characters (`° € ´`) need a key pair (`Alt` + key). Their select value `CHAR_PAIR_<i>` is never stored: on "Änderung übernehmen", `resolveCharPairActions` reuses an equal pair or appends one (pending change) and writes `PAIR_<n>`. With 16 pairs a new one is rejected. The key change and the new pair go to the device together in the next full sync (see "Full live sync").
- Combo actions show only the single-code characters (combos do not support pairs). A search field above each action select filters its options (`applySelectFilter`, pure part `filterOptionNodes`). The search compares the option text without the prefix `Halten = ` / `2× Tippen = ` and never changes the selection. A hidden selected option stays selected and is named in a hint; without a match, the hint blocks "Änderung übernehmen" or "Combo speichern". The live monitor maps `UMLAUT_*` to `KeyU` / `KeyS` with held Alt (`findKeyForEventCode`).

### One-Shot Modifiers and Caps Word (`DactylOneShot.h`)
- The master keeps the state for both halves (`OneShotState` in `SplitArbitratedKeyboard`). `DactylLogic.h` calls `bleKeyboard.oneShotPress(mask)` / `oneShotRelease(mask)` / `capsWordToggle()`; the left half sends them as `SPLIT_OP_ONE_SHOT_PRESS` / `SPLIT_OP_ONE_SHOT_RELEASE` (mask 1..255) and `SPLIT_OP_CAPS_WORD_TOGGLE`. A one-shot key on one half therefore acts on the next key of either half.
- Tap without another input in between: the modifier is armed for the next key or mouse press. A second tap disarms it. Several one-shot modifiers stack. Held while other keys are pressed: it acts as a normal modifier for each of them and arms nothing.
- The armed modifiers go into the same HID report as the key press; the next report releases them (`pressWithMods`). A modifier that is already in the report is not pressed or released again. Modifier keys do not consume the armed state.
- A press while Alt is in the report (umlaut dead key, key pair with Alt) consumes nothing and does not change Caps Word. So an armed Shift before `UMLAUT_AE` gives `Ä`.
- A held one-shot key does not count in `heldModifierMask()`: an umlaut pressed while a one-shot key is held sends the plain sequence, and the held one-shot modifier does not reach the umlaut (Alt in the report blocks it). `test_umlaut_while_one_shot_key_held_sends_plain_sequence` fixes this behavior.
- A `CAPS_WORD` key that is a combo candidate is buffered like a normal key: a triggered combo does not toggle Caps Word; a quick tap toggles it on release, a hold after `comboTimeoutMs` (`processDeferredKeys`, forced hold in `activateTapHoldAsHold`). One-shot keys are not buffered; a triggered combo releases them without arming (`releaseAll()`).
- Caps Word: `a`..`z` and `-` get Shift. Digits, `_`, Backspace, Delete and modifiers keep it on; every other key ends it. The key toggles it.
- `RELEASE_ALL`, a right `releaseAll()` (combos) and the link timeout release a held one-shot key without arming it. A host loss clears the state. `CAPS_WORD_TOGGLE` is never retried (a duplicate would undo it); one-shot press and release are idempotent.
- Combos support both actions with `KEY_PRESS` (one-shot = tap). `MODIFIER_HOLD` holds only codes 1..255, so `server.py` (`generate_combos_cpp`) and the combo dialog reject `OSM_*` and `CAPS_WORD` with `MODIFIER_HOLD`. Older saved configs, profiles and imports with this pair are migrated to `KEY_PRESS` (`migrate_config` in `server.py`, `migrateConfig` in `validateConfigShape`); before, such a combo sent nothing. Key pairs do not accept them as members.

### Mod-Tap / Layer-Tap (`HOLDMAP`)
- Each key has a tap action (`KEYMAP`) and an optional hold action (`HOLDMAP`, `0` = none), both persisted in NVS (`keymap`, `holdmap`) and generated by `server.py` between `[[[START_KEYMAP]]]` / `[[[START_HOLDMAP]]]` markers.
- A key with a hold action resolves as **hold** when it is held for the tapping term (`tappingTermMs`, default `TAPPING_TERM_MS` 200 ms), also if the release is processed before the next tick, or when another key is pressed while it is undecided; otherwise its release sends the tap action. A forced hold of a combo candidate is sent to the host immediately, before the dependent key.
- A triggered combo cancels the tap-hold decision of both member keys; their individual tap or hold actions do not execute. A hold action without a tap action behaves as a normal key.
- Transparent fallback to Layer 0 applies only when tap, hold and double-tap of the active layer are all `0`.
- The tapping term is a setting per half: `tappingTermMs` (100..500 ms, default 200), command `SET_TAPPING_TERM <ms>`, NVS key `tap_term`, `DEVICE_INFO` field `tapping_term_ms`, config field `settings.tappingTermMs`, rendered by `server.py` in `[[[START_SETTINGS]]]`. It controls Mod-Tap and Tap-Dance; the combo window stays `comboTimeoutMs`.

### Tap-Dance / Double-Tap (`DTAPMAP`)
- Each key has an optional third action (`DTAPMAP`, `0` = none), persisted in NVS (`dtapmap`), generated by `server.py` between `[[[START_DTAPMAP]]]` / `[[[END_DTAPMAP]]]` (required marker), and sent by `GET_CONFIG` as `DTAP_DATA:`. A double-tap action works only together with a tap action.
- A key with a double-tap action holds back its tap: a second press within the tapping term (`tappingTermMs`) after the first release sends the double-tap action (held while the key is held). Otherwise the single tap is sent when the window expires, or immediately before another key press so the character order stays correct. Keys without a double-tap action keep sending without delay.
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
  4. The ESP32 immediately returns to normal Mac keyboard mode. The app sends `EXIT_CONFIG` right after the sync, without a delay.

### 4. Full live sync (`requestLiveSync`, `js/config-sync.js`)
- Every change goes through `markPendingSync`. When the connection (BLE preferred, else USB) belongs to the half of the change, `markPendingSync` calls `requestLiveSync(side)`, and the app sends the complete configuration with `writeConfigToESP32` (settings, layer names, all keys, combos, key pairs, macros). It never sends a single `SET_KEY`, `SET_NAME` or `SET_*` setting command. Reason: the device lost its layout during development; a full sync makes the device equal to the app after each change.
- Changes within `LIVE_SYNC_DEBOUNCE_MS` (300 ms) start one sync. A change during a running sync (`isAutoSyncing`) or BLE connection setup (`isConnectingBle`) starts the next sync after it (`LIVE_SYNC_RETRY_MS`). The sync clears only the changes it sent.
- "Rückgängig" and "Alle verwerfen" call `requestLiveSync(side, true)`: the app sends the restored state also without a pending change, because an earlier sync can already have sent the undone change.
- While the layout diff runs (`deviceSnapshotRead`, `diffFlowActive`), or when the connection ends before the sync starts, the live sync sends nothing and shows the pending hint; the changes stay pending for the next one-shot auto-sync, BLE connect or "Auf ESP32 speichern". A failed sync keeps the changes pending.
- NVS skips a write when the new value equals the stored value (also for blobs, ESP-IDF `Storage::writeItem`). So a live sync writes only the changed data, for example the `keymap` blob (672 bytes, about 23 entries) after a key change, and always `num_macros` (`saveMacrosToNVS` removes it first). The old `SET_KEY` also wrote all three key blobs, so a key change costs about the same as before. NVS spreads the writes over its 5 pages (wear leveling); about 24 entries per sync give about 2.6 million syncs at 100,000 erase cycles per page. Over USB the live sync also runs in keyboard mode.

---

## Idea Backlog Ranking (`docs/ideas.md`)

- The section "Rangliste" in `docs/ideas.md` is an unnumbered list. The top entry is the most important.
- Rate each new idea (benefit, effort) and insert it at its rank. Do not append it at the end.
- Follow the ranking rules at the top of `docs/ideas.md`.

## Code Review Rule: LOW Findings

- Fix each finding from a code review in the current work, `LOW` included. Add a regression test for each fix, and check that the test fails without the fix.
- Verify each finding against the code before you change it. Reject a finding with a short technical reason if the code does not confirm it.
- Record a finding in `docs/ideas.md`, section "Offene LOW-Befunde aus Code-Reviews", only if the user defers it explicitly. Hardware checks that need the physical keyboard also go there.
- Write each entry with file and line, the problem, the consequence and the recommended correction.
- A review cycle counts as clean when no `BLOCKER`, `HIGH` or `MEDIUM` finding remains. Fix the `LOW` findings of that last cycle too, but start no further cycle only for them. A `LOW` fix that changes code runs the relevant tests again.
- A change to the section "Offene LOW-Befunde aus Code-Reviews" alone needs no new review cycle.

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
   - Every command reports its result: `OK <CMD> ...` on success, otherwise `ERR BUSY <cmd>`, `ERR ARGS <cmd>`, `ERR NVS <CMD>`, or `ERR UNKNOWN <cmd>`. `SET_K` sends no `OK`, only `ERR`. The app treats a sync as successful only after `OK SAVE_NVS`, `OK SAVE_COMBOS` and `OK SAVE_PAIRS`, and clears only the pending changes that the sync transmitted. `SET_TAPPING_TERM` is optional in the full sync (`buildSettingCommands`): firmware without it answers `ERR UNKNOWN`, the app shows a flash hint and continues. The progress bar counts the steps with `countSyncSteps`.

   - Layout diff: the button "Auf ESP32 speichern" (`writeConfigWithDiff`, `js/config-sync.js`) first sends `GET_CONFIG` to the connected half. While this read runs, `captureDeviceSnapshotLine` takes the `LAYER_NAMES` / `*_DATA` / `CONFIG_SYNC_DONE` lines of that half into a snapshot and does not change the local config. `diffKeymap` (`js/config-model.js`) compares each physical key (tap, hold, double-tap as numeric codes) and each layer name; the dialog `#syncDiffModal` shows the result, and only "Übertragen" starts `writeConfigToESP32` with `expectedSide`; if the connection changed to the other half meanwhile, nothing is sent. Combos and key pairs are not in `GET_CONFIG` and are not compared. If the read fails (timeout 8 s), a confirmation asks whether to sync without a diff. After a timeout, late `GET_CONFIG` lines of that half are still discarded until `CONFIG_SYNC_DONE` or 30 s, so a late reply never overwrites the local config or clears pending changes. While the diff flow runs (`diffFlowActive`), a second click and "Vom ESP32 laden" do nothing; while late lines are discarded, a second click shows a hint. A BLE or USB disconnect ends a running read at once (`abortDeviceSnapshotReadIfDisconnected`). The One-Shot Auto-Sync skips the diff; it does not start while a read or the diff flow runs (`runAutoSync`).

2a. **BLE Command Authorization:**
   - In keyboard mode, BLE accepts only `GET_INFO`. Config mode is entered only through the physical `R4C5 + R0C0` combo or USB serial `ENTER_CONFIG`. The config characteristic is intentionally unauthenticated during the time-limited (3 min) config mode; this risk was explicitly accepted to preserve the macOS bonding design.
   - Macros raise the impact of this accepted risk: in config mode, a nearby BLE client can store a macro (up to 32 steps) on a key, for example a typed terminal command. Before macros, a client could only remap single keys and key pairs. The config mode stays time-limited (3 min) and starts only through the physical combo or USB.
   - ESP-NOW between the halves is unencrypted (accepted design for latency). The master executes HID operations from any sender with the left MAC `2E:BC:BB:81:61:B0`; a nearby transmitter that spoofs this MAC can inject keystrokes. `parseSplitHidPacket()` limits the impact to valid HID operations; ESP-NOW never carries config commands. In the other direction, a transmitter that spoofs the master MAC can keep the left half awake with `SPLIT_OP_ACTIVITY` (battery drain only, no HID effect). With `SPLIT_OP_LAYER_STATE`, a transmitter that spoofs either MAC can change the active layer of the other half (MO layers and toggles), so the following keys of that half send the actions of another layer. `isValidSplitLayerEvent()` and `isValidSplitMasterLayerEvent()` limit the packet to layer state; it carries no keycodes and no config commands. Likewise, a spoofed left MAC can keep the master awake with `SPLIT_OP_KEY_EVENT`, also without a Mac connection (battery drain and at most `SPLIT_KEY_EVENTS_PER_RX` serial lines per `loop()`, no HID effect). These risks are accepted with the same design.

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
   - `onMatrixKeyChange()` sends `MATRIX:{"r":..,"c":..,"pressed":0|1}` for each physical change, independent of layer, tap-hold and combo logic. It sends the line after the HID events of that change (`applyMatrixKeyChange`), so the serial output does not delay the key press. A key with action `0` also sends it; `KEY_PRESS` stays limited to keys with an action.
   - The firmware prints `MATRIX:` only on USB serial (`Serial.println`), never over BLE, also not in config mode: no keylogger channel and no extra BLE load next to the sync acks. The matrix test for keys with action `0` therefore needs USB; over BLE the matrix test still counts keys with an action through `KEY_PRESS`.
   - The app uses `MATRIX:` only for the matrix test (`parseMatrixLine`, `js/config-model.js`). `KEY_PRESS` and `SPLIT_KEY` still mark keys in the matrix test too; marking is idempotent, so the count stays correct. Live monitor and heatmap keep using `KEY_PRESS`. Left keys reach the master's USB as `SPLIT_KEY:`, which also covers keys with action `0`. While the left half itself is connected (BLE or USB), the app ignores `SPLIT_KEY`, because that half reports its keys directly (no double count in heatmap and statistics).

4. **Live Monitor Layer Filtering:**
   - Visual keypress indicators in the configurator must compare `pressedLayer` with `activeLayerIndex`. Keys pressed on a different layer must not highlight keycaps on the currently viewed layer.
   - Browser key events (`js/keyboard-hooks.js`) carry no half, because macOS sees both halves as one keyboard. The split view resolves the code in each half with that half's config, the held layer of both halves (`getSharedHeldLayer`, highest MO layer wins, like the firmware) and that half's scancode table (`resolveKeyForSide`, `browserKeySides`). A code that exists on both halves (for example `Space`) highlights on both. The single view resolves only the edited half. Combo alerts follow the same rule. USB `KEY_PRESS` lines carry their half and are not affected.

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
