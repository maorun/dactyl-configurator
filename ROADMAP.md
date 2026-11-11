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

### Keypress counter reset and export (`resetKeyPressStats`, `exportKeyPressStatsJson`)

- **Rank:** Feature model. Total 26/40 (typing 4, configuration 8, harmony 7, safety 7). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/diagnostics-ui.js`, `js/storage.js`, `index.html`.
- **Problem:** Typing heatmap data accumulates indefinitely in `localStorage`. Users cannot reset counters between layout tests or export historical raw counts.
- **Goal:** Add buttons "Zähler zurücksetzen" (with confirmation dialog) and "Statistik als JSON exportieren" in the diagnostics view.
- **Acceptance test:** An app test simulates 50 key presses, exports valid JSON containing side/layer/row/col counts, resets the data and verifies all counts return to zero.

## Priority 3

### Strict modifier matching in Key Overrides (`overrideStrictMods`)

- **Rank:** Feature model. Total 25/40 (typing 6, configuration 6, harmony 6, safety 7). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylKeyOverride.h`, `js/key-overrides-ui.js`.
- **Problem:** Key overrides match even when unlisted modifiers are held (e.g. `Ctrl + Shift + Backspace`), triggering unwanted overrides on complex shortcuts.
- **Goal:** Add an optional `strict` boolean flag to key override definitions. When set, the override only fires if no extra modifiers outside `mods` are pressed.
- **Acceptance test:** A firmware test configures a strict `Shift + Backspace` override and verifies that `Ctrl + Shift + Backspace` does not activate the override.

### Firmware Git commit hash in GET_INFO (`fw_commit`)

- **Rank:** Maintenance model. Total 23/40 (reach 7, safety 6, speed 5, unblocks 5). Effort S. Estimate.
- **Area:** Firmware, App, Tooling.
- **Code:** `firmware/dactyl_right/dactyl_right.ino`, `firmware/dactyl_right/DactylVersion.h`, `server.py`, `js/serial.js`.
- **Problem:** `DEVICE_INFO` outputs an integer firmware number (`fw: 49`). Maintainers cannot determine the exact Git commit of flashed boards.
- **Goal:** Inject the Git short commit hash into `DactylVersion.h` during build and report `githash` in `DEVICE_INFO` and the diagnosis panel.
- **Acceptance test:** Compiling firmware generates a valid commit macro; `GET_INFO` output contains `githash:"<hash>"`.

### Interactive typing speed monitor in App (`wpmCounter`)

- **Rank:** Feature model. Total 22/40 (typing 5, configuration 5, harmony 6, safety 6). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/side-routing.js`, `js/editor.js`, `index.html`.
- **Problem:** The app receives keypress events over USB serial for the heatmap, but provides no real-time typing speed feedback during practice.
- **Goal:** Add a rolling 10-second WPM calculator based on received serial keypress timestamps. Render a live WPM indicator in the application header.
- **Acceptance test:** An app unit test feeds 50 keystroke events across 6 seconds and expects a calculated WPM of 100 in the UI pill.

### Layer Lock timeout (`layerLockTimeoutMinutes`)

- **Rank:** Feature model. Total 21/40 (typing 5, configuration 5, harmony 6, safety 5). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylCommon.h`, `js/settings-ui.js`.
- **Problem:** Leaving a layer locked via `ACT_LAYER_LOCK` prevents normal typing if the user forgets to unlock it before returning to the computer.
- **Goal:** Add setting `layerLockTimeoutMinutes` (0 = disabled, 1..60 min). If no keys are pressed for the specified interval, layer lock releases automatically.
- **Acceptance test:** A firmware test activates layer lock, advances time past `layerLockTimeoutMinutes` without key presses, and expects layer 0 restored.

### Dynamic macro persistent slot save (`ACT_DM_SAVE`)

