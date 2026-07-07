// Extension -> Webview messages
export type ExtToWebviewMessage =
  | { type: "streamToken"; text: string }
  | { type: "streamDone" }
  | { type: "toolCallStart"; id: string; name: string }
  | { type: "toolCallResult"; id: string; result: string; isError: boolean }
  | { type: "assistantMessage"; content: string }
  | { type: "boardStatus"; board: BoardInfo | null }
  | { type: "providerInfo"; providers: ProviderInfoItem[] }
  | { type: "configUpdate"; config: WebviewConfig }
  | { type: "error"; message: string }
  | { type: "approvalRequest"; id: string; toolName: string; description: string }
  | { type: "modelList"; models: string[] }
  | { type: "serialData"; data: string };

// Webview -> Extension messages
export type WebviewToExtMessage =
  | { type: "sendMessage"; text: string }
  | { type: "cancelRequest" }
  | { type: "setProvider"; providerId: string }
  | { type: "setModel"; model: string }
  | { type: "setApiKey"; providerId: string; key: string }
  | { type: "setSearchApiKey"; provider: string; key: string }
  | { type: "setBaseUrl"; providerId: string; url: string }
  | { type: "approvalResponse"; id: string; approved: boolean }
  | { type: "getProviders" }
  | { type: "getConfig" }
  | { type: "listModels" }
  | { type: "openSettings" }
  | { type: "serialSend"; data: string }
  | { type: "ready" };

export interface BoardInfo {
  name: string;
  fqbn: string;
  port: string;
  protocol: string;
}

export interface ProviderInfoItem {
  id: string;
  name: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
}

export interface WebviewConfig {
  provider: string;
  model: string;
  searchProvider: string;
  hasSearchApiKey: boolean;
  isFirstRun: boolean;
  ollamaUrl: string;
  customOpenaiUrl: string;
}
