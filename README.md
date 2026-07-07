# ArduinoBot

An AI-powered coding assistant that lives in the **Arduino IDE 2.x** (and VS Code) sidebar. Chat to write, compile, upload, and debug Arduino sketches — it can read and edit your code, fix compiler errors, install libraries, check wiring, and watch serial output. Built for hobbyists and non-developers: no config files, no terminal required.

Works with 8 AI providers: **Anthropic, OpenAI, Gemini, Mistral, Groq, OpenRouter, Custom OpenAI**, and **Ollama** (free & fully offline).

---

## Install

### Windows — one click
1. Download **[ArduinoBotSetup.exe](https://github.com/JibinES/Arduino-Copilot/releases/latest)** from the latest release.
2. Run it (if Windows SmartScreen appears: **More info → Run anyway** — it's unsigned).
3. Restart Arduino IDE. The ArduinoBot panel appears in the left sidebar.

The installer sets up Arduino IDE if it's missing and handles arduino-cli automatically.

### macOS & Linux — one command
Paste this into a terminal:

```bash
curl -sSL https://github.com/JibinES/Arduino-Copilot/releases/latest/download/install.sh | bash
```

Then restart Arduino IDE. (Requires Arduino IDE 2.x — get it free at <https://www.arduino.cc/en/software>.)

**Uninstall:**
```bash
curl -sSL https://github.com/JibinES/Arduino-Copilot/releases/latest/download/uninstall.sh | bash
```

---

## First run
Open the ArduinoBot panel → **Settings** → pick a provider and add its API key (or choose **Ollama** for free/offline use). Use **Load from API** to see the provider's live model list, or type any model id. Then just chat.

## What it can do
- **Write & edit sketches** from plain-English requests, then **compile and auto-fix** errors.
- **Upload to your board** and read serial output.
- **Install libraries** automatically when a `#include` is missing.
- **Upload Doctor** — turns cryptic `avrdude` upload failures into plain-English causes + fixes.
- **Memory Advisor** — warns when a sketch is close to full flash/SRAM and shows what to change.
- **Pin conflict check + wiring tables** — scans your sketch for pin clashes and gives a pin→component wiring table.
- **Project scaffolding** — describe a goal ("plant watering system with a soil sensor and pump") and it builds the whole project. Command: **ArduinoBot: New Project from Goal**.

Every action that writes files, uploads, or runs commands asks for your approval first.

---

## Build from source
```bash
npm install
npm run build       # esbuild -> dist/
npm test            # vitest
npm run package     # build the .vsix
```
The Windows `.exe` and the macOS/Linux install scripts are produced automatically by GitHub Actions on each version tag and attached to the Release.

## License
MIT
