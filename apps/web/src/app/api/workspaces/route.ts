import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transitionWorkspace } from "@/lib/engine/lifecycle";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  config: z.object({
    productName: z.string().min(1),
    productDescription: z.string().min(1),
    productUrl: z.string().url().optional(),
    industry: z.string().optional(),
    stage: z.enum(["launch", "validation", "growth", "scale"]).optional(),
    icpDescription: z.string().optional(),
    brandVoice: z.string().optional(),
    monthlyBudget: z.number().positive().optional(),
    currency: z.string().default("USD"),
    targetGeographies: z.array(z.string()).default([]),
    primaryGoal: z
      .enum(["signups", "leads", "revenue", "demos", "awareness"])
      .optional(),
    targetCac: z.number().positive().optional(),
    targetRoas: z.number().positive().optional(),
    autonomyMode: z
      .enum(["draft", "approval", "guardrailed", "autonomous"])
      .default("approval"),
  }),
});

export async function GET() {
  const workspaces = await prisma.workspace.findMany({
    include: {
      config: true,
      _count: {
        select: {
          campaigns: true,
          tasks: true,
          creatives: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(workspaces);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, slug, config } = parsed.data;

  // Check slug uniqueness
  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "Workspace slug already exists" },
      { status: 409 }
    );
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      status: "onboarding",
      config: {
        create: {
          productName: config.productName,
          productDescription: config.productDescription,
          productUrl: config.productUrl,
          industry: config.industry,
          stage: config.stage,
          icpDescription: config.icpDescription,
          brandVoice: config.brandVoice,
          monthlyBudget: config.monthlyBudget,
          currency: config.currency,
          targetGeographies: config.targetGeographies,
          primaryGoal: config.primaryGoal,
          targetCac: config.targetCac,
          targetRoas: config.targetRoas,
          autonomyMode: config.autonomyMode,
        },
      },
      // Log the creation event
      events: {
        create: {
          type: "workspace_created",
          data: { name, slug },
        },
      },
    },
    include: { config: true },
  });

  // Auto-transition to "auditing" state — this triggers the initial research tasks
  // (audit_market, audit_competitors, audit_tracking) via the lifecycle engine
  const transitionResult = await transitionWorkspace(
    workspace.id,
    "auditing",
    "onboarding_complete",
    "Auto-triggered on workspace creation"
  );

  return NextResponse.json(
    {
      ...workspace,
      _autoTransition: {
        success: transitionResult.success,
        newState: transitionResult.success ? "auditing" : workspace.status,
        tasksCreated: transitionResult.tasksCreated ?? [],
        error: transitionResult.error,
      },
    },
    { status: 201 }
  );
}
