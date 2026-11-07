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

### Combo suggestions from frequent bigrams (`suggestCombos`)

- **Rank:** Feature model. Total 28/40 (typing 6, configuration 6, harmony 8, safety 8). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/heatmap.js`, `js/editor.js` (combo table).
- **Problem:** The user must find good combo pairs without data. The heatmap already counts same-finger pairs, but it does not count key pairs of different hands or fingers.
- **Goal:** Count the most frequent bigrams of two keys on the same half in `recordKeyPress`. Add `suggestCombos(stats, config, profile)`. It lists up to five pairs that no combo uses yet and whose two keys are adjacent. Add a button "Combo anlegen" that opens the combo dialog with the pair filled in.
- **Acceptance test:** A unit test gives statistics with the pair `t`/`h` as most frequent adjacent pair and expects it first; a pair that a combo already uses does not appear.

### Detect a stale layout on connect (`js/config-sync.js`)

- **Rank:** Feature model. Total 27/40 (typing 3, configuration 7, harmony 8, safety 9). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/config-sync.js` (`readConfigFromESP32`), `js/config-model.js`, `app.js`.
- **Problem:** The user can edit the layout on the device in another session. The app then shows an old layout, and the next sync overwrites the newer device layout without a warning.
- **Goal:** After each BLE or serial connect, read the configuration and compare it with the app state through the existing layout diff. When they differ and the app has no pending change, show a banner "Gerät weicht ab" with the buttons "Vom Gerät laden" and "Ignorieren". Do not start a sync on its own.
- **Acceptance test:** A unit test gives a device layout with one changed key and expects the banner state with one difference; equal layouts and a state with pending changes give no banner.

### Layer auto-return timeout (`layerTimeoutMs`)

- **Rank:** Feature model. Total 26/40 (typing 7, configuration 3, harmony 8, safety 8). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/config-model.js`, `js/editor-events.js`, `server.py`.
- **Problem:** A toggled layer (`TG_n`) stays on when the user forgets it. The next keys then send wrong characters.
- **Goal:** Add the setting `layerTimeoutMs` per half (`0` = off, `1000..60000`, default `0`; `SET_LAYER_TIMEOUT`, NVS key `layer_to`, `DEVICE_INFO` field `lt`). When no key of either half is pressed for this time, clear all toggled layers. Layer lock and `MO_n` are not affected. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test toggles layer 2, waits `layerTimeoutMs` without a key press and expects layer 0; a key press inside the time restarts the timer.

### Support report export (`buildSupportReport`)

- **Rank:** Feature model. Total 26/40 (typing 2, configuration 8, harmony 7, safety 9). Effort S. Estimate.
- **Area:** App, Server.
- **Code:** `js/serial.js`, `js/config-sync.js`, `js/config-model.js`, `server.py`.
- **Problem:** To report a fault, the user must copy `GET_INFO`, `GET_DIAG`, the split link state and the firmware versions by hand.
- **Goal:** Add the button "Diagnosebericht speichern". It collects `DEVICE_INFO`, `GET_DIAG`, `left_link`, `left_fw` and the app version into one JSON file. The report holds no keymap, no macro, no key pair and no key press data.
- **Acceptance test:** A unit test builds a report from sample data and expects all listed fields; a sample with a macro text and a keymap expects that the report contains neither.

### Macro library import and export (`buildMacroExport`, `js/macros-ui.js`)

- **Rank:** Feature model. Total 26/40 (typing 3, configuration 6, harmony 8, safety 9). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/macros-ui.js`, `js/config-model.js` (`parseConfigImport`).
- **Problem:** The user can move a whole configuration, but not a single macro. A good macro stays on one half.
- **Goal:** Add the buttons "Makro exportieren" and "Makro importieren" for one macro. The file holds the steps and the name. The import validates the steps with the existing macro limits and puts the macro into the first free slot as a pending change.
- **Acceptance test:** A unit test exports a macro, imports it into an empty config and expects equal steps; an import with more than 32 steps is rejected.

## Priority 3

### Send queue high-water mark in `GET_DIAG` (`DactylLeftLogic.h`)

