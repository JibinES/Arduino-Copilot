import * as fs from "fs/promises";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";
import { resolveWithinWorkspace, accessDeniedMessage } from "./path-utils.js";

export class WriteFileTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "write_file",
    description: "Write a file, creating parent directories and overwriting if it exists.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path (workspace-relative or absolute).",
        },
        content: {
          type: "string",
          description: "Content to write.",
        },
      },
      required: ["path", "content"],
    },
  };

  readonly requiresApproval = true;

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput> {
    const filePath = args.path as string;
    const content = args.content as string;

    if (!filePath) {
      return { content: "Error: 'path' argument is required.", isError: true };
    }

    if (content === undefined || content === null) {
      return { content: "Error: 'content' argument is required.", isError: true };
    }

    const resolvedPath = resolveWithinWorkspace(context.workspaceRoot, filePath);
    if (!resolvedPath) {
      return { content: accessDeniedMessage(filePath), isError: true };
    }

    try {
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(resolvedPath, content, "utf-8");
      return { content: `Successfully wrote ${content.length} characters to "${resolvedPath}".` };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      return { content: `Error writing file: ${error.message}`, isError: true };
    }
  }
}
