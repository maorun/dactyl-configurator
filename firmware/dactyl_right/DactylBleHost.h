#pragma once
/*
 * DactylBleHost.h — BLE-Host-Slots (ACT_HOST_1 .. ACT_HOST_3). Keine Arduino- oder ESP-IDF-Abhängigkeit.
 *
 * Jeder Slot hat eine eigene statische Random-Adresse, die aus der Basis-MAC folgt. Damit koppelt jeder Host
 * (zweiter Mac, iPad) unabhängig; macOS cacht die Report Map je Adresse. Die Adresse des Config Mode
 * (DactylConfigBle.h) bleibt eine eigene und fällt nie mit einer Slot-Adresse zusammen.
 */
#include <stdint.h>
#include <string.h>

#define BLE_HOST_SLOTS    3
#define BLE_HOST_DEFAULT  1

inline bool isValidBleHostSlot(int slot) { return slot >= 1 && slot <= BLE_HOST_SLOTS; }

// Statische Random-Adresse des Slots 1..3: die beiden obersten Bits von addr[0] sind 11b. Byte 1 trägt den Slot,
// die Adressen von Slot 1..3 und die des Config Mode (ändert nur Byte 4 und 5) sind damit paarweise verschieden.
inline bool bleHostAddress(const uint8_t base[6], int slot, uint8_t out[6]) {
  if (!isValidBleHostSlot(slot)) return false;
  memcpy(out, base, 6);
  out[0] |= 0xC0;
  out[1] ^= (uint8_t)(0x30 + slot);
  return true;
}
