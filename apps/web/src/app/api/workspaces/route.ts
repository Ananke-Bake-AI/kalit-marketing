import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transitionWorkspace } from "@/lib/engine/lifecycle";
import { requireAuth, isAuthError } from "@/lib/api-auth";

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  shareConnections: z.boolean().default(true),
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

// Platforms that support multi-project under a single account (shareable across workspaces)
const SHAREABLE_PLATFORMS = ["google", "ga4", "stripe", "posthog"];

export async function GET() {
  const userOrRes = await requireAuth();
  if (isAuthError(userOrRes)) return userOrRes;
  const user = userOrRes;

  const workspaces = await prisma.workspace.findMany({
    where: AUTH_DISABLED
      ? undefined
      : { members: { some: { userId: user.id } } },
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
  const userOrRes = await requireAuth();
  if (isAuthError(userOrRes)) return userOrRes;
  const user = userOrRes;

  const body = await request.json();
  const parsed = createWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, slug, config, shareConnections } = parsed.data;

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
          data: { name, slug, shareConnections },
        },
      },
    },
    include: { config: true },
  });

  // Add creating user as workspace owner
  if (!AUTH_DISABLED) {
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      },
    });
  }

  // Share compatible connections from existing workspaces
  let sharedConnections: string[] = [];
  if (shareConnections) {
    // Find the oldest workspace with active connections (the "source" workspace)
    const sourceAccounts = await prisma.connectedAccount.findMany({
      where: {
        isActive: true,
        platform: { in: SHAREABLE_PLATFORMS as never[] },
        workspaceId: { not: workspace.id },
      },
      orderBy: { createdAt: "asc" },
      // Only take distinct platform+accountId combos (first connected wins)
      distinct: ["platform", "accountId"],
    });

    for (const source of sourceAccounts) {
      // Check if this exact platform+account combo already exists for the new workspace
      const alreadyExists = await prisma.connectedAccount.findFirst({
        where: {
          workspaceId: workspace.id,
          platform: source.platform,
          accountId: source.accountId,
        },
      });
      if (alreadyExists) continue;

      await prisma.connectedAccount.create({
        data: {
          workspaceId: workspace.id,
          platform: source.platform,
          accountId: source.accountId,
          accountName: source.accountName
            ? `${source.accountName} (shared)`
            : "Shared connection",
          credentials: source.credentials ?? {},
          scopes: source.scopes,
          isActive: true,
          metadata: source.metadata ?? {},
        },
      });
      sharedConnections.push(source.platform);
    }

    if (sharedConnections.length > 0) {
      await prisma.event.create({
        data: {
          workspaceId: workspace.id,
          type: "workspace_status_changed",
          data: {
            action: "connections_shared",
            platforms: sharedConnections,
            count: sharedConnections.length,
          },
        },
      });
    }
  }

  // Auto-transition to "auditing" state — this triggers the initial research tasks
  // (audit_market, audit_competitors, audit_tracking) via the lifecycle engine
  const transitionResult = await transitionWorkspace(
    workspace.id,
    "auditing",
    "onboarding_complete",
    "Auto-triggered on workspace creation"
  );

  // Fire-and-forget: kick off the worker tick to process the newly created audit tasks
  // This ensures users don't have to wait for the next cron cycle
  if (transitionResult.success && transitionResult.tasksCreated?.length) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    fetch(`${baseUrl}/api/internal/worker/tick`, { method: "GET" }).catch(() => {
      // Silent — the cron will pick it up eventually
    });
  }

  return NextResponse.json(
    {
      ...workspace,
      _autoTransition: {
        success: transitionResult.success,
        newState: transitionResult.success ? "auditing" : workspace.status,
        tasksCreated: transitionResult.tasksCreated ?? [],
        error: transitionResult.error,
      },
      _sharedConnections: sharedConnections,
    },
    { status: 201 }
  );
}
