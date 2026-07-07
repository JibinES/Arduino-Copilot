import { execFile } from "child_process";
import { promisify } from "util";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 120000;

/**
 * Search and install Arduino libraries via arduino-cli.
 * Missing-library errors are the most common Arduino compile failure, so the
 * agent needs this to close the compile -> fix -> recompile loop autonomously.
 */
export class ArduinoLibraryTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "arduino_library",
    description:
      "Manage Arduino libraries: 'search' finds by name/keyword, 'install' installs (optional version 'Name@x.y.z'), 'list' shows installed. Use when a compile fails with a missing library header.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["search", "install", "list"],
          description: "Library operation to perform.",
        },
        name: {
          type: "string",
          description: "Library name; required for search/install. May include version 'Name@x.y.z'.",
        },
      },
      required: ["action"],
    },
  };

  // Installing modifies the user's environment; search/list are read-only.
  // Approval is decided per-call in the executor via requiresApprovalFor.
  readonly requiresApproval = true;

  requiresApprovalFor(args: Record<string, unknown>): boolean {
    return args.action === "install";
  }

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolCallOutput> {
    const action = args.action as string;
    const name = (args.name as string) || "";

    if (!action) {
      return { content: "Error: 'action' argument is required.", isError: true };
    }
    if ((action === "search" || action === "install") && !name) {
      return { content: `Error: 'name' argument is required for action '${action}'.`, isError: true };
    }

    const cliArgs =
      action === "search"
        ? ["lib", "search", name, "--format", "json"]
        : action === "install"
          ? ["lib", "install", name]
          : action === "list"
            ? ["lib", "list", "--format", "json"]
            : null;

    if (!cliArgs) {
      return { content: `Error: Unknown action '${action}'. Use 'search', 'install', or 'list'.`, isError: true };
    }

    try {
      const { stdout, stderr } = await execFileAsync(context.arduinoCliPath, cliArgs, {
        timeout: TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
      });

      if (action === "install") {
        return { content: `Library install output:\n${stdout}${stderr}`.trim() + `\nInstalled '${name}'.` };
      }

      if (action === "search") {
        return { content: formatSearchResults(stdout, name) };
      }

      return { content: formatInstalledList(stdout) };
    } catch (err: unknown) {
      const error = err as Error & { stdout?: string; stderr?: string };
      const detail = [error.stderr, error.stdout].filter(Boolean).join("\n").trim();
      return {
        content: `Error running arduino-cli lib ${action}: ${error.message}${detail ? `\n${detail}` : ""}`,
        isError: true,
      };
    }
  }
}

function formatSearchResults(stdout: string, query: string): string {
  try {
    const parsed = JSON.parse(stdout) as {
      libraries?: Array<{
        name?: string;
        latest?: { version?: string; sentence?: string; author?: string };
      }>;
    };
    const libs = parsed.libraries || [];
    if (libs.length === 0) return `No libraries found matching "${query}".`;

    const lines = libs.slice(0, 15).map((lib) => {
      const v = lib.latest?.version ? ` (v${lib.latest.version})` : "";
      const desc = lib.latest?.sentence ? ` — ${lib.latest.sentence}` : "";
      return `- ${lib.name}${v}${desc}`;
    });
    const more = libs.length > 15 ? `\n...and ${libs.length - 15} more.` : "";
    return `Found ${libs.length} libraries matching "${query}":\n${lines.join("\n")}${more}`;
  } catch {
    return stdout;
  }
}

function formatInstalledList(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as {
      installed_libraries?: Array<{ library?: { name?: string; version?: string } }>;
    };
    const libs = parsed.installed_libraries || [];
    if (libs.length === 0) return "No libraries installed.";
    const lines = libs.map((l) => `- ${l.library?.name} (v${l.library?.version})`);
    return `Installed libraries (${libs.length}):\n${lines.join("\n")}`;
  } catch {
    return stdout;
  }
}
