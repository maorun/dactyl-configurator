# Roadmap

This file lists the open work for the Dactyl Configurator, the firmware of both halves and the desktop app.
The list uses priorities. Priority 1 is the highest priority.
Do the work in priority order, unless the maintainer gives a different order.

Rules for this file:

- Write in ASD-STE100 Simplified Technical English.
- Add one entry for each open item. Do not give an entry a status. Each entry in this file is open.
- Remove an entry in the pull request that completes it. Describe the finished feature in `FEATURES.md`.
- Each entry names the code location, the goal and the acceptance test.
- Each entry has a `Rank` line with the model, the total score, the four single scores and the effort size. See "Rules for ranking".
- Put each entry in the priority that matches its total score. Order the entries inside a priority by total score, highest first. For equal scores, put the smaller effort first. Put a dependency above the entry that needs it.
- Priority 1 is the exception. It holds faults that disturb the daily typing and has no score band.
- Do not record review findings in this file, also not `LOW` findings. Do not record hardware checks here. Name them in the final report and in the pull request description (see `AGENTS.md`).

## Priority 1: Faults that disturb daily typing

## Priority 2

## Priority 3

### Alternate repeat (`ALT_REPEAT`)

- **Rank:** Feature model. Total 22/40 (typing 5, configuration 2, harmony 8, safety 7). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h` (new action code), `firmware/dactyl_right/DactylLogic.h` (`lastRepeatAction`, `repeatPress`), `firmware/dactyl_right/DactylSplitHid.h` (`SPLIT_OP_REPEAT`, `SPLIT_OP_REPEAT_RUN`), `firmware/dactyl_left/DactylLeftLogic.h` (`LeftRepeatLink`), `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** `REPEAT` runs the last action again. A user who moves too far with an arrow key, or deletes too much, must reach for the opposite key.
- **Goal:** Add the action `ALT_REPEAT`. It runs the opposite of the last action: Left and Right, Up and Down, Page Up and Page Down, Home and End, Backspace and Delete, wheel up and wheel down, volume up and volume down, next and previous track. A pure function `altRepeatAction(code)` holds the table and returns `0` for an action without an opposite; then the key sends nothing. Held modifiers stay applied, so `Cmd` + `ALT_REPEAT` after `Left` gives `Cmd` + `Right`. The action works across both halves like `REPEAT`, with a flag in the repeat operations. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test checks each pair of the table in both directions, an action without an opposite and an `ALT_REPEAT` on the left half after a right key.

### Read the complete configuration from the device

- **Rank:** Feature model. Total 22/40 (typing 0, configuration 8, harmony 8, safety 6). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/config-sync.js` (`readConfigFromESP32`, `captureDeviceSnapshotLine`), `js/config-model.js` (`captureListLine`), `index.html`, `tests/test_app_logic.js`.
- **Problem:** "Vom ESP32 laden" takes only the key matrices and the layer names. `GET_CONFIG` also sends combos, key pairs, key overrides and macros, but the app ignores them. A user who lost the local config cannot get the complete layout back.
- **Goal:** Build a complete config from the `GET_CONFIG` snapshot of the half, including the settings from `DEVICE_INFO`. Show the layout diff against the local config. After a confirmation, apply it as a snapshot pending change with the flags `pairs` and `macros`, like an import. A snapshot with an invalid line applies nothing.
- **Acceptance test:** A test feeds a complete `GET_CONFIG` output and expects the same config as the source. A test with an invalid list line expects no change.

### Three-key combos with their own window

- **Rank:** Feature model. Total 21/40 (typing 5, configuration 4, harmony 7, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h` (`KeyCombo`, `MAX_COMBOS`), `firmware/dactyl_right/DactylLogic.h` (`isComboCandidateKey`, combo buffer), `firmware/dactyl_right/DactylVersion.h`, `server.py`, `js/editor.js` (combo table), `js/config-model.js`.
- **Problem:** A combo has exactly two keys and uses the global `comboTimeoutMs`. Fast typists need a short window for combos on letter keys and a longer window for combos on thumb keys.
- **Goal:** Add an optional third key and an optional window per combo (`0` = `comboTimeoutMs`). Use the `combos_v2` NVS format (see `FEATURES.md`, "Combos per layer"): it has reserved fields for the third key (`r3`, `c3`) and the window, so no new format is needed. Keep the old 8-byte `combos_data` format readable. Extend `ADD_COMBO` and `COMBO_DATA` with optional values after the layer mask. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test triggers a three-key combo only when all three keys arrive within the window of that combo. A test loads the old NVS format without data loss.

