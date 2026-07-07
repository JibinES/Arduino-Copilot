import * as vscode from "vscode";

export function getConfig() {
  const config = vscode.workspace.getConfiguration("arduinoBot");
  return {
    provider: config.get<string>("provider", "anthropic"),
    model: config.get<string>("model", "claude-opus-4-8"),
    arduinoCliPath: config.get<string>("arduinoCliPath", "arduino-cli"),
    defaultBaudRate: config.get<number>("defaultBaudRate", 9600),
    searchProvider: config.get<string>("searchProvider", "none"),
    ollamaUrl: config.get<string>("ollamaUrl", "http://localhost:11434"),
    customOpenaiUrl: config.get<string>("customOpenaiUrl", ""),
  };
}

export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("arduinoBot")) {
      callback();
    }
  });
}
