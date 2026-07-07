import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OllamaProvider extends OpenAICompatibleProvider {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";
  readonly requiresApiKey = false;

  protected getBaseUrl(): string {
    return (this.config.baseUrl || "http://localhost:11434") + "/v1";
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  protected getModel(): string {
    return this.config.model || "llama3.1";
  }

  async listModels(): Promise<string[]> {
    try {
      const baseUrl = this.config.baseUrl || "http://localhost:11434";
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }
}
