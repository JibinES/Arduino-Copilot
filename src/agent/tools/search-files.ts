import * as fs from "fs/promises";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";
import { resolveWithinWorkspace, accessDeniedMessage } from "./path-utils.js";

interface SearchMatch {
  file: string;
  line: number;
  text: string;
}

export class SearchFilesTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "search_files",
    description: "Regex-search file contents; returns file:line matches (max 50).",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regex pattern to search for.",
        },
        path: {
          type: "string",
          description: "Directory to search (workspace-relative or absolute). Defaults to workspace root.",
        },
        include: {
          type: "string",
          description: 'Glob to filter files (e.g. "*.ino", "*.ts").',
        },
      },
      required: ["pattern"],
    },
  };

  readonly requiresApproval = false;

  private static readonly MAX_RESULTS = 50;

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput> {
    const pattern = args.pattern as string;
    const searchPath = (args.path as string) || ".";
    const include = args.include as string | undefined;

    if (!pattern) {
      return { content: "Error: 'pattern' argument is required.", isError: true };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (err: unknown) {
      const error = err as Error;
      return { content: `Error: Invalid regex pattern: ${error.message}`, isError: true };
    }

    const resolvedPath = resolveWithinWorkspace(context.workspaceRoot, searchPath);
    if (!resolvedPath) {
      return { content: accessDeniedMessage(searchPath), isError: true };
    }

    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        return { content: `Error: "${resolvedPath}" is not a directory.`, isError: true };
      }

      const matches: SearchMatch[] = [];
      await this.searchDirectory(resolvedPath, regex, include, matches, path.resolve(context.workspaceRoot));

      if (matches.length === 0) {
        return { content: `No matches found for pattern "${pattern}".` };
      }

      const lines = matches.map(
        (m) => `${path.relative(context.workspaceRoot, m.file)}:${m.line}: ${m.text}`,
      );

      let result = lines.join("\n");
      if (matches.length >= SearchFilesTool.MAX_RESULTS) {
        result += `\n\n(Results truncated at ${SearchFilesTool.MAX_RESULTS} matches.)`;
      }

      return { content: result };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return { content: `Error: Directory not found: "${resolvedPath}".`, isError: true };
      }
      return { content: `Error searching files: ${error.message}`, isError: true };
    }
  }

  private async searchDirectory(
    dirPath: string,
    regex: RegExp,
    include: string | undefined,
    matches: SearchMatch[],
    workspaceRoot: string,
  ): Promise<void> {
    if (matches.length >= SearchFilesTool.MAX_RESULTS) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (matches.length >= SearchFilesTool.MAX_RESULTS) {
        return;
      }

      const fullPath = path.join(dirPath, entry.name);

      // Skip common non-code directories
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "build") {
          continue;
        }
        await this.searchDirectory(fullPath, regex, include, matches, workspaceRoot);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      // Apply include glob filter
      if (include && !this.matchesGlob(entry.name, include)) {
        continue;
      }

      // Skip binary files by checking extension
      if (this.isBinaryExtension(entry.name)) {
        continue;
      }

      await this.searchFile(fullPath, regex, matches);
    }
  }

  private async searchFile(
    filePath: string,
    regex: RegExp,
    matches: SearchMatch[],
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= SearchFilesTool.MAX_RESULTS) {
          return;
        }

        if (regex.test(lines[i])) {
          matches.push({
            file: filePath,
            line: i + 1,
            text: lines[i].trimEnd(),
          });
        }
      }
    } catch {
      // Skip files that cannot be read (e.g., binary files that fail utf-8 decode)
    }
  }

  private matchesGlob(fileName: string, globPattern: string): boolean {
    // Convert simple glob pattern to regex
    // Supports: *.ext, *.{ext1,ext2}, exact names
    const escaped = globPattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\{([^}]+)\}/g, (_match, group: string) => {
        const alternatives = group.split(",").map((s: string) => s.trim());
        return `(${alternatives.join("|")})`;
      });

    const globRegex = new RegExp(`^${escaped}$`);
    return globRegex.test(fileName);
  }

  private isBinaryExtension(fileName: string): boolean {
    const binaryExtensions = new Set([
      ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
      ".zip", ".tar", ".gz", ".rar", ".7z",
      ".exe", ".dll", ".so", ".dylib",
      ".pdf", ".doc", ".docx", ".xls", ".xlsx",
      ".bin", ".hex", ".elf", ".o", ".a",
      ".woff", ".woff2", ".ttf", ".eot",
      ".mp3", ".wav", ".ogg", ".mp4", ".avi",
    ]);

    const ext = path.extname(fileName).toLowerCase();
    return binaryExtensions.has(ext);
  }
}
