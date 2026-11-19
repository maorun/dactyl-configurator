#!/bin/bash
# Schreibt den Git-Kurzhash des Checkouts nach firmware/dactyl_right/DactylGitHash.h (DACTYL_GIT_HASH, nicht
# versioniert). DactylVersion.h bindet die Datei ein; ohne sie meldet die Firmware "unknown".
# Ein ungespeicherter Stand (auch eine neue, nicht ignorierte Datei) bekommt das Suffix "-dirty"; die beim Flash
# gerenderten .ino-Dateien zählen nicht.
# Ohne Git-Checkout wird eine vorhandene Datei entfernt (die Firmware meldet "unknown", kein veralteter Hash).
# Aufruf: bash scripts/generate-git-hash.sh   (Ziel ändern: DACTYL_GIT_HASH_FILE=/pfad/Datei.h)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${DACTYL_GIT_HASH_FILE:-$REPO_DIR/firmware/dactyl_right/DactylGitHash.h}"

HASH="$(git -C "$REPO_DIR" rev-parse --short=7 HEAD 2>/dev/null || true)"
if ! [[ "$HASH" =~ ^[0-9a-f]{7,12}$ ]]; then
  rm -f "$OUT_FILE"
  exit 0
fi
# Versionierte Änderungen und neue, nicht ignorierte Dateien zählen (lokale Zustandsdateien sind ignoriert)
if [ -n "$(git -C "$REPO_DIR" status --porcelain --untracked-files=normal -- . ':!firmware/dactyl_*/dactyl_*.ino' 2>/dev/null || true)" ]; then
  HASH="$HASH-dirty"
fi

mkdir -p "$(dirname "$OUT_FILE")"
TMP="$(mktemp "$OUT_FILE.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
printf '#pragma once\n// Erzeugt von scripts/generate-git-hash.sh, nicht versioniert.\n#define DACTYL_GIT_HASH "%s"\n' "$HASH" > "$TMP"
chmod 644 "$TMP"
mv "$TMP" "$OUT_FILE"
trap - EXIT
