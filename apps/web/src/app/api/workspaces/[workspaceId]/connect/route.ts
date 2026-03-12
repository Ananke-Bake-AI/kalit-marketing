import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdapter } from "@/lib/adapters";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const connectSchema = z.object({
  platform: z.enum([
    "meta", "google", "tiktok", "linkedin", "x",
    "reddit", "youtube", "ga4", "search_console",
    "hubspot", "salesforce", "mailchimp", "sendgrid", "stripe",
  ]),
  accountId: z.string().min(1),
  accountName: z.string().optional(),
  credentials: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
  }),
  metadata: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const body = await request.json();
  const parsed = connectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validate credentials with the platform adapter
  const adapter = getAdapter(data.platform);
  if (adapter) {
    try {
      const valid = await adapter.validateCredentials({
        accessToken: data.credentials.accessToken,
        refreshToken: data.credentials.refreshToken,
        accountId: data.accountId,
        metadata: data.metadata,
      });

      if (!valid) {
        return NextResponse.json(
          { error: "Invalid credentials — could not authenticate with platform" },
          { status: 401 }
        );
      }

      // Get account info
      const info = await adapter.getAccountInfo({
        accessToken: data.credentials.accessToken,
        refreshToken: data.credentials.refreshToken,
        accountId: data.accountId,
        metadata: data.metadata,
      });

      data.accountName = info.name;
    } catch (err) {
      return NextResponse.json(
        {
          error: `Platform validation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 400 }
      );
    }
  }

  const account = await prisma.connectedAccount.upsert({
    where: {
      workspaceId_platform_accountId: {
        workspaceId,
        platform: data.platform,
        accountId: data.accountId,
      },
    },
    update: {
      credentials: data.credentials as never,
      accountName: data.accountName,
      metadata: data.metadata as never,
      isActive: true,
      lastSyncAt: new Date(),
    },
    create: {
      workspaceId,
      platform: data.platform,
      accountId: data.accountId,
      accountName: data.accountName,
      credentials: data.credentials as never,
      scopes: [],
      metadata: data.metadata as never,
    },
  });

  await prisma.event.create({
    data: {
      workspaceId,
      type: "workspace_created", // reuse for account connection
      data: {
        action: "account_connected",
        platform: data.platform,
        accountId: data.accountId,
        accountName: data.accountName,
      },
    },
  });

  return NextResponse.json(account, { status: 201 });
}
