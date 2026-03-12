/**
 * Meta (Facebook Pages + Instagram) Organic Social Posting Adapter
 *
 * Handles organic posting to Facebook Pages and Instagram business accounts
 * via the Graph API v21.0.
 */

import type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "../social-types";

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function metaFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${META_API_BASE}${endpoint}`;

  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}access_token=${token}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const error = (data as { error?: { message?: string } }).error;
    throw new Error(`Meta API error: ${error?.message || res.statusText}`);
  }

  return data;
}

function getPageId(credentials: SocialCredentials): string {
  const pageId = credentials.pageId || credentials.metadata?.pageId;
  if (!pageId) {
    throw new Error("Meta social adapter requires pageId in credentials");
  }
  return pageId;
}

function getIgUserId(credentials: SocialCredentials): string | undefined {
  return credentials.metadata?.instagramAccountId;
}

function buildMessage(post: SocialPostSpec): string {
  let message = post.content;

  if (post.hashtags?.length) {
    message += "\n\n" + post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  }

  if (post.mentions?.length) {
    message += " " + post.mentions.map((m) => (m.startsWith("@") ? m : `@${m}`)).join(" ");
  }

  return message;
}

async function createFacebookPost(
  credentials: SocialCredentials,
  post: SocialPostSpec
): Promise<SocialPostResult> {
  const pageId = getPageId(credentials);
  const message = buildMessage(post);

  let data: { id: string };

  if (post.mediaUrls?.length) {
    // Photo post (first image)
    data = (await metaFetch(`/${pageId}/photos`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify({
        url: post.mediaUrls[0],
        caption: message,
      }),
    })) as { id: string };
  } else {
    // Text/link post
    const body: Record<string, string> = { message };
    if (post.link) {
      body.link = post.link;
    }

    data = (await metaFetch(`/${pageId}/feed`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    })) as { id: string };
  }

  return {
    platformPostId: data.id,
    url: `https://www.facebook.com/${data.id.replace("_", "/posts/")}`,
    status: "published",
    publishedAt: new Date().toISOString(),
  };
}

async function createInstagramPost(
  credentials: SocialCredentials,
  post: SocialPostSpec
): Promise<SocialPostResult> {
  const igUserId = getIgUserId(credentials);
  if (!igUserId) {
    throw new Error("Instagram posting requires instagramAccountId in credentials metadata");
  }

  const caption = buildMessage(post);

  if (!post.mediaUrls?.length) {
    throw new Error("Instagram posts require at least one media URL");
  }

  // Step 1: Create media container
  const containerBody: Record<string, string> = {
    caption,
    image_url: post.mediaUrls[0],
  };

  const container = (await metaFetch(
    `/${igUserId}/media`,
    credentials.accessToken,
    {
      method: "POST",
      body: JSON.stringify(containerBody),
    }
  )) as { id: string };

  // Step 2: Publish the container
  const published = (await metaFetch(
    `/${igUserId}/media_publish`,
    credentials.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        creation_id: container.id,
      }),
    }
  )) as { id: string };

  return {
    platformPostId: published.id,
    url: `https://www.instagram.com/p/${published.id}`,
    status: "published",
    publishedAt: new Date().toISOString(),
  };
}

export const metaSocialAdapter: SocialPostingAdapter = {
  platform: "meta",

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      const pageId = getPageId(credentials);
      await metaFetch(
        `/${pageId}?fields=name,access_token`,
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
    const igUserId = getIgUserId(credentials);

    // If Instagram account is configured and there's media, post to Instagram
    if (igUserId && post.mediaUrls?.length) {
      return createInstagramPost(credentials, post);
    }

    // Default to Facebook Page post
    return createFacebookPost(credentials, post);
  },

  async deletePost(
    credentials: SocialCredentials,
    postId: string
  ): Promise<void> {
    await metaFetch(`/${postId}`, credentials.accessToken, {
      method: "DELETE",
    });
  },

  async getPostMetrics(
    credentials: SocialCredentials,
    postIds: string[]
  ): Promise<SocialPostMetrics[]> {
    const results: SocialPostMetrics[] = [];

    for (const postId of postIds) {
      try {
        const data = (await metaFetch(
          `/${postId}?fields=likes.summary(true),comments.summary(true),shares`,
          credentials.accessToken
        )) as {
          likes?: { summary?: { total_count?: number } };
          comments?: { summary?: { total_count?: number } };
          shares?: { count?: number };
        };

        // Try to get insights for impressions/reach
        let impressions = 0;
        let reach = 0;
        try {
          const insights = (await metaFetch(
            `/${postId}/insights?metric=post_impressions,post_impressions_unique`,
            credentials.accessToken
          )) as {
            data?: Array<{
              name: string;
              values?: Array<{ value: number }>;
            }>;
          };

          if (insights.data) {
            for (const metric of insights.data) {
              if (metric.name === "post_impressions" && metric.values?.[0]) {
                impressions = metric.values[0].value;
              }
              if (metric.name === "post_impressions_unique" && metric.values?.[0]) {
                reach = metric.values[0].value;
              }
            }
          }
        } catch {
          // Insights may not be available for all post types
        }

        const likes = data.likes?.summary?.total_count ?? 0;
        const comments = data.comments?.summary?.total_count ?? 0;
        const shares = data.shares?.count ?? 0;

        const totalEngagements = likes + comments + shares;
        const engagementRate = impressions > 0
          ? totalEngagements / impressions
          : 0;

        results.push({
          platformPostId: postId,
          likes,
          comments,
          shares,
          impressions,
          reach: reach || undefined,
          engagementRate: engagementRate || undefined,
        });
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

  async schedulePost(
    credentials: SocialCredentials,
    post: SocialPostSpec,
    scheduledFor: Date
  ): Promise<SocialPostResult> {
    const pageId = getPageId(credentials);
    const message = buildMessage(post);
    const scheduledPublishTime = Math.floor(scheduledFor.getTime() / 1000);

    const body: Record<string, unknown> = {
      message,
      published: false,
      scheduled_publish_time: scheduledPublishTime,
    };

    if (post.link) {
      body.link = post.link;
    }

    const data = (await metaFetch(`/${pageId}/feed`, credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    })) as { id: string };

    return {
      platformPostId: data.id,
      status: "scheduled",
    };
  },
};
