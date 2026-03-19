/**
 * Shareable Connections API
 *
 * GET — Returns active connections from existing workspaces that can be
 * shared with a new workspace. Only platforms that support multi-project
 * under a single account are included.
 */

import { NextResponse } from "next/server";
import { prisma } from "@kalit/db";

const SHAREABLE_PLATFORMS = ["google", "ga4", "stripe", "posthog"];

export async function GET() {
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      isActive: true,
      platform: { in: SHAREABLE_PLATFORMS as never[] },
    },
    select: {
      platform: true,
      accountName: true,
      accountId: true,
      workspace: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    distinct: ["platform", "accountId"],
  });

  const result = accounts.map((a) => ({
    platform: a.platform,
    accountName: a.accountName,
    accountId: a.accountId,
    workspaceName: a.workspace.name,
  }));

  return NextResponse.json(result);
}
