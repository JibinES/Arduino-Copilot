import React from "react";
import { CodeBlock } from "./CodeBlock";

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

interface MessageBubbleProps {
  message: ChatMessage;
}

const styles: Record<string, React.CSSProperties> = {
  userContainer: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "4px 0",
  },
  assistantContainer: {
    display: "flex",
    justifyContent: "flex-start",
    padding: "4px 0",
  },
  userBubble: {
    background: "var(--vscode-button-background, #0e639c)",
    color: "var(--vscode-button-foreground, #ffffff)",
    borderRadius: "12px 12px 2px 12px",
    padding: "8px 12px",
    maxWidth: "85%",
    wordBreak: "break-word",
    fontSize: "var(--vscode-font-size, 13px)",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    lineHeight: "1.5",
  },
  assistantBubble: {
    background: "var(--vscode-editor-background, #1e1e1e)",
    color: "var(--vscode-foreground, #cccccc)",
    borderRadius: "12px 12px 12px 2px",
    padding: "8px 12px",
    maxWidth: "95%",
    wordBreak: "break-word",
    fontSize: "var(--vscode-font-size, 13px)",
    fontFamily: "var(--vscode-font-family, sans-serif)",
    lineHeight: "1.5",
  },
  inlineCode: {
    background: "var(--vscode-textCodeBlock-background, #2d2d2d)",
    color: "var(--vscode-textPreformat-foreground, #d7ba7d)",
    padding: "1px 4px",
    borderRadius: 3,
    fontFamily: "var(--vscode-editor-font-family, 'Courier New', monospace)",
    fontSize: "0.9em",
  },
  bold: {
    fontWeight: 700,
  },
  paragraph: {
    margin: "4px 0",
  },
  cursor: {
    display: "inline-block",
    width: 6,
    height: "1em",
    background: "var(--vscode-terminalCursor-foreground, #aeafad)",
    marginLeft: 2,
    verticalAlign: "text-bottom",
    animation: "blink 1s step-end infinite",
  },
};

// Inject blink keyframes once
const BLINK_STYLE_ID = "msg-bubble-blink";
if (typeof document !== "undefined" && !document.getElementById(BLINK_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = BLINK_STYLE_ID;
  style.textContent = `@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`;
  document.head.appendChild(style);
}

function parseMarkdown(text: string): React.ReactNode[] {
  // Split on code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseInline(text.slice(lastIndex, match.index), key));
      key += 100;
    }
    parts.push(
      <CodeBlock key={`cb-${key++}`} code={match[2].trimEnd()} language={match[1] || undefined} />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...parseInline(text.slice(lastIndex), key));
  }

  return parts;
}

function parseInline(text: string, baseKey: number): React.ReactNode[] {
  // Split into paragraphs
  const paragraphs = text.split(/\n{2,}/);
  const nodes: React.ReactNode[] = [];

  paragraphs.forEach((para, pi) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    // Handle single newlines as line breaks within a paragraph
    const lines = trimmed.split("\n");
    const lineNodes: React.ReactNode[] = [];

    lines.forEach((line, li) => {
      if (li > 0) lineNodes.push(<br key={`br-${baseKey}-${pi}-${li}`} />);
      lineNodes.push(...parseFormattedText(line, `${baseKey}-${pi}-${li}`));
    });

    nodes.push(
      <div key={`p-${baseKey}-${pi}`} style={styles.paragraph}>
        {lineNodes}
      </div>
    );
  });

  return nodes;
}

function parseFormattedText(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold** and `inline code`
  const regex = /(\*\*(.+?)\*\*)|(`([^`]+)`)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      nodes.push(text.slice(lastIdx, m.index));
    }
    if (m[2]) {
      // bold
      nodes.push(
        <span key={`b-${keyPrefix}-${k++}`} style={styles.bold}>
          {m[2]}
        </span>
      );
    } else if (m[4]) {
      // inline code
      nodes.push(
        <code key={`ic-${keyPrefix}-${k++}`} style={styles.inlineCode}>
          {m[4]}
        </code>
      );
    }
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div style={isUser ? styles.userContainer : styles.assistantContainer}>
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        {isUser ? message.content : parseMarkdown(message.content)}
        {message.isStreaming && <span style={styles.cursor} />}
      </div>
    </div>
  );
};
