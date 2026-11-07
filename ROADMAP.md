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

### Custom alternate repeat pairs (`userAltRepeats`)

- **Rank:** Feature model. Total 25/40 (typing 7, configuration 4, harmony 7, safety 7). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `js/config-model.js`, `js/heatmap.js`, `server.py`.
- **Problem:** `ALT_REPEAT` uses a fixed table in `DactylCommon.h` and cannot eliminate user-specific same-finger bigrams.
- **Goal:** Add up to 16 custom alternate-repeat entries (`{ key, alt }`, keyboard codes `1..255`) per half (`CLEAR_ALT_REPEATS`, `ADD_ALT_REPEAT`, `SAVE_ALT_REPEATS`, NVS keys `num_altrep`, `altrep_data`, `GET_CONFIG` lines `ALTREP_COUNT` and `ALTREP_DATA`). `altRepeatAction()` checks the custom table before the default table. Add a UI card and a button in the finger-load panel to create entries from the top same-finger pairs. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test adds a custom pair `e -> u`, presses `e` then `ALT_REPEAT` and expects `u`; the app and server round-trip the list in `GET_CONFIG` and codegen.

### Mouse precision and turbo keys (`MOUSE_SLOW`, `MOUSE_FAST`)

- **Rank:** Feature model. Total 24/40 (typing 6, configuration 2, harmony 8, safety 8). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylSplitHid.h`, `js/keycodes.js`, `server.py`.
- **Problem:** Mouse movement acceleration reaches 16 pixels per tick quickly, which makes fine cursor positioning difficult.
- **Goal:** Add the actions `MOUSE_SLOW` and `MOUSE_FAST`. While `MOUSE_SLOW` is held, `mouseMoveTick()` and `wheelHoldTick()` cap the step at 1 without acceleration. While `MOUSE_FAST` is held, pointer movement uses `MOUSE_MOVE_MAX_STEP` from the first tick. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test holds `MOUSE_SLOW` and `MOUSE_RIGHT_MOVE` for 1000 ms and verifies that each step remains 1.

### Auto Shift character class filter (`autoShift` modes)

- **Rank:** Feature model. Total 24/40 (typing 6, configuration 4, harmony 7, safety 7). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylLogic.h`, `js/config-model.js`, `js/editor-events.js`, `server.py`.
- **Problem:** `autoShift` applies to letters, digits and symbols alike. Many users want Auto Shift on symbols and digits without shifting home-row letters during brief pauses.
- **Goal:** Extend `autoShift` from `0..1` to `0..4` (`0` = off, `1` = all printable keys, `2` = digits and symbols only, `3` = letters only, `4` = symbols only) in `SET_AUTO_SHIFT`, NVS, `DEVICE_INFO`, `server.py` and the settings UI. Keep mode `1` identical to the existing behavior.
- **Acceptance test:** A firmware test sets `autoShift = 2`, holds `'a'` past `autoShiftMs` and expects `'a'`, then holds `'1'` past `autoShiftMs` and expects `'!'`.

### Drag-and-drop key swap and cross-half layer mirror in the editor

