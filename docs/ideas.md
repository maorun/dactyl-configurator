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

- **Echte LiPo-Spannungsmessung** `[Firmware]` — *Nutzen: hoch · Aufwand: mittel* — `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert). Ohne Anzeige fällt die Tastatur ohne Vorwarnung aus. Braucht einen Hardware-Umbau (Spannungsteiler), deshalb unter den Split-Fehlern.
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
- `js/config-sync.js:76`: Die Schrittzahl des Syncs (`+ 9`) entspricht jetzt genau den festen Schritten. Folge: Eine weitere Einstellung lässt den Fortschritt über 100 % laufen; `Math.min` verdeckt das. Korrektur: Die Schrittzahl aus einer gezählten Befehlsliste ableiten.
- `js/config-sync.js:96`: Der volle Sync sendet `SET_TAPPING_TERM` auch an Firmware ohne diesen Befehl. Folge: Alte Firmware antwortet `ERR UNKNOWN`, und der Sync bricht vor den Tasten ab. Korrektur: `ERR UNKNOWN` für diesen Befehl tolerieren oder dokumentieren, dass zuerst ein Flash nötig ist.
- `firmware/tests/test_firmware_logic.cpp:1957`: Der Test prüft nur die Ablehnung von 99 und 501 und die Annahme von 300. Folge: Ein Off-by-one an den Grenzen 100 und 500 fällt nicht auf. Korrektur: Annahme von 100 und 500 prüfen.
- `firmware/tests/test_firmware_logic.cpp:1971`: Kein Test lädt einen gespeicherten `tap_term` außerhalb des Bereichs. Folge: Die Bereichsprüfung in `loadKeymapFromNVS` ist ungetestet. Korrektur: 50 direkt in NVS schreiben, `loadKeymapFromNVS` aufrufen und den Standardwert prüfen.
- Hardware-Prüfung offen: Tottaste Alt + u eines Umlauts auf der linken Hälfte am Mac testen. Der Host-Test prüft nur die Reihenfolge der `SplitHidEvent`s; der Master sendet sie ohne Abstand.
- `firmware/dactyl_left/dactyl_left.ino:574`: Der Aufruf `shouldRestartEspNow(restartGuard, millis(), true)` übergibt für `allowed` immer `true`. Config Mode und Deep Sleep sperren den Neustart nur, weil diese Pfade die Prüfung nie erreichen. Folge: Die Tests prüfen nur den Parameter; ein entfernter Schutz fällt nicht auf. Korrektur: Eine reine Gate-Funktion in `DactylLeftLogic.h` mit Config- und Sleep-Zustand anlegen und testen.
- `firmware/dactyl_left/dactyl_left.ino:339`: `restartEspNow()` leert die Warteschlange und sendet `RELEASE_ALL`, behält aber den gedrückten Zustand in `DactylLogic.h`. Folge: Eine während des Neustarts gehaltene Taste ist nur am Master gelöst; ein gehaltener Modifier fehlt danach. Korrektur: Das Verhalten in `AGENTS.md` dokumentieren oder gehaltene Tasten nach dem Neustart erneut drücken.
- `firmware/dactyl_left/dactyl_left.ino:574`: Ist der Master aus oder im Deep Sleep, startet die linke Hälfte ESP-NOW alle 30 s neu. Folge: Jeder Neustart kostet Strom und blockiert `loop()` für etwa 20 ms. Korrektur: Den Backoff exponentiell steigern oder nach N Neustarts ohne Zustellung aussetzen.
- Hardware-Prüfung offen: ESP-NOW-Neustart der linken Hälfte. Den Master per Reset-Taste neu starten, während links getippt wird. Erwartet: `ESPNOW_RESTART` höchstens einmal pro 30 s, danach `Master erreichbar=1` ohne Reset der linken Hälfte.
- `firmware/dactyl_right/dactyl_right.ino` (`sendSplitActivityIfDue`): Der Master prüft den Rückgabewert von `esp_now_send` nicht. Folge: Ein fehlgeschlagener Versand verbraucht die Vormerkung; das nächste `ACTIVITY` folgt erst nach dem nächsten Tastendruck und Intervall. Korrektur: Rückgabewert prüfen und bei Fehler `splitActivityNote` erneut aufrufen.
- `firmware/dactyl_left/dactyl_left.ino` (`loop`, Block `masterActivityReceived`): Kein Host-Test deckt das Rücksetzen des Timers links ab. Folge: Ein entfernter oder verschobener Block fällt in keinem Test auf. Korrektur: Das Rücksetzen in eine reine Funktion in einem Header verschieben und testen.
- `firmware/dactyl_right/dactyl_right.ino` (Matrix-Scan, `splitActivityNote`): Kein Test prüft, dass ein Tastenwechsel am Master `ACTIVITY` vormerkt. Folge: Ein fehlender Aufruf fällt nur auf der Hardware auf. Korrektur: Den Aufruf in eine testbare Funktion auslagern oder in der Hardware-Prüfung unten abdecken.
- `AGENTS.md` (Abschnitt 2a): Ein Sender mit gefälschter Master-MAC hält die linke Hälfte per `ACTIVITY` wach. Folge: nur Stromverbrauch, keine HID-Wirkung; passt zur akzeptierten Designentscheidung. Korrektur: Einen Satz zu diesem Risiko in Abschnitt 2a ergänzen oder das Problem korrigieren
- `firmware/dactyl_left/dactyl_left.ino` (`loop`): Das Rücksetzen läuft nur außerhalb des Config Mode; ein vorher gesetztes `masterActivityReceived` bleibt stehen. Folge: keine, weil der Config Mode mit `ESP.restart()` endet. Korrektur: Einen Code-Kommentar ergänzen.
- `docs/ideas.md` (Einträge zu `dactyl_left.ino:339` und `:574`): Der Merge von PR #18 verschiebt `restartEspNow()` und den Aufruf von `shouldRestartEspNow` in `loop()` um etwa 6 Zeilen. Folge: Die Zeilennummern stimmen nicht mehr. Korrektur: Die Einträge auf Funktionsnamen statt Zeilennummern umstellen.
- `firmware/dactyl_left/dactyl_left.ino` (`setupEspNow`, `esp_now_register_recv_cb`): Ein Fehler beim Registrieren des Empfangs-Callbacks erzeugt nur eine Serial-Zeile. Folge: Die linke Hälfte schläft dann ohne Meldung nach eigener Inaktivität ein. Korrektur: Den Fehler als Setup-Fehler behandeln oder im Status melden.
- Hardware-Prüfung offen: Synchronisierte Inaktivitäts-Timer. 6 Min nur rechts tippen; links darf nicht in Standby gehen (Serial `[POWER]`), und linke Tasten kommen ohne Verzögerung an. Der Host-Test prüft nur Parser und Drosselung, nicht den Funkweg Master -> links.

## Detailpläne

Derzeit kein offener Plan.

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
- **Konfigurierbarer Tapping-Term:** `tappingTermMs` (100–500 ms, Standard 200) pro Hälfte in NVS und App; steuert Mod-Tap und Tap-Dance — PR #19.
- **ESP-NOW-Neustart nach wiederholten Sendefehlern (linke Hälfte):** Nach 5 verworfenen Ereignissen in Folge und 5 s ohne Zustellung startet die linke Hälfte ESP-NOW neu (`ESPNOW_RESTART`, höchstens einmal pro 30 s). Scheitert der Neustart, startet das Board neu. Offen: Reaktion des Masters auf einen langen Link-Ausfall — PR #17.
- **Synchronisierte Inaktivitäts-Timer:** Tippen am Master meldet `SPLIT_OP_ACTIVITY` (höchstens alle 10 s) an die linke Hälfte; sie geht nicht mehr in Standby oder Deep Sleep, solange rechts getippt wird.
