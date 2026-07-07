import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/providers/registry";

describe("ProviderRegistry", () => {
  it("should list all provider IDs", () => {
    const registry = new ProviderRegistry();
    const ids = registry.listProviderIds();
    expect(ids).toContain("anthropic");
    expect(ids).toContain("openai");
    expect(ids).toContain("gemini");
    expect(ids).toContain("mistral");
    expect(ids).toContain("ollama");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("groq");
    expect(ids).toContain("custom-openai");
    expect(ids).toHaveLength(8);
  });

  it("should create a provider instance", () => {
    const registry = new ProviderRegistry();
    const provider = registry.getProvider("anthropic", {
      apiKey: "test-key",
      model: "claude-sonnet-4-20250514",
    });
    expect(provider.id).toBe("anthropic");
    expect(provider.name).toBe("Anthropic (Claude)");
    expect(provider.requiresApiKey).toBe(true);
  });

  it("should reuse provider instances", () => {
    const registry = new ProviderRegistry();
    const p1 = registry.getProvider("ollama", { model: "llama3.1" });
    const p2 = registry.getProvider("ollama", { model: "llama3.1" });
    expect(p1).toBe(p2);
  });

  it("should throw for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(() =>
      registry.getProvider("nonexistent", { model: "x" }),
    ).toThrow("Unknown provider");
  });

  it("should return provider info", () => {
    const registry = new ProviderRegistry();
    const info = registry.getProviderInfo();
    expect(info.length).toBe(8);

    const ollama = info.find((p) => p.id === "ollama");
    expect(ollama?.requiresApiKey).toBe(false);

    const anthropic = info.find((p) => p.id === "anthropic");
    expect(anthropic?.requiresApiKey).toBe(true);

    const groq = info.find((p) => p.id === "groq");
    expect(groq?.requiresApiKey).toBe(true);
  });
});
