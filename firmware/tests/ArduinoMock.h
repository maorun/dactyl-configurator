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
inline int xSemaphoreTake(SemaphoreHandle_t, uint32_t) { return pdTRUE; }
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

  bool begin(const char*, bool) { return true; }
  void end() {}
  void clear() {
    strStore.clear();
    uintStore.clear();
    bytesStore.clear();
  }

  bool isKey(const char* key) {
    if (!key) return false;
    std::string k(key);
    return (strStore.count(k) > 0 || uintStore.count(k) > 0 || bytesStore.count(k) > 0);
  }

  void putString(const char* key, String val) { strStore[key] = val.c_str(); }
  String getString(const char* key, String def = "") {
    if (strStore.count(key)) return String(strStore[key]);
    return def;
  }

  void putUInt(const char* key, uint32_t val) { uintStore[key] = val; }
  uint32_t getUInt(const char* key, uint32_t def = 0) {
    if (uintStore.count(key)) return uintStore[key];
    return def;
  }

  void putUChar(const char* key, uint8_t val) { uintStore[key] = val; }
  uint8_t getUChar(const char* key, uint8_t def = 0) {
    if (uintStore.count(key)) return (uint8_t)uintStore[key];
    return def;
  }

  void putUShort(const char* key, uint16_t val) { uintStore[key] = val; }
  uint16_t getUShort(const char* key, uint16_t def = 0) {
    if (uintStore.count(key)) return (uint16_t)uintStore[key];
    return def;
  }

  size_t putBytes(const char* key, const void* buf, size_t len) {
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

  BleKeyboard(std::string n, std::string m, uint8_t b) : name(n), mfr(m), batt(b) {}
  bool isConnected() { return connected; }
  void press(uint8_t k) { pressedKeys.push_back(k); }
  void release(uint8_t k) {
    auto it = std::find(pressedKeys.begin(), pressedKeys.end(), k);
    if (it != pressedKeys.end()) pressedKeys.erase(it);
  }
  void press(uint16_t k) { pressedMediaKeys.push_back(k); }
  void release(uint16_t k) {
    auto it = std::find(pressedMediaKeys.begin(), pressedMediaKeys.end(), k);
    if (it != pressedMediaKeys.end()) pressedMediaKeys.erase(it);
  }
  void write(uint8_t k) { writtenKeys.push_back(k); }
  void write(uint16_t k) { pressedMediaKeys.push_back(k); }
  void releaseAll() { pressedKeys.clear(); pressedMediaKeys.clear(); }
  void setDisconnected() { connected = false; }
};

// Keyboard Definitions
#define KEY_ESC 0xB1
#define KEY_RETURN 0xB0
#define KEY_BACKSPACE 0xB2
#define KEY_TAB 0xB3
#define KEY_DELETE 0xD4
#define KEY_CAPS_LOCK 0xC1
#define KEY_INSERT 0xD1
#define KEY_PRTSC 0xCE
#define KEY_UP_ARROW 0xDA
#define KEY_DOWN_ARROW 0xD9
#define KEY_LEFT_ARROW 0xD8
#define KEY_RIGHT_ARROW 0xD7
#define KEY_LEFT_CTRL 0x80
#define KEY_LEFT_SHIFT 0x81
#define KEY_LEFT_ALT 0x82
#define KEY_RIGHT_ALT 0x86
#define KEY_RIGHT_SHIFT 0x85
#define KEY_NUM_0 0xEA
#define KEY_NUM_1 0xE1
#define KEY_NUM_9 0xE9
#define KEY_F1 0xC2
#define KEY_F7 0xC8
#define KEY_F12 0xCD
#define KEY_F13 0xF0
#define KEY_F24 0xFB

#define KEY_MEDIA_PLAY_PAUSE 0xE8
#define KEY_MEDIA_MUTE 0xE2
#define KEY_MEDIA_VOLUME_UP 0xE9
#define KEY_MEDIA_VOLUME_DOWN 0xEA
#define KEY_MEDIA_NEXT_TRACK 0xEB
#define KEY_MEDIA_PREVIOUS_TRACK 0xEC
#define KEY_MEDIA_STOP 0xED
#define KEY_MEDIA_GLOBE 0x127
