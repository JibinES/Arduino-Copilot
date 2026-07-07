import React, { useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { ToolCallBlock } from "./ToolCallBlock";
import { InputArea } from "./InputArea";
import { BoardStatus } from "./BoardStatus";
import { ProviderSelect } from "./ProviderSelect";

interface ToolCallInfo {
  id: string;
  name: string;
  result?: string;
  isError?: boolean;
  isComplete: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
}

interface ApprovalRequest {
  id: string;
  toolName: string;
  description: string;
}

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  approval: ApprovalRequest | null;
  onSend: (text: string) => void;
  onCancel: () => void;
  onApproval: (id: string, approved: boolean) => void;
  onOpenSettings: () => void;
  board: { name: string; port: string } | null;
  providers: Array<{ id: string; name: string; hasApiKey: boolean }>;
  currentProvider: string;
  onProviderChange: (id: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    background: "var(--vscode-sideBar-background, #252526)",
    color: "var(--vscode-foreground, #ccc)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "1px solid var(--vscode-panel-border, #3c3c3c)",
    flexShrink: 0,
    gap: 8,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  settingsBtn: {
    background: "var(--vscode-button-secondaryBackground, #3a3d41)",
    border: "none",
    color: "var(--vscode-foreground, #ccc)",
    cursor: "pointer",
    fontSize: 15,
    padding: "4px 8px",
    borderRadius: 4,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 14px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--vscode-descriptionForeground, #888)",
    fontSize: 13,
    textAlign: "center",
    padding: 24,
    lineHeight: "1.6",
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--vscode-foreground, #ccc)",
    marginBottom: 6,
  },
  approvalOverlay: {
    margin: "8px 0",
    padding: 12,
    background: "var(--vscode-editorWidget-background, #2d2d30)",
    border: "1px solid var(--vscode-editorWarning-foreground, #cca700)",
    borderRadius: 6,
  },
  approvalTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "var(--vscode-editorWarning-foreground, #cca700)",
  },
  approvalDesc: {
    fontSize: 12,
    color: "var(--vscode-foreground, #ccc)",
    marginBottom: 10,
    lineHeight: "1.4",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    background: "var(--vscode-textCodeBlock-background, #1e1e1e)",
    padding: "6px 8px",
    borderRadius: 4,
    wordBreak: "break-all",
  },
  approvalButtons: {
    display: "flex",
    gap: 8,
  },
  approveBtn: {
    background: "var(--vscode-button-background, #0e639c)",
    color: "var(--vscode-button-foreground, #ffffff)",
    border: "none",
    borderRadius: 4,
    padding: "6px 18px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--vscode-font-family, sans-serif)",
  },
  denyBtn: {
    background: "var(--vscode-button-secondaryBackground, #3a3d41)",
    color: "var(--vscode-button-secondaryForeground, #cccccc)",
    border: "none",
    borderRadius: 4,
    padding: "6px 18px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "var(--vscode-font-family, sans-serif)",
  },
};

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  approval,
  onSend,
  onCancel,
  onApproval,
  onOpenSettings,
  board,
  providers,
  currentProvider,
  onProviderChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, approval]);

  const handleApprove = useCallback(
    (id: string) => onApproval(id, true),
    [onApproval],
  );

  const handleDeny = useCallback(
    (id: string) => onApproval(id, false),
    [onApproval],
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <BoardStatus board={board} />
          <ProviderSelect
            providers={providers}
            currentProvider={currentProvider}
            onProviderChange={onProviderChange}
          />
        </div>
        <button
          style={styles.settingsBtn}
          onClick={onOpenSettings}
          title="Settings"
        >
          &#9881;
        </button>
      </div>

      {/* Message List */}
      <div style={styles.messageList}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>&#9889;</div>
            <div style={styles.emptyTitle}>ArduinoBot</div>
            <div>
              Ask me anything about Arduino!
              <br />
              I can write code, compile sketches, upload to boards, and debug errors.
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble message={msg} />
              {msg.toolCalls?.map((tc) => (
                <ToolCallBlock key={tc.id} toolCall={tc} />
              ))}
            </div>
          ))
        )}

        {approval && (
          <div style={styles.approvalOverlay}>
            <div style={styles.approvalTitle}>Approval Required</div>
            <div style={styles.approvalDesc}>
              {approval.toolName}: {approval.description}
            </div>
            <div style={styles.approvalButtons}>
              <button
                style={styles.approveBtn}
                onClick={() => handleApprove(approval.id)}
              >
                Approve
              </button>
              <button
                style={styles.denyBtn}
                onClick={() => handleDeny(approval.id)}
              >
                Deny
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} style={{ height: 0 }} />
      </div>

      <InputArea onSend={onSend} disabled={isLoading} onCancel={onCancel} />
    </div>
  );
};
