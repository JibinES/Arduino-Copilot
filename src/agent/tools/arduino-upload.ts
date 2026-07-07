import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const execFileAsync = promisify(execFile);

export class ArduinoUploadTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "arduino_upload",
    description:
      "Upload a compiled sketch to a connected board. Auto-detects port and fqbn if omitted.",
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
        port: {
          type: "string",
          description: "Serial port (e.g. '/dev/ttyUSB0', 'COM3'). Auto-detected if omitted.",
        },
      },
      required: ["sketch_path"],
    },
  };

  readonly requiresApproval = true;

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
    let port = args.port as string | undefined;

    // Auto-detect board and port if not provided
    if (!fqbn || !port) {
      try {
        const detected = await this.detectBoardAndPort(context);
        if (!fqbn) {
          fqbn = detected.fqbn;
        }
        if (!port) {
          port = detected.port;
        }
      } catch {
        const missing: string[] = [];
        if (!fqbn) {
          missing.push("fqbn");
        }
        if (!port) {
          missing.push("port");
        }
        return {
          content: `Error: Could not auto-detect ${missing.join(" and ")}. Please specify ${missing.join(" and ")} explicitly.`,
          isError: true,
        };
      }
    }

    const cliArgs = [
      "upload",
      "-p",
      port,
      "--fqbn",
      fqbn,
      resolvedSketchPath,
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

      let output = `Upload successful to ${port} (${fqbn}).\n`;
      if (stdout) {
        output += `\n${stdout}`;
      }
      if (stderr) {
        output += `\n${stderr}`;
      }

      return { content: output };
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      let output = `Upload failed to ${port} (${fqbn}).\n`;
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

  private async detectBoardAndPort(
    context: ToolContext,
  ): Promise<{ fqbn: string; port: string }> {
    const { stdout } = await execFileAsync(
      context.arduinoCliPath,
      ["board", "list", "--format", "json"],
      { timeout: 15000 },
    );

    const boards = JSON.parse(stdout) as Array<{
      port?: { address?: string };
      matching_boards?: Array<{ fqbn?: string }>;
    }>;

    for (const entry of boards) {
      if (
        entry.matching_boards &&
        entry.matching_boards.length > 0 &&
        entry.port?.address
      ) {
        const fqbn = entry.matching_boards[0].fqbn;
        if (fqbn) {
          return { fqbn, port: entry.port.address };
        }
      }
    }

    throw new Error("No board detected");
  }
}
