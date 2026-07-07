import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  readonly requiresApiKey = true;

  protected getBaseUrl(): string {
    return "https://api.openai.com/v1";
  }

  protected getHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  protected getModel(): string {
    return this.config.model || "gpt-4o";
  }
}
