# Ideen-Backlog (Dactyl Configurator & Firmware)

Gesammelte Verbesserungsideen für spätere Arbeit. Erledigte Punkte verweisen auf ihren Pull Request.

## Regeln für die Rangliste

- Die Rangliste hat keine Nummern. Der oberste Eintrag ist der wichtigste, der unterste der unwichtigste.
- Bewerte jeden neuen Eintrag und füge ihn an der passenden Stelle ein. Hänge ihn nicht einfach unten an.
- Jeder Eintrag hat die Form: **Titel** `[Bereich]` — *Nutzen: hoch|mittel|gering · Aufwand: klein|mittel|groß* — Beschreibung und Begründung der Position.
- Ordne nach diesen Kriterien, in dieser Reihenfolge:
  1. Ausfälle und Fehler, die das tägliche Tippen stören.
  2. Nutzen im Alltag (Tippen, Konfigurieren, Diagnose).
  3. Aufwand: Bei gleichem Nutzen steht der kleinere Aufwand oben.
  4. Abhängigkeiten: Eine Voraussetzung steht über dem Eintrag, der sie braucht.
- Ein langer Plan steht unter "Detailpläne". Der Eintrag in der Rangliste verweist darauf.
- Ein umgesetzter Eintrag wandert mit seiner PR-Nummer nach "Umgesetzt".
- `LOW`-Befunde aus Code-Reviews stehen nicht in der Rangliste, sondern unter "Offene LOW-Befunde aus Code-Reviews" (Regel in `AGENTS.md`). Ein späterer, eigener Lauf behebt sie gemeinsam.

## Rangliste

