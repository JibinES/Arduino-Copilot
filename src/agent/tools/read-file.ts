import * as fs from "fs/promises";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";
import { resolveWithinWorkspace, accessDeniedMessage } from "./path-utils.js";

export class ReadFileTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "read_file",
    description: "Read a file's contents.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path (workspace-relative or absolute).",
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

    const resolvedPath = resolveWithinWorkspace(context.workspaceRoot, filePath);
    if (!resolvedPath) {
      return { content: accessDeniedMessage(filePath), isError: true };
    }

    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        return { content: `Error: "${resolvedPath}" is not a file.`, isError: true };
      }

      const content = await fs.readFile(resolvedPath, "utf-8");
      return { content };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return { content: `Error: File not found: "${resolvedPath}".`, isError: true };
      }
      return { content: `Error reading file: ${error.message}`, isError: true };
    }
  }
}
