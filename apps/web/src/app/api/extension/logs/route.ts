/**
 * Extension Logs API
 *
 * POST /api/extension/logs — Save logs from the extension (sent by bridge)
 * GET /api/extension/logs — Read saved logs
 *
 * Logs are stored in a file so they persist across requests and can be
 * read from the CLI without needing the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";

const LOG_DIR = join(process.cwd(), ".extension-logs");
const LOG_FILE = join(LOG_DIR, "deploy-log.json");

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await writeFile(LOG_FILE, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const data = await readFile(LOG_FILE, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ logs: null, interactions: [] });
  }
}
