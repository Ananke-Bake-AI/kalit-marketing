import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, isAuthError } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ workspaceId: string; postId: string }>;
}

/**
 * PATCH — Update a draft social post (content, mediaUrls).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { workspaceId, postId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const post = await prisma.socialPost.findFirst({
    where: { id: postId, workspaceId },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.status !== "draft") {
    return NextResponse.json({ error: "Only draft posts can be edited" }, { status: 400 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.content === "string") data.content = body.content;
  if (Array.isArray(body.mediaUrls)) data.mediaUrls = body.mediaUrls;

  const updated = await prisma.socialPost.update({
    where: { id: postId },
    data,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE — Delete a draft social post.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { workspaceId, postId } = await context.params;
  const authResult = await requireWorkspaceMember(workspaceId);
  if (isAuthError(authResult)) return authResult;

  const post = await prisma.socialPost.findFirst({
    where: { id: postId, workspaceId },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await prisma.socialPost.delete({ where: { id: postId } });
  return NextResponse.json({ deleted: true });
}
