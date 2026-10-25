# Ideen-Backlog (Dactyl Configurator & Firmware)

Gesammelte Verbesserungsideen für spätere Arbeit. Erledigte Punkte verweisen auf ihren Pull Request.

## Umgesetzt

- **Tasten-Heatmap & WPM-Anzeige** im Live-Monitor — PR #2.
- **Matrix-Test (Löt- und Dioden-Tester)** als eigener Tab — PR #3.
- **Ebenen-Werkzeuge:** Ebene kopieren, tauschen, leeren (als Snapshot vorgemerkt, rückgängig machbar) — PR #4.
- **Tastenpaare (Zwei-Tasten-Aktion):** eine Taste drückt zwei frei wählbare Tasten gleichzeitig (z. B. `Shift` + `.` = `:` auf deutschem macOS) — PR #5.
- **Tap-Dance / Doppel-Tippen:** dritte Aktion pro Taste; zwei Tipps innerhalb von 200 ms lösen sie aus.
- **Linke Hälfte:** eigene Firmware (Keymap, NVS, Config-BLE, Power Management) mit ESP-NOW zum Master; die App bearbeitet, synchronisiert und flasht beide Hälften.
- **Flash-Port-Auswahl:** `server.py` flasht nur den Port, dessen Board sich per `DEVICE_INFO.side` als die gewählte Hälfte meldet.
- **Deutsche Zeichen im Keycode-Picker:** Gruppe "Deutsche Zeichen (macOS)" mit Shift-Zeichen (`:`, `+`, `*`, `?` …) als Einzelcode und Option-Zeichen (`@`, `€`, `{` …) als automatisch angelegtes Tastenpaar; Suchfeld über jeder Aktions-Auswahl.
- **Weitere deutsche Zeichen:** `<` (ISO-Taste `KEY_NON_US_BACKSLASH`, HID `0x64`), `>` (Tastenpaar Shift + ISO-Taste), `^`, `°`, `´` und `` ` `` in "Deutsche Zeichen (macOS)"; Zuordnung für den macOS-Tastaturtyp ISO.
- **macOS-Layout "U.S.":** Gruppe "Sonderzeichen (macOS US)" mit US-Zeichen, `§` über die ISO-Taste, `° € ´` als Tastenpaar; eigene Umlaut-Aktionen `UMLAUT_AE` … `UMLAUT_SZ` (Tottaste Alt + u, dann Vokal; ß = Alt + s); Preset und Vorlagen mit US-Beschriftung.

## App (Configurator)

- **Bildschirm-Tastatur als Picker:** Alternative zum `<select>` mit Suchfeld.
- **Makro-Engine (App-Seite):** Editor für Tastenfolgen mit Verzögerung; braucht Firmware-Aktionscodes und NVS-Speicher.
- **Profilverwaltung:** mehrere benannte Layouts lokal speichern und umschalten (heute nur ein `current_config.json` plus JSON-Export/Import).
- **Layout-Diff vor dem Sync:** pro Taste anzeigen, was sich gegenüber dem Gerät ändert (`GET_CONFIG` mit lokalem Stand vergleichen).
- **Ebenen-Übersicht:** alle 8 Ebenen verkleinert nebeneinander, damit transparente Tasten und Konflikte sichtbar werden.
- **Tastatur-Bedienung im Editor:** Pfeiltasten zum Wechseln der ausgewählten Taste.
- **Heatmap pro Ebene:** Zähler zusätzlich nach `layer` aus dem `KEY_PRESS`-Event trennen.
- **Heatmap-Export:** Zähler als CSV/JSON exportieren, z. B. für Layout-Optimierung.
- **Matrix-Test für leere Tasten:** im Test-Modus Ebene 0 erzwingen oder das reine Matrix-Event der Firmware nutzen.
- **Fortschritt beim Flashen:** `arduino-cli`-Ausgabe live an die App streamen statt nur am Ende melden.

## Firmware

- **Echte LiPo-Spannungsmessung:** `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert).
- **Makros:** Aktionscode-Bereich für Tastenfolgen, Speicherung in NVS, Ausführung nicht blockierend.
- **Reines Matrix-Event für Diagnose:** eine `MATRIX:`-Zeile unabhängig von der Belegung; heute sendet `dispatchPress` kein `KEY_PRESS` für Tasten mit Aktion `0`.
- **One-Shot-Modifier / Caps Word:** häufige Komfortfunktionen ergänzend zu Mod-Tap.
- **Konfigurierbarer Tapping-Term:** `TAPPING_TERM_MS` (200 ms) als Einstellung in NVS und App.

