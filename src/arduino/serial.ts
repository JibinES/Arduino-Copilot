import { spawn, type ChildProcess } from "child_process";

type DataCallback = (data: string) => void;

export class SerialMonitor {
  private process: ChildProcess | null = null;
  private buffer: string[] = [];
  private listeners: DataCallback[] = [];
  private cliPath: string;

  constructor(cliPath: string) {
    this.cliPath = cliPath;
  }

  get isRunning(): boolean {
    return this.process !== null;
  }

  onData(callback: DataCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  start(port: string, baudRate: number = 9600): void {
    if (this.process) this.stop();

    this.buffer = [];
    this.process = spawn(this.cliPath, [
      "monitor",
      "-p", port,
      "-b", String(baudRate),
      "--raw",
    ]);

    this.process.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.buffer.push(text);
      // Keep buffer to last 500 lines
      if (this.buffer.length > 500) {
        this.buffer = this.buffer.slice(-250);
      }
      for (const listener of this.listeners) {
        listener(text);
      }
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.buffer.push(`[stderr] ${text}`);
    });

    this.process.on("exit", () => {
      this.process = null;
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  send(data: string): void {
    if (this.process?.stdin) {
      this.process.stdin.write(data);
    }
  }

  getRecentOutput(lines: number = 50): string {
    return this.buffer.slice(-lines).join("");
  }

  async readForDuration(port: string, baudRate: number, durationMs: number = 3000): Promise<string> {
    return new Promise((resolve) => {
      const output: string[] = [];
      const proc = spawn(this.cliPath, [
        "monitor", "-p", port, "-b", String(baudRate), "--raw",
      ]);

      proc.stdout?.on("data", (chunk: Buffer) => {
        output.push(chunk.toString());
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        output.push(chunk.toString());
      });

      setTimeout(() => {
        proc.kill();
        resolve(output.join(""));
      }, durationMs);

      proc.on("error", () => {
        resolve(output.join("") || "Failed to start serial monitor");
      });
    });
  }

  dispose(): void {
    this.stop();
    this.listeners = [];
    this.buffer = [];
  }
}
