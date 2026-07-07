import { execFile, spawn } from "child_process";
import { promisify } from "util";
import type { ITool, ToolContext, ToolCallOutput } from "./types.js";
import type { ToolDefinition } from "../../providers/types.js";

const execFileAsync = promisify(execFile);

const READ_DURATION_MS = 3000;

export class SerialMonitorTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "serial_monitor",
    description:
      "Board serial monitor: 'read' captures 3s of output, 'start'/'stop' manage a session; can send data first.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["read", "start", "stop"],
          description: "'read' captures 3s of output, 'start' opens a session, 'stop' ends it.",
        },
        port: {
          type: "string",
          description: "Serial port (e.g. '/dev/ttyUSB0', 'COM3'). Auto-detected if omitted.",
        },
        baud_rate: {
          type: "number",
          description: "Baud rate. Defaults to the configured value (usually 9600).",
        },
        send: {
          type: "string",
          description: "Data to send before reading.",
        },
      },
      required: ["action"],
    },
  };

  readonly requiresApproval = false;

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolCallOutput> {
    const action = args.action as string;
    if (!action || !["read", "start", "stop"].includes(action)) {
      return {
        content: "Error: 'action' must be one of: 'read', 'start', 'stop'.",
        isError: true,
      };
    }

    const baudRate = (args.baud_rate as number) || context.defaultBaudRate;
    let port = args.port as string | undefined;
    const sendData = args.send as string | undefined;

    // Auto-detect port if not provided
    if (!port && action !== "stop") {
      try {
        port = await this.detectPort(context);
      } catch {
        return {
          content:
            "Error: No port specified and auto-detection failed. Please specify a port.",
          isError: true,
        };
      }
    }

    switch (action) {
      case "read":
        return this.readSerial(context, port!, baudRate, sendData);
      case "start":
        return {
          content: `Serial monitor session requested on ${port} at ${baudRate} baud. Persistent sessions are not yet supported in this tool. Use 'read' action to capture output for ${READ_DURATION_MS / 1000} seconds.`,
        };
      case "stop":
        return {
          content:
            "Serial monitor stop requested. Persistent sessions are not yet supported in this tool.",
        };
      default:
        return { content: `Unknown action: ${action}`, isError: true };
    }
  }

  private async readSerial(
    context: ToolContext,
    port: string,
    baudRate: number,
    sendData?: string,
  ): Promise<ToolCallOutput> {
    return new Promise((resolve) => {
      const cliArgs = [
        "monitor",
        "-p",
        port,
        "-b",
        String(baudRate),
        "--raw",
      ];

      const proc = spawn(context.arduinoCliPath, cliArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let output = "";
      let errorOutput = "";

      proc.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      // Send data if requested
      if (sendData && proc.stdin.writable) {
        proc.stdin.write(sendData + "\n");
      }

      // Kill after READ_DURATION_MS
      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
      }, READ_DURATION_MS);

      proc.on("close", () => {
        clearTimeout(timer);

        if (!output && errorOutput) {
          resolve({
            content: `Serial monitor error:\n${errorOutput}`,
            isError: true,
          });
          return;
        }

        if (!output) {
          resolve({
            content: `No serial output received from ${port} at ${baudRate} baud within ${READ_DURATION_MS / 1000} seconds.`,
          });
          return;
        }

        resolve({
          content: `Serial output from ${port} (${baudRate} baud, ${READ_DURATION_MS / 1000}s capture):\n\n${output}`,
        });
      });

      proc.on("error", (err: Error) => {
        clearTimeout(timer);
        resolve({
          content: `Failed to start serial monitor: ${err.message}`,
          isError: true,
        });
      });
    });
  }

  private async detectPort(context: ToolContext): Promise<string> {
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
      if (entry.port?.address && entry.matching_boards && entry.matching_boards.length > 0) {
        return entry.port.address;
      }
    }

    // Fall back to first available port
    for (const entry of boards) {
      if (entry.port?.address) {
        return entry.port.address;
      }
    }

    throw new Error("No port detected");
  }
}
