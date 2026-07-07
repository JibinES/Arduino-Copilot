import { describe, it, expect, vi } from "vitest";
import { resolve, join } from "path";
import { MessageHistory } from "../../src/agent/message-history";
import { Agent, type AgentEvent } from "../../src/agent/agent";
import { resolveWithinWorkspace } from "../../src/agent/tools/path-utils";
import type { IProvider, ChatResponse } from "../../src/providers/types";

describe("MessageHistory", () => {
  it("should add and retrieve messages", () => {
    const history = new MessageHistory();
    history.addSystem("You are a bot.");
    history.addUser("Hello");
    history.addAssistant({ content: "Hi there!", toolCalls: undefined });

    const messages = history.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[2].role).toBe("assistant");
  });

  it("should replace system message on re-add", () => {
    const history = new MessageHistory();
    history.addSystem("First system");
    history.addSystem("Second system");

    const messages = history.getMessages();
    const systemMessages = messages.filter((m) => m.role === "system");
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toBe("Second system");
  });

  it("should add tool results", () => {
    const history = new MessageHistory();
    history.addToolResult({
      toolCallId: "call_1",
      content: "file contents...",
    });

    const messages = history.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("tool");
    expect(messages[0].toolCallId).toBe("call_1");
  });

  it("should clear non-system messages", () => {
    const history = new MessageHistory();
    history.addSystem("System");
    history.addUser("User msg");
    history.addAssistant({ content: "Reply" });

    history.clear();
    const messages = history.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("system");
  });

  it("should return a copy of messages", () => {
    const history = new MessageHistory();
    history.addUser("Test");

    const m1 = history.getMessages();
    const m2 = history.getMessages();
    expect(m1).not.toBe(m2);
    expect(m1).toEqual(m2);
  });

  it("should trim oldest messages when over the token budget", () => {
    const history = new MessageHistory(500); // tiny budget for testing
    history.addSystem("sys");
    for (let i = 0; i < 20; i++) {
      history.addUser(`message ${i} ` + "x".repeat(400));
    }

    const messages = history.getMessages();
    expect(messages[0].role).toBe("system");
    expect(messages.length).toBeLessThan(21);
    // Most recent message always survives
    expect(messages[messages.length - 1].content).toContain("message 19");
  });

  it("should never orphan tool results from their assistant tool-call message", () => {
    const history = new MessageHistory(600);
    history.addSystem("sys");

    for (let i = 0; i < 10; i++) {
      history.addUser(`turn ${i} ` + "x".repeat(200));
      history.addAssistant({
        content: "",
        toolCalls: [{ id: `call_${i}`, name: "read_file", arguments: { path: "a.ino" } }],
      });
      history.addToolResult({ toolCallId: `call_${i}`, content: "y".repeat(200) });
      history.addAssistant({ content: `done ${i}` });
    }

    const messages = history.getMessages();
    // Every tool message must be directly preceded by an assistant message
    // with toolCalls (or another tool result of the same group).
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "tool") {
        const prev = messages[i - 1];
        expect(prev).toBeDefined();
        const validPredecessor =
          (prev.role === "assistant" && (prev.toolCalls?.length || 0) > 0) ||
          prev.role === "tool";
        expect(validPredecessor).toBe(true);
      }
    }
    // First non-system message must be a user turn
    const firstNonSystem = messages.find((m) => m.role !== "system");
    expect(firstNonSystem?.role).toBe("user");
  });

  it("should truncate gigantic tool results", () => {
    const history = new MessageHistory();
    history.addToolResult({ toolCallId: "c1", content: "z".repeat(100_000) });
    const [msg] = history.getMessages();
    expect(msg.content.length).toBeLessThan(40_000);
    expect(msg.content).toContain("[truncated");
  });
});

describe("resolveWithinWorkspace", () => {
  // Normalize to the host OS so assertions hold on Windows (D:\...) too.
  const root = resolve("/tmp/workspace");

  it("allows paths inside the workspace", () => {
    expect(resolveWithinWorkspace(root, "sketch.ino")).toBe(join(root, "sketch.ino"));
    expect(resolveWithinWorkspace(root, "sub/dir/file.h")).toBe(join(root, "sub", "dir", "file.h"));
    expect(resolveWithinWorkspace(root, ".")).toBe(root);
  });

  it("rejects traversal outside the workspace", () => {
    expect(resolveWithinWorkspace(root, "../etc/passwd")).toBeNull();
    expect(resolveWithinWorkspace(root, "sub/../../escape")).toBeNull();
    expect(resolveWithinWorkspace(root, "/etc/passwd")).toBeNull();
  });

  it("rejects sibling directories with the workspace as a prefix", () => {
    expect(resolveWithinWorkspace(root, resolve("/tmp/workspaceXYZ/file"))).toBeNull();
  });
});

