import React, { useState, useCallback, useEffect } from "react";

interface ProviderInfo {
  id: string;
  name: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
}

interface SettingsViewProps {
  providers: ProviderInfo[];
  currentProvider: string;
  currentModel: string;
  onSaveApiKey: (providerId: string, key: string) => void;
  onSaveSearchKey: (provider: string, key: string) => void;
  onSaveBaseUrl: (providerId: string, url: string) => void;
  onSaveModel: (model: string) => void;
  onClose: () => void;
  ollamaUrl: string;
  customOpenaiUrl: string;
  availableModels?: string[];
  onLoadModels?: () => void;
}

const s: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px 14px",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    color: "var(--vscode-foreground, #ccc)",
    height: "100%",
    overflow: "auto",
    background: "var(--vscode-sideBar-background, #252526)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: "1px solid var(--vscode-panel-border, #3c3c3c)",
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
    letterSpacing: 0.3,
  },
  backBtn: {
    background: "var(--vscode-button-secondaryBackground, #3a3d41)",
    border: "none",
    color: "var(--vscode-button-secondaryForeground, #ccc)",
    cursor: "pointer",
    padding: "5px 14px",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "var(--vscode-font-family, sans-serif)",
  },
  // Collapsible section (top-level accordion)
  section: {
    marginBottom: 10,
    border: "1px solid var(--vscode-panel-border, #3c3c3c)",
    borderRadius: 6,
    overflow: "hidden",
    background: "var(--vscode-editorWidget-background, #2d2d2d)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "11px 12px",
    background: "transparent",
    border: "none",
    color: "var(--vscode-foreground, #ccc)",
    cursor: "pointer",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    textAlign: "left" as const,
  },
  sectionHeaderText: { flex: 1 },
  chevron: {
    display: "inline-block",
    fontSize: 10,
    opacity: 0.7,
    transition: "transform 0.15s ease",
  },
  chevronOpen: { transform: "rotate(90deg)" },
  sectionBody: {
    padding: "4px 12px 14px",
    borderTop: "1px solid var(--vscode-panel-border, #3c3c3c)",
  },
  sectionHint: {
    fontSize: 11,
    color: "var(--vscode-descriptionForeground, #888)",
    margin: "8px 0 12px",
    lineHeight: 1.5,
  },
  // Provider card (nested collapsible)
  providerCard: {
    border: "1px solid var(--vscode-panel-border, #3c3c3c)",
    borderRadius: 5,
    marginBottom: 8,
    background: "var(--vscode-sideBar-background, #252526)",
    overflow: "hidden",
  },
  providerHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "9px 11px",
    background: "transparent",
    border: "none",
    color: "var(--vscode-foreground, #ccc)",
    cursor: "pointer",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    fontSize: 12.5,
    fontWeight: 600,
    textAlign: "left" as const,
  },
  providerName: { flex: 1 },
  providerBody: { padding: "2px 11px 12px" },
  row: { marginBottom: 12 },
  sublabel: {
    fontSize: 11,
    color: "var(--vscode-descriptionForeground, #888)",
    marginBottom: 4,
  },
  inputRow: { display: "flex", gap: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #cccccc)",
    border: "1px solid var(--vscode-input-border, #555)",
    borderRadius: 4,
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    outline: "none",
  },
  saveBtn: {
    background: "var(--vscode-button-background, #0e639c)",
    color: "var(--vscode-button-foreground, #ffffff)",
    border: "none",
    borderRadius: 4,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    whiteSpace: "nowrap",
    fontWeight: 600,
  },
  badge: {
    fontSize: 9,
    padding: "2px 7px",
    borderRadius: 8,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  badgeOk: { background: "#2ea04366", color: "#73c991" },
  badgeWarn: { background: "#cca70033", color: "#cca700" },
  badgeFree: { background: "#2ea04366", color: "#73c991" },
};

const SEARCH_PROVIDERS = [
  { id: "tavily", name: "Tavily", hint: "Free 1,000 req/month at tavily.com" },
  { id: "brave", name: "Brave Search", hint: "api.search.brave.com" },
];

const URL_PROVIDERS = new Set(["ollama", "custom-openai"]);

// Current default model per provider (shown as the input placeholder). Kept in
// sync with src/config/provider-models.ts on the host side.
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  mistral: "mistral-small-latest",
  ollama: "llama3.2",
  openrouter: "anthropic/claude-haiku-4-5",
  groq: "openai/gpt-oss-20b",
  "custom-openai": "",
};

