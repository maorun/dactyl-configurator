#pragma once
#include <stdint.h>

// Host-Test-Ersatz für HIDTypes.h aus der ESP32-BLE-Bibliothek (gleiche Item-Präfixe laut USB-HID-Spezifikation 6.2.2)
#define HIDINPUT(size)        (0x80 | size)
#define HIDOUTPUT(size)       (0x90 | size)
#define COLLECTION(size)      (0xa0 | size)
#define END_COLLECTION(size)  (0xc0 | size)
#define USAGE_PAGE(size)      (0x04 | size)
#define LOGICAL_MINIMUM(size) (0x14 | size)
#define LOGICAL_MAXIMUM(size) (0x24 | size)
#define REPORT_SIZE(size)     (0x74 | size)
#define REPORT_ID(size)       (0x84 | size)
#define REPORT_COUNT(size)    (0x94 | size)
#define USAGE(size)           (0x08 | size)
#define USAGE_MINIMUM(size)   (0x18 | size)
#define USAGE_MAXIMUM(size)   (0x28 | size)
