import { useState, useEffect, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  result?: string;
  isError?: boolean;
  isComplete: boolean;
}

export interface ApprovalRequest {
  id: string;
  toolName: string;
  description: string;
}

export function useMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const streamingRef = useRef<string>("");
  const toolCallsRef = useRef<ToolCallInfo[]>([]);

  const addUserMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, msg]);
    setIsLoading(true);
    streamingRef.current = "";
    toolCallsRef.current = [];

    // Add placeholder assistant message
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isStreaming: true,
        toolCalls: [],
      },
    ]);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;

      switch (msg.type) {
        case "streamToken": {
          streamingRef.current += msg.text;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: streamingRef.current,
              };
            }
            return updated;
          });
          break;
        }

        case "streamDone": {
          setIsLoading(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                isStreaming: false,
              };
            }
            return updated;
          });
          break;
        }

        case "toolCallStart": {
          const tc: ToolCallInfo = {
            id: msg.id,
            name: msg.name,
            isComplete: false,
          };
          toolCallsRef.current = [...toolCallsRef.current, tc];
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                toolCalls: [...toolCallsRef.current],
              };
            }
            return updated;
          });
          break;
        }

        case "toolCallResult": {
          toolCallsRef.current = toolCallsRef.current.map((tc) =>
            tc.id === msg.id
              ? { ...tc, result: msg.result, isError: msg.isError, isComplete: true }
              : tc,
          );
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                toolCalls: [...toolCallsRef.current],
              };
            }
            return updated;
          });
          // Reset for next iteration
          streamingRef.current = "";
          break;
        }

        case "assistantMessage": {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: msg.content,
            },
          ]);
          break;
        }

        case "approvalRequest": {
          setApproval({
            id: msg.id,
            toolName: msg.toolName,
            description: msg.description,
          });
          break;
        }

        case "error": {
          setIsLoading(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && last.isStreaming) {
              updated[updated.length - 1] = {
                ...last,
                content: `Error: ${msg.message}`,
                isStreaming: false,
              };
            } else {
              updated.push({
                id: `error-${Date.now()}`,
                role: "assistant",
                content: `Error: ${msg.message}`,
              });
            }
            return updated;
          });
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const clearApproval = useCallback(() => {
    setApproval(null);
  }, []);

  return { messages, isLoading, approval, addUserMessage, clearApproval };
}
