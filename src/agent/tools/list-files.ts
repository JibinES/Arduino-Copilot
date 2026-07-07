import * as fs from "fs/promises";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";
import { resolveWithinWorkspace, accessDeniedMessage } from "./path-utils.js";

export class ListFilesTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "list_files",
    description:
      "List a directory. Defaults to the workspace root, non-recursive; recursive shows a tree up to 3 levels deep.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path (workspace-relative or absolute). Defaults to workspace root.",
        },
        recursive: {
          type: "boolean",
          description: "List recursively (max depth 3). Default false.",
        },
      },
    },
  };

  readonly requiresApproval = false;

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput> {
    const dirPath = (args.path as string) || ".";
    const recursive = (args.recursive as boolean) || false;

    const resolvedPath = resolveWithinWorkspace(context.workspaceRoot, dirPath);
    if (!resolvedPath) {
      return { content: accessDeniedMessage(dirPath), isError: true };
    }

    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        return { content: `Error: "${resolvedPath}" is not a directory.`, isError: true };
      }

      if (recursive) {
        const lines: string[] = [];
        await this.buildTree(resolvedPath, "", 0, 3, lines);
        return { content: lines.join("\n") || "Empty directory." };
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const lines = entries.map((entry) => {
        const suffix = entry.isDirectory() ? "/" : "";
        return `${entry.name}${suffix}`;
      });

      return { content: lines.join("\n") || "Empty directory." };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return { content: `Error: Directory not found: "${resolvedPath}".`, isError: true };
      }
      return { content: `Error listing directory: ${error.message}`, isError: true };
    }
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    currentDepth: number,
    maxDepth: number,
    lines: string[],
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    // Sort entries: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) {
        return -1;
      }
      if (!a.isDirectory() && b.isDirectory()) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
      const suffix = entry.isDirectory() ? "/" : "";

      lines.push(`${prefix}${connector}${entry.name}${suffix}`);

      if (entry.isDirectory()) {
        const childPrefix = prefix + (isLast ? "    " : "\u2502   ");
        await this.buildTree(
          path.join(dirPath, entry.name),
          childPrefix,
          currentDepth + 1,
          maxDepth,
          lines,
        );
      }
    }
  }
}
