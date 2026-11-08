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
