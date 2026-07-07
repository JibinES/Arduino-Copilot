import { execFile } from "child_process";
import { promisify } from "util";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_LENGTH = 10000;
const TIMEOUT_MS = 30000;

export class RunCommandTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "run_command",
    description:
      "Run a shell command in the workspace (30s timeout) when no dedicated tool covers the task.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute.",
        },
        cwd: {
          type: "string",
          description: "Working directory. Defaults to workspace root.",
        },
      },
      required: ["command"],
    },
  };

  readonly requiresApproval = true;

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolCallOutput> {
    const command = args.command as string;
    if (!command) {
      return { content: "Error: 'command' argument is required.", isError: true };
    }

    const cwd = (args.cwd as string) || context.workspaceRoot;

    try {
      const { stdout, stderr } = await execFileAsync(command, [], {
        shell: true,
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      });

      let output = "";
      if (stdout) {
        output += stdout;
      }
      if (stderr) {
        output += (output ? "\n" : "") + stderr;
      }
      if (!output) {
        output = "(command completed with no output)";
      }

      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncated)";
      }

      return { content: output };
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
        code?: string | number;
      };

      if (error.killed) {
        return {
          content: `Command timed out after ${TIMEOUT_MS / 1000} seconds.`,
          isError: true,
        };
      }

      let output = "";
      if (error.stdout) {
        output += error.stdout;
      }
      if (error.stderr) {
        output += (output ? "\n" : "") + error.stderr;
      }
      if (!output) {
        output = error.message || "Unknown error";
      }

      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + "\n...(truncated)";
      }

      return { content: output, isError: true };
    }
  }
}
