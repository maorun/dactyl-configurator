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

### Tap-Toggle layer keys (`ACT_TT_BASE`)

- **Rank:** Feature model. Total 32/40 (typing 8, configuration 7, harmony 8, safety 9). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylVersion.h`, `firmware/dactyl_left/dactyl_left.ino`, `js/keycodes.js`, `server.py`.
- **Problem:** The user must assign two separate keys (`MO_n` and `TG_n`) to use a layer momentarily for single keys and persistently for longer typing.
- **Goal:** Add Tap-Toggle layer actions `TT_0` to `TT_7` (`0x193` .. `0x19A`). Holding the key activates the layer momentarily (`MO_n`). Tapping the key two times quickly toggles the layer on or off like `TG_n`. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test holds `TT_1`, verifies that layer 1 is active, releases it and expects layer 0; then taps `TT_1` twice quickly and expects layer 1 toggled on until another tap turns it off.

### Auto-mouse layer (`autoMouseLayer`, `mouseTimeoutMs`)

- **Rank:** Feature model. Total 30/40 (typing 7, configuration 7, harmony 8, safety 8). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/dactyl_right.ino`, `firmware/dactyl_left/dactyl_left.ino`, `js/config-sync.js`, `js/settings-ui.js`.
- **Problem:** Mouse navigation on a split keyboard requires dedicating a thumb key to hold a momentary layer while operating mouse movement and wheel keys.
- **Goal:** Add `autoMouseLayer` (`0..7`, disabled when `0xFF`) and `mouseTimeoutMs` (100..2000 ms, default 500 ms) in settings. Any mouse action (`ACT_MOUSE_UP`, wheel, buttons) activates `autoMouseLayer`. After `mouseTimeoutMs` without mouse input, the layer deactivates automatically.
- **Acceptance test:** A firmware test triggers mouse movement, verifies that `autoMouseLayer` activates, advances the clock past `mouseTimeoutMs` and expects the layer to deactivate.

### Matrix diagnostics and solder tester (`MATRIX_TEST_MODE`)

- **Rank:** Feature model. Total 29/40 (typing 4, configuration 9, harmony 7, safety 9). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/dactyl_right.ino`, `firmware/dactyl_left/dactyl_left.ino`, `firmware/dactyl_right/DactylCommon.h`, `js/serial.js`, `js/diagnostics-ui.js`, `index.html`.
- **Problem:** Hardware faults such as cold solder joints, damaged switches or diode shorts are difficult to isolate without external instruments.
- **Goal:** Add a serial command `TEST_MATRIX 1|0`. In test mode, both halves stream switch changes as `MATRIX_RAW:<side>,<row>,<col>,<down>`. The app diagnostic panel highlights pressed switches on a physical switch grid for both halves.
- **Acceptance test:** A firmware test enables test mode, simulates physical key press and release, and expects formatted `MATRIX_RAW:` lines; an app test parses the lines and updates switch highlight states.

### Layer Lock live status pill (`MODE_STATE`)

- **Rank:** Feature model. Total 27/40 (typing 5, configuration 6, harmony 8, safety 8). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `js/serial.js`, `js/side-routing.js`, `index.html`.
- **Problem:** When `ACT_LAYER_LOCK` is active, the app header shows no status pill, unlike `Caps Word`, `Num Word` and `Swap Hands`.
- **Goal:** Add `ll` (layer lock active flag, 0 or 1) and `lli` (locked layer index, 0..7) to `MODE_STATE`. Show a status pill "Layer Lock (Ebene N)" in `#modeStatePills` while a layer is locked and remove it when layer lock is cleared.
- **Acceptance test:** A firmware test locks layer 2 and expects `MODE_STATE` with `"ll":1,"lli":2`; an app test renders the status pill with the locked layer number.

## Priority 3

### Cross-half bilateral combos (`bilateralCombos`)

- **Rank:** Feature model. Total 24/40 (typing 7, configuration 5, harmony 6, safety 6). Effort L. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylSplitHid.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylCommon.h`, `js/combos-ui.js`.
- **Problem:** Combos only execute when all pressed keys reside on the same keyboard half.
- **Goal:** Allow combos that combine one key from the left half and one key from the right half (`side1`, `side2`). The master collects candidate key presses across the split link within `comboTimeoutMs` before resolving the combo action.
- **Acceptance test:** A firmware test presses a key on the left half and a key on the right half within the combo window and expects the combined action.

## Priority 4

No open entry.

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
