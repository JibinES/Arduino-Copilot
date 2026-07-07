import React, { useState, useEffect, useCallback } from "react";
import { useMessages } from "./hooks/useMessages";
import { useVsCode } from "./hooks/useVsCode";
import { ChatView } from "./components/ChatView";
import { SettingsView } from "./components/SettingsView";
import { WelcomeScreen } from "./components/WelcomeScreen";

interface ProviderInfo {
  id: string;
  name: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
}

interface Config {
  provider: string;
  model: string;
  searchProvider: string;
  hasSearchApiKey: boolean;
  isFirstRun: boolean;
  ollamaUrl: string;
  customOpenaiUrl: string;
}

interface BoardInfo {
  name: string;
  port: string;
}

type View = "chat" | "settings" | "welcome";

export function App() {
  const [view, setView] = useState<View>("chat");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [wizardShown, setWizardShown] = useState(false);
  const { messages, isLoading, approval, addUserMessage, clearApproval } = useMessages();
  const vscode = useVsCode();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "providerInfo") {
        setProviders(msg.providers);
      } else if (msg.type === "configUpdate") {
        setConfig(msg.config);
        // Only show wizard once per session, and only on true first run
        if (msg.config.isFirstRun && !wizardShown && view === "chat") {
          setView("welcome");
          setWizardShown(true);
        }
      } else if (msg.type === "boardStatus") {
        setBoard(msg.board);
      }
    };

    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ready" });

    return () => window.removeEventListener("message", handler);
  }, [wizardShown]);

  const handleSend = useCallback(
    (text: string) => {
      addUserMessage(text);
      vscode.sendMessage(text);
    },
    [addUserMessage, vscode],
  );

  const handleApproval = useCallback(
    (id: string, approved: boolean) => {
      vscode.approvalResponse(id, approved);
      clearApproval();
    },
    [vscode, clearApproval],
  );

  const handleWelcomeComplete = useCallback(() => {
    // Mark setup done even if no API key was entered (e.g. Ollama user)
    vscode.setApiKey("_setup_done", "true");
    setView("chat");
  }, [vscode]);

  if (view === "welcome") {
    return (
      <WelcomeScreen
        providers={providers}
        onSelectProvider={(id) => vscode.setProvider(id)}
        onSaveApiKey={(providerId, key) => vscode.setApiKey(providerId, key)}
        onComplete={handleWelcomeComplete}
      />
    );
  }

  if (view === "settings") {
    return (
      <SettingsView
        providers={providers}
        currentProvider={config?.provider || "anthropic"}
        currentModel={config?.model || ""}
        onSaveApiKey={(providerId, key) => vscode.setApiKey(providerId, key)}
        onSaveSearchKey={(provider, key) => vscode.setSearchApiKey(provider, key)}
        onSaveBaseUrl={(providerId, url) => vscode.setBaseUrl(providerId, url)}
        onSaveModel={(model) => vscode.setModel(model)}
        onClose={() => setView("chat")}
        ollamaUrl={config?.ollamaUrl || "http://localhost:11434"}
        customOpenaiUrl={config?.customOpenaiUrl || ""}
      />
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <ChatView
        messages={messages}
        isLoading={isLoading}
        approval={approval}
        onSend={handleSend}
        onCancel={vscode.cancelRequest}
        onApproval={handleApproval}
        onOpenSettings={() => setView("settings")}
        board={board}
        providers={providers}
        currentProvider={config?.provider || "anthropic"}
        onProviderChange={vscode.setProvider}
      />
    </div>
  );
}
