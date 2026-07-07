export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface StreamEvent {
  type: "text_delta" | "tool_call_start" | "tool_call_delta" | "done" | "error";
  text?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface IProvider {
  readonly id: string;
  readonly name: string;
  readonly requiresApiKey: boolean;

  updateConfig(config: Partial<ProviderConfig>): void;

  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onStream: (event: StreamEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatResponse>;

  listModels(): Promise<string[]>;
}

export interface ProviderConfig {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
}
