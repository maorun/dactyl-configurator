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

## Priority 4

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
