#!/bin/bash
# Baut die installierte Desktop-App neu: kopiert main.js, package.json, server.py, die Weboberfläche, die
# Config-Vorlagen und die Firmware-Quellen in das Electron-Paket und signiert es ad hoc neu. Die App braucht
# danach kein Repository. Ihren Laufzeitzustand (current_config*.json, gerenderte Firmware) schreibt server.py
# in das Datenverzeichnis; fehlt dort eine Nutzer-Config, übernimmt das Skript die des Repositorys einmalig.
# Aufruf: npm run build:app   (Ziel ändern: DACTYL_APP=/pfad/zur/App.app npm run build:app)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${DACTYL_APP:-$HOME/Applications/Dactyl Configurator.app}"
APP_DIR="$APP/Contents/Resources/app"
# Gleicher Pfad wie in main.js: app.getPath('userData') + /data (userData folgt dem Namen in package.json)
DATA_DIR="${DACTYL_DATA_DIR:-$HOME/Library/Application Support/dactyl-configurator/data}"

if [ ! -d "$APP/Contents/Frameworks/Electron Framework.framework" ]; then
  echo "Kein Electron-Paket gefunden: $APP" >&2
  exit 1
fi
if pgrep -f "$APP/Contents/MacOS/" > /dev/null; then
  echo "Die App läuft noch. Bitte zuerst beenden: $APP" >&2
  exit 1
fi

node --check "$REPO_DIR/main.js"
python3 -m py_compile "$REPO_DIR/server.py"

# Erst vollständig neben dem Ziel aufbauen, dann ersetzen: alte Dateien früherer Versionen bleiben nicht liegen
STAGE="$APP_DIR.new"
rm -rf "$STAGE"
mkdir -p "$STAGE/js" "$STAGE/firmware"
cp "$REPO_DIR/main.js" "$REPO_DIR/package.json" "$REPO_DIR/server.py" \
   "$REPO_DIR/index.html" "$REPO_DIR/app.js" "$REPO_DIR/style.css" \
   "$REPO_DIR/default_config.json" "$REPO_DIR/default_config_left.json" "$STAGE/"
cp "$REPO_DIR"/js/*.js "$STAGE/js/"
cp -R "$REPO_DIR/firmware/dactyl_right" "$REPO_DIR/firmware/dactyl_left" "$STAGE/firmware/"

# Altes Verzeichnis erst zur Seite legen und erst nach bestandener Signaturprüfung löschen: ein Abbruch oder ein
# Signaturfehler hinterlässt nie ein Paket ohne App-Verzeichnis oder mit ungültiger Signatur. Das Backup liegt
# neben dem Paket, nicht darin: codesign versiegelt sonst auch das Backup, und sein Löschen bricht die Signatur.
OLD="$(dirname "$APP")/.$(basename "$APP").app-dir.old"
# Ein früherer Lauf wurde abgebrochen: entweder zwischen den beiden Verschiebungen (kein App-Verzeichnis), oder
# nach dem Einsetzen der neuen App vor der bestandenen Signaturprüfung. In beiden Fällen ist die gültige App das
# Backup. Es wird nur gelöscht, wenn das vorhandene Paket gültig signiert ist.
if [ -d "$OLD" ]; then
  if [ ! -d "$APP_DIR" ] || ! codesign --verify --deep "$APP" 2>/dev/null; then
    echo "Abgebrochener Lauf erkannt: vorherige App wird aus $OLD wiederhergestellt." >&2
    rm -rf "$APP_DIR"
    mv "$OLD" "$APP_DIR"
  fi
fi
rm -rf "$OLD"
restore_old() {
  echo "Fehler beim Austausch oder Signieren: vorherige App wird wiederhergestellt." >&2
  rm -rf "$APP_DIR"
  if [ -d "$OLD" ]; then
    mv "$OLD" "$APP_DIR"
    codesign --force --deep --sign - "$APP" || true
    codesign --verify --deep "$APP" || echo "WARNUNG: Die Signatur der wiederhergestellten App ist ungültig: $APP" >&2
  fi
}
if [ -d "$APP_DIR" ]; then
  mv "$APP_DIR" "$OLD"
fi
trap restore_old ERR
trap 'restore_old; exit 130' INT
trap 'restore_old; exit 143' TERM
mv "$STAGE" "$APP_DIR"
codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP"
trap - ERR INT TERM
rm -rf "$OLD"

mkdir -p "$DATA_DIR"
for name in current_config.json current_config_left.json; do
  if [ -f "$REPO_DIR/$name" ] && [ ! -e "$DATA_DIR/$name" ]; then
    cp -p "$REPO_DIR/$name" "$DATA_DIR/$name"
    echo "Nutzer-Config übernommen: $DATA_DIR/$name"
  fi
done

echo "App neu gebaut: $APP"
