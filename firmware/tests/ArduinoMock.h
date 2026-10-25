#pragma once
#include <string>
#include <vector>
#include <map>
#include <cstdint>
#include <cstdio>
#include <cstdarg>
#include <cstring>
#include <algorithm>
#include <sstream>
#include <cctype>

// Basic Arduino Types & Constants
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2

typedef uint8_t byte;
typedef bool boolean;
typedef void* SemaphoreHandle_t;
#define pdTRUE 1
#define pdFALSE 0
#define pdMS_TO_TICKS(ms) (ms)

inline SemaphoreHandle_t xSemaphoreCreateMutex() { return (void*)1; }
static bool _mock_mutex_busy = false;
inline int xSemaphoreTake(SemaphoreHandle_t, uint32_t) { return _mock_mutex_busy ? pdFALSE : pdTRUE; }
inline void xSemaphoreGive(SemaphoreHandle_t) {}

// Mock Time
static unsigned long _mock_millis = 1000;
inline unsigned long millis() { return _mock_millis; }
inline void advanceMillis(unsigned long ms) { _mock_millis += ms; }
inline void setMillis(unsigned long ms) { _mock_millis = ms; }
inline void delay(unsigned long ms) { _mock_millis += ms; }
inline void delayMicroseconds(unsigned int) {}

// Mock GPIO
static uint8_t _mock_pin_mode[40] = {0};
static uint8_t _mock_pin_state[40] = {HIGH};
inline void pinMode(uint8_t pin, uint8_t mode) { if (pin < 40) _mock_pin_mode[pin] = mode; }
inline void digitalWrite(uint8_t pin, uint8_t val) { if (pin < 40) _mock_pin_state[pin] = val; }
inline int digitalRead(uint8_t pin) { return (pin < 40) ? _mock_pin_state[pin] : HIGH; }

// Arduino String Class Mock
class String {
private:
  std::string s;
public:
  String() : s("") {}
  String(const char* c) : s(c ? c : "") {}
  String(const std::string& str) : s(str) {}
  String(int v) : s(std::to_string(v)) {}
  String(unsigned int v) : s(std::to_string(v)) {}
  String(long v) : s(std::to_string(v)) {}
  String(unsigned long v) : s(std::to_string(v)) {}
  String(char c) : s(1, c) {}

  const char* c_str() const { return s.c_str(); }
  size_t length() const { return s.length(); }
  bool startsWith(const String& prefix) const {
    if (prefix.s.length() > s.length()) return false;
    return s.compare(0, prefix.s.length(), prefix.s) == 0;
  }
  bool endsWith(const String& suffix) const {
    if (suffix.s.length() > s.length()) return false;
    return s.compare(s.length() - suffix.s.length(), suffix.s.length(), suffix.s) == 0;
  }
  int indexOf(char ch, size_t fromIndex = 0) const {
    size_t pos = s.find(ch, fromIndex);
    return (pos == std::string::npos) ? -1 : (int)pos;
  }
  String substring(size_t from, size_t to = std::string::npos) const {
    if (from >= s.length()) return String("");
    if (to == std::string::npos) return String(s.substr(from));
    return String(s.substr(from, to - from));
  }
  void trim() {
    size_t first = s.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) { s = ""; return; }
    size_t last = s.find_last_not_of(" \t\r\n");
    s = s.substr(first, (last - first + 1));
  }
  void replace(const String& from, const String& to) {
    if (from.s.empty()) return;
    size_t pos = 0;
    while ((pos = s.find(from.s, pos)) != std::string::npos) {
      s.replace(pos, from.s.length(), to.s);
      pos += to.s.length();
    }
  }
  int toInt() const {
    try { return std::stoi(s); } catch (...) { return 0; }
  }
  char charAt(size_t idx) const { return (idx < s.length()) ? s[idx] : 0; }

  bool operator==(const String& o) const { return s == o.s; }
  bool operator!=(const String& o) const { return s != o.s; }
  String operator+(const String& o) const { return String(s + o.s); }
  String& operator+=(const String& o) { s += o.s; return *this; }
  String& operator+=(char c) { s += c; return *this; }
  bool operator<(const String& o) const { return s < o.s; }
};

