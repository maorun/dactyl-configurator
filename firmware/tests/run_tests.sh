#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${TMPDIR:-/tmp}/test_firmware_logic_$$"
BIN_LEFT="${TMPDIR:-/tmp}/test_left_logic_$$"
BIN_SPLIT="${TMPDIR:-/tmp}/test_split_hid_$$"
BIN_PROXY="${TMPDIR:-/tmp}/test_left_split_keyboard_$$"
trap 'rm -f "$BIN" "$BIN_LEFT" "$BIN_SPLIT" "$BIN_PROXY"' EXIT

echo "Compiling firmware unit tests with clang++..."
# -I "$DIR": Host-Ersatz für HIDTypes.h (ESP32-Core ist im Host-Build nicht vorhanden)
clang++ -std=c++17 -Wall -Wextra -I "$DIR" "$DIR/test_firmware_logic.cpp" -o "$BIN"
clang++ -std=c++17 -Wall -Wextra "$DIR/test_left_logic.cpp" -o "$BIN_LEFT"
clang++ -std=c++17 -Wall -Wextra "$DIR/test_split_hid.cpp" -o "$BIN_SPLIT"
clang++ -std=c++17 -Wall -Wextra -I "$DIR" "$DIR/test_left_split_keyboard.cpp" -o "$BIN_PROXY"

echo "Running firmware unit tests..."
"$BIN"
"$BIN_LEFT"
"$BIN_SPLIT"
"$BIN_PROXY"

rm -f "$BIN" "$BIN_LEFT" "$BIN_SPLIT" "$BIN_PROXY"
echo "All firmware tests completed successfully!"
