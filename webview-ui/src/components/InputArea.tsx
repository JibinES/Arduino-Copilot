import React, { useState, useRef, useCallback, useEffect } from "react";

interface InputAreaProps {
  onSend: (text: string) => void;
  disabled: boolean;
  onCancel: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "sticky",
    bottom: 0,
    padding: "8px 12px",
    background: "var(--vscode-sideBar-background, #252526)",
    borderTop: "1px solid var(--vscode-panel-border, #3c3c3c)",
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1px solid var(--vscode-input-border, #3c3c3c)",
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #cccccc)",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    fontSize: "var(--vscode-font-size, 13px)",
    padding: "6px 8px",
    borderRadius: 4,
    outline: "none",
    minHeight: 32,
    maxHeight: 150,
    overflow: "auto",
    lineHeight: "1.4",
  },
  sendButton: {
    background: "var(--vscode-button-background, #0e639c)",
    color: "var(--vscode-button-foreground, #ffffff)",
    border: "none",
    borderRadius: 4,
    padding: "6px 14px",
    cursor: "pointer",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    fontSize: "var(--vscode-font-size, 13px)",
    whiteSpace: "nowrap",
    minHeight: 32,
    flexShrink: 0,
  },
  stopButton: {
    background: "var(--vscode-inputValidation-errorBackground, #5a1d1d)",
    color: "var(--vscode-errorForeground, #f48771)",
    border: "1px solid var(--vscode-inputValidation-errorBorder, #be1100)",
    borderRadius: 4,
    padding: "6px 14px",
    cursor: "pointer",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    fontSize: "var(--vscode-font-size, 13px)",
    whiteSpace: "nowrap",
    minHeight: 32,
    flexShrink: 0,
  },
};

export const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, onCancel }) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, []);

  useEffect(() => {
    autoGrow();
  }, [text, autoGrow]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div style={styles.container}>
      <textarea
        ref={textareaRef}
        style={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Waiting for response..." : "Ask about Arduino..."}
        disabled={disabled}
        rows={1}
      />
      {disabled ? (
        <button style={styles.stopButton} onClick={onCancel}>
          Stop
        </button>
      ) : (
        <button
          style={{
            ...styles.sendButton,
            opacity: text.trim() ? 1 : 0.5,
            cursor: text.trim() ? "pointer" : "default",
          }}
          onClick={handleSend}
          disabled={!text.trim()}
        >
          Send
        </button>
      )}
    </div>
  );
};
