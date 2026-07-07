; ArduinoBot — Windows installer (Inno Setup 6.1+)
; ---------------------------------------------------------------------------
; Produces ArduinoBotSetup.exe. What it does for a non-developer, one click:
;   1. Installs Arduino IDE 2.x if it isn't already present (silent download+install).
;   2. Copies the built extension into %USERPROFILE%\.arduinoIDE\extensions\arduino-bot-<ver>\.
;   3. Ensures arduino-cli exists — Arduino IDE bundles it, but if it's missing we
;      download the official build into %USERPROFILE%\.arduinoIDE\arduino-bot-cli\,
;      a location the extension checks (see src/arduino/cli-locator.ts).
;   4. On next Arduino IDE launch the ArduinoBot chat panel appears in the sidebar.
;
; Build locally:  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\installer.iss
; (CI does this automatically — see .github/workflows/build-windows-installer.yml)
;
; Prereq: run `npm run build` first so ..\dist exists.

#define MyAppName "ArduinoBot"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "ArduinoBot"
#define ExtFolderName "arduino-bot-0.1.0"

; Official download URLs (latest stable). Bump the IDE URL when a newer one is desired.
#define ArduinoCliUrl "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip"
#define ArduinoIdeUrl "https://downloads.arduino.cc/arduino-ide/arduino-ide_latest_Windows_64bit.exe"

[Setup]
AppId={{6C3F1E2A-9B4D-4A77-8E21-ARDUINOBOT01}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
; Per-user install — no administrator rights needed (matches the hobbyist audience).
PrivilegesRequired=lowest
DefaultDirName={userprofile}\.arduinoIDE\extensions\{#ExtFolderName}
DisableDirPage=yes
DisableProgramGroupPage=yes
UninstallDisplayName={#MyAppName} (Arduino IDE extension)
OutputBaseFilename=ArduinoBotSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
MinVersion=10.0
; Uncomment to sign the installer (recommended — avoids SmartScreen warnings):
; SignTool=signtool $f

[Files]
; The built extension. Run `npm run build` before compiling this script.
Source: "..\dist\*";        DestDir: "{app}\dist";  Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\package.json";  DestDir: "{app}";       Flags: ignoreversion
Source: "..\media\*";       DestDir: "{app}\media"; Flags: recursesubdirs createallsubdirs ignoreversion

[UninstallDelete]
; Remove the arduino-cli copy this installer placed (leave Arduino IDE's own alone).
Type: filesandordirs; Name: "{userprofile}\.arduinoIDE\arduino-bot-cli"

; NOTE: [Code] must be the LAST section — Inno Setup treats everything after it as
; Pascal code, so no [Section] tags may follow.
[Code]
var
  DownloadPage: TDownloadWizardPage;
  DownloadNeeded: Boolean;

// --- Detection helpers -----------------------------------------------------

function ArduinoIdePerUser(): String;
begin
  Result := ExpandConstant('{localappdata}\Programs\Arduino IDE\Arduino IDE.exe');
end;

function ArduinoIdeMachine(): String;
begin
  Result := ExpandConstant('{commonpf}\Arduino IDE\Arduino IDE.exe');
end;

function IsArduinoIdeInstalled(): Boolean;
begin
  Result := FileExists(ArduinoIdePerUser()) or FileExists(ArduinoIdeMachine());
end;

function BundledCliPerUser(): String;
begin
  Result := ExpandConstant('{localappdata}\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe');
end;

function BundledCliMachine(): String;
begin
  Result := ExpandConstant('{commonpf}\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe');
end;

function InstallerCliDir(): String;
begin
  Result := ExpandConstant('{userprofile}\.arduinoIDE\arduino-bot-cli');
end;

function InstallerCliPath(): String;
begin
  Result := InstallerCliDir() + '\arduino-cli.exe';
end;

function IsArduinoCliPresent(): Boolean;
begin
  Result := FileExists(BundledCliPerUser()) or FileExists(BundledCliMachine())
            or FileExists(InstallerCliPath());
end;

// --- Wizard flow -----------------------------------------------------------

procedure InitializeWizard();
begin
  DownloadPage := CreateDownloadPage(SetupMessage(msgWizardPreparing),
    'Downloading required components...', nil);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpReady then
  begin
    DownloadPage.Clear;
    DownloadNeeded := False;
    if not IsArduinoIdeInstalled() then
    begin
      DownloadPage.Add('{#ArduinoIdeUrl}', 'arduino-ide-setup.exe', '');
      DownloadNeeded := True;
    end;
    if not IsArduinoCliPresent() then
    begin
      DownloadPage.Add('{#ArduinoCliUrl}', 'arduino-cli.zip', '');
      DownloadNeeded := True;
    end;

    // Nothing to fetch? Skip the download page entirely.
    if DownloadNeeded then
    begin
      DownloadPage.Show;
      try
        try
          DownloadPage.Download;
        except
          if DownloadPage.AbortedByUser then
            Log('Download aborted by user.')
          else
            SuppressibleMsgBox(AddPeriod(GetExceptionMessage), mbCriticalError, MB_OK, IDOK);
          Result := False;
        end;
      finally
        DownloadPage.Hide;
      end;
    end;
  end;
end;

procedure ExtractArduinoCli();
var
  ResultCode: Integer;
  ZipPath, PsCmd: String;
begin
  ZipPath := ExpandConstant('{tmp}\arduino-cli.zip');
  if not FileExists(ZipPath) then
    Exit;

  ForceDirectories(InstallerCliDir());
  // PowerShell ships on every supported Windows — no third-party unzip needed.
  PsCmd := Format('-NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath ''%s'' -DestinationPath ''%s'' -Force"',
    [ZipPath, InstallerCliDir()]);
  if not Exec('powershell.exe', PsCmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Log('Failed to launch PowerShell to extract arduino-cli.')
  else if ResultCode <> 0 then
    Log('Expand-Archive returned code ' + IntToStr(ResultCode));
end;

procedure InstallArduinoIde();
var
  ResultCode: Integer;
  IdeSetup: String;
begin
  IdeSetup := ExpandConstant('{tmp}\arduino-ide-setup.exe');
  if not FileExists(IdeSetup) then
    Exit;
  // NSIS-based Arduino IDE installer — /S runs it silently (per-user).
  if not Exec(IdeSetup, '/S', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
    Log('Failed to launch the Arduino IDE installer.');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Install Arduino IDE first (it may bring its own arduino-cli), then place
    // our downloaded arduino-cli only if one still isn't available.
    if FileExists(ExpandConstant('{tmp}\arduino-ide-setup.exe')) then
      InstallArduinoIde();
    if not (FileExists(BundledCliPerUser()) or FileExists(BundledCliMachine())) then
      ExtractArduinoCli();
  end;
end;
