import fs from 'fs';
import path from 'path';

/**
 * Workspace isolation — every user gets their own directory.
 * Path: ZYVA_WORKSPACES_ROOT/{userId}/
 *
 * NOTE: No DB imports here — this file must be safe for both
 * Node.js API routes and server-side calls. DB persistence is
 * done in auth.ts callbacks, not here.
 */

const WORKSPACES_ROOT =
  process.env.ZYVA_WORKSPACES_ROOT ||
  path.join(process.cwd(), 'workspaces');

/** Get (and create if needed) the workspace root for a user. */
export function ensureUserWorkspaceSync(userId: string): string {
  const workspacePath = path.join(WORKSPACES_ROOT, userId);
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true, mode: 0o700 });
  }
  return workspacePath;
}

/** Async wrapper — same as sync but callable from async contexts */
export async function ensureUserWorkspace(userId: string): Promise<string> {
  return ensureUserWorkspaceSync(userId);
}

/** Get workspace root path for a user (sync, no DB call). */
export function getUserWorkspacePath(userId: string): string {
  return path.join(WORKSPACES_ROOT, userId);
}

/**
 * Validate that a requested path stays inside the user's workspace.
 * Throws if path escapes the boundary.
 */
export function assertInsideWorkspace(userId: string, requestedPath: string): string {
  const workspaceRoot = getUserWorkspacePath(userId);
  const resolved = path.resolve(requestedPath);

  if (resolved !== workspaceRoot && !resolved.startsWith(workspaceRoot + path.sep)) {
    throw new Error(`Access denied: path escapes workspace boundary for user ${userId}`);
  }

  return resolved;
}

/**
 * Get the absolute path for a project inside a user's workspace.
 * Safe: always validates the path stays inside the workspace.
 */
export function getUserProjectPath(userId: string, projectName: string): string {
  const safeName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
  const projectPath = path.join(getUserWorkspacePath(userId), safeName);
  assertInsideWorkspace(userId, projectPath);
  return projectPath;
}
