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
rm -rf "$APP_DIR"
mv "$STAGE" "$APP_DIR"

mkdir -p "$DATA_DIR"
for name in current_config.json current_config_left.json; do
  if [ -f "$REPO_DIR/$name" ] && [ ! -e "$DATA_DIR/$name" ]; then
    cp -p "$REPO_DIR/$name" "$DATA_DIR/$name"
    echo "Nutzer-Config übernommen: $DATA_DIR/$name"
  fi
done

codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP"
echo "App neu gebaut: $APP"
