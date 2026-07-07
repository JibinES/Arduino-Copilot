import { OpenAICompatibleProvider } from "./openai-compatible.js";
import { defaultModelFor } from "../config/provider-models.js";

export class GroqProvider extends OpenAICompatibleProvider {
  readonly id = "groq";
  readonly name = "Groq";
  readonly requiresApiKey = true;

  protected getBaseUrl(): string {
    return "https://api.groq.com/openai/v1";
  }

  protected getHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  protected getModel(): string {
    return this.config.model || defaultModelFor(this.id);
  }
}
