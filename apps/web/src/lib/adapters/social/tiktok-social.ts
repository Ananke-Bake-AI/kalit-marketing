/**
 * TikTok Organic Content Posting Adapter
 *
 * Handles video content publishing via the TikTok Content Posting API v2.
 * TikTok is primarily a video platform — text/image posts use Creator Tools
 * which are not available via API.
 */

import type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "../social-types";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

async function tiktokFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${TIKTOK_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string } }).error;
    throw new Error(
      `TikTok API error: ${error?.message || error?.code || res.statusText}`
    );
  }

  return data;
}

export const tiktokSocialAdapter: SocialPostingAdapter = {
  platform: "tiktok",

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await tiktokFetch(
        "/user/info/?fields=open_id,display_name",
        credentials.accessToken
      );
      return true;
    } catch {
      return false;
    }
  },

  async createPost(
    credentials: SocialCredentials,
    post: SocialPostSpec
  ): Promise<SocialPostResult> {
    if (!post.mediaUrls?.length) {
      throw new Error("TikTok posting requires a video URL in mediaUrls");
    }

    const caption = [
      post.content,
      ...(post.hashtags?.map((h) => (h.startsWith("#") ? h : `#${h}`)) ?? []),
      ...(post.mentions?.map((m) => (m.startsWith("@") ? m : `@${m}`)) ?? []),
    ].join(" ");

    // Step 1: Initialize video upload via inbox method
    const initData = (await tiktokFetch(
      "/post/publish/inbox/video/init/",
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          source_info: {
            source: "PULL_FROM_URL",
            video_url: post.mediaUrls[0],
          },
          post_info: {
            title: caption.slice(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
        }),
      }
    )) as {
      data?: {
        publish_id?: string;
      };
    };

    const publishId = initData.data?.publish_id;
    if (!publishId) {
      throw new Error("TikTok video init did not return a publish_id");
    }

    return {
      platformPostId: publishId,
      status: "pending_review",
      publishedAt: new Date().toISOString(),
    };
  },

  async deletePost(
    _credentials: SocialCredentials,
    _postId: string
  ): Promise<void> {
    // TikTok Content Posting API does not expose a delete endpoint.
    // Videos must be deleted through the TikTok app or Creator Tools.
    throw new Error("TikTok API does not support programmatic post deletion");
  },

  async getPostMetrics(
    credentials: SocialCredentials,
    postIds: string[]
  ): Promise<SocialPostMetrics[]> {
    const results: SocialPostMetrics[] = [];

    for (const postId of postIds) {
      try {
        // Check publish status which may include basic metrics
        const statusData = (await tiktokFetch(
          "/post/publish/status/fetch/",
          credentials.accessToken,
          {
            method: "POST",
            body: JSON.stringify({ publish_id: postId }),
          }
        )) as {
          data?: {
            status?: string;
          };
        };

        // TikTok's Content Posting API has limited metrics access.
        // Full metrics require the TikTok Research API or Business API.
        results.push({
          platformPostId: postId,
          likes: 0,
          comments: 0,
          shares: 0,
          impressions: 0,
        });

        // Consume statusData to avoid unused variable
        void statusData;
      } catch {
        results.push({
          platformPostId: postId,
          likes: 0,
          comments: 0,
          shares: 0,
          impressions: 0,
        });
      }
    }

    return results;
  },
};
