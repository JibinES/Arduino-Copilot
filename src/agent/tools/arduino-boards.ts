import { execFile } from "child_process";
import { promisify } from "util";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const execFileAsync = promisify(execFile);

interface BoardPort {
  address?: string;
  label?: string;
  protocol?: string;
  protocol_label?: string;
}

interface MatchingBoard {
  name?: string;
  fqbn?: string;
}

interface BoardListEntry {
  port?: BoardPort;
  matching_boards?: MatchingBoard[];
}

export class ArduinoBoardsTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "arduino_boards",
    description: "List connected Arduino boards (name, FQBN, serial port).",
    parameters: {
      type: "object",
      properties: {},
    },
  };

  readonly requiresApproval = false;

  async execute(
    _args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolCallOutput> {
    try {
      const { stdout, stderr } = await execFileAsync(
        context.arduinoCliPath,
        ["board", "list", "--format", "json"],
        {
          timeout: 15000,
          maxBuffer: 1024 * 1024,
        },
      );

      let boards: BoardListEntry[];
      try {
        boards = JSON.parse(stdout) as BoardListEntry[];
      } catch {
        return {
          content: `Error parsing board list output:\n${stdout}\n${stderr || ""}`,
          isError: true,
        };
      }

      if (!boards || boards.length === 0) {
        return { content: "No boards detected. Make sure a board is connected via USB." };
      }

      const lines: string[] = ["Connected boards:\n"];

      for (const entry of boards) {
        const port = entry.port;
        const portAddress = port?.address || "unknown";
        const portLabel = port?.label || portAddress;
        const protocol = port?.protocol || "unknown";

        if (entry.matching_boards && entry.matching_boards.length > 0) {
          for (const board of entry.matching_boards) {
            lines.push(
              `  Board: ${board.name || "Unknown"}\n` +
                `  FQBN:  ${board.fqbn || "N/A"}\n` +
                `  Port:  ${portLabel} (${portAddress})\n` +
                `  Protocol: ${protocol}\n`,
            );
          }
        } else {
          lines.push(
            `  Port: ${portLabel} (${portAddress})\n` +
              `  Protocol: ${protocol}\n` +
              `  Board: (not recognized - may need core installation)\n`,
          );
        }
      }

      return { content: lines.join("\n") };
    } catch (err: unknown) {
      const error = err as { stderr?: string; message?: string };
      const message =
        error.stderr || error.message || "Unknown error listing boards";
      return { content: `Error listing boards: ${message}`, isError: true };
    }
  }
}
