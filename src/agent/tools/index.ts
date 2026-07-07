import type { ToolExecutor } from "../tool-executor.js";
import { ReadFileTool } from "./read-file.js";
import { WriteFileTool } from "./write-file.js";
import { EditFileTool } from "./edit-file.js";
import { ListFilesTool } from "./list-files.js";
import { SearchFilesTool } from "./search-files.js";
import { RunCommandTool } from "./run-command.js";
import { ArduinoCompileTool } from "./arduino-compile.js";
import { ArduinoUploadTool } from "./arduino-upload.js";
import { ArduinoBoardsTool } from "./arduino-boards.js";
import { SerialMonitorTool } from "./serial-monitor.js";
import { ArduinoLibraryTool } from "./arduino-library.js";
import { AnalyzePinsTool } from "./analyze-pins.js";
import { WebSearchTool } from "./web-search.js";
import { WebFetchTool } from "./web-fetch.js";

export function registerCoreTools(
  executor: ToolExecutor,
  searchApiKey?: string,
  searchProvider?: string,
): void {
  // 11 core tools — always available
  executor.registerTool(new ReadFileTool());
  executor.registerTool(new WriteFileTool());
  executor.registerTool(new EditFileTool());
  executor.registerTool(new ListFilesTool());
  executor.registerTool(new SearchFilesTool());
  executor.registerTool(new RunCommandTool());
  executor.registerTool(new ArduinoCompileTool());
  executor.registerTool(new ArduinoUploadTool());
  executor.registerTool(new ArduinoBoardsTool());
  executor.registerTool(new SerialMonitorTool());
  executor.registerTool(new ArduinoLibraryTool());
  executor.registerTool(new AnalyzePinsTool());

  // 2 optional web tools — only if search API key is configured
  if (searchApiKey && searchProvider) {
    executor.registerTool(new WebSearchTool(searchApiKey, searchProvider));
    executor.registerTool(new WebFetchTool(searchApiKey));
  }
}
