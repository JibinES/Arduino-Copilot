import { describe, it, expect } from "vitest";
import { analyzePins, formatPinAnalysis } from "../../src/arduino/pin-analyzer.js";

const sketch = `
const int LED = 13;
#define BUTTON 2
void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(0, OUTPUT);
}
void loop() {
  digitalWrite(LED, HIGH);
  int v = analogRead(A0);
}
`;

describe("analyzePins", () => {
  it("resolves named pins to numbers and records assignments", () => {
    const a = analyzePins(sketch);
    const pins = a.assignments.map((x) => x.pin);
    expect(pins).toContain("13"); // LED resolved
    expect(pins).toContain("2"); // BUTTON resolved
    expect(pins).toContain("A0"); // analogRead pin
  });

  it("detects the Serial bus", () => {
    const a = analyzePins(sketch);
    expect(a.buses.some((b) => /Serial/.test(b))).toBe(true);
  });

  it("flags pin 0/1 used while Serial is active", () => {
    const a = analyzePins(sketch);
    expect(a.conflicts.some((c) => /Pin 0/.test(c))).toBe(true);
  });

  it("reports no conflict when pins 0/1 are unused", () => {
    const a = analyzePins("void setup(){ Serial.begin(9600); pinMode(5, OUTPUT); }");
    expect(a.conflicts.length).toBe(0);
  });

  it("formats a readable summary", () => {
    const text = formatPinAnalysis(analyzePins(sketch));
    expect(text).toMatch(/Pins used/);
    expect(text).toMatch(/Potential conflicts/);
  });

  it("handles a sketch with no pin usage", () => {
    expect(formatPinAnalysis(analyzePins("int x = 1;"))).toMatch(/No pin usage/);
  });
});