- **Rank:** Feature model. Total 23/40 (typing 2, configuration 8, harmony 6, safety 7). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor.js`, `js/editor-events.js`, `index.html`.
- **Problem:** Swapping two keys on a layer or mirroring a navigation or symbol layer to the other half requires manual edits for each key.
- **Goal:** Add `swapLayerKeys(layer, r1, c1, r2, c2)` and `mirrorLayerAcrossSides(layer, srcProfile, dstProfile)` in `js/config-model.js`. Allow dragging a keycap onto another keycap in the matrix to swap their cells, and add a layer tool button to mirror the active layer to the other half (swapping `LEFT_*` and `RIGHT_*` modifiers and left/right arrows, and skipping absent keys).
- **Acceptance test:** Unit tests in `tests/test_app_logic.js` verify key swapping, modifier and arrow mirroring, absent-key safety and undo snapshot restoration.

### One-shot modifier and one-shot layer timeout (`oneShotTimeoutMs`)

- **Rank:** Feature model. Total 23/40 (typing 5, configuration 3, harmony 7, safety 8). Effort S. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylOneShot.h`, `firmware/dactyl_right/DactylLogic.h`, `js/config-model.js`, `server.py`.
- **Problem:** An armed `OSM_*` or `OSL_n` remains active indefinitely when the user pauses, so the first key press after a break uses an unintended modifier or layer.
- **Goal:** Add the setting `oneShotTimeoutMs` (`0` = off, or `500..10000` ms, default `0`) per half (`SET_ONESHOT_TIMEOUT`, NVS key `osm_to`, `DEVICE_INFO` field `ot`). Expire armed one-shot modifiers and armed one-shot layers when `oneShotTimeoutMs` elapses without a consuming key press. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test arms `OSM_LSHIFT` and `OSL_2` with `oneShotTimeoutMs = 1500`, advances 1600 ms and verifies that the next key press sends an unshifted Layer 0 key.

### Caps Word idle timeout and automatic umlaut capitalization

- **Rank:** Feature model. Total 22/40 (typing 5, configuration 3, harmony 7, safety 7). Effort S. Estimate.
- **Area:** Firmware.
- **Code:** `firmware/dactyl_right/DactylOneShot.h`, `firmware/dactyl_right/DactylLogic.h`, `firmware/dactyl_right/DactylSplitHid.h`.
- **Problem:** Caps Word stays on forever after a typing pause, and pressing `UMLAUT_AE`, `UMLAUT_OE` or `UMLAUT_UE` during Caps Word sends a lowercase umlaut instead of the uppercase umlaut.
- **Goal:** Expire Caps Word automatically after `CAPS_WORD_IDLE_MS` (5000 ms) without a key press, and map `ACT_UMLAUT_AE`, `ACT_UMLAUT_OE` and `ACT_UMLAUT_UE` to their uppercase counterparts while Caps Word is active without ending Caps Word.
- **Acceptance test:** A firmware test enables Caps Word, presses `UMLAUT_AE` and expects the uppercase sequence `Alt+u`, `A`; advancing past 5000 ms of idle time turns Caps Word off.

### Macro repeat while held (`macroRepeat`)

- **Rank:** Feature model. Total 22/40 (typing 5, configuration 4, harmony 6, safety 7). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylCommon.h`, `firmware/dactyl_right/DactylLogic.h`, `js/macros-ui.js`, `js/config-model.js`, `server.py`.
- **Problem:** A macro always runs once per press. Repeating a step sequence requires tapping the key again and again.
- **Goal:** Add an optional repeat-while-held flag per macro (`userMacroRepeat`, `ADD_MACRO [0|1]`, NVS key `macro_rep`). When set, `macroTick()` restarts the macro from step 0 while the triggering key remains physically held, and stops when the key is released, on host loss or on `RELEASE_ALL`. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test starts a repeating macro while holding the key, verifies that it runs multiple passes, releases the key and verifies that playback stops cleanly with all held codes released.

### Combined dual-half configuration export and import

- **Rank:** Feature model. Total 21/40 (typing 1, configuration 8, harmony 5, safety 7). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor-events.js`, `index.html`.
- **Problem:** Saving or sharing a complete split-keyboard layout requires exporting and importing two separate JSON files (right and left).
- **Goal:** Add `buildDualSideBundle(configs)` and `parseConfigImport(raw, profiles)` in `js/config-model.js` and a button "Beide Hälften exportieren". The import accepts both a single-half config and a dual-half bundle (`{ bundleVersion: 1, sides: { R: ..., L: ... } }`), validates both halves before applying any change, and marks both halves for sync.
- **Acceptance test:** Unit tests in `tests/test_app_logic.js` verify round-trip export and import of a dual-half bundle and verify that an invalid left config aborts the import for both halves.

## Priority 4

