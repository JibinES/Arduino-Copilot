// Locates (and, as a last resort, downloads) the arduino-cli binary.
//
// Why this exists: the tools receive a plain `arduinoCliPath` string. On Windows
// a bare "arduino-cli" does NOT resolve through PATH via child_process on its own
// (it needs the full ...\arduino-cli.exe), and Arduino IDE ships its own copy in a
// per-user folder the extension previously didn't know about. This module gives a
// single, platform-aware place to find that binary — and to self-heal by downloading
// one when the machine genuinely has none. The download is best-effort and offline-safe:
// if it fails we fall back to the bare command so the rest of the extension keeps working.

import { existsSync, createWriteStream, mkdirSync, chmodSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import * as https from "https";
import { spawn } from "child_process";

/** Executable name for the current platform. */
export const CLI_BIN = process.platform === "win32" ? "arduino-cli.exe" : "arduino-cli";

/**
 * Well-known locations where arduino-cli may already live, ordered best-first.
 * Includes the binary Arduino IDE 2.x bundles, so most users never need a download.
 */
export function knownArduinoCliPaths(platform: NodeJS.Platform = process.platform): string[] {
  const home = process.env.HOME || homedir();

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const ideResources = ["resources", "app", "lib", "backend", "resources", "arduino-cli.exe"];
    return [
      // Arduino IDE 2.x bundled arduino-cli — per-user install (the common case)
      join(localAppData, "Programs", "Arduino IDE", ...ideResources),
      // Arduino IDE 2.x bundled arduino-cli — machine-wide install
      join(programFiles, "Arduino IDE", ...ideResources),
      // Copy placed by the ArduinoBot Windows installer (deterministic handshake)
      join(home, ".arduinoIDE", "arduino-bot-cli", "arduino-cli.exe"),
      // Standalone arduino-cli, common manual spots
      join(localAppData, "Arduino15", "arduino-cli.exe"),
      join(home, "arduino-cli.exe"),
    ];
  }

  if (platform === "darwin") {
    return [
      "/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli",
      "/usr/local/bin/arduino-cli",
      "/opt/homebrew/bin/arduino-cli",
      join(home, "bin/arduino-cli"),
    ];
  }

  // linux
  return [
    join(home, ".local/share/arduino-ide/resources/app/lib/backend/resources/arduino-cli"),
    "/opt/arduino-ide/resources/app/lib/backend/resources/arduino-cli",
    "/usr/local/bin/arduino-cli",
    "/usr/bin/arduino-cli",
    join(home, "bin/arduino-cli"),
  ];
}

/** Path where a self-downloaded arduino-cli is cached (inside the extension's storage). */
export function cachedCliPath(storageDir: string): string {
  return join(storageDir, "arduino-cli", CLI_BIN);
}

/**
 * Resolve the arduino-cli path synchronously — never touches the network.
 *  1. an explicit, existing configured path always wins
 *  2. otherwise the first known install location that exists
 *  3. otherwise a previously downloaded cached copy
 *  4. otherwise the bare command, so the OS PATH still gets a chance
 */
export function resolveArduinoCliSync(configured: string, storageDir?: string): string {
  if (configured && configured !== "arduino-cli" && existsSync(configured)) {
    return configured;
  }
  for (const p of knownArduinoCliPaths()) {
    if (existsSync(p)) return p;
  }
  if (storageDir) {
    const cached = cachedCliPath(storageDir);
    if (existsSync(cached)) return cached;
  }
  return configured || "arduino-cli";
}

/** Official arduino-cli download URL for a platform/arch. */
export function arduinoCliDownloadUrl(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const base = "https://downloads.arduino.cc/arduino-cli";
  if (platform === "win32") {
    return `${base}/arduino-cli_latest_Windows_64bit.zip`;
  }
  if (platform === "darwin") {
    return arch === "arm64"
      ? `${base}/arduino-cli_latest_macOS_ARM64.tar.gz`
      : `${base}/arduino-cli_latest_macOS_64bit.tar.gz`;
  }
  // linux
  if (arch === "arm64") return `${base}/arduino-cli_latest_Linux_ARM64.tar.gz`;
  if (arch === "arm") return `${base}/arduino-cli_latest_Linux_ARMv7.tar.gz`;
  return `${base}/arduino-cli_latest_Linux_64bit.tar.gz`;
}

/** Download a URL to a file, following redirects. */
function downloadFile(url: string, dest: string, redirectsLeft = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 60000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error("Too many redirects downloading arduino-cli"));
          return;
        }
        resolve(downloadFile(res.headers.location, dest, redirectsLeft - 1));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error(`arduino-cli download failed: HTTP ${status}`));
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("arduino-cli download timed out")));
  });
}

/** Run a child process, resolving on exit code 0. */
function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)),
    );
  });
}

/**
 * Ensure an arduino-cli binary exists, downloading the official build if needed.
 * Best-effort and offline-safe: returns the cached binary path on success, or
 * `undefined` on any failure (caller then falls back to the bare command).
 */
export async function ensureArduinoCliDownloaded(storageDir: string): Promise<string | undefined> {
  const binPath = cachedCliPath(storageDir);
  if (existsSync(binPath)) return binPath;

  const dir = join(storageDir, "arduino-cli");
  try {
    mkdirSync(dir, { recursive: true });
    const url = arduinoCliDownloadUrl();
    const isZip = url.endsWith(".zip");
    const archive = join(dir, isZip ? "arduino-cli.zip" : "arduino-cli.tar.gz");

    await downloadFile(url, archive);

    if (isZip) {
      // PowerShell ships on every supported Windows; avoids a zip dependency.
      await run("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath "${archive}" -DestinationPath "${dir}" -Force`,
      ]);
    } else {
      await run("tar", ["-xzf", archive, "-C", dir]);
    }

    if (!existsSync(binPath)) return undefined;
    if (process.platform !== "win32") chmodSync(binPath, 0o755);
    try {
      unlinkSync(archive);
    } catch {
      // leaving the archive behind is harmless
    }
    return binPath;
  } catch (err) {
    // Offline or blocked — not fatal. Chat and Ollama keep working; arduino
    // actions will surface a friendly "arduino-cli not found" error instead.
    console.error("[arduino-bot] arduino-cli auto-download failed:", err);
    return undefined;
  }
}
