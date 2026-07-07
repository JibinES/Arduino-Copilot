// Static pin-usage analyzer for Arduino sketches.
//
// Regex-scans a sketch for pin assignments and bus usage, resolves #define/const
// pin names to numbers, and flags high-confidence conflicts. Deliberately
// conservative — it only reports the pins-0/1-with-Serial conflict (the classic
// upload-blocker), and leaves board-specific capability judgement to the AI,
// which knows the exact board (FQBN). This avoids false positives.

export interface PinAssignment {
  pin: string; // pin number ("13"), analog name ("A0"), or unresolved token
  role: string; // e.g. "pinMode OUTPUT", "digitalWrite", "analogRead"
  line: number;
}

export interface PinAnalysis {
  assignments: PinAssignment[];
  buses: string[];
  conflicts: string[];
}

export function analyzePins(source: string): PinAnalysis {
  const lines = source.split("\n");

  // Map pin names (#define X 13 / const int X = 13) to their numbers.
  const nameToPin = new Map<string, string>();
  const defineRe =
    /(?:#define\s+(\w+)\s+(\d+))|(?:const\s+(?:int|uint8_t|byte|uint8)\s+(\w+)\s*=\s*(\d+))/;
  for (const line of lines) {
    const m = defineRe.exec(line);
    if (m) {
      if (m[1]) nameToPin.set(m[1], m[2]);
      else if (m[3]) nameToPin.set(m[3], m[4]);
    }
  }

  const resolve = (raw: string): string => {
    const tok = raw.trim();
    if (/^\d+$/.test(tok)) return tok;
    if (/^A\d+$/.test(tok)) return tok;
    return nameToPin.get(tok) ?? tok;
  };

  const assignments: PinAssignment[] = [];
  const buses = new Set<string>();
  const usedPins = new Set<string>();

  const push = (pinTok: string, role: string, lineNo: number) => {
    const pin = resolve(pinTok);
    assignments.push({ pin, role, line: lineNo });
    usedPins.add(pin);
  };

  const single: Array<[RegExp, string]> = [
    [/digitalWrite\s*\(\s*([A-Za-z0-9_]+)/, "digitalWrite"],
    [/digitalRead\s*\(\s*([A-Za-z0-9_]+)/, "digitalRead"],
    [/analogWrite\s*\(\s*([A-Za-z0-9_]+)/, "analogWrite (PWM)"],
    [/analogRead\s*\(\s*([A-Za-z0-9_]+)/, "analogRead"],
    [/tone\s*\(\s*([A-Za-z0-9_]+)/, "tone"],
    [/\.attach\s*\(\s*([A-Za-z0-9_]+)/, "servo.attach"],
  ];

  lines.forEach((line, i) => {
    const n = i + 1;

    const pm = /pinMode\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z_]+)\s*\)/.exec(line);
    if (pm) push(pm[1], `pinMode ${pm[2]}`, n);

    for (const [re, role] of single) {
      const m = re.exec(line);
      if (m) push(m[1], role, n);
    }

    const ss = /SoftwareSerial\s+\w+\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(line);
    if (ss) {
      push(ss[1], "SoftwareSerial RX", n);
      push(ss[2], "SoftwareSerial TX", n);
      buses.add("SoftwareSerial");
    }

    if (/\bSerial\.begin\s*\(/.test(line)) buses.add("Serial over USB (also pins 0 RX / 1 TX)");
    if (/\bWire\.begin\s*\(/.test(line)) buses.add("I2C (Wire) — SDA/SCL pins");
    if (/\bSPI\.begin\s*\(/.test(line)) buses.add("SPI — MOSI/MISO/SCK/SS pins");
  });

  const conflicts: string[] = [];
  const usesSerial = [...buses].some((b) => b.startsWith("Serial"));
  for (const pin of ["0", "1"]) {
    if (usedPins.has(pin) && usesSerial) {
      conflicts.push(
        `Pin ${pin} is used AND Serial is active. Pins 0/1 are the USB serial lines — using them can block uploads and corrupt Serial output. Move that wiring to another pin.`,
      );
    }
  }

  return { assignments, buses: [...buses], conflicts };
}

export function formatPinAnalysis(a: PinAnalysis): string {
  if (a.assignments.length === 0 && a.buses.length === 0) {
    return "No pin usage detected (no pinMode/digital/analog/bus calls found).";
  }

  const out: string[] = [];

  if (a.assignments.length > 0) {
    const byPin = new Map<string, string[]>();
    for (const as of a.assignments) {
      if (!byPin.has(as.pin)) byPin.set(as.pin, []);
      byPin.get(as.pin)!.push(`${as.role} (line ${as.line})`);
    }
    out.push("Pins used:");
    for (const [pin, roles] of byPin) out.push(`  • Pin ${pin}: ${roles.join(", ")}`);
  }

  if (a.buses.length > 0) {
    out.push("\nBuses/peripherals:");
    for (const b of a.buses) out.push(`  • ${b}`);
  }

  if (a.conflicts.length > 0) {
    out.push("\n⚠️ Potential conflicts:");
    for (const c of a.conflicts) out.push(`  • ${c}`);
  } else {
    out.push("\nNo obvious pin conflicts detected.");
  }

  return out.join("\n");
}
