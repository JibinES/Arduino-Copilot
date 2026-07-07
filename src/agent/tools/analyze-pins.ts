import * as fs from "fs/promises";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";
import { resolveWithinWorkspace, accessDeniedMessage } from "./path-utils.js";
import { analyzePins, formatPinAnalysis } from "../../arduino/pin-analyzer.js";

export class AnalyzePinsTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "analyze_pins",
    description:
      "Scan a sketch and report which pins and buses it uses plus any pin conflicts (e.g. using pins 0/1 while Serial is active). Call this before giving wiring help or when a wired component doesn't respond, then produce a pin→component wiring table for the user's board.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Sketch file path (workspace-relative).",
        },
      },
      required: ["path"],
    },
  };

  readonly requiresApproval = false;

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput> {
    const filePath = args.path as string;
    if (!filePath) {
      return { content: "Error: 'path' argument is required.", isError: true };
    }

    const resolved = resolveWithinWorkspace(context.workspaceRoot, filePath);
    if (!resolved) {
      return { content: accessDeniedMessage(filePath), isError: true };
    }

    try {
      const src = await fs.readFile(resolved, "utf-8");
      return { content: formatPinAnalysis(analyzePins(src)) };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return { content: `Error: File not found: "${resolved}".`, isError: true };
      }
      return { content: `Error reading file: ${error.message}`, isError: true };
    }
  }
}
