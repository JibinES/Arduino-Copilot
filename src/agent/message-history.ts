import type { ChatMessage, ToolResult } from "../providers/types.js";

// Rough heuristic: ~4 characters per token. Good enough for budget trimming.
const CHARS_PER_TOKEN = 4;
const DEFAULT_TOKEN_BUDGET = 80_000;
// Guard against a single enormous tool result (e.g. a verbose compile log)
// blowing the context on its own.
const DEFAULT_MAX_TOOL_RESULT_CHARS = 30_000;

/**
 * Conversation history with token-aware trimming.
 *
 * Trimming is "pair-safe": an assistant message that contains tool calls and
 * the tool-result messages that answer it are treated as one atomic group.
 * Splitting them produces dangling tool_use/tool_result blocks, which every
 * provider rejects with a 400.
 */
export class MessageHistory {
  private messages: ChatMessage[] = [];
  private tokenBudget: number;
  private maxToolResultChars: number;

  constructor(
    tokenBudget: number = DEFAULT_TOKEN_BUDGET,
    maxToolResultChars: number = DEFAULT_MAX_TOOL_RESULT_CHARS,
  ) {
    this.tokenBudget = tokenBudget;
    this.maxToolResultChars = maxToolResultChars;
  }

  /**
   * Adjust the trimming limits at runtime — used when the user switches to a
   * provider with a much smaller per-minute token allowance (e.g. Groq free
   * tier) so requests stay small. Re-trims immediately with the new budget.
   */
  setLimits(tokenBudget: number, maxToolResultChars: number): void {
    this.tokenBudget = tokenBudget;
    this.maxToolResultChars = maxToolResultChars;
    this.trim();
  }

  addSystem(content: string): void {
    // Replace existing system message if any
    this.messages = this.messages.filter((m) => m.role !== "system");
    this.messages.unshift({ role: "system", content });
  }

  addUser(content: string): void {
    this.messages.push({ role: "user", content });
    this.trim();
  }

  addAssistant(message: Pick<ChatMessage, "content" | "toolCalls">): void {
    this.messages.push({
      role: "assistant",
      content: message.content,
      toolCalls: message.toolCalls,
    });
    this.trim();
  }

  addToolResult(result: ToolResult): void {
    let content = result.content;
    if (content.length > this.maxToolResultChars) {
      content =
        content.slice(0, this.maxToolResultChars) +
        `\n...[truncated ${content.length - this.maxToolResultChars} characters]`;
    }
    this.messages.push({
      role: "tool",
      content,
      toolCallId: result.toolCallId,
    });
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clear(): void {
    const system = this.messages.find((m) => m.role === "system");
    this.messages = system ? [system] : [];
  }

  private estimateTokens(message: ChatMessage): number {
    let chars = message.content?.length || 0;
    if (message.toolCalls?.length) {
      chars += JSON.stringify(message.toolCalls).length;
    }
    return Math.ceil(chars / CHARS_PER_TOKEN) + 8; // +8 for role/structure overhead
  }

  /**
   * Split non-system messages into atomic groups: an assistant message with
   * tool calls absorbs all immediately-following tool results.
   */
  private toGroups(nonSystem: ChatMessage[]): ChatMessage[][] {
    const groups: ChatMessage[][] = [];
    let i = 0;
    while (i < nonSystem.length) {
      const msg = nonSystem[i];
      const group = [msg];
      i++;
      if (msg.role === "assistant" && msg.toolCalls?.length) {
        while (i < nonSystem.length && nonSystem[i].role === "tool") {
          group.push(nonSystem[i]);
          i++;
        }
      }
      groups.push(group);
    }
    return groups;
  }

  private trim(): void {
    const system = this.messages.find((m) => m.role === "system");
    const nonSystem = this.messages.filter((m) => m.role !== "system");

    const systemTokens = system ? this.estimateTokens(system) : 0;
    const groups = this.toGroups(nonSystem);
    const groupTokens = groups.map((g) =>
      g.reduce((sum, m) => sum + this.estimateTokens(m), 0),
    );

    let total = systemTokens + groupTokens.reduce((a, b) => a + b, 0);

    // Drop oldest groups until under budget — but always keep the last group
    // so the model has the current turn to respond to.
    let firstKept = 0;
    while (total > this.tokenBudget && firstKept < groups.length - 1) {
      total -= groupTokens[firstKept];
      firstKept++;
    }

    // Providers require the conversation to start with a user turn — if the
    // budget cut landed mid-exchange, keep dropping until it does.
    while (firstKept > 0 && firstKept < groups.length - 1 && groups[firstKept][0].role !== "user") {
      firstKept++;
    }

    if (firstKept > 0) {
      const kept = groups.slice(firstKept).flat();
      this.messages = system ? [system, ...kept] : kept;
    }
  }
}
