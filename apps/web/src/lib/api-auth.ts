import { auth } from "@/lib/auth";
import { prisma } from "@kalit/db";
import { NextResponse } from "next/server";

const AUTH_DISABLED = process.env.AUTH_DISABLED === "true";

interface AuthUser {
  id: string;
  email: string;
  externalUserId?: string;
  externalOrgId?: string;
}

interface MembershipResult {
  user: AuthUser;
  membership: { id: string; role: string };
}

/**
 * Require an authenticated session. Returns the user or a 401 Response.
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  if (AUTH_DISABLED) {
    // Dev mode: return a stub user
    return { id: "dev-user", email: "dev@kalit.ai" };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user: AuthUser = {
    id: session.user.id,
    email: session.user.email ?? "",
    externalUserId: (session.user as Record<string, unknown>).externalUserId as string | undefined,
    externalOrgId: (session.user as Record<string, unknown>).externalOrgId as string | undefined,
  };

  return user;
}

/**
 * Require authenticated user + membership in the given workspace.
 * Returns { user, membership } or a 401/403 Response.
 */
export async function requireWorkspaceMember(
  workspaceId: string
): Promise<MembershipResult | NextResponse> {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  if (AUTH_DISABLED) {
    return { user, membership: { id: "dev-membership", role: "owner" } };
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: user.id },
    },
    select: { id: true, role: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this workspace" },
      { status: 403 }
    );
  }

  return { user, membership };
}

/**
 * Type guard: check if the result is a NextResponse (error) or the expected data.
 */
export function isAuthError(
  result: AuthUser | MembershipResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
