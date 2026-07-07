import { execFile } from "child_process";
import { promisify } from "util";
import { resolveArduinoCliSync } from "./cli-locator.js";

const execFileAsync = promisify(execFile);

/** Best-effort synchronous discovery of arduino-cli (Windows/macOS/Linux). */
function findArduinoCli(): string {
  return resolveArduinoCliSync("arduino-cli");
}

export interface CompileResult {
  success: boolean;
  output: string;
  errors: CompilerError[];
}

export interface CompilerError {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
}

export interface BoardInfo {
  name: string;
  fqbn: string;
  port: string;
  protocol: string;
}

export class ArduinoCLI {
  constructor(private cliPath: string = findArduinoCli()) {}

  async compile(
    sketchPath: string,
    fqbn: string,
    options?: { verbose?: boolean },
  ): Promise<CompileResult> {
    try {
      const args = ["compile", "--fqbn", fqbn, sketchPath, "--format", "json"];
      if (options?.verbose) args.push("-v");

      const { stdout, stderr } = await execFileAsync(this.cliPath, args, {
        timeout: 120000,
      });

      return {
        success: true,
        output: stdout + (stderr ? "\n" + stderr : ""),
        errors: [],
      };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      const output = (error.stdout || "") + "\n" + (error.stderr || "");
      return {
        success: false,
        output,
        errors: parseCompilerErrors(output),
      };
    }
  }

  async upload(sketchPath: string, fqbn: string, port: string): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(
        this.cliPath,
        ["upload", "-p", port, "--fqbn", fqbn, sketchPath],
        { timeout: 120000 },
      );
      return { success: true, output: stdout + (stderr ? "\n" + stderr : "") };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      return {
        success: false,
        output: (error.stdout || "") + "\n" + (error.stderr || "") + "\n" + (error.message || ""),
      };
    }
  }

  async listBoards(): Promise<BoardInfo[]> {
    try {
      const { stdout } = await execFileAsync(
        this.cliPath,
        ["board", "list", "--format", "json"],
        { timeout: 10000 },
      );

      const data = JSON.parse(stdout) as {
        detected_ports?: Array<{
          port?: { address?: string; protocol?: string };
          matching_boards?: Array<{ name?: string; fqbn?: string }>;
        }>;
      };

      const boards: BoardInfo[] = [];
      for (const entry of data.detected_ports || []) {
        const board = entry.matching_boards?.[0];
        if (board?.fqbn) {
          boards.push({
            name: board.name || "Unknown Board",
            fqbn: board.fqbn,
            port: entry.port?.address || "",
            protocol: entry.port?.protocol || "serial",
          });
        }
      }
      return boards;
    } catch {
      return [];
    }
  }

  async installLibrary(name: string): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(
        this.cliPath,
        ["lib", "install", name],
        { timeout: 60000 },
      );
      return { success: true, output: stdout + (stderr ? "\n" + stderr : "") };
    } catch (err) {
      const error = err as { message?: string };
      return { success: false, output: error.message || "Failed to install library" };
    }
  }

  async searchLibraries(query: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        this.cliPath,
        ["lib", "search", query, "--format", "json"],
        { timeout: 15000 },
      );
      return stdout;
    } catch {
      return "[]";
    }
  }
}

function parseCompilerErrors(output: string): CompilerError[] {
  const errors: CompilerError[] = [];
  const regex = /^(.+?):(\d+):(\d+):\s+(error|warning):\s+(.+)$/gm;

  let match;
  while ((match = regex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      severity: match[4] as "error" | "warning",
      message: match[5],
    });
  }

  return errors;
}
