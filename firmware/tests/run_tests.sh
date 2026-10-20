#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$DIR/test_firmware_logic"

echo "Compiling firmware unit tests with clang++..."
clang++ -std=c++17 -Wall -Wextra "$DIR/test_firmware_logic.cpp" -o "$BIN"

echo "Running firmware unit tests..."
"$BIN"

rm -f "$BIN"
echo "All firmware tests completed successfully!"
