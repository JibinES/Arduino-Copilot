import type { IProvider, StreamEvent } from "../providers/types.js";
import { MessageHistory } from "./message-history.js";
import { ToolExecutor } from "./tool-executor.js";
import { getSystemPrompt } from "./system-prompt.js";
import { registerCoreTools } from "./tools/index.js";
import type { ToolContext } from "./tools/types.js";

export interface AgentConfig {
  workspaceRoot: string;
  searchApiKey?: string;
  searchProvider?: string;
  arduinoCliPath: string;
  defaultBaudRate: number;
  onUpdate: (event: AgentEvent) => void;
}

export type AgentEvent =
  | { type: "stream"; event: StreamEvent }
  | { type: "toolResult"; toolCallId: string; result: string; isError: boolean }
  | { type: "approval"; id: string; toolName: string; description: string }
  | { type: "error"; message: string }
  | { type: "info"; message: string };

const MAX_ITERATIONS = 25;
const MAX_PROVIDER_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
// Cap on how long we'll honor a server-suggested retry delay, so a bogus
// "try again in 9999s" can never hang the run.
const MAX_RETRY_DELAY_MS = 60_000;

export class Agent {
  private provider: IProvider;
  private history: MessageHistory;
  private toolExecutor: ToolExecutor;
  private config: AgentConfig;
  private pendingApprovals: Map<string, (approved: boolean) => void> = new Map();
  private running = false;

  constructor(provider: IProvider, config: AgentConfig) {
    this.provider = provider;
    this.config = config;
    const limits = historyLimitsFor(provider.id);
    this.history = new MessageHistory(limits.tokenBudget, limits.maxToolResultChars);
    this.history.addSystem(getSystemPrompt(config.workspaceRoot));

    const toolContext: ToolContext = {
      workspaceRoot: config.workspaceRoot,
      arduinoCliPath: config.arduinoCliPath,
      defaultBaudRate: config.defaultBaudRate,
    };

    this.toolExecutor = new ToolExecutor(toolContext, async (id, toolName, description) => {
      return this.requestApproval(id, toolName, description);
    });

    registerCoreTools(this.toolExecutor, config.searchApiKey, config.searchProvider);
  }

  updateProvider(provider: IProvider): void {
    this.provider = provider;
    const limits = historyLimitsFor(provider.id);
    this.history.setLimits(limits.tokenBudget, limits.maxToolResultChars);
  }

  isRunning(): boolean {
    return this.running;
  }

  async run(userMessage: string, signal: AbortSignal): Promise<void> {
    if (this.running) {
      throw new Error("A request is already running. Cancel it or wait for it to finish.");
    }
    this.running = true;

    // If the run is cancelled while a tool is waiting for approval, release it
    // as denied — otherwise the promise leaks and the loop hangs forever.
    const onAbort = () => this.cancelPendingApprovals();
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      this.history.addUser(userMessage);

      let iterations = 0;

      while (!signal.aborted && iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await this.chatWithRetry(signal);
        if (!response) break; // aborted or retries exhausted (event already emitted)

        this.history.addAssistant(response);

        // No tool calls = done
        if (!response.toolCalls?.length) return;

        // Execute all tool calls
        for (const toolCall of response.toolCalls) {
          if (signal.aborted) break;

          const result = await this.toolExecutor.execute(toolCall, signal);

          this.history.addToolResult(result);
          this.config.onUpdate({
            type: "toolResult",
            toolCallId: result.toolCallId,
            result: result.content,
            isError: result.isError || false,
          });
        }
        // Loop continues — AI sees results and decides next action
      }

      if (!signal.aborted && iterations >= MAX_ITERATIONS) {
        this.config.onUpdate({
          type: "info",
          message:
            `Stopped after ${MAX_ITERATIONS} steps without finishing. ` +
            "Send a follow-up message (e.g. \"continue\") to keep going.",
        });
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
      this.cancelPendingApprovals();
      this.running = false;
    }
  }

