import { describe, it, expect } from "vitest";
import { parseGccErrors, formatErrorsForAI } from "../../src/arduino/error-parser";

describe("parseGccErrors", () => {
  it("should parse a single error", () => {
    const output = `/home/user/sketch/Blink.ino:15:3: error: 'foo' was not declared in this scope`;
    const errors = parseGccErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      file: "/home/user/sketch/Blink.ino",
      line: 15,
      column: 3,
      severity: "error",
      message: "'foo' was not declared in this scope",
      context: undefined,
    });
  });

  it("should parse multiple errors and warnings", () => {
    const output = `
/sketch.ino:10:5: warning: unused variable 'x'
     int x = 5;
         ^
/sketch.ino:20:1: error: expected ';' before '}' token
 }
 ^
`.trim();
    const errors = parseGccErrors(output);
    expect(errors).toHaveLength(2);
    expect(errors[0].severity).toBe("warning");
    expect(errors[0].line).toBe(10);
    expect(errors[1].severity).toBe("error");
    expect(errors[1].line).toBe(20);
  });

  it("should capture context lines", () => {
    const output = `/sketch.ino:5:3: error: missing semicolon
     int x = 5
         ^`;
    const errors = parseGccErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].context).toContain("int x = 5");
  });

  it("should return empty array for clean output", () => {
    const output = "Sketch uses 1234 bytes (3%) of program storage space.";
    const errors = parseGccErrors(output);
    expect(errors).toHaveLength(0);
  });

  it("should parse note severity", () => {
    const output = `/sketch.ino:5:3: note: declared here`;
    const errors = parseGccErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("note");
  });
});

describe("formatErrorsForAI", () => {
  it("should format errors for AI consumption", () => {
    const errors = [
      {
        file: "/sketch.ino",
        line: 15,
        column: 3,
        severity: "error" as const,
        message: "'foo' was not declared",
      },
    ];
    const result = formatErrorsForAI(errors);
    expect(result).toContain("ERROR");
    expect(result).toContain("/sketch.ino:15:3");
    expect(result).toContain("'foo' was not declared");
  });

  it("should return message for no errors", () => {
    expect(formatErrorsForAI([])).toBe("No errors found.");
  });
});
