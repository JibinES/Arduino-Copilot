export interface ParsedError {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "note";
  message: string;
  context?: string;
}

export function parseGccErrors(output: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const lines = output.split("\n");

  const errorRegex = /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = errorRegex.exec(lines[i]);
    if (match) {
      const error: ParsedError = {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: match[4] as ParsedError["severity"],
        message: match[5],
      };

      // Grab context lines (the source line and caret)
      const contextLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].match(errorRegex)) break;
        contextLines.push(lines[j]);
      }
      if (contextLines.length > 0) {
        error.context = contextLines.join("\n");
      }

      errors.push(error);
    }
  }

  return errors;
}

export function formatErrorsForAI(errors: ParsedError[]): string {
  if (errors.length === 0) return "No errors found.";

  return errors
    .map((e) => {
      let msg = `${e.severity.toUpperCase()} at ${e.file}:${e.line}:${e.column}: ${e.message}`;
      if (e.context) msg += `\n${e.context}`;
      return msg;
    })
    .join("\n\n");
}