- **Synchronisierte Inaktivitäts-Timer (Standby und Deep Sleep)** `[Split]` — *Nutzen: hoch · Aufwand: mittel* — Wer 60 Min nur rechts tippt, schickt die linke Hälfte in Deep Sleep; die nächste linke Taste geht verloren. Der Fehler tritt im Alltag regelmäßig auf. Plan: [Synchronisierte Timer](#plan-synchronisierte-inaktivitäts-timer-standby-und-deep-sleep).
- **Echte LiPo-Spannungsmessung** `[Firmware]` — *Nutzen: hoch · Aufwand: mittel* — `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert). Ohne Anzeige fällt die Tastatur ohne Vorwarnung aus. Braucht einen Hardware-Umbau (Spannungsteiler), deshalb unter den Split-Fehlern.
- **Konfigurierbarer Tapping-Term** `[Firmware]` — *Nutzen: mittel · Aufwand: klein* — `TAPPING_TERM_MS` (200 ms) als Einstellung in NVS und App. Der Wert steuert Mod-Tap und Tap-Dance; ein unpassender Wert erzeugt Fehltipper. Kleiner Aufwand, weil das Muster der Sleep-Einstellungen existiert.
- **Layout-Diff vor dem Sync** `[App]` — *Nutzen: mittel · Aufwand: mittel* — Pro Taste anzeigen, was sich gegenüber dem Gerät ändert (`GET_CONFIG` mit lokalem Stand vergleichen). Verhindert, dass ein Sync eine Gerätebelegung unbemerkt überschreibt.
- **Linke Tasten im Live-Monitor über den Master** `[Split]` — *Nutzen: mittel · Aufwand: mittel* — `SPLIT_HID`-Zeilen tragen keine Matrix-Position. Heute zeigt die App linke Tasten nur über eine direkte Verbindung zur linken Hälfte (BLE im Config Mode oder USB). Braucht ein Protokollfeld oder eine eigene Diagnose-Op (append-only).
- **Reines Matrix-Event für Diagnose** `[Firmware]` — *Nutzen: mittel · Aufwand: klein* — Eine `MATRIX:`-Zeile unabhängig von der Belegung; heute sendet `dispatchPress` kein `KEY_PRESS` für Tasten mit Aktion `0`. Voraussetzung für den nächsten Eintrag.
- **Matrix-Test für leere Tasten** `[App]` — *Nutzen: mittel · Aufwand: klein* — Im Test-Modus das reine Matrix-Event der Firmware nutzen (oder Ebene 0 erzwingen). Hilft beim Löten und bei Wackelkontakten. Hängt vom Matrix-Event ab.
- **One-Shot-Modifier / Caps Word** `[Firmware]` — *Nutzen: mittel · Aufwand: mittel* — Häufige Komfortfunktionen ergänzend zu Mod-Tap. Neue Aktionscodes in Firmware, App und `server.py`.
- **Makros (Firmware und App)** `[Firmware/App]` — *Nutzen: mittel · Aufwand: groß* — Firmware: Aktionscode-Bereich für Tastenfolgen, Speicherung in NVS, Ausführung nicht blockierend (auf der linken Hälfte über die Sendewarteschlange). App: Editor für Tastenfolgen mit Verzögerung. Großer Aufwand über alle Schichten, deshalb hinter den kleineren Komfortfunktionen.
- **Profilverwaltung** `[App]` — *Nutzen: mittel · Aufwand: mittel* — Mehrere benannte Layouts lokal speichern und umschalten (heute nur ein `current_config.json` pro Hälfte plus JSON-Export/Import). Der Export deckt den Bedarf heute teilweise ab.
- **ESP-NOW härten bzw. verschlüsseln** `[Split]` — *Nutzen: gering · Aufwand: mittel* — Unverschlüsseltes ESP-NOW ist eine bewusst akzeptierte Designentscheidung (Latenz, `AGENTS.md` 2a). Ein Angriff braucht Nähe und die gefälschte linke MAC. Verschlüsselung mit PMK/LMK kostet Airtime; vorher die Latenz messen.
- **Fortschritt beim Flashen** `[App]` — *Nutzen: gering · Aufwand: klein* — `arduino-cli`-Ausgabe live an die App streamen statt nur am Ende melden. Flashen ist selten; der Nutzen liegt in der Fehlersuche bei einem hängenden Upload.
- **Ebenen-Übersicht** `[App]` — *Nutzen: gering · Aufwand: mittel* — Alle 8 Ebenen verkleinert nebeneinander, damit transparente Tasten und Konflikte sichtbar werden.
- **Heatmap pro Ebene** `[App]` — *Nutzen: gering · Aufwand: klein* — Zähler zusätzlich nach `layer` aus dem `KEY_PRESS`-Event trennen.
- **Heatmap-Export** `[App]` — *Nutzen: gering · Aufwand: klein* — Zähler als CSV/JSON exportieren, z. B. für Layout-Optimierung. Sinnvoll erst zusammen mit oder nach der Heatmap pro Ebene.
- **Gemeinsame Matrix-Konstanten** `[Tooling]` — *Nutzen: gering · Aufwand: mittel* — Pins, Größen und nicht vorhandene Tasten einmal definieren und in Web-App, `server.py` und Firmware prüfen. `tests/test_side_profiles.js` prüft die Profile bereits gegen die Firmware-Quellen; der Rest-Nutzen ist klein.
- **Tastatur-Bedienung im Editor** `[App]` — *Nutzen: gering · Aufwand: klein* — Pfeiltasten zum Wechseln der ausgewählten Taste.
- **Bildschirm-Tastatur als Picker** `[App]` — *Nutzen: gering · Aufwand: mittel* — Alternative zum `<select>`. Das Suchfeld über jeder Aktions-Auswahl deckt den Bedarf bereits weitgehend ab.

## Offene LOW-Befunde aus Code-Reviews

Kleine Befunde aus Reviews, bewusst auf später verschoben. Jeder Punkt braucht beim Umsetzen einen Regressionstest.

- `tests/test_side_profiles.js:231`: Der Test der Preset-Auswahl filtert die Optionen in `index.html` mit den festen Schlüsseln `us_qwerty` und `de_qwertz`. Folge: Ein neues Preset in `R.presets` ohne Option in `index.html` fällt nicht auf. Korrektur: Die festen Schlüssel entfernen und die Optionen von `layoutPresetSelect` mit `Object.keys(R.presets)` vergleichen.
- Hardware-Prüfung offen: Tottaste Alt + u eines Umlauts auf der linken Hälfte am Mac testen. Der Host-Test prüft nur die Reihenfolge der `SplitHidEvent`s; der Master sendet sie ohne Abstand.
- `firmware/dactyl_left/dactyl_left.ino:574`: Der Aufruf `shouldRestartEspNow(restartGuard, millis(), true)` übergibt für `allowed` immer `true`. Config Mode und Deep Sleep sperren den Neustart nur, weil diese Pfade die Prüfung nie erreichen. Folge: Die Tests prüfen nur den Parameter; ein entfernter Schutz fällt nicht auf. Korrektur: Eine reine Gate-Funktion in `DactylLeftLogic.h` mit Config- und Sleep-Zustand anlegen und testen.
- `firmware/dactyl_left/dactyl_left.ino:339`: `restartEspNow()` leert die Warteschlange und sendet `RELEASE_ALL`, behält aber den gedrückten Zustand in `DactylLogic.h`. Folge: Eine während des Neustarts gehaltene Taste ist nur am Master gelöst; ein gehaltener Modifier fehlt danach. Korrektur: Das Verhalten in `AGENTS.md` dokumentieren oder gehaltene Tasten nach dem Neustart erneut drücken.
- `firmware/dactyl_left/dactyl_left.ino:574`: Ist der Master aus oder im Deep Sleep, startet die linke Hälfte ESP-NOW alle 30 s neu. Folge: Jeder Neustart kostet Strom und blockiert `loop()` für etwa 20 ms. Korrektur: Den Backoff exponentiell steigern oder nach N Neustarts ohne Zustellung aussetzen.
- Hardware-Prüfung offen: ESP-NOW-Neustart der linken Hälfte. Den Master per Reset-Taste neu starten, während links getippt wird. Erwartet: `ESPNOW_RESTART` höchstens einmal pro 30 s, danach `Master erreichbar=1` ohne Reset der linken Hälfte.

## Detailpläne

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
- **ESP-NOW-Neustart nach wiederholten Sendefehlern (linke Hälfte):** Nach 5 verworfenen Ereignissen in Folge und 5 s ohne Zustellung startet die linke Hälfte ESP-NOW neu (`ESPNOW_RESTART`, höchstens einmal pro 30 s). Scheitert der Neustart, startet das Board neu. Offen: Reaktion des Masters auf einen langen Link-Ausfall — PR #17.
