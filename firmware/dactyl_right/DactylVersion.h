#pragma once
/*
 * DactylVersion.h — Firmwarestand beider Hälften (DEVICE_INFO "fw", SPLIT_OP_FW_VERSION).
 * Erhöhe den Wert bei jeder Änderung an Split-Protokoll, Konfig-Befehlen oder NVS-Format.
 * Beide Hälften teilen den Wert; die App meldet "Beide Hälften flashen", wenn er abweicht.
 * Wertebereich 1..65535 (0 = unbekannt). Keine Arduino- oder ESP-IDF-Abhängigkeit.
 */
#define DACTYL_FW_VERSION 61

/*
 * DACTYL_GIT_HASH — Git-Kurzhash des Builds (GIT_INFO "githash"). scripts/generate-git-hash.sh schreibt
 * DactylGitHash.h (nicht versioniert); ohne die Datei gilt "unknown".
 */
#if defined(__has_include)
#if __has_include("DactylGitHash.h")
#include "DactylGitHash.h"
#endif
#endif
#ifndef DACTYL_GIT_HASH
#define DACTYL_GIT_HASH "unknown"
#endif
