#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${TMPDIR:-/tmp}/test_firmware_logic_$$"
trap 'rm -f "$BIN"' EXIT

echo "Compiling firmware unit tests with clang++..."
# -I "$DIR": Host-Ersatz für HIDTypes.h (ESP32-Core ist im Host-Build nicht vorhanden)
clang++ -std=c++17 -Wall -Wextra -I "$DIR" "$DIR/test_firmware_logic.cpp" -o "$BIN"

echo "Running firmware unit tests..."
"$BIN"

rm -f "$BIN"
echo "All firmware tests completed successfully!"
