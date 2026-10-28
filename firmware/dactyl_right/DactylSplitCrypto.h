#pragma once
/*
 * DactylSplitCrypto.h — Verschlüsselung der ESP-NOW-Strecke zwischen beiden Hälften (CCMP mit PMK + LMK).
 *
 * Der Schlüssel liegt in DactylSplitKey.h neben dieser Datei. Die Datei ist nicht versioniert (.gitignore, Modus
 * 0600); scripts/generate-split-key.sh erzeugt sie. Ohne Schlüssel bricht der Build ab: eine Firmware ohne
 * Verschlüsselung entsteht nie still. Beide Hälften brauchen denselben Schlüssel.
 *
 * Eingebunden von beiden Sketches und den Host-Tests (firmware/tests/test_split_hid.cpp; sie definieren einen
 * Testschlüssel vor dem Include). Keine Arduino- oder ESP-IDF-Abhängigkeit: der Aufrufer übergibt die Peer-Felder
 * und setzt die PMK selbst.
 */
#include <stdint.h>
#include <string.h>

#ifndef DACTYL_SPLIT_KEY_PRESENT
#if __has_include("DactylSplitKey.h")
#include "DactylSplitKey.h"
#endif
#endif
#ifndef DACTYL_SPLIT_KEY_PRESENT
#error "ESP-NOW-Schlüssel fehlt: bash scripts/generate-split-key.sh ausführen, dann beide Hälften flashen."
#endif

#define SPLIT_ESPNOW_KEY_LEN 16
static_assert(sizeof(SPLIT_ESPNOW_PMK) == SPLIT_ESPNOW_KEY_LEN, "PMK muss 16 Byte lang sein");
static_assert(sizeof(SPLIT_ESPNOW_LMK) == SPLIT_ESPNOW_KEY_LEN, "LMK muss 16 Byte lang sein");

// Verschlüsselten Peer vorbereiten: encrypt und lmk eines esp_now_peer_info_t (Felder als Referenz und Zeiger,
// damit die Host-Tests ohne ESP-IDF laufen). Die PMK setzt der Aufrufer vorher mit esp_now_set_pmk(SPLIT_ESPNOW_PMK).
inline void splitPeerSetEncryption(bool &encrypt, uint8_t *lmk) {
  encrypt = true;
  memcpy(lmk, SPLIT_ESPNOW_LMK, SPLIT_ESPNOW_KEY_LEN);
}
