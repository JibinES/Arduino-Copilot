import { describe, it, expect } from "vitest";
import {
  parseUploadErrors,
  parseMemoryUsage,
  formatMemoryAdvice,
} from "../../src/arduino/error-parser.js";

describe("parseUploadErrors (Upload Doctor)", () => {
  it("diagnoses a not-in-sync / stk500 failure", () => {
    const out =
      "avrdude: stk500_recv(): programmer is not responding\n" +
      "avrdude: stk500_getsync() attempt 1 of 10: not in sync: resp=0x00";
    const d = parseUploadErrors(out);
    expect(d.length).toBeGreaterThan(0);
    expect(d[0].title.toLowerCase()).toContain("responding");
    expect(d[0].fixes.join(" ")).toMatch(/serial monitor/i);
  });

  it("diagnoses a busy / permission-denied port", () => {
    const d = parseUploadErrors(
      'avrdude: ser_open(): can\'t open device "/dev/ttyUSB0": Permission denied',
    );
    expect(d.some((x) => /busy|permission/i.test(x.title))).toBe(true);
  });

  it("diagnoses no board detected", () => {
    const d = parseUploadErrors("Failed uploading: no upload port provided");
    expect(d.some((x) => /no board/i.test(x.title))).toBe(true);
  });

  it("returns empty for unrelated / successful output", () => {
    expect(parseUploadErrors("Upload successful to COM3")).toEqual([]);
  });
});

describe("parseMemoryUsage + formatMemoryAdvice (Memory Advisor)", () => {
  it("parses flash and SRAM percentages", () => {
    const out =
      "Sketch uses 30000 bytes (93%) of program storage space. Maximum is 32256 bytes.\n" +
      "Global variables use 1800 bytes (87%) of dynamic memory, leaving 248 bytes for local variables. Maximum is 2048 bytes.";
    const mem = parseMemoryUsage(out)!;
    expect(mem.flashPercent).toBe(93);
    expect(mem.sramPercent).toBe(87);
    const advice = formatMemoryAdvice(mem)!;
    expect(advice).toMatch(/Flash/);
    expect(advice).toMatch(/SRAM/);
  });

  it("gives no advice when usage is low", () => {
    const mem = parseMemoryUsage(
      "Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.\n" +
        "Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.",
    )!;
    expect(formatMemoryAdvice(mem)).toBeNull();
  });

  it("returns null when no memory lines are present", () => {
    expect(parseMemoryUsage("just some unrelated text")).toBeNull();
  });
});
