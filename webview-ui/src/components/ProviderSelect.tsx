import React from "react";

interface ProviderInfo {
  id: string;
  name: string;
  hasApiKey: boolean;
}

interface ProviderSelectProps {
  providers: ProviderInfo[];
  currentProvider: string;
  onProviderChange: (id: string) => void;
}

const s: Record<string, React.CSSProperties> = {
  select: {
    background: "var(--vscode-dropdown-background, #3c3c3c)",
    color: "var(--vscode-dropdown-foreground, #cccccc)",
    border: "1px solid var(--vscode-dropdown-border, #555)",
    borderRadius: 4,
    padding: "3px 6px",
    fontSize: 11,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    outline: "none",
    cursor: "pointer",
    maxWidth: 150,
  },
};

const SHORT_NAMES: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  mistral: "Mistral",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  groq: "Groq",
  "custom-openai": "Custom API",
};

export const ProviderSelect: React.FC<ProviderSelectProps> = ({
  providers,
  currentProvider,
  onProviderChange,
}) => {
  return (
    <select
      style={s.select}
      value={currentProvider}
      onChange={(e) => onProviderChange(e.target.value)}
    >
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {SHORT_NAMES[p.id] || p.name}
          {p.hasApiKey ? "" : " !"}
        </option>
      ))}
    </select>
  );
};
