import { BaseProvider } from "./base-provider.js";
import type {
  ChatMessage,
  ChatResponse,
  ToolCall,
  ToolDefinition,
  StreamEvent,
} from "./types.js";

export class GeminiProvider extends BaseProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";
  readonly requiresApiKey = true;

  private getBaseUrl(): string {
    return "https://generativelanguage.googleapis.com/v1beta";
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onStream: (event: StreamEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatResponse> {
    const model = this.config.model || "gemini-2.0-flash";
    const url = `${this.getBaseUrl()}/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

    const { systemInstruction, contents } = this.formatMessages(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens || 4096,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    let content = "";
    const toolCalls: ToolCall[] = [];

    await this.fetchSSE(
      url,
      body,
      {},
      (line) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6);

        try {
          const parsed = JSON.parse(data);
          const parts = parsed.candidates?.[0]?.content?.parts || [];

          for (const part of parts) {
            if (part.text) {
              content += part.text;
              onStream({ type: "text_delta", text: part.text });
            }
            if (part.functionCall) {
              const id = `call_${Date.now()}_${toolCalls.length}`;
              toolCalls.push({
                id,
                name: part.functionCall.name,
                arguments: part.functionCall.args || {},
              });
              onStream({
                type: "tool_call_start",
                toolCall: { id, name: part.functionCall.name },
              });
            }
          }
        } catch {
          // Skip malformed
        }
      },
      signal,
    );

    onStream({ type: "done" });

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async listModels(): Promise<string[]> {
    return ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"];
  }

  private formatMessages(messages: ChatMessage[]) {
    let systemInstruction = "";
    const contents: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += (systemInstruction ? "\n\n" : "") + msg.content;
        continue;
      }

      if (msg.role === "tool") {
        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: "tool",
                response: { result: msg.content },
              },
            },
          ],
        });
        continue;
      }

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        const parts: Array<Record<string, unknown>> = [];
        if (msg.content) parts.push({ text: msg.content });
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: { name: tc.name, args: tc.arguments },
          });
        }
        contents.push({ role: "model", parts });
        continue;
      }

      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    return { systemInstruction, contents };
  }
}
