import { describe, it, expect } from "vitest";
import { MessageHistory } from "../../src/agent/message-history";

describe("MessageHistory", () => {
  it("truncates oversized tool results at the configured cap", () => {
    const history = new MessageHistory(80_000, 100);
    history.addUser("hi");
    history.addToolResult({ toolCallId: "t1", content: "x".repeat(500) });

    const tool = history.getMessages().find((m) => m.role === "tool");
    expect(tool).toBeDefined();
    expect(tool!.content.length).toBeLessThan(500);
    expect(tool!.content).toContain("[truncated");
  });

  it("setLimits re-trims history down to the smaller budget", () => {
    // Large budget first: nothing gets dropped.
    const history = new MessageHistory(80_000, 30_000);
    history.addSystem("system prompt");
    for (let i = 0; i < 10; i++) {
      // ~250 tokens per turn (1000 chars / 4).
      history.addUser("u".repeat(1000));
      history.addAssistant({ content: "a".repeat(1000) });
    }
    const before = history.getMessages().length;

    // Shrinking the budget should drop older turns (budget leaves room for a
    // couple of recent turns, not the whole conversation).
    history.setLimits(700, 8_000);
    const after = history.getMessages();

    expect(after.length).toBeLessThan(before);
    // System message is always preserved.
    expect(after.some((m) => m.role === "system")).toBe(true);
    // Conversation must still start with a user turn (after the system message).
    const firstNonSystem = after.find((m) => m.role !== "system");
    expect(firstNonSystem?.role).toBe("user");
  });
});
