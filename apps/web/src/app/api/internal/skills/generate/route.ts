/**
 * Internal Admin — Platform Skill Generator
 *
 * POST /api/internal/skills/generate
 *
 * Admin-only endpoint (protected by SUITE_API_KEY).
 * Generates or updates a platform skill cheatsheet from HTML dumps.
 *
 * Usage:
 *   curl -X POST http://localhost:3002/api/internal/skills/generate \
 *     -H "Authorization: Bearer kalit-suite-api-key-dev-2024" \
 *     -H "Content-Type: application/json" \
 *     -d '{"platform":"x","htmlDir":"/path/to/html-dumps"}'
 *
 * Or with inline HTML:
 *   curl -X POST ... -d '{"platform":"x","pages":[{"name":"Page 1","html":"<html>..."}]}'
 *
 * GET /api/internal/skills/generate?platform=x — View current skill
 * GET /api/internal/skills/generate — List all platforms with skills
 */

import { NextRequest, NextResponse } from "next/server";
import { llmComplete } from "@/lib/llm/client";
import type { ImageInput } from "@/lib/llm/client";
import { writeFile, readFile, readdir, mkdir } from "fs/promises";
import { join, extname } from "path";
import { getPlatformSkill, listPlatforms } from "@/lib/extension/skills";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const MEDIA_TYPES: Record<string, ImageInput["media_type"]> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const SKILLS_DIR = join(process.cwd(), ".extension-skills");