- **Rank:** Feature model. Total 21/40 (typing 5, configuration 5, harmony 6, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylDynamicMacro.h`, `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `server.py`.
- **Problem:** Dynamic macros recorded via `ACT_DM_REC` are stored only in RAM and are lost on deep sleep or board reset.
- **Goal:** Add action `ACT_DM_SAVE` (`0x19B`). Pressing it persists the dynamic macro buffer into macro slot 0 in NVS, surviving reboots.
- **Acceptance test:** A firmware test records a sequence via `DM_REC`, executes `DM_SAVE`, reloads macros from NVS and expects the saved macro in slot 0.

## Priority 4

### Leader sequence timeout indicator in App (`MODE_STATE: "ld"`)

- **Rank:** Feature model. Total 20/40 (typing 4, configuration 5, harmony 6, safety 5). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `js/serial.js`, `index.html`.
- **Problem:** After pressing `LEADER`, the user has no visual feedback indicating whether the leader window is active or timed out.
- **Goal:** Add `ld` (leader state: 0 = idle, 1..4 = number of keys gathered) to `MODE_STATE`. Show a temporary "Leader..." pill in the app header while awaiting sequence keys.
- **Acceptance test:** A firmware test presses `LEADER` and expects `MODE_STATE` with `"ld":1`, followed by `"ld":0` on timeout expiration.

### Macro single-step execution and debugger in App (`debugMacroStep`)

- **Rank:** Feature model. Total 19/40 (typing 3, configuration 6, harmony 5, safety 5). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/macros-ui.js`, `js/serial.js`, `index.html`.
- **Problem:** Diagnosing modifier leaks or timing errors in complex macros requires full-speed execution against a host text editor.
- **Goal:** Add a "Schrittweise testen" button in the macro editor to execute steps one at a time over USB serial while highlighting the active step in the UI.
- **Acceptance test:** An app test runs single-step execution through a 5-step macro, verifying that each step sends its exact HID command and updates UI step pointers.

### Combo latency and stagger timing assistant (`comboStaggerAnalyzer`)

- **Rank:** Feature model. Total 18/40 (typing 4, configuration 5, harmony 5, safety 4). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/diagnostics-ui.js`, `js/config-model.js`.
- **Problem:** Setting `comboTimeoutMs` is guesswork without measuring the user's natural finger stagger between chorded keys.
- **Goal:** Measure time intervals between consecutive keypresses during diagnostic test typing and suggest a personalized `comboTimeoutMs`.
- **Acceptance test:** An app test feeds simulated chord keystroke timestamps and verifies a recommended timeout based on the 95th percentile delta.

### Cross-half bilateral combos (`bilateralCombos`)

- **Rank:** Feature model. Total 17/40 (typing 5, configuration 3, harmony 4, safety 5). Effort L. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylSplitHid.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylCommon.h`, `js/combos-ui.js`.
- **Problem:** Combos only execute when all pressed keys reside on the same keyboard half.
- **Goal:** Allow combos that combine one key from the left half and one key from the right half (`side1`, `side2`). The master collects candidate key presses across the split link within `comboTimeoutMs` before resolving the combo action.
- **Acceptance test:** A firmware test presses a key on the left half and a key on the right half within the combo window and expects the combined action.

### BLE connection RSSI signal strength monitoring (`bleRssiMonitor`)

- **Rank:** Feature model. Total 16/40 (typing 2, configuration 5, harmony 4, safety 5). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/dactyl_right.ino`, `js/serial.js`, `js/diagnostics-ui.js`.
- **Problem:** BLE signal degradation causes missed key packets without indicating radio interference or distance issues.
- **Goal:** Query the active BLE connection RSSI on the master half and emit `BLE_RSSI:<dBm>` over USB serial to show signal bars in the app.
- **Acceptance test:** A firmware test queries BLE RSSI when connected and emits formatted `BLE_RSSI:` output to the serial console.

## Priority 5

### Macro loop and repeat step (`MACRO_STEP_REPEAT`)

- **Rank:** Feature model. Total 15/40 (typing 3, configuration 4, harmony 4, safety 4). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `js/macros-ui.js`, `server.py`.
- **Problem:** Repeating identical step patterns rapidly exhausts the 32-step limit in NVS macro storage.
- **Goal:** Add macro step type `MACRO_STEP_REPEAT` (`type: 4, count: 1..10, stepsBack: 1..31`). The engine re-executes the preceding slice of steps without consuming extra storage slots.
- **Acceptance test:** A firmware test defines a 3-step sequence followed by `REPEAT(count=2, stepsBack=3)` and expects 9 total events sent to the host.

### One-Shot Layer double-tap latching (`OSL_DOUBLE_TAP_LOCK`)

- **Rank:** Feature model. Total 14/40 (typing 4, configuration 2, harmony 4, safety 4). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylOneShot.h`, `firmware/dactyl_right/DactylCommon.h`.
- **Problem:** Tapping an OSL key primes the layer for exactly one key press. Typing numbers or formulas requires holding the key or switching via a separate toggle.
- **Goal:** Tapping an OSL key twice within `tappingTermMs` locks the layer permanently until the next tap on that OSL key releases it.
- **Acceptance test:** A firmware test double-taps `OSL_1`, types three keys from layer 1, and verifies that all three keys resolve to layer 1 until a fourth tap releases the layer.

### Debounce algorithm selection (`eagerDebounceMode`)

- **Rank:** Feature model. Total 13/40 (typing 3, configuration 4, harmony 3, safety 3). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_left/DactylLeftLogic.h`, `js/settings-ui.js`, `js/config-sync.js`.
- **Problem:** The keyboard uses eager debouncing (instant press, delayed release). Users with switch chattering experience double-presses.
- **Goal:** Add a setting `debounceMode` (0 = eager, 1 = symmetric defer). Defer mode delays press detection by `debounceMs` to filter severe switch chatter.
- **Acceptance test:** A firmware test injects chatter pulses in defer mode and verifies that only a single stabilized press event reaches the HID stack.

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
