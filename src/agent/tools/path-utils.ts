import * as path from "path";

/**
 * Resolve a user/model-supplied path and verify it stays inside the workspace.
 * Uses path.relative() so the check is correct on Windows (case differences,
 * separator differences) and not fooled by sibling dirs like "/workspaceXYZ".
 *
 * Returns the resolved absolute path, or null if it escapes the workspace.
 */
export function resolveWithinWorkspace(workspaceRoot: string, inputPath: string): string | null {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, inputPath);
  const relative = path.relative(root, resolved);

  if (relative === "") return resolved; // the workspace root itself
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

export function accessDeniedMessage(inputPath: string): string {
  return `Error: Access denied. The path "${inputPath}" resolves outside the workspace root.`;
}
