import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";
  readonly requiresApiKey = true;

  protected getBaseUrl(): string {
    return "https://openrouter.ai/api/v1";
  }

  protected getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "HTTP-Referer": "https://github.com/arduinobot",
      "X-Title": "ArduinoBot",
    };
  }

  protected getModel(): string {
    return this.config.model || "anthropic/claude-opus-4.8";
  }
}
