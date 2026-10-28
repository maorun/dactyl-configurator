#!/bin/bash
# Erzeugt den gemeinsamen ESP-NOW-Schlüssel beider Hälften: firmware/dactyl_right/DactylSplitKey.h (Modus 0600,
# in .gitignore). Beide Sketches binden ihn über DactylSplitCrypto.h ein. Das Skript gibt keine Schlüsselwerte aus.
# Nach einem neuen Schlüssel beide Hälften flashen, sonst verstehen sie sich nicht mehr.
# Aufruf: bash scripts/generate-split-key.sh [--force | --if-missing]   (Ziel ändern: DACTYL_SPLIT_KEY_FILE=/pfad/Datei.h)
# --if-missing: einen vorhandenen Schlüssel behalten und ohne Fehler enden (npm run build:app / rebuild:app). Der
# vorhandene Schlüssel wird nur im Aufbau geprüft (keine Werte in der Ausgabe) und auf Modus 0600 gesetzt.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_FILE="${DACTYL_SPLIT_KEY_FILE:-$REPO_DIR/firmware/dactyl_right/DactylSplitKey.h}"

MODE="${1:-}"
if [ $# -gt 1 ] || { [ -n "$MODE" ] && [ "$MODE" != "--force" ] && [ "$MODE" != "--if-missing" ]; }; then
  echo "Aufruf: bash scripts/generate-split-key.sh [--force | --if-missing]" >&2
  exit 2
fi

# Aufbau wie unten erzeugt: Marker und je 16 Bytes PMK und LMK
key_file_is_valid() {
  local byte='0x[0-9a-f]{2}' n
  grep -q '^#define DACTYL_SPLIT_KEY_PRESENT 1$' "$1" || return 1
  for n in PMK LMK; do
    grep -Eq "^static const uint8_t SPLIT_ESPNOW_$n\[16\] = \{($byte, ){15}$byte\};$" "$1" || return 1
  done
}

if [ -e "$KEY_FILE" ] && [ "$MODE" = "--if-missing" ]; then
  if ! key_file_is_valid "$KEY_FILE"; then
    echo "Schlüsseldatei ist beschädigt: $KEY_FILE (neu erzeugen mit --force, danach beide Hälften flashen)" >&2
    exit 1
  fi
  chmod 600 "$KEY_FILE"
  exit 0
fi
if [ -e "$KEY_FILE" ] && [ "$MODE" != "--force" ]; then
  echo "Schlüssel existiert bereits: $KEY_FILE (neu erzeugen mit --force, danach beide Hälften flashen)" >&2
  exit 1
fi

# 16 Zufallsbytes als C-Initialisierer: 0x12, 0x34, ...
random_bytes() {
  local hex
  hex="$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')"
  if [ "${#hex}" -ne 32 ]; then
    echo "Zufallsbytes konnten nicht gelesen werden" >&2
    return 1
  fi
  echo "$hex" | sed -e 's/\(..\)/0x\1, /g' -e 's/, $//'
}
PMK="$(random_bytes)"
LMK="$(random_bytes)"

umask 077
TMP="$(mktemp "$KEY_FILE.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<HEADER
#pragma once
// Erzeugt von scripts/generate-split-key.sh. Geheim: nicht committen, nicht weitergeben.
#include <stdint.h>
#define DACTYL_SPLIT_KEY_PRESENT 1
static const uint8_t SPLIT_ESPNOW_PMK[16] = {$PMK};
static const uint8_t SPLIT_ESPNOW_LMK[16] = {$LMK};
HEADER
chmod 600 "$TMP"
mv "$TMP" "$KEY_FILE"
trap - EXIT
echo "ESP-NOW-Schlüssel erzeugt: $KEY_FILE (Modus 0600). Jetzt beide Hälften flashen."
