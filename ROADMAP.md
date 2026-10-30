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

No open entry.

## Priority 2

No open entry.

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
- **Image size:** The app image has approximately 1.7 MB (`dactyl_right.ino.bin` 1,715,360 B, `dactyl_left.ino.bin` 1,698,672 B, 2026-10-30). One app slot has 1.875 MB.
- **Transport options:**
  - BLE in config mode (recommended): Use the config BLE server of each half (`Dactyl Config`, `Dactyl Config L`). This transport needs no Wi-Fi credentials. Stop the 3 min config-mode timeout during the update.
  - Wi-Fi (`ArduinoOTA` / `espota`): This transport is fast, but the device needs Wi-Fi credentials. On the left half, ESP-NOW uses the fixed channel 1. An access point sets its own channel.
  - Relay over the master (ESP-NOW to the left half): This transport is the most complex and the slowest. It has no advantage over BLE.
- **Speed comparison:** The values are estimates for an image of 1.7 MB. Measure them before the decision.

  | Transport | Throughput | Time for one half |
  |---|---|---|
  | USB, CH340 at `UploadSpeed=115200` (esptool compresses the image) | ~11 KB/s on the wire | ~1–2 min |
  | BLE, Web Bluetooth write without response (depends on the MTU) | ~5–20 KB/s | ~1.5–6 min |
  | Wi-Fi (`espota`) | ~100–500 KB/s | ~5–20 s |

  At best, BLE is as fast as USB. Usually, BLE is slower. The advantage of BLE is that no cable is necessary, not the speed. On the left half, BLE and ESP-NOW share the radio. This makes the transfer slower.
- **Requirements:** Check the signature of the image before the boot slot changes, for example with Ed25519, because the config characteristic has no authentication. Check if the precompiled Arduino bootloader supports `APP_ROLLBACK`. Keep the NVS partition (`0x9000`) and the macOS bond. Keep USB as the recovery path.
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
