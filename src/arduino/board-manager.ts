import { ArduinoCLI, type BoardInfo } from "./cli.js";

type BoardChangeCallback = (boards: BoardInfo[]) => void;

export class BoardManager {
  private cli: ArduinoCLI;
  private boards: BoardInfo[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: BoardChangeCallback[] = [];

  constructor(cliPath: string) {
    this.cli = new ArduinoCLI(cliPath);
  }

  getBoards(): BoardInfo[] {
    return [...this.boards];
  }

  getFirstBoard(): BoardInfo | null {
    return this.boards[0] || null;
  }

  onChange(callback: BoardChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  startPolling(intervalMs: number = 3000): void {
    if (this.pollInterval) return;

    // Initial check
    this.refresh();

    this.pollInterval = setInterval(() => this.refresh(), intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async refresh(): Promise<BoardInfo[]> {
    const newBoards = await this.cli.listBoards();
    const changed =
      JSON.stringify(newBoards) !== JSON.stringify(this.boards);

    this.boards = newBoards;

    if (changed) {
      for (const listener of this.listeners) {
        listener(newBoards);
      }
    }

    return newBoards;
  }

  dispose(): void {
    this.stopPolling();
    this.listeners = [];
  }
}
