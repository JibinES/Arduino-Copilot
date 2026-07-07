import * as vscode from "vscode";
import type { WebviewToExtMessage, ExtToWebviewMessage } from "./message-protocol.js";

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "arduinoBot.chatView";

  private view?: vscode.WebviewView;
  private messageHandler?: (message: WebviewToExtMessage) => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  onMessage(handler: (message: WebviewToExtMessage) => void): void {
    this.messageHandler = handler;
  }

  postMessage(message: ExtToWebviewMessage): void {
    this.view?.webview.postMessage(message);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewToExtMessage) => {
      this.messageHandler?.(message);
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js"),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
      font-src ${webview.cspSource};
      img-src ${webview.cspSource};">
  <title>ArduinoBot</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    #root {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    /* Ensure inputs handle clipboard properly */
    input, textarea {
      -webkit-user-select: text;
      user-select: text;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    // Fix copy/paste in Theia-based webviews (Arduino IDE 2.x)
    // Theia intercepts keyboard shortcuts before the webview DOM gets them.
    // We must capture in the earliest phase and use the clipboard API directly.
    document.addEventListener('keydown', (e) => {
      const el = document.activeElement;
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
      if (!(e.metaKey || e.ctrlKey)) return;

      const input = el;
      const isPassword = input.type === 'password';

      // Helper: get selection range safely (password fields throw)
      function getSel() {
        try { return [input.selectionStart || 0, input.selectionEnd || 0]; }
        catch { return [0, input.value.length]; }
      }

      // Helper: set value via React-compatible native setter
      function setVal(val, cursorPos) {
        const nativeSet = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(input), 'value'
        )?.set;
        if (nativeSet) {
          nativeSet.call(input, val);
          try { input.setSelectionRange(cursorPos, cursorPos); } catch {}
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      switch (e.key) {
        case 'a':
          e.preventDefault(); e.stopPropagation();
          input.select();
          break;
        case 'c':
          e.preventDefault(); e.stopPropagation();
          if (!isPassword) {
            const [s, end] = getSel();
            if (s !== end) {
              navigator.clipboard.writeText(input.value.substring(s, end))
                .catch(() => { document.execCommand('copy'); });
            }
          }
          break;
        case 'x':
          e.preventDefault(); e.stopPropagation();
          if (!isPassword) {
            const [s, end] = getSel();
            if (s !== end) {
              navigator.clipboard.writeText(input.value.substring(s, end)).catch(() => {});
              setVal(input.value.slice(0, s) + input.value.slice(end), s);
            }
          }
          break;
        case 'v':
          e.preventDefault(); e.stopPropagation();
          navigator.clipboard.readText().then((text) => {
            const [s, end] = getSel();
            setVal(input.value.slice(0, s) + text + input.value.slice(end), s + text.length);
          }).catch(() => { document.execCommand('paste'); });
          break;
      }
    }, true);
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
