import type { ITool, ToolContext } from "./tools/types.js";
import type { ToolCall, ToolResult, ToolDefinition } from "../providers/types.js";

type ApprovalCallback = (
  id: string,
  toolName: string,
  description: string,
) => Promise<boolean>;

export class ToolExecutor {
  private tools: Map<string, ITool> = new Map();
  private context: ToolContext;
  private onApproval?: ApprovalCallback;

  constructor(context: ToolContext, onApproval?: ApprovalCallback) {
    this.context = context;
    this.onApproval = onApproval;
  }

  registerTool(tool: ITool): void {
    this.tools.set(tool.definition.name, tool);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(toolCall: ToolCall, signal?: AbortSignal): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        content: `Unknown tool: ${toolCall.name}`,
        isError: true,
      };
    }

    if (signal?.aborted) {
      return { toolCallId: toolCall.id, content: "Cancelled by user.", isError: true };
    }

    // Check approval for destructive tools (per-call override wins if defined)
    const needsApproval = tool.requiresApprovalFor
      ? tool.requiresApprovalFor(toolCall.arguments)
      : tool.requiresApproval;

    if (needsApproval && this.onApproval) {
      const description = `${toolCall.name}(${JSON.stringify(toolCall.arguments).slice(0, 200)})`;
      const approved = await this.onApproval(toolCall.id, toolCall.name, description);
      if (!approved) {
        return {
          toolCallId: toolCall.id,
          content: "User denied this action.",
          isError: true,
        };
      }
      if (signal?.aborted) {
        return { toolCallId: toolCall.id, content: "Cancelled by user.", isError: true };
      }
    }

    try {
      const result = await tool.execute(toolCall.arguments, { ...this.context, signal });
      return {
        toolCallId: toolCall.id,
        content: result.content,
        isError: result.isError,
      };
    } catch (err) {
      return {
        toolCallId: toolCall.id,
        content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }
}
