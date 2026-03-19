import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@kalit/db";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";

/**
 * GET /api/auth/sso/callback?token=xxx
 *
 * SSO entry point from the main Kalit app (kalit.ai).
 * Receives a JWT signed with the shared SUITE_JWT_SECRET,
 * finds or creates a local User linked by externalUserId,
 * creates a NextAuth JWT session cookie, and redirects to /dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing token parameter" },
      { status: 400 },
    );
  }

  const jwtSecret = process.env.SUITE_JWT_SECRET;
  if (!jwtSecret) {
    console.error("SUITE_JWT_SECRET is not configured");
    return NextResponse.json(
      { error: "SSO not configured" },
      { status: 500 },
    );
  }

  // Verify the JWT from the main app
  let payload: {
    userId: string;
    email: string;
    name?: string;
    orgId?: string;
    suiteId?: string;
    entitlements?: string[];
  };

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload: verified } = await jwtVerify(token, secret);
    payload = verified as typeof payload;
  } catch (err) {
    console.error("SSO token verification failed:", err);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  if (!payload.userId || !payload.email) {
    return NextResponse.json(
      { error: "Token missing required fields (userId, email)" },
      { status: 400 },
    );
  }

  // Find or create user linked to the main app
  let user = await prisma.user.findUnique({
    where: { externalUserId: payload.userId },
  });

  if (!user) {
    // Check if a user with this email already exists (e.g. from local dev signup)
    user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (user) {
      // Link existing user to the main app identity
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          externalUserId: payload.userId,
          externalOrgId: payload.orgId ?? null,
          name: payload.name ?? user.name,
        },
      });
    } else {
      // Create a brand new user
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? payload.email.split("@")[0],
          externalUserId: payload.userId,
          externalOrgId: payload.orgId ?? null,
        },
      });
    }
  } else {
    // Update org/name if changed
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        externalOrgId: payload.orgId ?? user.externalOrgId,
        name: payload.name ?? user.name,
        email: payload.email, // keep in sync
      },
    });
  }

  // Ensure the user has at least one workspace (auto-create for new SSO users)
  const memberCount = await prisma.workspaceMember.count({
    where: { userId: user.id },
  });

  if (memberCount === 0) {
    const orgName = payload.name
      ? `${payload.name}'s Workspace`
      : "My Workspace";
    const slug =
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      user.id.slice(-6);

    await prisma.workspace.create({
      data: {
        name: orgName,
        slug,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });
  }

  // Create a NextAuth-compatible JWT session token
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) {
    console.error("NEXTAUTH_SECRET is not configured");
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 500 },
    );
  }

  const isSecure = request.url.startsWith("https");
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const sessionToken = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.image,
      sub: user.id,
    },
    secret: nextAuthSecret,
    salt: cookieName,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Set the session cookie and redirect to dashboard
  const cookieStore = await cookies();

  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  const redirectUrl = new URL("/dashboard", request.url);
  return NextResponse.redirect(redirectUrl);
}
