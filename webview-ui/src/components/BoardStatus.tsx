import React from "react";

interface BoardStatusProps {
  board: { name: string; port: string } | null;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontFamily: "var(--vscode-font-family, sans-serif)",
    color: "var(--vscode-foreground, #cccccc)",
    background: "var(--vscode-badge-background, #4d4d4d)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 200,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  dotConnected: {
    background: "var(--vscode-testing-iconPassed, #73c991)",
  },
  dotDisconnected: {
    background: "var(--vscode-descriptionForeground, #888)",
  },
  label: {
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};

export const BoardStatus: React.FC<BoardStatusProps> = ({ board }) => {
  const connected = board !== null;

  return (
    <div style={styles.container}>
      <span
        style={{
          ...styles.dot,
          ...(connected ? styles.dotConnected : styles.dotDisconnected),
        }}
      />
      <span style={styles.label}>
        {connected ? `${board.name} (${board.port})` : "No board"}
      </span>
    </div>
  );
};
