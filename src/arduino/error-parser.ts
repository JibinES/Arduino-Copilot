export interface ParsedError {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "note";
  message: string;
  context?: string;
}

export function parseGccErrors(output: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const lines = output.split("\n");

  const errorRegex = /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = errorRegex.exec(lines[i]);
    if (match) {
      const error: ParsedError = {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: match[4] as ParsedError["severity"],
        message: match[5],
      };

      // Grab context lines (the source line and caret)
      const contextLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].match(errorRegex)) break;
        contextLines.push(lines[j]);
      }
      if (contextLines.length > 0) {
        error.context = contextLines.join("\n");
      }

      errors.push(error);
    }
  }

  return errors;
}

export function formatErrorsForAI(errors: ParsedError[]): string {
  if (errors.length === 0) return "No errors found.";

  return errors
    .map((e) => {
      let msg = `${e.severity.toUpperCase()} at ${e.file}:${e.line}:${e.column}: ${e.message}`;
      if (e.context) msg += `\n${e.context}`;
      return msg;
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Upload Failure Doctor — turn cryptic avrdude/upload output into plain-English
// causes + fixes. arduino-cli's upload errors are opaque to hobbyists and the
// right fix depends entirely on which failure it is.
// ---------------------------------------------------------------------------

export interface UploadDiagnosis {
  title: string;
  cause: string;
  fixes: string[];
}

const UPLOAD_PATTERNS: Array<{ re: RegExp; diag: UploadDiagnosis }> = [
  {
    re: /not in sync|stk500_(recv|getsync)|programmer is not responding|resp=0x00/i,
    diag: {
      title: "The board isn't responding to the uploader",
      cause: "arduino-cli reached the port but the board didn't answer in time.",
      fixes: [
        "Close the Serial Monitor (or any app using the port), then upload again.",
        "Make sure the selected board (FQBN) matches what's actually plugged in.",
        "If your sketch uses pins 0 (RX) or 1 (TX), disconnect whatever is wired to them during upload.",
        "Press the board's reset button just as the upload starts (needed on some clones).",
      ],
    },
  },
  {
    re: /can't open (device|serial port)|permission denied|access is denied|resource busy|device or resource busy|port .* busy|Error touching serial port/i,
    diag: {
      title: "The serial port is busy or you lack permission",
      cause: "Another program is holding the port, or your user can't access it.",
      fixes: [
        "Close the Serial Monitor and any other serial app, then retry.",
        "On Linux, add your user to the 'dialout' group: sudo usermod -a -G dialout $USER — then log out and back in.",
        "Unplug and replug the board, or pick the correct port.",
      ],
    },
  },
  {
    re: /no (upload port|device found|serial port|board)|no upload port provided|Failed uploading: no upload port/i,
    diag: {
      title: "No board was detected on any port",
      cause: "The computer doesn't see an Arduino connected.",
      fixes: [
        "Use a DATA USB cable, not a charge-only one.",
        "Try a different USB port or cable.",
        "Install the USB-serial driver your board needs (CH340 or CP2102 for many clones).",
        "Check the board's power LED is on.",
      ],
    },
  },
  {
    re: /(wrong|invalid|expected).{0,25}signature|Device signature = 0x000000|Yikes! Invalid device signature/i,
    diag: {
      title: "Wrong board type or a bad connection",
      cause: "The chip's signature doesn't match the selected board.",
      fixes: [
        "Select the board that matches your hardware (e.g. Uno vs Nano vs Mega).",
        "If it reads 0x000000, check the USB cable/connection — the chip isn't communicating.",
      ],
    },
  },
  {
    re: /verification error|content mismatch|Expected .{1,20} Received/i,
    diag: {
      title: "Upload started but verification failed",
      cause: "Data written to the board didn't read back correctly.",
      fixes: [
        "Check for loose wiring and try a different USB cable.",
        "Retry the upload; if it keeps failing, the board's flash may be worn out.",
      ],
    },
  },
  {
    re: /timed?\s?out|timeout/i,
    diag: {
      title: "The upload timed out",
      cause: "The board didn't respond within the expected time.",
      fixes: [
        "Close the Serial Monitor and retry.",
        "Press reset as the upload begins.",
        "Verify the correct port and board are selected.",
      ],
    },
  },
];

export function parseUploadErrors(output: string): UploadDiagnosis[] {
  const found: UploadDiagnosis[] = [];
  const seen = new Set<string>();
  for (const { re, diag } of UPLOAD_PATTERNS) {
    if (re.test(output) && !seen.has(diag.title)) {
      seen.add(diag.title);
      found.push(diag);
    }
  }
  return found;
}

export function formatUploadDiagnosis(diags: UploadDiagnosis[]): string {
  if (diags.length === 0) return "";
  return (
    "\n\n🩺 Upload Doctor — likely cause(s):\n" +
    diags
      .map(
        (d) =>
          `• ${d.title}\n  Why: ${d.cause}\n  Try:\n` +
          d.fixes.map((f) => `   - ${f}`).join("\n"),
      )
      .join("\n\n")
  );
}

// ---------------------------------------------------------------------------
// Memory Usage Advisor — parse the flash/SRAM summary arduino-cli prints and
// warn (with concrete fixes) when the sketch is close to full. SRAM exhaustion
// is a top cause of "worked then randomly crashed" for beginners.
// ---------------------------------------------------------------------------

export interface MemoryUsage {
  flashUsed?: number;
  flashPercent?: number;
  flashMax?: number;
  sramUsed?: number;
  sramPercent?: number;
  sramMax?: number;
}

export function parseMemoryUsage(output: string): MemoryUsage | null {
  const mem: MemoryUsage = {};

  const flash = /Sketch uses (\d+) bytes(?: \((\d+)%\))? of program storage space(?:\. Maximum is (\d+) bytes)?/.exec(output);
  if (flash) {
    mem.flashUsed = parseInt(flash[1], 10);
    if (flash[2]) mem.flashPercent = parseInt(flash[2], 10);
    if (flash[3]) mem.flashMax = parseInt(flash[3], 10);
  }

  const sram = /Global variables use (\d+) bytes(?: \((\d+)%\))? of dynamic memory(?:.*?Maximum is (\d+) bytes)?/.exec(output);
  if (sram) {
    mem.sramUsed = parseInt(sram[1], 10);
    if (sram[2]) mem.sramPercent = parseInt(sram[2], 10);
    if (sram[3]) mem.sramMax = parseInt(sram[3], 10);
  }

  return mem.flashUsed !== undefined || mem.sramUsed !== undefined ? mem : null;
}

export function formatMemoryAdvice(mem: MemoryUsage): string | null {
  const warns: string[] = [];
  if (mem.flashPercent !== undefined && mem.flashPercent >= 90) {
    warns.push(
      `Flash (program storage) is at ${mem.flashPercent}% — nearly full. Remove unused libraries/code, and move constant strings/tables into flash with the F() macro and PROGMEM.`,
    );
  }
  if (mem.sramPercent !== undefined && mem.sramPercent >= 75) {
    warns.push(
      `SRAM (dynamic memory) is at ${mem.sramPercent}% — low RAM causes random crashes, garbage output, and reboots. Wrap string literals in F() (e.g. Serial.println(F("hello"))), prefer char[] over the String class, and use small int types (uint8_t) where values are small.`,
    );
  }
  if (warns.length === 0) return null;
  return "⚠️ Memory advisory:\n" + warns.map((w) => "• " + w).join("\n");
}
