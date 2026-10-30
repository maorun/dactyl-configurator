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

### Mod-Tap decision across both halves

- **Rank:** Feature model. Total 25/40 (typing 8, configuration 3, harmony 9, safety 5). Effort L. Estimate.
- **Area:** Firmware (both halves).
- **Code:** `firmware/dactyl_right/DactylLogic.h` (`resolvePendingTapHoldsAsHold`), `firmware/dactyl_right/DactylSplitHid.h` (`SplitLocalDefer`), `firmware/dactyl_left/DactylLeftLogic.h`.
- **Problem:** A key press of the other half does not decide an open Mod-Tap key as hold. Example: the right `R5C0` holds `MO_1` and a left key follows within the tapping term. The right half then sends its tap action (`Delete`) and the left key acts on layer 0.
- **Goal:** Let a key press of one half decide an open Mod-Tap key of the other half as hold, before the press acts. Use the pattern of "Double-tap across both halves": append new split ops, hold the press for a short time, and apply it after the layer change.
- **Goal:** Keep the old behavior when one half has an older firmware. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A test with both halves shows that a held `MO_1` on one half and a key press on the other half gives the layer 1 action and no tap action.

## Priority 2

### Bounce detection in the matrix test

- **Rank:** Feature model. Total 29/40 (typing 3, configuration 9, harmony 8, safety 9). Effort S. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (`onMatrixKeyChange`), `js/config-model.js` (`parseMatrixLine`, `summarizeMatrixTest`), `js/matrix-test.js`.
- **Problem:** A worn or badly soldered switch can type a key twice. The matrix test shows only that a key works, not that it bounces.
- **Goal:** Add the scan time `t` to the `MATRIX:` line. Count a press that follows a release of the same key within a short limit as a bounce.
- **Goal:** Mark bouncing keys in the matrix test and show a hint to increase `debounceMs`. A line without `t` gives no bounce result.
- **Acceptance test:** A test shows that a press 10 ms after a release counts as a bounce and a press 200 ms after a release does not.

### Layout check

- **Rank:** Feature model. Total 29/40 (typing 3, configuration 9, harmony 8, safety 9). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js` (`validateConfigShape`, `isKeyPairUsed`, `isMacroUsed`), `js/side-profiles.js` (`cellHasAction`), `js/config-sync.js` (`writeConfigWithDiff`).
- **Problem:** The app checks only the shape of a configuration. An action on a key that does not exist has no effect and no warning. A layer that the user cannot reach, or cannot leave, also gives no warning.
- **Goal:** Add a pure function that checks both halves together, because both halves share the active layer. Report: an action on a missing key, a layer without a way in, a toggled layer without a way out, an unused key pair or macro, a duplicate combo, and a combo key with a hold or double-tap action.
- **Goal:** Show the result in the matrix tab, in the layout diff and before "Auf Dactyl flashen". A warning does not block the sync.
- **Acceptance test:** A test shows each check with one positive and one negative case, including an action on `R5C5` of the right half.

## Priority 3

### `GET_CONFIG` with combos, key pairs and macros

- **Rank:** Feature model. Total 23/40 (typing 2, configuration 7, harmony 8, safety 6). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (`GET_CONFIG`), `js/config-sync.js` (`captureDeviceSnapshotLine`), `js/config-model.js` (`diffKeymap`).
- **Problem:** The layout diff and "Vom ESP32 laden" skip combos, key pairs and macros. The diff can show "no change" while the macros on the device differ.
- **Goal:** Send combos, key pairs and macros in `GET_CONFIG`. Compare them in the layout diff.
- **Goal:** Make a backup that is read directly from the device complete. The automatic backup of the app already covers the main case.
- **Acceptance test:** A firmware test shows that `GET_CONFIG` returns all combos, key pairs and macros.
- **Acceptance test:** `diffKeymap` reports a changed macro.

## Priority 4

### Mouse movement (mouse keys)

- **Rank:** Feature model. Total 20/40 (typing 5, configuration 4, harmony 6, safety 5). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (`processDeferredKeys()`), `firmware/dactyl_right/DactylSplitHid.h`, `js/keycodes.js`.
- **Problem:** Report ID 3 has X and Y, but only click and scroll exist (`0x130`..`0x134`).
- **Goal:** Add the actions `MOUSE_UP`, `MOUSE_DOWN`, `MOUSE_LEFT` and `MOUSE_RIGHT` with acceleration in `processDeferredKeys()`.
- **Goal:** Add new split ops for the left half. Only append ops; never renumber.
- **Acceptance test:** A firmware test shows that a held mouse key moves the pointer with growing speed and stops at the release.

### Key overrides

- **Rank:** Feature model. Total 20/40 (typing 6, configuration 4, harmony 5, safety 5). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h` (`heldModifierMask`), `firmware/dactyl_right/DactylOneShot.h` (`SplitArbitratedKeyboard`).
- **Problem:** A modifier with a key always sends both. The user needs a key pair or a layer for each replacement.
- **Goal:** Let a modifier plus a key give another action, for example `Shift` + `Backspace` = `Delete`. This saves key pairs and layers.
- **Note:** The design must respect `heldModifierMask` and the state in `SplitArbitratedKeyboard`.
- **Acceptance test:** A firmware test shows that `Shift` + `Backspace` sends `Delete` without `Shift`, and that `Backspace` alone is unchanged.

