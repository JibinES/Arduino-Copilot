import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  resolveArduinoCliSync,
  arduinoCliDownloadUrl,
  knownArduinoCliPaths,
  cachedCliPath,
} from "../../src/arduino/cli-locator.js";

describe("resolveArduinoCliSync", () => {
  it("returns a configured path verbatim when it exists on disk", () => {
    // This test file itself is a guaranteed-existing path — it wins over any
    // known install location.
    const existing = __filename;
    expect(resolveArduinoCliSync(existing)).toBe(existing);
  });

  it("always returns a non-empty command/path", () => {
    // Whatever the host machine has (a real install, a cached copy, or nothing),
    // the resolver must yield something runnable — never empty.
    const result = resolveArduinoCliSync("arduino-cli");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("arduinoCliDownloadUrl", () => {
  it("selects the Windows zip build", () => {
    expect(arduinoCliDownloadUrl("win32", "x64")).toBe(
      "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip",
    );
  });

  it("selects the correct macOS build per arch", () => {
    expect(arduinoCliDownloadUrl("darwin", "arm64")).toContain("macOS_ARM64.tar.gz");
    expect(arduinoCliDownloadUrl("darwin", "x64")).toContain("macOS_64bit.tar.gz");
  });

  it("selects the correct Linux build per arch", () => {
    expect(arduinoCliDownloadUrl("linux", "x64")).toContain("Linux_64bit.tar.gz");
    expect(arduinoCliDownloadUrl("linux", "arm64")).toContain("Linux_ARM64.tar.gz");
    expect(arduinoCliDownloadUrl("linux", "arm")).toContain("Linux_ARMv7.tar.gz");
  });
});

describe("knownArduinoCliPaths", () => {
  it("uses the .exe binary and Arduino IDE bundle location on Windows", () => {
    const paths = knownArduinoCliPaths("win32");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.endsWith("arduino-cli.exe"))).toBe(true);
    expect(paths.some((p) => p.includes("Arduino IDE"))).toBe(true);
  });

  it("uses the macOS app bundle path on darwin", () => {
    const paths = knownArduinoCliPaths("darwin");
    expect(paths.some((p) => p.includes("Arduino IDE.app"))).toBe(true);
  });
});

describe("cachedCliPath", () => {
  it("places the cached binary under the given storage dir", () => {
    const storage = join("tmp", "storage");
    const p = cachedCliPath(storage);
    expect(p.startsWith(storage)).toBe(true);
    expect(p.endsWith(process.platform === "win32" ? "arduino-cli.exe" : "arduino-cli")).toBe(true);
  });
});