## Split / Hardware

- **Linke Tasten im Live-Monitor über den Master:** `SPLIT_HID`-Zeilen tragen keine Matrix-Position. Heute zeigt die App linke Tasten nur über eine direkte Verbindung zur linken Hälfte (BLE im Config Mode oder USB).
- ESP-NOW härten bzw. encrypten die Übertragung

### Plan: ESP-NOW-Neustart nach wiederholten Sendefehlern (linke Hälfte)

**Anlass (2026-10-25):** Beide Hälften waren wach. Rechts: BLE zum Mac verbunden, ESP-NOW-Empfang bereit. Links: Matrix aktiv. Trotzdem scheiterte jeder Versand der linken Hälfte (`ESPNOW_RETRY` 3x, dann `ESPNOW_FAIL`, Status `Master erreichbar=0`); keine linke Taste kam am Mac an. Erst ein Reset beider Boards (zuerst Master, dann links) stellte die Verbindung her. Die Boot-Logs zeigten danach richtige MAC-Adressen (links Wi-Fi-STA `…:B0`, Master `…:A6`) und Kanal 1. Die Ursache ist unbekannt; der Plan ist eine Absicherung, keine Ursachenbehebung.

**Umsetzung:**
1. `DactylLeftLogic.h`: Zähler `consecutiveDrops` für Ereignisse mit Ergebnis `SEND_DROPPED`; ein bestätigter Versand setzt ihn auf 0. Reine Funktion, z. B. `shouldRestartEspNow(drops, linkDownSinceMs, nowMs)`, damit der Host-Test sie prüfen kann.
2. Auslöser: mindestens `ESPNOW_RESTART_DROPS` verworfene Ereignisse (Vorschlag 5) **und** Link seit mindestens `ESPNOW_RESTART_DOWN_MS` unten (Vorschlag 5 s; der Heartbeat liefert jede Sekunde ein Ereignis). Danach höchstens ein Neustart pro `ESPNOW_RESTART_BACKOFF_MS` (Vorschlag 30 s), damit kein Neustart-Kreislauf entsteht.
3. `dactyl_left.ino`: `restartEspNow()` = Sendewarteschlange leeren, `esp_now_deinit()`, `WiFi.mode(WIFI_OFF)`, dann `setupEspNow()` erneut (stellt Kanal, Peer und das erste `RELEASE_ALL` her). Serial-Zeile `ESPNOW_RESTART` für die Diagnose.
4. Optional als zweite Stufe: nach N erfolglosen ESP-NOW-Neustarts `ESP.restart()` der linken Hälfte (Keymap liegt in NVS; Kosten: kurze Pause der linken Hälfte).

**Tests:**
- Host-Test (`firmware/tests/run_tests.sh`): Schwellwert, Rücksetzen nach Erfolg, Backoff, kein Neustart im Config Mode und während Deep-Sleep-Vorbereitung.
- Hardware: Master per Reset-Taste neu starten, während links getippt wird; erwartet: `ESPNOW_RESTART` höchstens einmal pro Backoff, danach `Master erreichbar=1` ohne Reset der linken Hälfte.

**Offene Fragen:**
- Soll auch der Master etwas tun (z. B. ESP-NOW neu starten, wenn `SPLIT_LINK_TIMEOUT_MS` lange anhält)? Heute weiß der Master nicht, ob die linke Hälfte schläft oder hängt.
- Reproduktion: Der Fehlerzustand trat ohne bekannten Auslöser auf. Vor dem Fix den Master-Log bei `[SPLIT] WARN: Linke Hälfte nicht erreichbar` mitschneiden.

