#!/bin/bash
# Baut die installierte Desktop-App neu: übernimmt main.js und package.json aus dem Repository in das
# Electron-Paket und signiert es ad hoc neu. Die Weboberfläche (index.html, app.js, js/) liefert server.py
# zur Laufzeit aus dem Repository, sie gehört nicht in das Paket.
# Aufruf: npm run build:app   (Ziel ändern: DACTYL_APP=/pfad/zur/App.app npm run build:app)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${DACTYL_APP:-$HOME/Applications/Dactyl Configurator.app}"
APP_DIR="$APP/Contents/Resources/app"

if [ ! -d "$APP/Contents/Frameworks/Electron Framework.framework" ]; then
  echo "Kein Electron-Paket gefunden: $APP" >&2
  exit 1
fi
if pgrep -f "$APP/Contents/MacOS/" > /dev/null; then
  echo "Die App läuft noch. Bitte zuerst beenden: $APP" >&2
  exit 1
fi

node --check "$REPO_DIR/main.js"
mkdir -p "$APP_DIR"
cp "$REPO_DIR/main.js" "$REPO_DIR/package.json" "$APP_DIR/"
codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP"
echo "App neu gebaut: $APP"
