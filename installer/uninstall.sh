#!/usr/bin/env bash
# Remove ArduinoBot from Arduino IDE (macOS/Linux).
#
#   curl -sSL https://github.com/JibinES/Arduino-Copilot/releases/latest/download/uninstall.sh | bash
set -euo pipefail

removed=0
for dir in \
  "$HOME/.arduinoIDE/extensions/arduino-bot" \
  "$HOME/.arduinoIDE/extensions/arduino-bot-0.1.0"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "Removed $dir"
    removed=1
  fi
done

if [ "$removed" -eq 0 ]; then
  echo "ArduinoBot was not found in ~/.arduinoIDE/extensions/."
else
  echo "ArduinoBot removed. Restart Arduino IDE."
fi

echo "Note: a self-downloaded arduino-cli (if any) stays cached in the extension's"
echo "storage and is harmless; the Arduino IDE's own arduino-cli is untouched."
