import { ArduinoCLI } from "./cli.js";

export interface LibraryInfo {
  name: string;
  version: string;
  author: string;
  sentence: string;
}

export class LibraryManager {
  private cli: ArduinoCLI;

  constructor(cliPath: string) {
    this.cli = new ArduinoCLI(cliPath);
  }

  async install(name: string): Promise<{ success: boolean; output: string }> {
    return this.cli.installLibrary(name);
  }

  async search(query: string): Promise<LibraryInfo[]> {
    const raw = await this.cli.searchLibraries(query);
    try {
      const data = JSON.parse(raw) as {
        libraries?: Array<{
          name?: string;
          latest?: { version?: string; author?: string; sentence?: string };
        }>;
      };
      return (data.libraries || []).slice(0, 20).map((lib) => ({
        name: lib.name || "",
        version: lib.latest?.version || "",
        author: lib.latest?.author || "",
        sentence: lib.latest?.sentence || "",
      }));
    } catch {
      return [];
    }
  }
}
