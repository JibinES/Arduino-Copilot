import type { IProvider, ProviderConfig } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { MistralProvider } from "./mistral.js";
import { OllamaProvider } from "./ollama.js";
import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import { CustomOpenAIProvider } from "./custom-openai.js";

type ProviderFactory = (config: ProviderConfig) => IProvider;

const PROVIDERS: Record<string, ProviderFactory> = {
  anthropic: (c) => new AnthropicProvider(c),
  openai: (c) => new OpenAIProvider(c),
  gemini: (c) => new GeminiProvider(c),
  mistral: (c) => new MistralProvider(c),
  ollama: (c) => new OllamaProvider(c),
  openrouter: (c) => new OpenRouterProvider(c),
  groq: (c) => new GroqProvider(c),
  "custom-openai": (c) => new CustomOpenAIProvider(c),
};

export class ProviderRegistry {
  private instances: Map<string, IProvider> = new Map();

  getProvider(id: string, config: ProviderConfig): IProvider {
    const existing = this.instances.get(id);
    if (existing) {
      existing.updateConfig(config);
      return existing;
    }

    const factory = PROVIDERS[id];
    if (!factory) {
      throw new Error(`Unknown provider: ${id}. Available: ${this.listProviderIds().join(", ")}`);
    }

    const provider = factory(config);
    this.instances.set(id, provider);
    return provider;
  }

  listProviderIds(): string[] {
    return Object.keys(PROVIDERS);
  }

  getProviderInfo(): Array<{ id: string; name: string; requiresApiKey: boolean }> {
    return Object.entries(PROVIDERS).map(([id, factory]) => {
      const temp = factory({ model: "" });
      return { id, name: temp.name, requiresApiKey: temp.requiresApiKey };
    });
  }
}
