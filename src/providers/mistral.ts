import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class MistralProvider extends OpenAICompatibleProvider {
  readonly id = "mistral";
  readonly name = "Mistral";
  readonly requiresApiKey = true;

  protected getBaseUrl(): string {
    return "https://api.mistral.ai/v1";
  }

  protected getHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  protected getModel(): string {
    return this.config.model || "mistral-large-latest";
  }
}
