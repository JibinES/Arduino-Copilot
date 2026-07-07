import React, { useState, useCallback } from "react";

interface ToolCallInfo {
  id: string;
  name: string;
  result?: string;
  isError?: boolean;
  isComplete: boolean;
}

interface ToolCallBlockProps {
  toolCall: ToolCallInfo;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: "4px 0",
    border: "1px solid var(--vscode-panel-border, #3c3c3c)",
    borderRadius: 4,
    overflow: "hidden",
    background: "var(--vscode-editor-background, #1e1e1e)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    cursor: "pointer",
    userSelect: "none",
    background: "var(--vscode-titleBar-activeBackground, #2d2d2d)",
    fontSize: 12,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    color: "var(--vscode-foreground, #ccc)",
  },
  toolName: {
    fontFamily: "var(--vscode-editor-font-family, 'Courier New', monospace)",
    fontSize: 12,
    flex: 1,
  },
  statusIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  spinner: {
    display: "inline-block",
    width: 12,
    height: 12,
    border: "2px solid var(--vscode-foreground, #ccc)",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "tool-spin 0.8s linear infinite",
    flexShrink: 0,
  },
  resultContainer: {
    borderTop: "1px solid var(--vscode-panel-border, #3c3c3c)",
    maxHeight: 200,
    overflow: "auto",
  },
  resultPre: {
    margin: 0,
    padding: 10,
    fontFamily: "var(--vscode-editor-font-family, 'Courier New', monospace)",
    fontSize: 12,
    color: "var(--vscode-foreground, #ccc)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  chevron: {
    fontSize: 10,
    flexShrink: 0,
    transition: "transform 0.15s ease",
  },
};

// Inject spin keyframes once
const SPIN_STYLE_ID = "tool-call-spin";
if (typeof document !== "undefined" && !document.getElementById(SPIN_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = SPIN_STYLE_ID;
  style.textContent = `@keyframes tool-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    if (toolCall.isComplete && toolCall.result) {
      setExpanded((prev) => !prev);
    }
  }, [toolCall.isComplete, toolCall.result]);

  const renderStatusIcon = () => {
    if (!toolCall.isComplete) {
      return <span style={styles.spinner} />;
    }
    if (toolCall.isError) {
      return (
        <span style={{ ...styles.statusIcon, color: "var(--vscode-errorForeground, #f48771)" }}>
          ✗
        </span>
      );
    }
    return (
      <span
        style={{
          ...styles.statusIcon,
          color: "var(--vscode-testing-iconPassed, #73c991)",
        }}
      >
        ✓
      </span>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={toggle}>
        <span
          style={{
            ...styles.chevron,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </span>
        <span style={styles.toolName}>{toolCall.name}</span>
        {renderStatusIcon()}
      </div>
      {expanded && toolCall.result && (
        <div style={styles.resultContainer}>
          <pre style={styles.resultPre}>{toolCall.result}</pre>
        </div>
      )}
    </div>
  );
};
