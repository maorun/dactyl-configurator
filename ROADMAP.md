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

### Combo and leader preset templates (`COMBO_PRESETS`, `LEADER_PRESETS`)

- **Rank:** Feature model. Total 27/40 (typing 5, configuration 7, harmony 8, safety 7). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor-events.js`, `js/leader-ui.js`.
- **Problem:** Users must configure common combos and leader sequences manually key by key.
- **Goal:** Add preset selectors in the combo and leader editors (`COMBO_PRESETS`, `LEADER_PRESETS`, `applyComboPreset`, `applyLeaderPreset`). Selecting a template inserts the combo or leader sequence as a pending change when a slot is free and the keys do not duplicate an existing entry.
- **Acceptance test:** A unit test applies each combo and leader preset to an empty configuration and expects valid entries; a duplicate preset is rejected.

### Per-key tapping term suggestions in the timing assistant (`computePerKeyTimingSuggestions`)

- **Rank:** Feature model. Total 26/40 (typing 5, configuration 6, harmony 7, safety 8). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor-events.js`.
- **Problem:** A global `tappingTermMs` is too short for slow fingers and too long for fast home-row keys.
- **Goal:** Extend the timing assistant with `computePerKeyTimingSuggestions(samples, config, profile)`. List Mod-Tap and Layer-Tap keys whose p95 hold time differs by at least 25 ms from `tappingTermMs` and add a button to apply the recommended per-key `tappingTerm` values as a pending change.
- **Acceptance test:** A unit test feeds hold samples for two Mod-Tap keys and expects a per-key recommendation only for the outlier key.

### Layer swap and move with reference updates (`swapLayersWithRefs`)

- **Rank:** Feature model. Total 26/40 (typing 3, configuration 7, harmony 8, safety 8). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor-events.js`.
- **Problem:** Swapping two layers leaves `MO_n`, `TG_n`, `OSL_n`, `triLayers`, `bootLayer`, `numWordLayer`, combo `layerMask` and key override `layerMask` pointing to the old layer indices.
- **Goal:** Update the layer swap tool (`swapLayersWithRefs(config, layerA, layerB)`) so that swapping layer A and layer B also swaps all references to A and B in key actions, combo actions, combo layer masks, key override layer masks, `triLayers`, `bootLayer` and `numWordLayer`.
- **Acceptance test:** A unit test swaps layer 1 and layer 2 in a configuration with `MO_1`, `triLayers`, `bootLayer = 1` and a layer mask, and expects all references updated to layer 2; swapping twice restores the original configuration.

## Priority 3

### Live status pills for active keyboard modes (`MODE_STATE`)

- **Rank:** Feature model. Total 25/40 (typing 4, configuration 6, harmony 7, safety 8). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `js/side-routing.js`, `js/serial.js`, `index.html`.
- **Problem:** The user cannot see in the app whether `Caps Word`, `Num Word`, `Sentence Case`, `Swap Hands` or `Keep Awake` is currently active on the keyboard.
- **Goal:** Print `MODE_STATE:{"cw":0|1,"nw":0|1,"sc":0|1,"sh":0|1,"ka":0|1}` on USB serial of the master when a mode changes and on `GET_INFO` (never over BLE). Show active modes as pills in the app header and clear them on disconnect.
- **Acceptance test:** A firmware test toggles `Caps Word` and `Keep Awake` and expects the matching `MODE_STATE:` line; a JS test parses the line and updates the state.

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
