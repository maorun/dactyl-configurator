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

### Combos per layer

- **Rank:** Feature model. Total 25/40 (typing 5, configuration 5, harmony 8, safety 7). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h` (`KeyCombo`), `firmware/dactyl_right/DactylLogic.h` (`isComboCandidateKey`, `getActiveLayer`), `firmware/dactyl_right/DactylVersion.h`, `server.py`, `js/editor.js` (combo table), `js/config-model.js` (`lintLayouts`).
- **Problem:** A combo acts on every layer. Two keys that form a combo on the base layer also buffer their keys on the number layer or the gaming layer, so these keys get the combo delay there too.
- **Goal:** Add a layer mask per combo (8 bits, default all layers). `isComboCandidateKey` checks the mask against the active layer, so a key outside the mask sends at once. Store the mask in a new NVS combo format. Keep the old 6-byte format readable. Extend `ADD_COMBO` and `COMBO_DATA` with an optional value. Increase `DACTYL_FW_VERSION`.
- **Dependency:** "Three-key combos with their own window" also changes the combo format. Define one new NVS format for both entries.
- **Acceptance test:** A firmware test shows that a combo with the mask of layer 0 triggers on layer 0 and that its keys send without delay on layer 2. A test loads the old NVS format with the mask of all layers.

### Tapping term per key

- **Rank:** Feature model. Total 24/40 (typing 7, configuration 4, harmony 7, safety 6). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (Mod-Tap and Tap-Dance timing), `firmware/dactyl_right/DactylVersion.h`, `server.py`, `js/editor.js` (inspector), `js/config-sync.js`, `js/config-model.js`.
- **Problem:** `tappingTermMs` applies to all keys of a half. Home row mods on the ring finger and the little finger need a longer term than a thumb key. One value causes wrong holds or slow taps.
- **Goal:** Add an optional tapping term per key (100..500 ms, `0` = the value of the half). The inspector shows the field next to the hold action. Store the values in a new NVS key; a missing key keeps the current behavior. Add a command for the full sync and the `GET_CONFIG` output. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test shows that a key with 300 ms stays a tap at 250 ms, while a key without its own value resolves as hold. A server test checks the rendering and the value range.

### Host LED state and Caps Lock indicator

- **Rank:** Feature model. Total 23/40 (typing 5, configuration 4, harmony 6, safety 8). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylBleComposite.h` (`onWrite`, output report `KEYBOARD_ID`), `firmware/dactyl_right/dactyl_right.ino` (GPIO 22, onboard LED), `firmware/dactyl_right/DactylLogic.h` (`DEVICE_INFO`), `js/serial.js`, `index.html`.
- **Problem:** The HID descriptor declares the keyboard LED output report, but `onWrite` ignores it. The user cannot see the Caps Lock state on the keyboard or in the app.
- **Goal:** Read the LED bits (Num Lock, Caps Lock, Scroll Lock) in `onWrite`. Print each change on USB serial as `HOST_LEDS:{"caps":0|1,...}` and add the field to `DEVICE_INFO`. Add a setting (default off) that lights the onboard LED while Caps Lock is on. The app shows a Caps Lock pill in the header.
- **Acceptance test:** A firmware test feeds an output report to the callback and checks the stored state and the serial line. An app test parses the line.


### Hold only after a typing pause

- **Rank:** Feature model. Total 22/40 (typing 7, configuration 2, harmony 7, safety 6). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (tap/hold resolution, `holdTapMode`), `firmware/dactyl_right/DactylSplitHid.h` (`SPLIT_OP_HOLD_PENDING`), `firmware/dactyl_right/DactylVersion.h`, `server.py`, `js/editor.js`.
- **Problem:** Home row mods give wrong modifiers during fast typing, because a rolled key press resolves a Mod-Tap key as hold.
- **Goal:** Add a setting per half `requirePriorIdleMs` (0..500 ms, default 0 = off). A Mod-Tap key that is pressed less than this time after the last key press of either half resolves as tap at once. The last key press of the other half comes from the split events that already arrive. Layer-Tap keys with `MO_n` keep their behavior.
- **Acceptance test:** A firmware test presses a key and then a Mod-Tap key within the time and expects the tap. A test with a longer pause expects the normal hold decision. A test with a key of the other half also expects the tap.

### Finger load analysis

- **Rank:** Feature model. Total 22/40 (typing 2, configuration 5, harmony 6, safety 9). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js` (`recordKeyPress`, `heatmapCounts`), `js/heatmap.js`, `js/matrix-constants.js`, `index.html`, `tests/test_app_logic.js`.
- **Problem:** The heatmap shows the presses per key. It does not show the load per finger or the keys that one finger types twice in a row.
- **Goal:** Assign each column of both halves to a finger in the side profile. Show the press share per finger and per half next to the heatmap. Count same-finger sequences (two different keys of one finger in a row) and list the five most frequent pairs. Store the counters with the typing statistics.
- **Acceptance test:** A test feeds key presses and checks the finger shares, the same-finger count and the storage format. A test checks that an older stored statistic still loads.

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
- **Goal:** Add an optional third key and an optional window per combo (`0` = `comboTimeoutMs`). Keep the old 6-byte NVS format readable; store the new format under a new NVS key. Extend `ADD_COMBO` and `COMBO_DATA` with optional values. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test triggers a three-key combo only when all three keys arrive within the window of that combo. A test loads the old NVS format without data loss.

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

### Auto Shift

- **Rank:** Feature model. Total 18/40 (typing 5, configuration 2, harmony 6, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (tap/hold resolution), `firmware/dactyl_right/DactylVersion.h`, `server.py` (`[[[START_SETTINGS]]]`), `js/editor.js`.
- **Problem:** `Shift` on a little finger or on a Mod-Tap key causes strain and timing errors.
- **Goal:** Add a setting per half (default off) and a timeout (default 175 ms). A letter, digit or symbol key without a hold action sends its shifted character when the user holds it longer than the timeout. Keys with a hold action, modifiers and layer keys stay unchanged. Caps Word and One-Shot `Shift` keep their behavior.
- **Acceptance test:** A firmware test checks a short tap (`a`), a long hold (`A`), a key with a hold action (no Auto Shift) and the character order during a fast roll.

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
