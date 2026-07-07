import type { ToolDefinition } from "../../providers/types.js";

export interface ToolContext {
  workspaceRoot: string;
  arduinoCliPath: string;
  defaultBaudRate: number;
  /** Abort signal for the current agent run. Long-running tools should honor it. */
  signal?: AbortSignal;
}

export interface ToolCallInput {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallOutput {
  content: string;
  isError?: boolean;
}

export interface ITool {
  definition: ToolDefinition;
  requiresApproval: boolean;
  /** Optional per-call override — lets a tool gate only its destructive actions. */
  requiresApprovalFor?(args: Record<string, unknown>): boolean;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput>;
}