function makeProvider(responses: Array<ChatResponse | Error>): IProvider {
  let call = 0;
  return {
    id: "mock",
    name: "Mock",
    requiresApiKey: false,
    updateConfig: () => {},
    chat: vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      if (r instanceof Error) throw r;
      return r;
    }),
    listModels: async () => ["mock-model"],
  };
}

function makeAgent(provider: IProvider, events: AgentEvent[]): Agent {
  return new Agent(provider, {
    workspaceRoot: "/tmp/workspace",
    arduinoCliPath: "arduino-cli",
    defaultBaudRate: 9600,
    onUpdate: (e) => events.push(e),
  });
}

describe("Agent", () => {
  it("completes when the provider returns no tool calls", async () => {
    const events: AgentEvent[] = [];
    const provider = makeProvider([{ content: "All done!" }]);
    const agent = makeAgent(provider, events);

    await agent.run("hello", new AbortController().signal);
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === "error")).toHaveLength(0);
  });

  it("retries transient provider errors and then succeeds", async () => {
    const events: AgentEvent[] = [];
    const provider = makeProvider([
      new Error("429 rate_limit exceeded"),
      { content: "Recovered" },
    ]);
    const agent = makeAgent(provider, events);

    await agent.run("hello", new AbortController().signal);
    expect(provider.chat).toHaveBeenCalledTimes(2);
    expect(events.some((e) => e.type === "info" && e.message.includes("Retrying"))).toBe(true);
    expect(events.filter((e) => e.type === "error")).toHaveLength(0);
  }, 15_000);

  it("emits an error event for non-transient provider failures without retrying", async () => {
    const events: AgentEvent[] = [];
    const provider = makeProvider([new Error("401 invalid api key")]);
    const agent = makeAgent(provider, events);

    await agent.run("hello", new AbortController().signal);
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === "error" && e.message.includes("401"))).toBe(true);
  });

  it("emits an info event when the iteration limit is reached", async () => {
    const events: AgentEvent[] = [];
    // Always returns a tool call for an unknown tool — loops until the cap.
    const provider = makeProvider([
      {
        content: "",
        toolCalls: [{ id: "c1", name: "nonexistent_tool", arguments: {} }],
      },
    ]);
    const agent = makeAgent(provider, events);

    await agent.run("loop forever", new AbortController().signal);
    expect(events.some((e) => e.type === "info" && e.message.includes("Stopped after"))).toBe(true);
  });

  it("rejects concurrent runs", async () => {
    const events: AgentEvent[] = [];
    let release: () => void = () => {};
    const provider: IProvider = {
      id: "mock",
      name: "Mock",
      requiresApiKey: false,
      updateConfig: () => {},
      chat: () =>
        new Promise((resolve) => {
          release = () => resolve({ content: "done" });
        }),
      listModels: async () => [],
    };
    const agent = makeAgent(provider, events);

    const first = agent.run("one", new AbortController().signal);
    await expect(agent.run("two", new AbortController().signal)).rejects.toThrow(
      /already running/,
    );
    release();
    await first;
    // After the first run completes, a new run is accepted again
    expect(agent.isRunning()).toBe(false);
  });

  it("resolves pending approvals as denied when the run is aborted", async () => {
    const events: AgentEvent[] = [];
    const provider = makeProvider([
      {
        content: "",
        toolCalls: [
          { id: "c1", name: "write_file", arguments: { path: "a.ino", content: "x" } },
        ],
      },
      { content: "after denial" },
    ]);
    const agent = makeAgent(provider, events);
    const controller = new AbortController();

    const runPromise = agent.run("write something", controller.signal);

    // Wait for the approval request to surface, then abort instead of answering
    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "approval")).toBe(true);
    });
    controller.abort();

    // The run must terminate (the leaked-promise bug would hang forever here)
    await runPromise;
    expect(agent.isRunning()).toBe(false);
  });
});
