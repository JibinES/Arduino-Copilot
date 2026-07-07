# ArduinoBot Windows Installer

One-click `ArduinoBotSetup.exe` for non-developers. Download → run → the ArduinoBot
chat panel appears in Arduino IDE's sidebar. No terminal, no config files.

## What the installer does
1. **Arduino IDE 2.x** — if not already installed, downloads and silently installs it.
2. **Extension files** — copies `dist/`, `package.json`, `media/` into
   `%USERPROFILE%\.arduinoIDE\extensions\arduino-bot-0.1.0\`.
3. **arduino-cli** — Arduino IDE bundles it; if it's somehow missing, downloads the
   official build into `%USERPROFILE%\.arduinoIDE\arduino-bot-cli\arduino-cli.exe`.
   The extension checks that exact location (see `src/arduino/cli-locator.ts`), so no
   settings file is edited. As a final safety net the extension also self-downloads
   arduino-cli on first use if none is found.

## How the .exe is produced
- **Automatically (recommended):** push a version tag (`git tag v0.1.0 && git push --tags`).
  The `Build Windows Installer` GitHub Action builds the extension, compiles this script
  on a Windows runner, and attaches `ArduinoBotSetup.exe` to the GitHub Release.
- **Manually:** on a Windows machine, `npm run build`, then run Inno Setup 6.1+:
  `"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\installer.iss`
  Output: `installer\Output\ArduinoBotSetup.exe`.

## Before shipping publicly
- **Code-sign the .exe** to avoid Windows SmartScreen "unknown publisher" warnings
  (uncomment `SignTool` in `installer.iss` and configure a certificate). Unsigned
  installers scare non-technical users.