### Physical key capture in the combo and leader editors

- **Rank:** Feature model. Total 20/40 (typing 1, configuration 7, harmony 5, safety 7). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor-events.js`, `js/leader-ui.js`, `js/serial.js`, `index.html`.
- **Problem:** Picking matrix coordinates (`R2C1`, `R2C2`) in the combo dialog or key sequences in the leader editor from dropdown lists is slow and error-prone.
- **Goal:** Add a capture toggle "Auf Tastatur drücken" in the combo dialog and the leader editor. While capture is active, physical presses from `MATRIX:`, `KEY_PRESS` and `SPLIT_KEY` of the edited half fill the next key slot automatically without triggering editor shortcuts.
- **Acceptance test:** Unit tests in `tests/test_app_logic.js` feed simulated matrix and serial events into the capture state machine and verify that duplicate coordinates and wrong-side presses are ignored.

### Interactive timing assistant (`Tapping-Term-Assistent`)

- **Rank:** Feature model. Total 19/40 (typing 3, configuration 7, harmony 4, safety 5). Effort M. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/editor-events.js`, `index.html`.
- **Problem:** Users configure `tappingTermMs`, `comboTimeoutMs`, `quickTapMs` and `requirePriorIdleMs` by trial and error without data from their own typing speed.
- **Goal:** Add a pure analyzer `computeTimingRecommendations(samples)` in `js/config-model.js` and a dialog in the settings card that records `MATRIX:` press and release durations and inter-key roll gaps over USB, then calculates recommended values with a one-click apply button.
- **Acceptance test:** Unit tests in `tests/test_app_logic.js` verify percentile calculation, clamping to `SETTINGS_RANGES` and rejection of incomplete press and release pairs.

### Layer mask for key overrides (`KeyOverride.layerMask`)

- **Rank:** Feature model. Total 18/40 (typing 5, configuration 3, harmony 5, safety 5). Effort M. Estimate.
- **Area:** Firmware, App, Server.
- **Code:** `firmware/dactyl_right/DactylKeyOverride.h`, `firmware/dactyl_right/DactylSplitHid.h`, `firmware/dactyl_right/DactylLogic.h`, `js/key-overrides-ui.js`, `js/config-model.js`, `server.py`.
- **Problem:** Key overrides apply on every layer. An override intended only for the base layer or a code layer cannot be restricted.
- **Goal:** Add an 8-bit `layerMask` (default `0xFF`, all layers) to `KeyOverride`. Accept the optional fourth value in `ADD_OVERRIDE <mods> <key> <replacement> [<mask>]` and include it in `OVERRIDE_DATA` and NVS (`ovr_v2`, keeping `ovr_data` readable). Check the active layer before applying an override. Increase `DACTYL_FW_VERSION`.
- **Acceptance test:** A firmware test restricts an override to Layer 0 (`mask = 0x01`), verifies that it fires on Layer 0 and does not fire when Layer 1 is active.

### Heatmap-guided ergonomic swap suggestions (`suggestErgonomicSwaps`)

- **Rank:** Feature model. Total 17/40 (typing 3, configuration 6, harmony 4, safety 4). Effort S. Estimate.
- **Area:** App.
- **Code:** `js/config-model.js`, `js/heatmap.js`, `index.html`.
- **Problem:** The heatmap and finger-load bars show overloaded pinky columns and frequent same-finger bigrams, but do not point out which Layer 0 keys should trade places.
- **Goal:** Add `suggestErgonomicSwaps(stats, config, profile)` in `js/config-model.js` and a list in the heatmap panel that ranks up to 5 swaps between high-count keys on high-effort positions (outer pinky column, top row, or same-finger bigram pairs) and low-count keys on home-row index, middle or ring positions, leaving modifiers and layer keys untouched.
- **Acceptance test:** Unit tests in `tests/test_app_logic.js` verify that high-frequency outer keys are paired with low-frequency home-row keys and that modifiers, layer keys and absent keys are excluded.

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