### Plan: Synchronisierte Inaktivitäts-Timer (Standby und Deep Sleep)

**Heute:**
- Rechts (`dactyl_right.ino:461`): angewendete linke Ereignisse setzen `lastActivityTime` zurück. Der Master schläft nicht ein, solange links getippt wird.
- Links (`dactyl_left.ino:475`): nur eigene Tasten setzen `lastActivityTime` zurück. Bei 60 Min nur rechts tippen geht die linke Hälfte in Deep Sleep.
- Aufwachen: Eine Hälfte im Deep Sleep empfängt kein Funksignal; die andere Hälfte kann sie nicht wecken. Nach dem Deep Sleep braucht jede Hälfte einen eigenen Tastendruck. Das bleibt so (Hardware-Grenze).

**Ziel:** Beide Hälften gehen erst in Standby / Deep Sleep, wenn auf **keiner** Hälfte getippt wurde.

**Umsetzung:**
1. Neue Rückrichtung Master -> links. Protokoll in `DactylSplitHid.h` append-only erweitern, z. B. Op `SPLIT_OP_ACTIVITY` (nur Master -> links, ohne HID-Wirkung). `parseSplitHidPacket` auf dem Master lehnt sie ab; ein eigener Parser links prüft Absender-MAC `…:A6` und Länge.
2. Master: Bei eigener Taste höchstens alle `SPLIT_ACTIVITY_INTERVAL_MS` (Vorschlag 10 s) ein `ACTIVITY`-Paket senden. Dafür braucht der Master einen Peer auf die linke MAC `…:B0`; kein Retry, ein verlorenes Paket ist unkritisch.
3. Links: Empfangs-Callback registrieren; ein gültiges `ACTIVITY` setzt `lastActivityTime` zurück und beendet Standby. Kein Tastendruck, keine HID-Wirkung.
4. `AGENTS.md`: Abschnitt "Config mode, NVS, power" und "Known limit" anpassen.

**Tests:**
- Host-Test: Parser links (gültig, falsche MAC, falsche Länge, unbekannter Op), Drosselung auf dem Master, Rücksetzen des Timers links.
- Hardware: 6 Min nur rechts tippen; links darf nicht in Standby gehen (Serial `[POWER]`), und linke Tasten kommen ohne Verzögerung an.

**Offene Fragen:**
- Soll `ACTIVITY` auch den Standby der linken Hälfte verhindern oder nur den Deep Sleep? Ohne Standby verbraucht links mehr Strom, reagiert aber ohne gedrosselten Scan (40 ms).
- Funkzeit: Ein Paket alle 10 s ist gering, teilt sich aber das 2,4-GHz-Radio mit BLE. Intervall auf Hardware prüfen.
- Soll auch der umgekehrte Fall (Master bleibt wach wegen links) unverändert bleiben? Heute ja.
- Sollen beide Hälften dieselben Timeout-Werte erzwingen (heute getrennt pro Hälfte in NVS)?

## Offene LOW-Befunde aus Code-Reviews

Kleine Befunde aus Reviews, bewusst auf später verschoben. Jeder Punkt braucht beim Umsetzen einen Regressionstest.

- `tests/test_side_profiles.js:231`: Der Test der Preset-Auswahl filtert die Optionen in `index.html` mit den festen Schlüsseln `us_qwerty` und `de_qwertz`. Folge: Ein neues Preset in `R.presets` ohne Option in `index.html` fällt nicht auf. Korrektur: Die festen Schlüssel entfernen und die Optionen von `layoutPresetSelect` mit `Object.keys(R.presets)` vergleichen.
- Hardware-Prüfung offen: Tottaste Alt + u eines Umlauts auf der linken Hälfte am Mac testen. Der Host-Test prüft nur die Reihenfolge der `SplitHidEvent`s; der Master sendet sie ohne Abstand.


## Tooling & Qualität

- **Gemeinsame Matrix-Konstanten:** Pins, Größen und nicht vorhandene Tasten einmal definieren und in der Web-App, `server.py` und Firmware prüfen.