function checkAuth(req: NextRequest): boolean {
  const apiKey = process.env.SUITE_API_KEY;
  if (!apiKey) return true; // No key configured = dev mode
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${apiKey}`;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = req.nextUrl.searchParams.get("platform");

  if (!platform) {
    // List all platforms
    const platforms = await listPlatforms();
    const dynamicSkills: string[] = [];
    try {
      const files = await readdir(SKILLS_DIR);
      dynamicSkills.push(...files.filter(f => f.endsWith(".md")).map(f => f.replace(".md", "")));
    } catch { /* no dynamic skills dir */ }

    return NextResponse.json({
      staticPlatforms: platforms,
      dynamicPlatforms: dynamicSkills,
      allPlatforms: [...new Set([...platforms, ...dynamicSkills])],
    });
  }

  const skill = await getPlatformSkill(platform);
  return NextResponse.json({
    platform,
    hasSkill: skill.length > 0,
    length: skill.length,
    lines: skill.split("\n").length,
    skill,
  });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { platform, pages, htmlDir } = body as {
    platform: string;
    pages?: Array<{ name: string; html: string }>;
    htmlDir?: string;
  };

  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  // Load pages and images from directory if htmlDir is provided
  let pageData = pages || [];
  const images: Array<{ name: string; input: ImageInput }> = [];

  if (htmlDir) {
    try {
      const files = await readdir(htmlDir);
      const sortedFiles = files.sort();

      // Load HTML files
      if (pageData.length === 0) {
        for (const file of sortedFiles.filter(f => f.endsWith(".html"))) {
          const html = await readFile(join(htmlDir, file), "utf-8");
          pageData.push({ name: file.replace(".html", ""), html });
        }
      }

      // Load screenshots/images
      for (const file of sortedFiles) {
        const ext = extname(file).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          const data = await readFile(join(htmlDir, file));
          images.push({
            name: file,
            input: {
              type: "base64",
              media_type: MEDIA_TYPES[ext] || "image/png",
              data: data.toString("base64"),
            },
          });
        }
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to read htmlDir: ${err instanceof Error ? err.message : "unknown"}` },
        { status: 400 }
      );
    }
  }

  if (pageData.length === 0 && images.length === 0) {
    return NextResponse.json(
      { error: "No pages or images found. Provide HTML files and/or screenshots in htmlDir." },
      { status: 400 }
    );
  }

  console.log(`[skills/generate] Generating skill for ${platform} from ${pageData.length} HTML pages + ${images.length} screenshots...`);

  // Extract form elements from HTML to reduce tokens
  const compactPages = pageData.map((page) => ({
    name: page.name,
    compact: extractFormElements(page.html),
  }));

  const imageContext = images.length > 0
    ? `\n\nI'm also providing ${images.length} screenshots of the ad platform UI. Use these to:
- Understand the visual layout and field ordering
- Identify labels and sections that may be obfuscated in the HTML
- See dropdown menus, radio buttons, and conditional fields
- Understand the page flow and navigation

Screenshot filenames: ${images.map(i => i.name).join(", ")}`
    : "";

  const prompt = `Analyze these HTML dumps${images.length > 0 ? " and screenshots" : ""} from the ${platform.toUpperCase()} Ads Manager campaign creation flow.
Generate a comprehensive platform skill cheatsheet for an AI agent that fills these forms via a browser extension.

${compactPages.map((p, i) => `
=== PAGE ${i + 1}: ${p.name} ===
${p.compact}
`).join("\n")}
${imageContext}

Generate a cheatsheet covering:

1. PAGE FLOW — all pages in order with URL patterns and footer buttons
2. Per page: EVERY form field with exact data-testid/data-test-id-v2/aria-label/name/id, type, placeholder, label, and what campaign data maps to it
3. Per page: EVERY actionable button with text and identifier
4. FIELD IDENTIFICATION CHEAT SHEET — quick lookup table for all targeting/search fields with their selectors
5. SELECT/DROPDOWN INTERACTION RULES — how search fields work (type → wait → click result)
6. BUDGET RULES — which field is daily vs total, validation constraints
7. CREATIVE/AD PAGE RULES — where headlines, descriptions, URLs go. Note any conditionally-rendered fields.
8. ERROR PATTERNS — DOM patterns for validation errors
9. IMPORTANT REMINDERS — gotchas, field ordering, things that break

Be EXTREMELY precise. Every field identifier must come from the actual HTML. Cross-reference with the screenshots to confirm field labels and layout. The AI agent uses this to fill forms — wrong mappings = failed fills.
Return ONLY the cheatsheet text.`;

  try {
    const response = await llmComplete({
      model: "claude-sonnet-4-6",
      system: "You analyze ad platform HTML and screenshots to produce precise field-mapping cheatsheets for browser automation. Cross-reference visual screenshots with HTML selectors. Cite every data-testid, aria-label, name, id, and DOM pattern. Be exhaustive.",
      prompt,
      maxTokens: 8192,
      images: images.map(i => i.input),
    });

    const skill = response.text;

    // Save dynamic skill
    await mkdir(SKILLS_DIR, { recursive: true });
    const filePath = join(SKILLS_DIR, `${platform}.md`);
    await writeFile(filePath, skill, "utf-8");

    console.log(`[skills/generate] Saved ${platform} skill: ${skill.length} chars, ${skill.split("\n").length} lines`);

    return NextResponse.json({
      success: true,
      platform,
      chars: skill.length,
      lines: skill.split("\n").length,
      savedTo: filePath,
      pagesAnalyzed: pageData.length,
    });
  } catch (err) {
    console.error("[skills/generate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

function extractFormElements(html: string): string {
  const patterns = [
    /<input[^>]*>/gi,
    /<textarea[^>]*>.*?<\/textarea>/gis,
    /<select[^>]*>.*?<\/select>/gis,
    /<[^>]*data-test-id(?:-v2)?="[^"]*"[^>]*>/gi,
    /<[^>]*contenteditable[^>]*>/gi,
    /<[^>]*role="(?:button|radio|switch|checkbox|radiogroup|textbox|combobox|listbox|option|tab)"[^>]*>[^<]{0,100}/gi,
    /<label[^>]*>[^<]{0,100}<\/label>/gi,
    /<button[^>]*>[^<]{0,80}<\/button>/gi,
    /<legend[^>]*>[^<]{0,80}<\/legend>/gi,
    /<[^>]*(?:placeholder|aria-label|aria-labelledby)="[^"]*"[^>]*>/gi,
  ];

  const matches: string[] = [];
  for (const p of patterns) {
    const found = html.match(p);
    if (found) matches.push(...found);
  }

  const headings = html.match(/<(?:h[1-6]|strong|legend)[^>]*>[^<]{1,100}<\/(?:h[1-6]|strong|legend)>/gi) || [];
  return [...new Set([...headings, ...matches])].join("\n").slice(0, 30000);
}
