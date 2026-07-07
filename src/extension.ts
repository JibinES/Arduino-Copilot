import * as vscode from "vscode";
import { ProviderRegistry } from "./providers/registry.js";
import { SecretManager } from "./config/secrets.js";
import { getConfig, onConfigChange } from "./config/settings.js";
import { ChatPanelProvider } from "./webview/chat-panel.js";
import type { WebviewToExtMessage, ProviderInfoItem, WebviewConfig } from "./webview/message-protocol.js";
import type { StreamEvent, ProviderConfig } from "./providers/types.js";
import { Agent } from "./agent/agent.js";
import { resolveArduinoCliSync, ensureArduinoCliDownloaded } from "./arduino/cli-locator.js";
import { defaultModelFor } from "./config/provider-models.js";

let agent: Agent | undefined;
let abortController: AbortController | undefined;
let cliDownloadStarted = false;

export function activate(context: vscode.ExtensionContext) {
  const registry = new ProviderRegistry();
  const secrets = new SecretManager(context.secrets);
  const chatPanel = new ChatPanelProvider(context.extensionUri);

  // Mutable first-run flag — set once, never re-triggers
  let isFirstRun = !context.globalState.get("arduinoBot.setupDone");

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewType, chatPanel),
  );

  // Helper to get current provider
  async function getCurrentProvider() {
    const config = getConfig();
    const apiKey = await secrets.getApiKey(config.provider);
    const providerConfig: ProviderConfig = {
      apiKey: apiKey || undefined,
      model: config.model,
      baseUrl: config.provider === "ollama" ? config.ollamaUrl
        : config.provider === "custom-openai" ? config.customOpenaiUrl
        : undefined,
    };
    return registry.getProvider(config.provider, providerConfig);
  }

  // Helper to build webview config
  async function buildWebviewConfig(): Promise<WebviewConfig> {
    const config = getConfig();
    const searchKey = config.searchProvider !== "none"
      ? await secrets.getSearchApiKey(config.searchProvider)
      : undefined;
    return {
      provider: config.provider,
      model: config.model,
      searchProvider: config.searchProvider,
      hasSearchApiKey: !!searchKey,
      isFirstRun,
      ollamaUrl: config.ollamaUrl,
      customOpenaiUrl: config.customOpenaiUrl,
    };
  }

  // Helper to build provider info list
  async function buildProviderInfo(): Promise<ProviderInfoItem[]> {
    const providers = registry.getProviderInfo();
    const result: ProviderInfoItem[] = [];
    for (const p of providers) {
      const hasKey = p.requiresApiKey ? !!(await secrets.getApiKey(p.id)) : true;
      result.push({ ...p, hasApiKey: hasKey });
    }
    return result;
  }

  // Handle messages from webview
  chatPanel.onMessage(async (message: WebviewToExtMessage) => {
    switch (message.type) {
      case "ready": {
        chatPanel.postMessage({ type: "configUpdate", config: await buildWebviewConfig() });
        chatPanel.postMessage({ type: "providerInfo", providers: await buildProviderInfo() });
        break;
      }

      case "sendMessage": {
        if (agent?.isRunning()) {
          chatPanel.postMessage({
            type: "error",
            message: "A request is already running. Cancel it first or wait for it to finish.",
          });
          break;
        }
        try {
          const provider = await getCurrentProvider();
          const config = getConfig();
          const searchKey = config.searchProvider !== "none"
            ? await secrets.getSearchApiKey(config.searchProvider)
            : undefined;

          // Resolve the real arduino-cli location (configured path, an install we
          // know about, or a cached download) — synchronous, never blocks the UI.
          const storageDir = context.globalStorageUri.fsPath;
          const resolvedCliPath = resolveArduinoCliSync(config.arduinoCliPath, storageDir);
          // If nothing was found, self-heal in the background for next time. Best-effort
          // and offline-safe; it never blocks this message and never breaks Ollama/offline.
          if (resolvedCliPath === "arduino-cli" && !cliDownloadStarted) {
            cliDownloadStarted = true;
            void ensureArduinoCliDownloaded(storageDir);
          }

          if (!agent) {
            agent = new Agent(provider, {
              workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
              searchApiKey: searchKey,
              searchProvider: config.searchProvider !== "none" ? config.searchProvider : undefined,
              arduinoCliPath: resolvedCliPath,
              defaultBaudRate: config.defaultBaudRate,
              onUpdate: (event) => {
                if (event.type === "stream") {
                  const se = event.event as StreamEvent;
                  if (se.type === "text_delta" && se.text) {
                    chatPanel.postMessage({ type: "streamToken", text: se.text });
                  } else if (se.type === "tool_call_start" && se.toolCall) {
                    chatPanel.postMessage({
                      type: "toolCallStart",
                      id: se.toolCall.id || "",
                      name: se.toolCall.name || "",
                    });
                  } else if (se.type === "done") {
                    chatPanel.postMessage({ type: "streamDone" });
                  }
                } else if (event.type === "toolResult") {
                  chatPanel.postMessage({
                    type: "toolCallResult",
                    id: event.toolCallId as string,
                    result: event.result as string,
                    isError: (event.isError as boolean) || false,
                  });
                } else if (event.type === "approval") {
                  chatPanel.postMessage({
                    type: "approvalRequest",
                    id: event.id as string,
                    toolName: event.toolName as string,
                    description: event.description as string,
                  });
                } else if (event.type === "error") {
                  chatPanel.postMessage({ type: "error", message: event.message as string });
                } else if (event.type === "info") {
                  chatPanel.postMessage({
                    type: "assistantMessage",
                    content: event.message as string,
                  });
                }
              },
            });
          } else {
            agent.updateProvider(provider);
          }

          abortController = new AbortController();
          await agent.run(message.text, abortController.signal);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          chatPanel.postMessage({ type: "error", message: errorMessage });
        }
        break;
      }

      case "cancelRequest": {
        abortController?.abort();
        break;
      }

      case "setProvider": {
        const cfg = vscode.workspace.getConfiguration("arduinoBot");
        await cfg.update("provider", message.providerId, vscode.ConfigurationTarget.Global);
        // Give the newly-selected provider a valid default model so its model id
        // matches the provider (prevents "model not found" errors). Still editable.
        const def = defaultModelFor(message.providerId);
        if (def) {
          await cfg.update("model", def, vscode.ConfigurationTarget.Global);
        }
        break;
      }

      case "setModel": {
        await vscode.workspace
          .getConfiguration("arduinoBot")
          .update("model", message.model, vscode.ConfigurationTarget.Global);
        break;
      }

      case "setBaseUrl": {
        const setting = message.providerId === "ollama" ? "ollamaUrl" : "customOpenaiUrl";
        await vscode.workspace
          .getConfiguration("arduinoBot")
          .update(setting, message.url, vscode.ConfigurationTarget.Global);
        chatPanel.postMessage({ type: "configUpdate", config: await buildWebviewConfig() });
        break;
      }

      case "setApiKey": {
        await secrets.setApiKey(message.providerId, message.key);
        chatPanel.postMessage({ type: "providerInfo", providers: await buildProviderInfo() });
        // Mark setup done after first API key or provider selection
        if (isFirstRun) {
          isFirstRun = false;
          await context.globalState.update("arduinoBot.setupDone", true);
          chatPanel.postMessage({ type: "configUpdate", config: await buildWebviewConfig() });
        }
        break;
      }

      case "setSearchApiKey": {
        await secrets.setSearchApiKey(message.provider, message.key);
        chatPanel.postMessage({ type: "configUpdate", config: await buildWebviewConfig() });
        break;
      }

      case "getProviders": {
        chatPanel.postMessage({ type: "providerInfo", providers: await buildProviderInfo() });
        break;
      }

      case "getConfig": {
        chatPanel.postMessage({ type: "configUpdate", config: await buildWebviewConfig() });
        break;
      }

      case "listModels": {
        // Ask the active provider for its live model catalog; empty on failure
        // (offline, bad key) so the UI falls back to its curated suggestions.
        try {
          const provider = await getCurrentProvider();
          const models = await provider.listModels();
          chatPanel.postMessage({ type: "modelList", models });
        } catch {
          chatPanel.postMessage({ type: "modelList", models: [] });
        }
        break;
      }

      case "openSettings": {
        vscode.commands.executeCommand("workbench.action.openSettings", "arduinoBot");
        break;
      }

      case "approvalResponse": {
        agent?.resolveApproval(message.id, message.approved);
        break;
      }
    }
  });

  // Watch config changes
  context.subscriptions.push(
    onConfigChange(async () => {
      chatPanel.postMessage({ type: "configUpdate", config: await buildWebviewConfig() });
      // Abort any in-flight run before discarding the agent, otherwise the
      // orphaned run keeps streaming into the webview.
      abortController?.abort();
      agent = undefined;
    }),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("arduinoBot.openChat", () => {
      vscode.commands.executeCommand("arduinoBot.chatView.focus");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arduinoBot.newProject", () => {
      vscode.commands.executeCommand("arduinoBot.chatView.focus");
      chatPanel.postMessage({
        type: "assistantMessage",
        content:
          "Let's start a new project. Tell me your board (e.g. Uno, Nano, ESP32) and what you want to build — the sensors/outputs and how it should behave — and I'll scaffold the code, install the libraries, compile it, and give you a wiring table.",
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arduinoBot.compile", () => {
      chatPanel.postMessage({
        type: "assistantMessage",
        content: "Compiling current sketch...",
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arduinoBot.upload", () => {
      chatPanel.postMessage({
        type: "assistantMessage",
        content: "Uploading to board...",
      });
    }),
  );
}

export function deactivate() {
  abortController?.abort();
}
