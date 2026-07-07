import type {
  IProvider,
  ChatMessage,
  ToolDefinition,
  StreamEvent,
  ChatResponse,
  ProviderConfig,
} from "./types.js";

export abstract class BaseProvider implements IProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresApiKey: boolean;

  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onStream: (event: StreamEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatResponse>;

  abstract listModels(): Promise<string[]>;

  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  protected async fetchSSE(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onLine: (line: string) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.name} API error ${response.status}: ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) onLine(trimmed);
      }
    }

    if (buffer.trim()) onLine(buffer.trim());
  }
}
