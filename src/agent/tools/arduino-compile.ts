import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const execFileAsync = promisify(execFile);

export class ArduinoCompileTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "arduino_compile",
    description:
      "Compile an Arduino sketch; returns errors/warnings. Auto-detects the board if fqbn is omitted.",
    parameters: {
      type: "object",
      properties: {
        sketch_path: {
          type: "string",
          description: "Sketch file or directory path (workspace-relative).",
        },
        fqbn: {
          type: "string",
          description: "Board FQBN (e.g. 'arduino:avr:uno'). Auto-detected if omitted.",
        },
      },
      required: ["sketch_path"],
    },
  };

  readonly requiresApproval = false;

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolCallOutput> {
    const sketchPath = args.sketch_path as string;
    if (!sketchPath) {
      return { content: "Error: 'sketch_path' argument is required.", isError: true };
    }

    const resolvedSketchPath = path.isAbsolute(sketchPath)
      ? sketchPath
      : path.resolve(context.workspaceRoot, sketchPath);

    let fqbn = args.fqbn as string | undefined;

    // Auto-detect board if fqbn not provided
    if (!fqbn) {
      try {
        fqbn = await this.detectBoard(context);
      } catch {
        return {
          content:
            "Error: No fqbn provided and auto-detection failed. Please specify a board FQBN (e.g., 'arduino:avr:uno').",
          isError: true,
        };
      }
    }

    const cliArgs = [
      "compile",
      "--fqbn",
      fqbn,
      resolvedSketchPath,
      "--format",
      "json",
    ];

    try {
      const { stdout, stderr } = await execFileAsync(
        context.arduinoCliPath,
        cliArgs,
        {
          cwd: context.workspaceRoot,
          timeout: 120000,
          maxBuffer: 1024 * 1024,
        },
      );

      try {
        const result = JSON.parse(stdout) as {
          success?: boolean;
          compiler_out?: string;
          compiler_err?: string;
          builder_result?: { used_platform?: string };
        };

        let output = `Compilation successful for board: ${fqbn}\n`;
        if (result.compiler_out) {
          output += `\nCompiler output:\n${result.compiler_out}`;
        }
        if (result.compiler_err) {
          output += `\nCompiler warnings/info:\n${result.compiler_err}`;
        }
        return { content: output };
      } catch {
        // JSON parse failed, return raw output
        let output = stdout;
        if (stderr) {
          output += "\n" + stderr;
        }
        return { content: output || "Compilation completed." };
      }
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      // Try to parse JSON error output from arduino-cli
      if (error.stdout) {
        try {
          const result = JSON.parse(error.stdout) as {
            compiler_err?: string;
            compiler_out?: string;
          };
          let output = "Compilation failed.\n";
          if (result.compiler_err) {
            output += `\nErrors:\n${result.compiler_err}`;
          }
          if (result.compiler_out) {
            output += `\nOutput:\n${result.compiler_out}`;
          }
          return { content: output, isError: true };
        } catch {
          // Not valid JSON, fall through
        }
      }

      let output = "Compilation failed.\n";
      if (error.stderr) {
        output += error.stderr;
      } else if (error.stdout) {
        output += error.stdout;
      } else {
        output += error.message || "Unknown error";
      }

      return { content: output, isError: true };
    }
  }

  private async detectBoard(context: ToolContext): Promise<string> {
    const { stdout } = await execFileAsync(
      context.arduinoCliPath,
      ["board", "list", "--format", "json"],
      { timeout: 15000 },
    );

    const boards = JSON.parse(stdout) as Array<{
      matching_boards?: Array<{ fqbn?: string }>;
    }>;

    for (const entry of boards) {
      if (entry.matching_boards && entry.matching_boards.length > 0) {
        const fqbn = entry.matching_boards[0].fqbn;
        if (fqbn) {
          return fqbn;
        }
      }
    }

    throw new Error("No board detected");
  }
}