- **Rank:** Feature model. Total 25/40 (typing 2, configuration 7, harmony 7, safety 9). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_left/DactylLeftLogic.h`, `firmware/dactyl_right/DactylLogic.h` (`GET_DIAG`), `firmware/dactyl_right/DactylVersion.h`, `js/serial.js`.
- **Problem:** The user cannot see if the left send queue nearly overflows. A lost key shows no cause.
- **Goal:** Count the highest fill level of the send queue and the number of dropped events since boot. Report both in `GET_DIAG` of the left half (`sq_max`, `sq_drop`) and show them in the diagnostics view. Keep the `DEVICE_INFO` line unchanged. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test queues events up to the limit plus one and expects `sq_max` equal to the limit and `sq_drop` equal to 1.

### Num Word (`ACT_NUM_WORD`)

- **Rank:** Feature model. Total 25/40 (typing 7, configuration 2, harmony 8, safety 8). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** Typing a number needs a held layer key or a toggle that the user must switch off again.
- **Goal:** Add the action `NUM_WORD` with a layer setting (`numWordLayer`, `0..7`). A tap turns the layer on. The layer turns off at the first key that is not a digit, a number symbol (`.`, `,`, `-`, `+`, `*`, `/`, `=`), a modifier or a layer key, or after 5000 ms without a key press. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test taps `NUM_WORD`, types `1`, `2`, `Space` and expects that `1` and `2` come from the layer and `Space` comes from layer 0.

### Tapping term tune keys (`TT_UP`, `TT_DOWN`)

- **Rank:** Feature model. Total 24/40 (typing 5, configuration 4, harmony 8, safety 7). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** The user must open the app to change `tappingTermMs`. A good value shows only during real typing.
- **Goal:** Add the actions `TT_UP` and `TT_DOWN`. Each tap changes `tappingTermMs` of its half by 10 ms inside `100..500` and keeps it in RAM. A long press of both keys saves the value to the NVS. A reboot without saving restores the stored value. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test taps `TT_UP` twice and expects `tappingTermMs` + 20; a reboot without the save restores the old value.

### Boot layer setting (`bootLayer`)

- **Rank:** Feature model. Total 23/40 (typing 5, configuration 3, harmony 7, safety 8). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/config-model.js`, `js/editor-events.js`, `server.py`.
- **Problem:** The keyboard always starts on layer 0. A user who works with a game or number layout must switch it after each wake-up.
- **Goal:** Add the setting `bootLayer` per half (`0..7`, default `0`; `SET_BOOT_LAYER`, NVS key `boot_layer`, `DEVICE_INFO` field `bl`). The firmware toggles this layer on at boot and after deep sleep. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test sets `bootLayer = 3`, restarts the logic and expects layer 3 for the next key press; `TG_0` clears it.

### Hold-tap flavor per key (`HOLDFLAVORMAP`)

- **Rank:** Feature model. Total 23/40 (typing 6, configuration 3, harmony 8, safety 6). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/config-model.js`, `js/editor.js`, `server.py`.
- **Problem:** `holdTapMode` applies to all Mod-Tap keys of a half. A home-row key and a thumb key need different decisions.
- **Goal:** Add a per-key override of `holdTapMode` (`0` = value of the half, `1..n` = fixed mode; `SET_KF`, a new NVS blob). Show the choice in the key inspector. Use one helper, `effectiveHoldMode()`, like `effectiveTapTerm()`. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test sets mode A on the half and mode B on one key, and expects that only this key resolves with mode B.

### Heatmap CSV export (`buildHeatmapCsv`)

- **Rank:** Feature model. Total 22/40 (typing 1, configuration 5, harmony 6, safety 10). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/heatmap.js`, `js/config-model.js`.
- **Problem:** The user cannot analyze the typing statistics in a spreadsheet or compare two weeks.
- **Goal:** Add the button "Als CSV speichern". The file has one row for each key (half, row, column, layer 0 label, total presses, presses for each layer, corrections). It holds no text, no time stamp of single presses and no sequence of keys.
- **Acceptance test:** A unit test builds a CSV from sample statistics and expects the header, one row for each counted key and the exact counts.

## Priority 4

### Keep-awake key (`ACT_KEEP_AWAKE`)

- **Rank:** Feature model. Total 19/40 (typing 3, configuration 1, harmony 6, safety 9). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `js/keycodes.js`, `server.py`.
- **Problem:** During a long video call or a read phase, the Mac goes to sleep because no input arrives.
- **Goal:** Add the toggle action `KEEP_AWAKE` on the master. While on, it sends a mouse move of one pixel and back every 60 s when the BLE link is up and the config mode is off. `RELEASE_ALL`, host loss, standby and a physical key press stop the timer or reset it. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test turns `KEEP_AWAKE` on, advances 60 s and expects two mouse reports with opposite steps; a standby clears the state.

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