// Curated autocomplete suggestions per provider (fallback when the live API list
// can't be fetched). Mirrors PROVIDER_MODEL_SUGGESTIONS on the host side.
const MODEL_SUGGESTIONS: Record<string, string[]> = {
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

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <span style={{ ...s.chevron, ...(open ? s.chevronOpen : {}) }}>&#9654;</span>
);

const StatusBadge: React.FC<{ p: ProviderInfo }> = ({ p }) => {
  if (!p.requiresApiKey) return <span style={{ ...s.badge, ...s.badgeFree }}>Free</span>;
  if (p.hasApiKey) return <span style={{ ...s.badge, ...s.badgeOk }}>Configured</span>;
  return <span style={{ ...s.badge, ...s.badgeWarn }}>Not set</span>;
};

interface SectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, open, onToggle, children }) => (
  <div style={s.section}>
    <button style={s.sectionHeader} onClick={onToggle} aria-expanded={open}>
      <Chevron open={open} />
      <span style={s.sectionHeaderText}>{title}</span>
    </button>
    {open && <div style={s.sectionBody}>{children}</div>}
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  providers,
  currentProvider,
  currentModel,
  onSaveApiKey,
  onSaveSearchKey,
  onSaveBaseUrl,
  onSaveModel,
  onClose,
  ollamaUrl,
  customOpenaiUrl,
  availableModels = [],
  onLoadModels,
}) => {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [searchKeys, setSearchKeys] = useState<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({
    ollama: ollamaUrl || "http://localhost:11434",
    "custom-openai": customOpenaiUrl || "",
  });
  const [model, setModel] = useState(currentModel || "");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loadingModels, setLoadingModels] = useState(false);

  // A model list arrived (or the provider changed) — stop the loading spinner.
  useEffect(() => {
    setLoadingModels(false);
  }, [availableModels]);

  // Combined, de-duplicated model choices: live API results first, then curated.
  const modelChoices = Array.from(
    new Set([...availableModels, ...(MODEL_SUGGESTIONS[currentProvider] || [])]),
  );

  const handleLoadModels = useCallback(() => {
    setLoadingModels(true);
    onLoadModels?.();
  }, [onLoadModels]);

  // Which top-level sections are open. Model + Providers open by default.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    model: true,
    providers: true,
    search: false,
  });
  // Expand the active provider's card by default; others collapsed.
  const [openProvider, setOpenProvider] = useState<string | null>(currentProvider);

  const toggleSection = (id: string) =>
    setOpenSections((p) => ({ ...p, [id]: !p[id] }));
  const toggleProvider = (id: string) =>
    setOpenProvider((cur) => (cur === id ? null : id));

  const flash = (key: string) => {
    setSaved((p) => ({ ...p, [key]: true }));
    setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
  };

  const handleSaveKey = useCallback(
    (id: string) => {
      const key = apiKeys[id];
      if (key?.trim()) { onSaveApiKey(id, key.trim()); flash(id); }
    },
    [apiKeys, onSaveApiKey],
  );

  const handleSaveUrl = useCallback(
    (id: string) => {
      const url = urls[id];
      if (url?.trim()) { onSaveBaseUrl(id, url.trim()); flash(`url-${id}`); }
    },
    [urls, onSaveBaseUrl],
  );

  const handleSaveModel = useCallback(() => {
    if (model.trim()) { onSaveModel(model.trim()); flash("model"); }
  }, [model, onSaveModel]);

  const handleSaveSearchKey = useCallback(
    (id: string) => {
      const key = searchKeys[id];
      if (key?.trim()) { onSaveSearchKey(id, key.trim()); flash(`search-${id}`); }
    },
    [searchKeys, onSaveSearchKey],
  );

  const currentProviderName =
    providers.find((p) => p.id === currentProvider)?.name || currentProvider;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>Settings</h2>
        <button style={s.backBtn} onClick={onClose}>Back to Chat</button>
      </div>

      {/* Model */}
      <Section
        title="Model"
        open={openSections.model}
        onToggle={() => toggleSection("model")}
      >
        <div style={s.sectionHint}>
          Model for the active provider ({currentProviderName}). Pick a suggestion
          or type any model id. Use “Load from API” to fetch this provider’s live list.
        </div>
        <div style={s.inputRow}>
          <input
            style={s.input}
            list="model-choices"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODELS[currentProvider] || "Enter model name"}
          />
          <button style={s.saveBtn} onClick={handleSaveModel}>
            {saved["model"] ? "Saved!" : "Save"}
          </button>
        </div>
        <datalist id="model-choices">
          {modelChoices.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div style={{ ...s.inputRow, marginTop: 8, alignItems: "center" }}>
          <button
            style={{ ...s.backBtn, opacity: loadingModels ? 0.6 : 1 }}
            onClick={handleLoadModels}
            disabled={loadingModels}
          >
            {loadingModels ? "Loading…" : "Load from API"}
          </button>
          <span style={s.sublabel}>
            {availableModels.length > 0
              ? `${availableModels.length} models loaded`
              : "Needs a valid API key / running server"}
          </span>
        </div>
      </Section>

      {/* AI Providers */}
      <Section
        title="AI Providers"
        open={openSections.providers}
        onToggle={() => toggleSection("providers")}
      >
        <div style={s.sectionHint}>
          Expand a provider to add its API key or endpoint. Keys are stored in
          VS Code SecretStorage.
        </div>
        {providers.map((p) => {
          const expanded = openProvider === p.id;
          const showUrl = URL_PROVIDERS.has(p.id);
          const showKey = p.requiresApiKey || p.id === "custom-openai";
          return (
            <div key={p.id} style={s.providerCard}>
              <button
                style={s.providerHeader}
                onClick={() => toggleProvider(p.id)}
                aria-expanded={expanded}
              >
                <Chevron open={expanded} />
                <span style={s.providerName}>{p.name}</span>
                <StatusBadge p={p} />
              </button>

              {expanded && (
                <div style={s.providerBody}>
                  {!showUrl && !showKey && (
                    <div style={s.sublabel}>
                      No configuration needed — this provider runs without an API key.
                    </div>
                  )}

                  {showUrl && (
                    <div style={s.row}>
                      <div style={s.sublabel}>
                        {p.id === "ollama" ? "Ollama server URL" : "API endpoint URL"}
                      </div>
                      <div style={s.inputRow}>
                        <input
                          style={s.input}
                          placeholder={
                            p.id === "ollama"
                              ? "http://localhost:11434"
                              : "https://your-server.com/v1"
                          }
                          value={urls[p.id] || ""}
                          onChange={(e) =>
                            setUrls((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                        />
                        <button style={s.saveBtn} onClick={() => handleSaveUrl(p.id)}>
                          {saved[`url-${p.id}`] ? "Saved!" : "Save"}
                        </button>
                      </div>
                    </div>
                  )}

                  {showKey && (
                    <div style={s.row}>
                      <div style={s.sublabel}>
                        API Key{p.id === "custom-openai" ? " (optional)" : ""}
                      </div>
                      <div style={s.inputRow}>
                        <input
                          type="password"
                          style={s.input}
                          placeholder={`Enter ${p.name} API key`}
                          value={apiKeys[p.id] || ""}
                          onChange={(e) =>
                            setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                        />
                        <button style={s.saveBtn} onClick={() => handleSaveKey(p.id)}>
                          {saved[p.id] ? "Saved!" : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* Web Search */}
      <Section
        title="Web Search (Optional)"
        open={openSections.search}
        onToggle={() => toggleSection("search")}
      >
        <div style={s.sectionHint}>
          Enable web search tools so the AI can look up docs and datasheets.
        </div>
        {SEARCH_PROVIDERS.map((sp) => (
          <div key={sp.id} style={s.row}>
            <div style={{ ...s.sublabel, fontWeight: 600, color: "var(--vscode-foreground, #ccc)" }}>
              {sp.name}
            </div>
            <div style={s.sublabel}>{sp.hint}</div>
            <div style={s.inputRow}>
              <input
                type="password"
                style={s.input}
                placeholder={`Enter ${sp.name} API key`}
                value={searchKeys[sp.id] || ""}
                onChange={(e) =>
                  setSearchKeys((prev) => ({ ...prev, [sp.id]: e.target.value }))
                }
              />
              <button style={s.saveBtn} onClick={() => handleSaveSearchKey(sp.id)}>
                {saved[`search-${sp.id}`] ? "Saved!" : "Save"}
              </button>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
};
