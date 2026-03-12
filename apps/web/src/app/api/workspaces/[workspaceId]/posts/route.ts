import { prisma } from "@kalit/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { SocialPostingAdapter, SocialCredentials, SocialPostSpec } from "@/lib/adapters/social-types";
import { metaSocialAdapter } from "@/lib/adapters/social/meta-social";
import { xSocialAdapter } from "@/lib/adapters/social/x-social";
import { linkedinSocialAdapter } from "@/lib/adapters/social/linkedin-social";
import { tiktokSocialAdapter } from "@/lib/adapters/social/tiktok-social";
import { redditSocialAdapter } from "@/lib/adapters/social/reddit-social";
import { MockSocialAdapter } from "@/lib/adapters/social-mock";

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const socialAdapters: Record<string, SocialPostingAdapter> = {
  meta: metaSocialAdapter,
  x: xSocialAdapter,
  linkedin: linkedinSocialAdapter,
  tiktok: tiktokSocialAdapter,
  reddit: redditSocialAdapter,
};

function getSocialAdapter(platform: string): SocialPostingAdapter | null {
  if (process.env.MOCK_ADAPTERS === "true") {
    return new MockSocialAdapter(platform);
  }
  return socialAdapters[platform] ?? null;
}

const createPostSchema = z.object({
  platform: z.enum(["meta", "x", "linkedin", "tiktok", "reddit"]),
  content: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional(),
  link: z.string().url().optional(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  scheduledFor: z.string().datetime().optional(),
  creativeId: z.string().optional(),
  publish: z.boolean().default(false),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const { searchParams } = new URL(request.url);

  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  const posts = await prisma.socialPost.findMany({
    where: {
      workspaceId,
      ...(platform ? { platform: platform as never } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      creative: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json(posts);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { workspaceId } = await context.params;
  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  // Verify creative exists if provided
  if (data.creativeId) {
    const creative = await prisma.creative.findFirst({
      where: { id: data.creativeId, workspaceId },
    });
    if (!creative) {
      return NextResponse.json(
        { error: "Creative not found" },
        { status: 404 }
      );
    }
  }

  // Determine initial status
  let status = "draft";
  let platformPostId: string | null = null;
  let publishedAt: Date | null = null;

  if (data.scheduledFor) {
    status = "scheduled";
  }

  // If publish=true, post immediately via the adapter
  if (data.publish) {
    const adapter = getSocialAdapter(data.platform);
    if (!adapter) {
      return NextResponse.json(
        { error: `No social adapter available for platform: ${data.platform}` },
        { status: 400 }
      );
    }

    // Get connected account credentials for this platform
    const connectedAccount = await prisma.connectedAccount.findFirst({
      where: {
        workspaceId,
        platform: data.platform as never,
        isActive: true,
      },
    });

    if (!connectedAccount) {
      return NextResponse.json(
        { error: `No connected ${data.platform} account found for this workspace` },
        { status: 400 }
      );
    }

    const credentials: SocialCredentials = {
      accessToken: (connectedAccount.credentials as Record<string, string>).accessToken,
      accountId: connectedAccount.accountId,
      pageId: (connectedAccount.metadata as Record<string, string> | null)?.pageId,
      metadata: (connectedAccount.metadata as Record<string, string> | null) ?? undefined,
    };

    const postSpec: SocialPostSpec = {
      content: data.content,
      mediaUrls: data.mediaUrls,
      link: data.link,
      hashtags: data.hashtags,
      mentions: data.mentions,
    };

    try {
      const result = await adapter.createPost(credentials, postSpec);
      platformPostId = result.platformPostId;
      status = "published";
      publishedAt = result.publishedAt ? new Date(result.publishedAt) : new Date();
    } catch (err) {
      // Create the post record with failed status
      const failedPost = await prisma.socialPost.create({
        data: {
          workspaceId,
          platform: data.platform as never,
          creativeId: data.creativeId,
          content: data.content,
          mediaUrls: data.mediaUrls ?? [],
          status: "failed",
        },
      });

      return NextResponse.json(
        {
          error: "Failed to publish post",
          detail: err instanceof Error ? err.message : "Unknown error",
          post: failedPost,
        },
        { status: 502 }
      );
    }
  }

  // Create the social post record
  const socialPost = await prisma.socialPost.create({
    data: {
      workspaceId,
      platform: data.platform as never,
      creativeId: data.creativeId,
      content: data.content,
      mediaUrls: data.mediaUrls ?? [],
      platformPostId,
      status,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      publishedAt,
    },
  });

  return NextResponse.json(socialPost, { status: 201 });
}
