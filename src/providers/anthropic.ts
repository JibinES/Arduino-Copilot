import { BaseProvider } from "./base-provider.js";
import type {
  ChatMessage,
  ChatResponse,
  ToolCall,
  ToolDefinition,
  StreamEvent,
} from "./types.js";

interface AnthropicContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export class AnthropicProvider extends BaseProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic (Claude)";
  readonly requiresApiKey = true;

  private static readonly API_URL = "https://api.anthropic.com/v1/messages";

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onStream: (event: StreamEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatResponse> {
    const { systemPrompt, formattedMessages } = this.formatMessages(messages);

    const body: Record<string, unknown> = {
      model: this.config.model || "claude-opus-4-8",
      max_tokens: this.config.maxTokens || 4096,
      stream: true,
      messages: formattedMessages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    let content = "";
    const toolCalls: ToolCall[] = [];
    let currentToolId = "";
    let currentToolName = "";
    let currentToolArgs = "";
    let inputTokens = 0;
    let outputTokens = 0;

    await this.fetchSSE(
      AnthropicProvider.API_URL,
      body,
      {
        "x-api-key": this.config.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      (line) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6);

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case "content_block_start": {
              const block = event.content_block;
              if (block?.type === "tool_use") {
                currentToolId = block.id;
                currentToolName = block.name;
                currentToolArgs = "";
                onStream({
                  type: "tool_call_start",
                  toolCall: { id: block.id, name: block.name },
                });
              }
              break;
            }

            case "content_block_delta": {
              const delta = event.delta;
              if (delta?.type === "text_delta" && delta.text) {
                content += delta.text;
                onStream({ type: "text_delta", text: delta.text });
              } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                currentToolArgs += delta.partial_json;
                onStream({
                  type: "tool_call_delta",
                  toolCall: { id: currentToolId },
                  text: delta.partial_json,
                });
              }
              break;
            }

            case "content_block_stop": {
              if (currentToolId) {
                try {
                  toolCalls.push({
                    id: currentToolId,
                    name: currentToolName,
                    arguments: JSON.parse(currentToolArgs || "{}"),
                  });
                } catch {
                  toolCalls.push({
                    id: currentToolId,
                    name: currentToolName,
                    arguments: {},
                  });
                }
                currentToolId = "";
                currentToolName = "";
                currentToolArgs = "";
              }
              break;
            }

            case "message_delta": {
              if (event.usage) {
                outputTokens = event.usage.output_tokens || 0;
              }
              break;
            }

            case "message_start": {
              if (event.message?.usage) {
                inputTokens = event.message.usage.input_tokens || 0;
              }
              break;
            }

            case "message_stop": {
              onStream({ type: "done" });
              break;
            }

            case "error": {
              onStream({ type: "error", error: event.error?.message || "Unknown error" });
              break;
            }
          }
        } catch {
          // Skip malformed lines
        }
      },
      signal,
    );

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: { inputTokens, outputTokens },
    };
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-opus-4-8",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ];
  }

  private formatMessages(messages: ChatMessage[]) {
    let systemPrompt = "";
    const formattedMessages: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt += (systemPrompt ? "\n\n" : "") + msg.content;
        continue;
      }

      if (msg.role === "tool") {
        formattedMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content,
            },
          ],
        });
        continue;
      }

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        const content: AnthropicContent[] = [];
        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        formattedMessages.push({ role: "assistant", content });
        continue;
      }

      formattedMessages.push({ role: msg.role, content: msg.content });
    }

    return { systemPrompt, formattedMessages };
  }
}
