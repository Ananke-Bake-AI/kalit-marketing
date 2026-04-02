import { mkdir, writeFile, unlink, stat } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Local file storage for workspace assets.
 * Files are stored at: <DATA_DIR>/assets/<workspaceId>/<uuid>.<ext>
 * Served via: /api/assets/<workspaceId>/<filename>
 */

const DATA_DIR = process.env.ASSET_STORAGE_DIR || join(process.cwd(), "data");

function getWorkspaceDir(workspaceId: string): string {
  return join(DATA_DIR, "assets", workspaceId);
}

export interface StoredFile {
  storageKey: string; // relative path: assets/<workspaceId>/<uuid>.<ext>
  url: string; // served URL
  fileName: string; // original name
  fileSize: number;
  mimeType: string;
}

/**
 * Store a file buffer on disk for a workspace.
 */
export async function storeFile(
  workspaceId: string,
  file: Buffer,
  originalName: string,
  mimeType: string
): Promise<StoredFile> {
  const dir = getWorkspaceDir(workspaceId);
  await mkdir(dir, { recursive: true });

  const ext = originalName.includes(".")
    ? originalName.substring(originalName.lastIndexOf("."))
    : "";
  const storedName = `${randomUUID()}${ext}`;
  const filePath = join(dir, storedName);

  await writeFile(filePath, file);

  const stats = await stat(filePath);
  const storageKey = `assets/${workspaceId}/${storedName}`;

  return {
    storageKey,
    url: `/api/assets/${workspaceId}/${storedName}`,
    fileName: originalName,
    fileSize: stats.size,
    mimeType,
  };
}

/**
 * Delete a file from disk by storage key.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const filePath = join(DATA_DIR, storageKey);
  try {
    await unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Resolve a storage key to an absolute file path.
 */
export function resolveFilePath(storageKey: string): string {
  return join(DATA_DIR, storageKey);
}

/**
 * Get the base data directory.
 */
export function getDataDir(): string {
  return DATA_DIR;
}