  /**
   * Call the provider, retrying transient failures (rate limits, overload,
   * network blips) with exponential backoff. Returns null if the run was
   * aborted or retries were exhausted — an error event is emitted in the
   * latter case.
   */
  private async chatWithRetry(signal: AbortSignal) {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_PROVIDER_RETRIES; attempt++) {
      if (signal.aborted) return null;
      try {
        return await this.provider.chat(
          this.history.getMessages(),
          this.toolExecutor.getDefinitions(),
          (event) => this.config.onUpdate({ type: "stream", event }),
          signal,
        );
      } catch (err) {
        if (signal.aborted) return null;
        lastError = err;
        if (!isTransientError(err) || attempt === MAX_PROVIDER_RETRIES - 1) break;

        // Prefer the server's suggested wait (e.g. rate-limit "try again in 25.72s")
        // over our exponential backoff, since for per-minute limits the backoff is
        // far too short to ever recover.
        const backoff = RETRY_BASE_DELAY_MS * 2 ** attempt;
        const suggested = parseRetryDelayMs(err);
        const delay = Math.min(Math.max(suggested ?? backoff, backoff), MAX_RETRY_DELAY_MS);
        this.config.onUpdate({
          type: "info",
          message: `Provider request failed (${describeError(err)}). Retrying in ${Math.ceil(delay / 1000)}s...`,
        });
        await sleep(delay, signal);
      }
    }

    if (!signal.aborted) {
      this.config.onUpdate({ type: "error", message: describeError(lastError) });
    }
    return null;
  }

  resolveApproval(id: string, approved: boolean): void {
    const resolve = this.pendingApprovals.get(id);
    if (resolve) {
      resolve(approved);
      this.pendingApprovals.delete(id);
    }
  }

  private cancelPendingApprovals(): void {
    for (const resolve of this.pendingApprovals.values()) {
      resolve(false);
    }
    this.pendingApprovals.clear();
  }

  private requestApproval(id: string, toolName: string, description: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingApprovals.set(id, resolve);
      this.config.onUpdate({
        type: "approval",
        id,
        toolName,
        description,
      });
    });
  }
}

/**
 * History trimming limits per provider. Providers with small per-minute token
 * allowances (e.g. Groq's free tier ~12k TPM) get a much smaller rolling
 * history so each request stays well under the limit; generous-context
 * providers keep the large default.
 */
function historyLimitsFor(providerId: string): {
  tokenBudget: number;
  maxToolResultChars: number;
} {
  switch (providerId) {
    case "groq":
      // ~8k history + ~1.6k fixed overhead keeps a typical turn comfortably
      // small; big tool results (compile logs) are capped at ~2k tokens.
      return { tokenBudget: 8_000, maxToolResultChars: 8_000 };
    default:
      return { tokenBudget: 80_000, maxToolResultChars: 30_000 };
  }
}

function isTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(429|500|502|503|529|overloaded|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed)\b/i.test(
    message,
  );
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? "Unknown provider error");
}

/**
 * Extract a server-suggested retry delay (in ms) from a provider error.
 * Handles common rate-limit phrasings, e.g. Groq/OpenAI's
 * "Please try again in 25.72s" or "try again in 1m30s", and a bare
 * "retry-after: 30" seconds value. Returns null if none is found.
 */
function parseRetryDelayMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);

  // "try again in 1m30s" / "try again in 25.72s" / "try again in 500ms"
  const phrase = message.match(/try again in\s+([0-9hms.]+)/i);
  if (phrase) {
    const ms = parseDuration(phrase[1]);
    if (ms != null) return ms;
  }

  // "retry-after: 30" (HTTP header style, seconds)
  const header = message.match(/retry[- ]after["':\s]+([0-9.]+)/i);
  if (header) {
    const seconds = parseFloat(header[1]);
    if (!Number.isNaN(seconds)) return Math.round(seconds * 1000);
  }

  return null;
}

function parseDuration(raw: string): number | null {
  if (/ms$/i.test(raw)) {
    const ms = parseFloat(raw);
    return Number.isNaN(ms) ? null : Math.round(ms);
  }
  // Compound units like "1m30s" or plain seconds like "25.72s".
  const units = raw.match(/([0-9.]+)\s*(h|m|s)/gi);
  if (units) {
    let total = 0;
    for (const u of units) {
      const value = parseFloat(u);
      if (Number.isNaN(value)) continue;
      if (/h/i.test(u)) total += value * 3_600_000;
      else if (/m/i.test(u)) total += value * 60_000;
      else total += value * 1000;
    }
    return total > 0 ? Math.round(total) : null;
  }
  const seconds = parseFloat(raw);
  return Number.isNaN(seconds) ? null : Math.round(seconds * 1000);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
