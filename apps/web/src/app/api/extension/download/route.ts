/**
 * GET /api/extension/download
 *
 * Packages the browser extension folder as a ZIP file for download.
 * Users extract it and load as an unpacked extension in Chrome.
 */

import { NextResponse } from "next/server";
import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";

export async function GET() {
  const extensionDir = join(process.cwd(), "public", "extension");

  try {
    // Collect all files recursively
    const files: { path: string; data: Buffer }[] = [];
    await collectFiles(extensionDir, "", files);

    if (files.length === 0) {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }

    // Build a ZIP file manually (no external dependencies)
    const zipBuffer = buildZip(files);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=\"kalit-extension.zip\"",
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error("[extension/download] Error:", err);
    return NextResponse.json(
      { error: "Failed to package extension" },
      { status: 500 }
    );
  }
}

async function collectFiles(
  dir: string,
  prefix: string,
  files: { path: string; data: Buffer }[]
) {
  const entries = await readdir(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    const s = await stat(fullPath);
    if (s.isDirectory()) {
      await collectFiles(fullPath, relativePath, files);
    } else {
      const data = await readFile(fullPath);
      files.push({ path: relativePath, data });
    }
  }
}

/**
 * Build a minimal ZIP file from an array of {path, data} entries.
 * Implements the ZIP format spec without external dependencies.
 */
function buildZip(files: { path: string; data: Buffer }[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.path, "utf-8");
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + name + data)
    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression (store)
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc32
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuffer.length, 26); // name length
    local.writeUInt16LE(0, 28); // extra length
    nameBuffer.copy(local, 30);

    localHeaders.push(Buffer.concat([local, file.data]));

    // Central directory entry (46 bytes + name)
    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16); // crc32
    central.writeUInt32LE(size, 20); // compressed size
    central.writeUInt32LE(size, 24); // uncompressed size
    central.writeUInt16LE(nameBuffer.length, 28); // name length
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    nameBuffer.copy(central, 46);

    centralHeaders.push(central);
    offset += 30 + nameBuffer.length + size;
  }

  const centralDirSize = centralHeaders.reduce((sum, b) => sum + b.length, 0);

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central dir size
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/** CRC-32 computation */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