### Heatmap per layer

- **Rank:** Feature model. Total 19/40 (typing 1, configuration 4, harmony 6, safety 8). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/heatmap.js`, `js/side-state.js`.
- **Goal:** Count the key presses also by `layer` from the `KEY_PRESS` event.
- **Acceptance test:** A test shows that presses on two layers give two separate counters.

### Keyboard control in the editor

- **Rank:** Feature model. Total 18/40 (typing 0, configuration 5, harmony 5, safety 8). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/editor.js`, `js/editor-events.js`.
- **Goal:** Let the arrow keys change the selected key in the matrix.
- **Acceptance test:** A test shows that the arrow keys move the selection and stop at the edge of the matrix.

### Repeat the last action

- **Rank:** Feature model. Total 18/40 (typing 6, configuration 3, harmony 5, safety 4). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylCommon.h`.
- **Goal:** Add an action `REPEAT` that runs the last resolved action again. This includes combo actions, key pairs, umlauts, macros and media keys, not only the last key code.
- **Goal:** Store the resolved action, not the matrix position. A held `REPEAT` acts like the held original action.
- **Decision needed:** Exclude layer actions, one-shot keys and `CAPS_WORD`. Decide how the action repeats across both halves: the master knows only HID events, not the action of the left half.
- **Acceptance test:** A firmware test shows that `REPEAT` after a macro plays the same macro.

### Heatmap export

- **Rank:** Feature model. Total 17/40 (typing 0, configuration 3, harmony 6, safety 8). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/heatmap.js`.
- **Dependency:** "Heatmap per layer". The export is useful only with or after it.
- **Goal:** Export the counters as CSV or JSON, for example for layout optimization.
- **Acceptance test:** A test shows that the exported file contains the counter of each key and layer.

### Layer overview

- **Rank:** Feature model. Total 17/40 (typing 0, configuration 5, harmony 5, safety 7). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/editor.js`, `style.css`.
- **Goal:** Show all 8 layers in small size side by side, so transparent keys and conflicts are visible.
- **Acceptance test:** A test shows that the overview marks a key that is transparent on a layer.

## Priority 5

These entries need a decision of the maintainer before the work starts.

### On-screen keyboard as picker

- **Rank:** Feature model. Total 14/40 (typing 0, configuration 3, harmony 4, safety 7). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/editor.js` (`applySelectFilter`).
- **Decision needed:** The search field above each action select already covers most of the need. Decide if a second picker is worth the effort.
- **Goal:** Offer an on-screen keyboard as an alternative to the `<select>`.
- **Acceptance test:** A test shows that a click on the on-screen key sets the same action as the select.

### Shared matrix constants

- **Rank:** Maintenance model. Total 14/40 (reach 4, safety 5, speed 3, unblocks 2). Effort M. Estimate.
- **Area:** Tooling.
- **Code:** `tests/test_side_profiles.js`, `js/side-right.js`, `js/side-left.js`, `server.py`, `firmware/dactyl_right/dactyl_right.ino`.
- **Decision needed:** `tests/test_side_profiles.js` already checks the profiles against the firmware sources, so the remaining benefit is small.
- **Goal:** Define pins, sizes and absent keys once. Check them in the web app, in `server.py` and in the firmware.
- **Acceptance test:** A test fails when one source changes a pin without the shared definition.

### OTA update over BLE in config mode

- **Rank:** Feature model. Total 12/40 (typing 1, configuration 5, harmony 4, safety 2). Effort L. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/DactylConfigBle.h`, `server.py`.
- **Problem:** The user needs a USB cable to flash a half, especially the left half.
- **Goal:** Use the two OTA slots of `min_spiffs` to flash over BLE in config mode.
- **Decision needed:** The risk is high: rollback, signature and the unauthenticated config characteristic (see "BLE Command Authorization" in `AGENTS.md`).
- **Acceptance test:** A flash over BLE keeps the keymap and the macOS bond, and a failed update boots the old firmware again.

## Deferred

The entry below is outside the priorities. It needs a hardware change first.

### Real LiPo voltage measurement

- **Rank:** Feature model. Total 17/40 (typing 5, configuration 4, harmony 4, safety 4). Effort M. Estimate.
- **Area:** Firmware, App.
- **Code:** `firmware/dactyl_right/dactyl_right.ino` (`BAT_SENSE`, GPIO 35), `app.js` (`updateBatteryUI`, disabled).
- **Problem:** The app shows no battery level. Without it the keyboard stops without a warning.
- **Decision needed:** Build an external voltage divider on `BAT_SENSE`. The code does not start before this hardware change.
- **Goal:** Read `BAT_SENSE` and set the BLE battery level. Show it in the app.
- **Acceptance test:** A firmware test maps ADC values to a battery level. The app shows the level of a connected half.

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
