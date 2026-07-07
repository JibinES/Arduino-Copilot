import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class CustomOpenAIProvider extends OpenAICompatibleProvider {
  readonly id = "custom-openai";
  readonly name = "Custom OpenAI-Compatible";
  readonly requiresApiKey = false;

  protected getBaseUrl(): string {
    return this.config.baseUrl || "http://localhost:8080/v1";
  }

  protected getHeaders(): Record<string, string> {
    if (this.config.apiKey) {
      return { Authorization: `Bearer ${this.config.apiKey}` };
    }
    return {};
  }
}