### Record macros on the keyboard (`DM_REC`, `DM_PLAY`)

- **Rank:** Feature model. Total 21/40 (typing 5, configuration 4, harmony 7, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h` (new action codes, `MACRO_STEP_DOWN`, `MACRO_STEP_UP`, `MAX_MACRO_STEPS`), `firmware/dactyl_right/DactylLogic.h` (macro engine), `firmware/dactyl_right/DactylSplitHid.h`, `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** A macro needs the app and a sync. A user who repeats an edit many times, for example in a text file, cannot record it during the work.
- **Goal:** Add the actions `DM_REC` and `DM_PLAY` for one slot on the master. `DM_REC` starts and stops the recording of the key presses and releases of both halves (the master already runs the left key events). The recording holds up to `MAX_MACRO_STEPS` steps and stops at the limit. `DM_PLAY` runs it with the macro engine. The recording stays in RAM only: a restart, deep sleep and config mode clear it, and `GET_CONFIG` does not send it, because it can hold a password. The app shows the recording state from a USB serial line. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test records a key sequence of both halves and checks the steps, the stop at the limit and the playback. A test checks that `DM_REC` and `DM_PLAY` are not recorded and that a restart clears the slot.

## Priority 4

### Leader key (`LEADER`)

- **Rank:** Feature model. Total 20/40 (typing 6, configuration 3, harmony 6, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `server.py`, `js/keycodes.js`, new module `js/leader-ui.js`.
- **Problem:** Rare actions, for example a macro or a media key, use a key position or a combo. The positions and combos are limited.
- **Goal:** Add the action `LEADER`. After it, the firmware collects up to four keys within a timeout (default 1000 ms). A matching sequence runs its action (keyboard code, key pair or macro); no match sends nothing. The list holds up to 16 sequences per half. Keys in a sequence send no HID event. Add commands, NVS keys and a `GET_CONFIG` block like the key pairs. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test checks a match, a timeout, a sequence without a match and the release of all keys after the sequence.

### Eager debounce per key

- **Rank:** Feature model. Total 20/40 (typing 7, configuration 2, harmony 5, safety 6). Effort M. Estimate.
- **Area:** Firmware.
- **Code:** `firmware/dactyl_right/dactyl_right.ino` (`loop()`, `delay(debounceMs)`), `firmware/dactyl_left/dactyl_left.ino`, `firmware/dactyl_right/DactylLogic.h` (`debounceMs`).
- **Problem:** The loop waits `debounceMs` (5 ms) after each scan for all keys. This adds latency to each key press, and a switch that bounces longer than one pass can still send a double press.
- **Goal:** Replace the global delay with a debounce state per key: a press is sent at once (eager), and changes of that key are ignored for `debounceMs`. A release is sent after the key stays open for `debounceMs`. The scan rate in standby stays unchanged.
- **Acceptance test:** A firmware test feeds bouncing matrix samples and expects one press and one release. A test checks that the press is sent in the first pass.

### Key lock (`KEY_LOCK`)

- **Rank:** Feature model. Total 19/40 (typing 4, configuration 2, harmony 7, safety 6). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h` (new action code), `firmware/dactyl_right/DactylLogic.h` (action dispatch, key release), `firmware/dactyl_right/DactylBleComposite.h` (`releaseAll`), `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** A long drag with a mouse button key, a held `Shift` for a selection or a held game key needs a finger for the whole time.
- **Goal:** Add the action `KEY_LOCK`. After it, the next key press of either half stays held after the release of the key. A second press of the same key releases it. Layer keys, `KEY_LOCK` itself and macros are not locked. `RELEASE_ALL`, a link timeout, a host loss, standby and config mode release each locked key. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test presses `KEY_LOCK`, then a mouse button key, releases it and expects the button still held; a second press releases it. A test checks the release after a link timeout and that a layer key is not locked.

### Horizontal scroll and held wheel keys

- **Rank:** Feature model. Total 18/40 (typing 4, configuration 2, harmony 7, safety 5). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylHidDescriptor.h` (mouse report), `firmware/dactyl_right/DactylBleComposite.h` (`sendMouseReport`), `firmware/dactyl_right/DactylLogic.h` (`ACT_MOUSE_WHEEL_UP`, `ACT_MOUSE_WHEEL_DOWN`, `MOUSE_MOVE_INTERVAL_MS`), `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** The mouse keys scroll only up and down, and each press gives one wheel step. A long page needs many presses, and wide tables cannot scroll sideways.
- **Goal:** Add the actions `MOUSE_WHEEL_LEFT` and `MOUSE_WHEEL_RIGHT` with the usage AC Pan (`0x0238`, Consumer page) in the mouse report. A held wheel key repeats its step with an acceleration, like the mouse movement. Increase `DACTYL_FW_VERSION`.
- **Risk:** The report map changes. macOS caches the report map per address (see "macOS Bluetooth GATT Report Map Caching" in `AGENTS.md`). The pull request must describe the steps to pair again.
- **Dependency:** "macOS system keys" also changes the report map. Do both changes in one pull request, so the user pairs again only once.
- **Acceptance test:** A firmware test checks the report descriptor and the report bytes for each wheel direction. A test holds a wheel key and checks the repeat and the acceleration.

### Auto Shift

- **Rank:** Feature model. Total 18/40 (typing 5, configuration 2, harmony 6, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (tap/hold resolution), `firmware/dactyl_right/DactylVersion.h`, `server.py` (`[[[START_SETTINGS]]]`), `js/editor.js`.
- **Problem:** `Shift` on a little finger or on a Mod-Tap key causes strain and timing errors.
- **Goal:** Add a setting per half (default off) and a timeout (default 175 ms). A letter, digit or symbol key without a hold action sends its shifted character when the user holds it longer than the timeout. Keys with a hold action, modifiers and layer keys stay unchanged. Caps Word and One-Shot `Shift` keep their behavior.
- **Acceptance test:** A firmware test checks a short tap (`a`), a long hold (`A`), a key with a hold action (no Auto Shift) and the character order during a fast roll.

### macOS system keys

- **Rank:** Feature model. Total 17/40 (typing 5, configuration 1, harmony 6, safety 5). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylHidDescriptor.h` (Consumer report, `MEDIA_KEYS_ID`), `firmware/dactyl_right/DactylBleComposite.h` (`MediaKeyReport`), `firmware/dactyl_right/DactylCommon.h` (media action codes), `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** The Consumer report has 16 bits, and all 16 usages are assigned. The keyboard cannot send display brightness, Mission Control or Launchpad.
- **Goal:** Make the Consumer report 24 bits wide. Add the actions for Brightness Up (`0x006F`), Brightness Down (`0x0070`), Mission Control (AC Desktop Show All Windows, `0x029F`) and Launchpad (AC Desktop Show All Applications, `0x02A2`). Key pairs and macros accept the new codes. Increase `DACTYL_FW_VERSION`.
- **Risk:** The report map changes. macOS caches the report map per address (see "macOS Bluetooth GATT Report Map Caching" in `AGENTS.md`). The pull request must describe the steps to pair again.
- **Dependency:** "Horizontal scroll and held wheel keys" also changes the report map. Do both changes in one pull request.
- **Acceptance test:** A firmware test checks the report descriptor, the report length and the bit of each new action. A test checks that the existing media keys keep their bits.

### BLE host slots

- **Rank:** Feature model. Total 16/40 (typing 6, configuration 3, harmony 4, safety 3). Effort L. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylBleComposite.h`, `firmware/dactyl_right/dactyl_right.ino` (BLE address, advertising), `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `js/keycodes.js`.
- **Problem:** The master bonds to one host. A user with a second Mac or an iPad must forget and pair the keyboard again for each change.
- **Goal:** Add up to three host slots. Each slot uses its own static random BLE address and its own bond. The actions `HOST_1` .. `HOST_3` switch the slot; the active slot is stored in NVS. The config mode keeps its own address. The app shows the active slot.
- **Risk:** macOS caches the report map per address (see "macOS Bluetooth GATT Report Map Caching" in `AGENTS.md`). A wrong address change can break the current bond.
- **Acceptance test:** A firmware test checks the address per slot, the NVS persistence and the release of all keys before a slot change.

## Priority 5

No open entry.

## Deferred

The entry below is outside the priorities. It needs a hardware change first.

### Real LiPo voltage measurement

- **Rank:** Feature model. Total 17/40 (typing 5, configuration 4, harmony 4, safety 4). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/dactyl_right.ino` (`BAT_SENSE`, GPIO 35), `firmware/dactyl_left/dactyl_left.ino` (`BAT_SENSE`, GPIO 35), `firmware/dactyl_right/DactylSplitHid.h`, `js/serial.js` (`updateBatteryUI`, disabled).
- **Problem:** The app shows no battery level for either half. Without it the keyboard stops without a warning.
- **Decision needed:** Build an external voltage divider on `BAT_SENSE` on both halves. The code does not start before this hardware change.
- **Hardware finding:** Both boards have no divider. A measurement confirmed this. The keyboard has no battery switch.
- **Hardware plan:** On both halves, solder R1 between LiPo `+` and a middle point. Solder R2 between the middle point and GND. Connect the middle point to GPIO 35. Take `+` and GND at the JST socket of each board.
  - Two equal resistors halve the voltage: 4.2 V gives 2.1 V, which is below the 3.3 V limit of the ADC. The firmware factor is 2.
  - 2 x 100 kOhm draw about 21 uA all the time. 2 x 470 kOhm draw about 4.5 uA; then add a 100 nF capacitor from the middle point to GND.
  - Without a switch, the divider also drains the battery in deep sleep. Prefer 470 kOhm.
  - Solder only with the battery disconnected. Check for a short between `+` and GND before the first connection. Check the middle point with a multimeter: maximum 2.1 V.
  - The ESP32 ADC is inaccurate (about 5 %). Calibrate each half with a multimeter. This is an open hardware check.
- **Goal:** Read `BAT_SENSE` on both halves, forward the left battery level over ESP-NOW to the master, set the BLE battery level and show the battery level of both halves in the app.
- **Acceptance test:** A firmware test maps ADC values to a battery level and verifies split forwarding. The app shows the battery level of both halves.

## Rules for ranking

Rate each entry with one of two models. Each model has four criteria. Each criterion has a value from 0 to 10. The total score is the sum, with a maximum of 40.
Both models use the same scale. Therefore, one priority table applies to both models.
Effort does not add to the total. Give the effort as a size: S (one small pull request), M (one large pull request), L (several pull requests).

**Feature model.** Use it for an entry that changes the firmware behavior or the app:

1. **Typing:** How much does the idea help the daily typing?
2. **Configuration:** How much does it help to configure the keyboard or to find a fault?
3. **Harmony:** How many existing features does the idea use or extend?
4. **Safety:** How small is the risk for the layout, the radio link and the security? 10 means no risk.

**Maintenance model.** Use it for an entry that changes code structure, tests or tooling. The entry has no direct effect on the keyboard:

1. **Reach:** How many modules or features gain from the change?
2. **Safety:** How many bugs or regressions does the change prevent or find?
3. **Speed:** How much does the change speed up the daily work of maintainers?
4. **Unblocks:** How many other entries need this entry or become cheaper after it?

If an entry fits neither model, add a model here first. Do not reinterpret the criteria of a model.

The mark `Estimate` means that the maintainer did not rate the entry. Replace the estimate when the maintainer rates the entry.

Put a new entry in the priority that matches its total score:

| Total score | Priority |
|---|---|
| 26 or more | 2 |
| 21 to 25 | 3 |
| 16 to 20 | 4 |
| below 16 | 5 |

An entry that waits for a hardware change goes to "Deferred", whatever its score.
