import React, { useState, useCallback } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    borderRadius: 4,
    overflow: "hidden",
    margin: "8px 0",
    background: "var(--vscode-editor-background, #1e1e1e)",
    border: "1px solid var(--vscode-panel-border, #3c3c3c)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 8px",
    background: "var(--vscode-titleBar-activeBackground, #2d2d2d)",
    borderBottom: "1px solid var(--vscode-panel-border, #3c3c3c)",
    fontSize: 11,
  },
  language: {
    color: "var(--vscode-descriptionForeground, #888)",
    textTransform: "lowercase",
    userSelect: "none",
  },
  copyButton: {
    background: "transparent",
    border: "1px solid var(--vscode-button-secondaryBackground, #3a3d41)",
    color: "var(--vscode-foreground, #ccc)",
    cursor: "pointer",
    padding: "2px 8px",
    borderRadius: 3,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  pre: {
    margin: 0,
    padding: 12,
    overflow: "auto",
    maxHeight: 400,
  },
  code: {
    fontFamily: "var(--vscode-editor-font-family, 'Courier New', monospace)",
    fontSize: "var(--vscode-editor-font-size, 13px)",
    color: "var(--vscode-editor-foreground, #d4d4d4)",
    whiteSpace: "pre",
    tabSize: 2,
  },
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.language}>{language || ""}</span>
        <button style={styles.copyButton} onClick={handleCopy} title="Copy code">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={styles.pre}>
        <code style={styles.code}>{code}</code>
      </pre>
    </div>
  );
};
