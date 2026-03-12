import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const createPolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  condition: z.object({
    field: z.string(),
    operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "not_in"]),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  }),
  action: z.enum(["allow", "require_approval", "block", "alert"]),
  priority: z.number().int().default(0),
});

export async function GET(_request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;

  const policies = await prisma.policyRule.findMany({
    where: { workspaceId, isActive: true },
    orderBy: { priority: "desc" },
  });

  return NextResponse.json(policies);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const body = await request.json();
  const parsed = createPolicySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const policy = await prisma.policyRule.create({
    data: {
      workspaceId,
      name: data.name,
      description: data.description,
      condition: data.condition as never,
      action: data.action,
      priority: data.priority,
    },
  });

  return NextResponse.json(policy, { status: 201 });
}
