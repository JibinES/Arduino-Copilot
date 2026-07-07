// Single source of truth for per-provider model choices.
//
// Defaults favor cheap-but-capable models (the audience is hobbyists) and avoid
// models known to be retired. These are FALLBACKS/HINTS only: the Settings panel
// can fetch the live list per provider via IProvider.listModels(), and the model
// field is always editable. Verified current as of mid-2026 — if an ID stops
// resolving, the "Load models from API" button surfaces the live catalog.

export const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  mistral: "mistral-small-latest",
  ollama: "llama3.2",
  openrouter: "anthropic/claude-haiku-4-5",
  groq: "openai/gpt-oss-20b",
  "custom-openai": "",
};

// A short curated shortlist per provider, shown as autocomplete suggestions.
// The default model is listed first.
export const PROVIDER_MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8"],
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash"],
  mistral: ["mistral-small-latest", "mistral-large-latest", "codestral-latest"],
  ollama: ["llama3.2", "qwen2.5-coder", "codellama", "mistral"],
  openrouter: [
    "anthropic/claude-haiku-4-5",
    "google/gemini-2.5-flash",
    "openai/gpt-4.1-mini",
    "qwen/qwen3-coder",
  ],
  groq: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "groq/compound-mini"],
  "custom-openai": ["gpt-4o-mini", "gpt-4o"],
};

/** The recommended default model id for a provider, or "" if none (e.g. custom endpoints). */
export function defaultModelFor(provider: string): string {
  return PROVIDER_DEFAULT_MODEL[provider] ?? "";
}
