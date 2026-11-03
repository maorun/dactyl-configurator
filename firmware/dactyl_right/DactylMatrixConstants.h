#pragma once
/*
 * DactylMatrixConstants.h — Gemeinsame Matrix- und Pin-Konstanten beider Hälften.
 * Zentrale Quelle für Matrix-Dimensionen, GPIO-Pin-Listen und Hardware-Combos.
 */
#include <stdint.h>

#ifndef NUM_LAYERS
#define NUM_LAYERS 8
#endif

#ifndef NUM_ROWS
#define NUM_ROWS 6
#endif

#ifndef NUM_COLS
#define NUM_COLS 7
#endif

#ifndef FINGER_ROWS
#define FINGER_ROWS 5
#endif

#ifndef FINGER_COLS
#define FINGER_COLS 6
#endif

#ifndef LEFT_NUM_ROWS
#define LEFT_NUM_ROWS 6
#endif

#ifndef LEFT_NUM_COLS
#define LEFT_NUM_COLS 7
#endif

// Pin-Listen für die rechte Hälfte (Master, LOLIN32 Lite)
// Zeilen 0..5 (oben nach unten): Gelb, Orange, Grün, Braun, Blau, Lila (Daumen)
#define ROW_PINS_RIGHT {13, 14, 27, 26, 33, 32}

// Spalten 0..6 (links nach rechts): Gelb, Orange, Grün, Braun, Blau, Lila, Rot
#define COL_PINS_RIGHT {23, 19, 18, 17, 16, 4, 25}

// Pin-Listen für die linke Hälfte (Split Sender)
// Zeilen 0..5 (oben nach unten): Gelb, Orange, Grün, Braun, Blau, Lila (Daumen)
#define ROW_PINS_LEFT {23, 19, 18, 17, 16, 4}

// Spalten 0..6 (außen links nach innen rechts): Lila, Braun, Grün, Orange, Gelb, Rot, Blau (Daumen)
#define COL_PINS_LEFT {13, 14, 27, 26, 33, 32, 25}

// Hardware-Config-Combo Koordinaten
// Rechts: R0C0 + R4C5 (Taste 6 + Taste Shift/Alt ganz rechts außen)
#define RIGHT_CONFIG_COMBO_R1 0
#define RIGHT_CONFIG_COMBO_C1 0
#define RIGHT_CONFIG_COMBO_R2 4
#define RIGHT_CONFIG_COMBO_C2 5

// Links: R0C5 + R4C0 (Taste Esc + Taste Strg ganz links außen)
#define LEFT_CONFIG_COMBO_R1 0
#define LEFT_CONFIG_COMBO_C1 5
#define LEFT_CONFIG_COMBO_R2 4
#define LEFT_CONFIG_COMBO_C2 0

// Statische Arrays für direkte Pin-Zugriffe der linken Hälfte
static const uint8_t LEFT_ROW_PINS[NUM_ROWS] = ROW_PINS_LEFT;
static const uint8_t LEFT_COL_PINS[NUM_COLS] = COL_PINS_LEFT;
