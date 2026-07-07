#!/usr/bin/env bash
# ArduinoBot — one-command installer for macOS and Linux.
#
#   curl -sSL https://github.com/JibinES/Arduino-Copilot/releases/latest/download/install.sh | bash
#
# Free, no code signing, no Gatekeeper warning (a piped shell script isn't
# quarantined the way a downloaded .app/.pkg is). It downloads the extension
# bundle from the latest GitHub Release and drops it into Arduino IDE's
# extensions folder. arduino-cli is auto-detected/downloaded by the extension.
set -euo pipefail

REPO="JibinES/Arduino-Copilot"
EXT_DIR="$HOME/.arduinoIDE/extensions/arduino-bot"
LEGACY_DIR="$HOME/.arduinoIDE/extensions/arduino-bot-0.1.0"
BUNDLE_URL="https://github.com/$REPO/releases/latest/download/arduino-bot-extension.tar.gz"

echo "Installing ArduinoBot..."

case "$(uname -s)" in
  Linux|Darwin) ;;
  *)
    echo "This script is for macOS/Linux. On Windows use ArduinoBotSetup.exe." >&2
    exit 1
    ;;
esac

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: 'curl' is required but not found." >&2
  exit 1
fi

if [ ! -d "$HOME/.arduinoIDE" ]; then
  echo "Note: ~/.arduinoIDE not found — is Arduino IDE 2.x installed?"
  echo "      Get it free at https://www.arduino.cc/en/software"
  echo "      Continuing anyway; the extension loads once the IDE is installed."
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading extension bundle..."
curl -fsSL "$BUNDLE_URL" -o "$tmp/bundle.tar.gz"

echo "Installing to $EXT_DIR ..."
mkdir -p "$EXT_DIR"
rm -rf "${EXT_DIR:?}/"*                 # clean any previous version in place
tar -xzf "$tmp/bundle.tar.gz" -C "$EXT_DIR"
rm -rf "$LEGACY_DIR" 2>/dev/null || true  # remove old versioned folder if present

echo ""
echo "ArduinoBot installed."
echo "  -> Restart Arduino IDE. The ArduinoBot chat panel appears in the left sidebar."
echo "  -> First run: open Settings, pick your AI provider, and add an API key"
echo "     (or choose Ollama for free/offline). arduino-cli is handled automatically."
