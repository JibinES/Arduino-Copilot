import { BaseProvider } from "./base-provider.js";
import type {
  ChatMessage,
  ChatResponse,
  ToolCall,
  ToolDefinition,
  StreamEvent,
} from "./types.js";

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export abstract class OpenAICompatibleProvider extends BaseProvider {
  protected abstract getBaseUrl(): string;
  protected abstract getHeaders(): Record<string, string>;

  protected getModel(): string {
    return this.config.model;
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onStream: (event: StreamEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatResponse> {
    const url = `${this.getBaseUrl()}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.getModel(),
      messages: this.formatMessages(messages),
      stream: true,
      max_tokens: this.config.maxTokens || 4096,
    };

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    let content = "";
    const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
    let inputTokens = 0;
    let outputTokens = 0;

    await this.fetchSSE(
      url,
      body,
      this.getHeaders(),
      (line) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6);
        if (data === "[DONE]") {
          onStream({ type: "done" });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) return;

          if (delta.content) {
            content += delta.content;
            onStream({ type: "text_delta", text: delta.content });
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (tc.id) {
                toolCalls.set(idx, { id: tc.id, name: tc.function?.name || "", args: "" });
                onStream({
                  type: "tool_call_start",
                  toolCall: { id: tc.id, name: tc.function?.name },
                });
              }
              const existing = toolCalls.get(idx);
              if (existing && tc.function?.arguments) {
                existing.args += tc.function.arguments;
                onStream({
                  type: "tool_call_delta",
                  toolCall: { id: existing.id },
                  text: tc.function.arguments,
                });
              }
            }
          }

          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens || 0;
            outputTokens = parsed.usage.completion_tokens || 0;
          }
        } catch {
          // Skip malformed lines
        }
      },
      signal,
    );

    const resultToolCalls: ToolCall[] = [];
    for (const [, tc] of toolCalls) {
      try {
        resultToolCalls.push({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(tc.args || "{}"),
        });
      } catch {
        resultToolCalls.push({
          id: tc.id,
          name: tc.name,
          arguments: {},
        });
      }
    }

    return {
      content,
      toolCalls: resultToolCalls.length > 0 ? resultToolCalls : undefined,
      usage: { inputTokens, outputTokens },
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/models`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { data?: Array<{ id: string }> };
      return (data.data || []).map((m) => m.id);
    } catch {
      return [];
    }
  }

  private formatMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool",
          content: m.content,
          tool_call_id: m.toolCallId || "",
        };
      }

      if (m.role === "assistant" && m.toolCalls?.length) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }

      return { role: m.role, content: m.content };
    });
  }
}
