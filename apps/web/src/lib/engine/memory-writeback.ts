/**
 * Memory Writeback
 *
 * Agents store learnings back to workspace memory.
 * Memory types: insight, pattern, preference, constraint, performance_note.
 * Used to build context for future agent calls — the system learns per client.
 */

import { prisma } from "@kalit/db";

export interface MemoryEntry {
  type:
    | "winning_angle"
    | "failing_angle"
    | "audience_insight"
    | "channel_insight"
    | "creative_pattern"
    | "funnel_insight"
    | "brand_learning"
    | "experiment_result";
  title: string;
  content: string;
  confidence: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Store a new memory for a workspace.
 * Deduplicates by checking for similar existing memories.
 */
export async function writeMemory(
  workspaceId: string,
  entry: MemoryEntry
): Promise<{ id: string; deduplicated: boolean }> {
  // Check for duplicate — same type + similar title
  const existing = await prisma.memory.findFirst({
    where: {
      workspaceId,
      type: entry.type,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing && isSimilar(existing.title, entry.title)) {
    // Update confidence and bump evidence count
    const mergedConfidence = Math.min(
      1,
      (existing.confidence + entry.confidence) / 2 + 0.05
    );

    await prisma.memory.update({
      where: { id: existing.id },
      data: {
        confidence: mergedConfidence,
        evidenceCount: { increment: 1 },
        metadata: {
          ...(existing.metadata as Record<string, unknown> | null),
          lastReconfirmed: new Date().toISOString(),
        },
      },
    });

    return { id: existing.id, deduplicated: true };
  }

  const memory = await prisma.memory.create({
    data: {
      workspaceId,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      confidence: entry.confidence,
      tags: entry.tags ?? [],
      metadata: entry.metadata as never,
      evidenceCount: 1,
    },
  });

  return { id: memory.id, deduplicated: false };
}

/**
 * Retrieve relevant memories for an agent context.
 */
export async function getMemoriesForContext(
  workspaceId: string,
  options: {
    types?: string[];
    tags?: string[];
    minConfidence?: number;
    limit?: number;
  } = {}
): Promise<
  {
    id: string;
    type: string;
    title: string;
    content: string;
    confidence: number;
    tags: string[];
  }[]
> {
  const where: Record<string, unknown> = {
    workspaceId,
  };

  if (options.types?.length) {
    where.type = { in: options.types };
  }
  if (options.minConfidence) {
    where.confidence = { gte: options.minConfidence };
  }

  const memories = await prisma.memory.findMany({
    where,
    orderBy: [{ confidence: "desc" }, { evidenceCount: "desc" }],
    take: options.limit ?? 20,
  });

  // Filter by tags if provided (Prisma array contains)
  let filtered = memories;
  if (options.tags?.length) {
    filtered = memories.filter((m) =>
      options.tags!.some((tag) => m.tags.includes(tag))
    );
  }

  return filtered.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    content: m.content,
    confidence: m.confidence,
    tags: m.tags,
  }));
}

/**
 * Decay old memories — reduce confidence over time for stale insights.
 */
export async function decayMemories(workspaceId: string): Promise<number> {
  const staleThreshold = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
  );

  const staleMemories = await prisma.memory.findMany({
    where: {
      workspaceId,
      updatedAt: { lt: staleThreshold },
      confidence: { gt: 0.1 },
    },
  });

  let decayed = 0;
  for (const m of staleMemories) {
    const newConfidence = Math.max(0.1, m.confidence * 0.9); // 10% decay
    await prisma.memory.update({
      where: { id: m.id },
      data: { confidence: newConfidence },
    });
    decayed++;
  }

  return decayed;
}

/**
 * Delete a memory.
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  await prisma.memory.delete({
    where: { id: memoryId },
  });
}

// --- Helpers ---

/**
 * Simple similarity check — fuzzy content deduplication.
 * Uses Jaccard similarity on word sets.
 */
function isSimilar(a: string, b: string, threshold = 0.6): boolean {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union >= threshold : false;
}
