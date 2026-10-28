#!/bin/bash
# Erzeugt den gemeinsamen ESP-NOW-Schlüssel beider Hälften: firmware/dactyl_right/DactylSplitKey.h (Modus 0600,
# in .gitignore). Beide Sketches binden ihn über DactylSplitCrypto.h ein. Das Skript gibt keine Schlüsselwerte aus.
# Nach einem neuen Schlüssel beide Hälften flashen, sonst verstehen sie sich nicht mehr.
# Aufruf: bash scripts/generate-split-key.sh [--force]   (Ziel ändern: DACTYL_SPLIT_KEY_FILE=/pfad/Datei.h)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_FILE="${DACTYL_SPLIT_KEY_FILE:-$REPO_DIR/firmware/dactyl_right/DactylSplitKey.h}"

if [ -e "$KEY_FILE" ] && [ "${1:-}" != "--force" ]; then
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
