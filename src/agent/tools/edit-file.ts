import * as fs from "fs/promises";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";
import { resolveWithinWorkspace, accessDeniedMessage } from "./path-utils.js";

export class EditFileTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "edit_file",
    description:
      "Replace the first exact occurrence of old_string with new_string in a file. old_string must match exactly, including whitespace and indentation.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path (workspace-relative or absolute).",
        },
        old_string: {
          type: "string",
          description: "Exact string to find (must match file content exactly).",
        },
        new_string: {
          type: "string",
          description: "Replacement string.",
        },
      },
      required: ["path", "old_string", "new_string"],
    },
  };

  readonly requiresApproval = true;

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput> {
    const filePath = args.path as string;
    const oldString = args.old_string as string;
    const newString = args.new_string as string;

    if (!filePath) {
      return { content: "Error: 'path' argument is required.", isError: true };
    }

    if (oldString === undefined || oldString === null) {
      return { content: "Error: 'old_string' argument is required.", isError: true };
    }

    if (newString === undefined || newString === null) {
      return { content: "Error: 'new_string' argument is required.", isError: true };
    }

    const resolvedPath = resolveWithinWorkspace(context.workspaceRoot, filePath);
    if (!resolvedPath) {
      return { content: accessDeniedMessage(filePath), isError: true };
    }

    try {
      const content = await fs.readFile(resolvedPath, "utf-8");

      if (!content.includes(oldString)) {
        return {
          content: `Error: The string to replace was not found in "${resolvedPath}". Make sure 'old_string' matches the file content exactly, including whitespace and indentation.`,
          isError: true,
        };
      }

      // Replace only the first occurrence
      const index = content.indexOf(oldString);
      const updatedContent =
        content.substring(0, index) + newString + content.substring(index + oldString.length);

      await fs.writeFile(resolvedPath, updatedContent, "utf-8");
      return { content: `Successfully edited "${resolvedPath}".` };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return { content: `Error: File not found: "${resolvedPath}".`, isError: true };
      }
      return { content: `Error editing file: ${error.message}`, isError: true };
    }
  }
}