inline String operator+(const char* a, const String& b) { return String(a) + b; }

// Mock Serial
class MockSerial {
public:
  std::vector<std::string> outputLines;
  std::string rxBuffer;

  void begin(unsigned long) {}
  void setRxBufferSize(size_t) {}
  void flush() {}

  void print(const String& s) { outputLines.push_back(s.c_str()); }
  void println(const String& s = "") { outputLines.push_back(s.c_str()); }
  void println(const char* s) { outputLines.push_back(s ? s : ""); }

  void printf(const char* fmt, ...) {
    char buf[512];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    outputLines.push_back(buf);
  }

  int available() { return (int)rxBuffer.length(); }
  int read() {
    if (rxBuffer.empty()) return -1;
    char c = rxBuffer[0];
    rxBuffer.erase(0, 1);
    return (uint8_t)c;
  }
  void feed(const std::string& input) { rxBuffer += input; }
  void clear() { outputLines.clear(); rxBuffer.clear(); }
};
static MockSerial Serial;

// Mock Preferences (NVS)
class Preferences {
public:
  static std::map<std::string, std::string> strStore;
  static std::map<std::string, uint32_t> uintStore;
  static std::map<std::string, std::vector<uint8_t>> bytesStore;
  static bool failWrites; // Simuliert volle/defekte NVS-Partition
  static std::string failBytesKey; // Simuliert einen fehlschlagenden putBytes für genau diesen Key

  bool begin(const char*, bool) { return true; }
  void end() {}
  bool clear() {
    if (failWrites) return false;
    strStore.clear();
    uintStore.clear();
    bytesStore.clear();
    return true;
  }
  bool remove(const char* key) {
    strStore.erase(key); uintStore.erase(key); bytesStore.erase(key);
    return true;
  }

  bool isKey(const char* key) {
    if (!key) return false;
    std::string k(key);
    return (strStore.count(k) > 0 || uintStore.count(k) > 0 || bytesStore.count(k) > 0);
  }

  size_t putString(const char* key, String val) { if (failWrites) return 0; strStore[key] = val.c_str(); return val.length(); }
  String getString(const char* key, String def = "") {
    if (strStore.count(key)) return String(strStore[key]);
    return def;
  }

  size_t putUInt(const char* key, uint32_t val) { if (failWrites) return 0; uintStore[key] = val; return 4; }
  uint32_t getUInt(const char* key, uint32_t def = 0) {
    if (uintStore.count(key)) return uintStore[key];
    return def;
  }

  size_t putUChar(const char* key, uint8_t val) { if (failWrites) return 0; uintStore[key] = val; return 1; }
  uint8_t getUChar(const char* key, uint8_t def = 0) {
    if (uintStore.count(key)) return (uint8_t)uintStore[key];
    return def;
  }

  size_t putUShort(const char* key, uint16_t val) { if (failWrites) return 0; uintStore[key] = val; return 2; }
  uint16_t getUShort(const char* key, uint16_t def = 0) {
    if (uintStore.count(key)) return (uint16_t)uintStore[key];
    return def;
  }

  size_t putBytes(const char* key, const void* buf, size_t len) {
    if (failWrites || failBytesKey == key) return 0;
    const uint8_t* p = (const uint8_t*)buf;
    bytesStore[key] = std::vector<uint8_t>(p, p + len);
    return len;
  }
  size_t getBytesLength(const char* key) {
    if (bytesStore.count(key)) return bytesStore[key].size();
    return 0;
  }
  size_t getBytes(const char* key, void* buf, size_t maxLen) {
    if (!bytesStore.count(key)) return 0;
    const auto& vec = bytesStore[key];
    size_t copyLen = std::min(maxLen, vec.size());
    memcpy(buf, vec.data(), copyLen);
    return copyLen;
  }
};
std::map<std::string, std::string> Preferences::strStore;
std::map<std::string, uint32_t> Preferences::uintStore;
std::map<std::string, std::vector<uint8_t>> Preferences::bytesStore;
bool Preferences::failWrites = false;
std::string Preferences::failBytesKey;

