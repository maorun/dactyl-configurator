#!/bin/bash
# Baut die installierte Desktop-App neu und startet sie neu: beendet die laufende App sauber (der before-quit-Hook
# in main.js stoppt server.py), baut sie mit build-app.sh und öffnet sie wieder. Prüft danach, dass ein neuer
# server.py auf Port 8088 läuft und antwortet. Beendet nie einen Prozess mit kill.
# Aufruf: npm run rebuild:app   (Ziel ändern: DACTYL_APP=/pfad/zur/App.app npm run rebuild:app)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${DACTYL_APP:-$HOME/Applications/Dactyl Configurator.app}"
# Schrägstriche am Ende entfernen, damit "$APP/Contents/MacOS/" kein "//" enthält
while [ "${APP%/}" != "$APP" ]; do APP="${APP%/}"; done
if [ -z "$APP" ]; then
  echo "DACTYL_APP ergibt keinen App-Pfad (nur Schrägstriche)." >&2
  exit 1
fi
QUIT_TIMEOUT="${DACTYL_QUIT_TIMEOUT:-20}"
START_TIMEOUT="${DACTYL_START_TIMEOUT:-30}"
PORT=8088

# pgrep -f erwartet einen Regex: Sonderzeichen im App-Pfad (z. B. ".", "(", "+") wörtlich nehmen
regex_escape() { printf '%s' "$1" | sed 's/[][\\.*^$+?(){}|]/\\&/g'; }
APP_PATTERN="$(regex_escape "$APP/Contents/MacOS/")"
app_running() { pgrep -f "$APP_PATTERN" > /dev/null; }
server_pid() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true; }

# Wartet bis zu $1 Sekunden, bis Befehl $2 erfolgreich ist
wait_for() {
  local limit=$(( $1 * 2 )) i=0
  while [ "$i" -lt "$limit" ]; do
    if "$2"; then return 0; fi
    sleep 0.5
    i=$(( i + 1 ))
  done
  "$2"
}

app_stopped() { ! app_running; }
port_free() { [ -z "$(server_pid)" ]; }
new_server_up() {
  local pid
  pid="$(server_pid)"
  [ -n "$pid" ] && [ "$pid" != "$OLD_PID" ]
}

# build-app.sh kopiert server.py, Oberfläche und Firmware des aufrufenden Checkouts in das Paket.
# Aus einem Worktree gebaut, enthält die installierte App dessen Branch-Stand statt master.
# In einem Git-Worktree ist .git eine Datei, im Haupt-Checkout ein Verzeichnis.
if [ -f "$REPO_DIR/.git" ]; then
  echo "WARNUNG: $REPO_DIR ist ein Worktree, nicht der Haupt-Checkout. Die App enthält danach den Stand dieses Branches." >&2
fi

OLD_PID="$(server_pid)"
if app_running; then
  echo "Beende die App: $APP"
  if ! osascript -e "tell application \"$APP\" to quit"; then
    echo "osascript konnte die App nicht beenden: $APP. Bitte die Automation-Berechtigung prüfen (Systemeinstellungen > Datenschutz & Sicherheit > Automation)." >&2
    exit 1
  fi
  if ! wait_for "$QUIT_TIMEOUT" app_stopped; then
    echo "Die App läuft nach ${QUIT_TIMEOUT} s noch. Bitte von Hand beenden: $APP" >&2
    exit 1
  fi
fi
# main.js verwendet einen laufenden Server weiter (ensureServer): ohne freien Port lädt die App kein neues server.py
if ! wait_for "$QUIT_TIMEOUT" port_free; then
  echo "Port $PORT ist noch belegt (PID $(server_pid)), aber die App läuft nicht. Diesen Server bitte von Hand beenden." >&2
  exit 1
fi

if ! bash "$REPO_DIR/scripts/build-app.sh"; then
  echo "Build fehlgeschlagen. Die App ist beendet; nach der Korrektur erneut ausführen: npm run rebuild:app" >&2
  exit 1
fi

echo "Starte die App: $APP"
open -a "$APP"
if ! wait_for "$START_TIMEOUT" new_server_up; then
  echo "Kein neuer server.py auf Port $PORT nach ${START_TIMEOUT} s (alte PID: ${OLD_PID:-keine})." >&2
  exit 1
fi
STATUS="$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" -H "Host: localhost:$PORT" "http://127.0.0.1:$PORT/" || true)"
if [ "$STATUS" != "200" ]; then
  echo "server.py antwortet mit HTTP $STATUS statt 200." >&2
  exit 1
fi
echo "App neu gestartet: server.py PID ${OLD_PID:-keine} -> $(server_pid), HTTP $STATUS"