enum esp_reset_reason_t { ESP_RST_POWERON = 1, ESP_RST_SW = 3, ESP_RST_DEEPSLEEP = 5 };

// Mock BLE
#define ESP_MAC_BT 2
#define ESP_MAC_BASE 0
typedef uint8_t esp_bd_addr_t[6];
inline void esp_read_mac(uint8_t* mac, int) {
  mac[0] = 0x2E; mac[1] = 0xBC; mac[2] = 0xBB;
  mac[3] = 0x81; mac[4] = 0x61; mac[5] = 0xA8;
}
inline int esp_ble_gap_set_rand_addr(esp_bd_addr_t) { return 0; }
inline int esp_ble_gap_set_device_name(const char*) { return 0; }

class BLECharacteristic {
public:
  std::string value;
  std::vector<std::string> notifications;
  void setValue(const char* v) { value = v ? v : ""; }
  void notify() { notifications.push_back(value); }
};

// Report-IDs, Maus-Buttons & Report-Descriptor direkt aus der Firmware
// ("HIDTypes.h" wird zuerst im Testordner gefunden: Host-Ersatz ohne ESP32-Core)
#include "../dactyl_right/DactylHidDescriptor.h"

// Keycodes & Report-Typen direkt aus der Firmware (keine doppelte Pflege im Mock)
#include "../dactyl_right/DactylKeycodes.h"

// Media-Report als 16-Bit-Wert (Bitposition wie im Consumer-Report-Descriptor)
inline uint16_t mediaBits(const MediaKeyReport k) { return (uint16_t)(k[0] | (k[1] << 8)); }

// BleKeyboard Mock
class BleKeyboard {
public:
  std::string name;
  std::string mfr;
  uint8_t batt;
  bool connected = true;
  std::vector<uint8_t> pressedKeys;
  std::vector<uint8_t> writtenKeys;
  std::vector<uint16_t> pressedMediaKeys;
  uint8_t mouseButtons = 0;
  std::vector<uint8_t> clickedMouseButtons;
  std::vector<int8_t> mouseScrolls;

  BleKeyboard(std::string n, std::string m, uint8_t b) : name(n), mfr(m), batt(b) {}
  bool isConnected() { return connected; }
  std::vector<uint8_t> pressHistory; // jeder press() an den Host, wird von releaseAll() nicht geleert
  std::vector<int> keyEvents;        // +code = press, -code = release, in Aufrufreihenfolge
  void press(uint8_t k) { pressedKeys.push_back(k); pressHistory.push_back(k); keyEvents.push_back(k); }
  void release(uint8_t k) {
    keyEvents.push_back(-(int)k);
    auto it = std::find(pressedKeys.begin(), pressedKeys.end(), k);
    if (it != pressedKeys.end()) pressedKeys.erase(it);
  }
  std::vector<uint16_t> writtenMediaKeys;
  void press(const MediaKeyReport k) { pressedMediaKeys.push_back(mediaBits(k)); }
  void release(const MediaKeyReport k) {
    auto it = std::find(pressedMediaKeys.begin(), pressedMediaKeys.end(), mediaBits(k));
    if (it != pressedMediaKeys.end()) pressedMediaKeys.erase(it);
  }
  void write(uint8_t k) { writtenKeys.push_back(k); }
  void write(const MediaKeyReport k) { writtenMediaKeys.push_back(mediaBits(k)); }

  void mousePress(uint8_t btn) { mouseButtons |= btn; }
  void mouseRelease(uint8_t btn) { mouseButtons &= ~btn; }
  void mouseClick(uint8_t btn) { clickedMouseButtons.push_back(btn); }
  void mouseScroll(int8_t wheel) { mouseScrolls.push_back(wheel); }

  void releaseAll() {
    pressedKeys.clear();
    pressedMediaKeys.clear();
    writtenMediaKeys.clear();
    mouseButtons = 0;
    clickedMouseButtons.clear();
    mouseScrolls.clear();
  }
  void setDisconnected() { connected = false; }
};
