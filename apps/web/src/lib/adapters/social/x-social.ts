/**
 * X/Twitter Organic Social Posting Adapter
 *
 * Handles organic posting via the X API v2.
 */

import type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "../social-types";

const X_API_BASE = "https://api.x.com/2";

async function xFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${X_API_BASE}${endpoint}`;

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
    const detail = (data as { detail?: string; title?: string }).detail
      || (data as { title?: string }).title
      || res.statusText;
    throw new Error(`X API error: ${detail}`);
  }

  return data;
}

function buildTweetText(post: SocialPostSpec): string {
  let text = post.content;

  if (post.mentions?.length) {
    text += " " + post.mentions.map((m) => (m.startsWith("@") ? m : `@${m}`)).join(" ");
  }

  if (post.hashtags?.length) {
    text += " " + post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  }

  if (post.link) {
    text += "\n" + post.link;
  }

  return text;
}

export const xSocialAdapter: SocialPostingAdapter = {
  platform: "x",

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await xFetch("/users/me", credentials.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  async createPost(
    credentials: SocialCredentials,
    post: SocialPostSpec
  ): Promise<SocialPostResult> {
    const text = buildTweetText(post);

    const body: Record<string, unknown> = { text };

    if (post.replyToId) {
      body.reply = { in_reply_to_tweet_id: post.replyToId };
    }

    // If media URLs are provided, they need to be uploaded first via the
    // media upload endpoint (v1.1) which returns media_ids. For now, we
    // note the media_ids field but media upload is a separate flow.
    if (post.mediaUrls?.length && credentials.metadata?.mediaIds) {
      body.media = {
        media_ids: credentials.metadata.mediaIds.split(","),
      };
    }

    const data = (await xFetch("/tweets", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    })) as { data: { id: string; text: string } };

    return {
      platformPostId: data.data.id,
      url: `https://x.com/i/status/${data.data.id}`,
      status: "published",
      publishedAt: new Date().toISOString(),
    };
  },

  async deletePost(
    credentials: SocialCredentials,
    postId: string
  ): Promise<void> {
    await xFetch(`/tweets/${postId}`, credentials.accessToken, {
      method: "DELETE",
    });
  },

  async getPostMetrics(
    credentials: SocialCredentials,
    postIds: string[]
  ): Promise<SocialPostMetrics[]> {
    if (postIds.length === 0) return [];

    const ids = postIds.join(",");
    const data = (await xFetch(
      `/tweets?ids=${ids}&tweet.fields=public_metrics`,
      credentials.accessToken
    )) as {
      data?: Array<{
        id: string;
        public_metrics?: {
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          bookmark_count: number;
          impression_count: number;
        };
      }>;
    };

    if (!data.data) return [];

    return data.data.map((tweet) => {
      const metrics = tweet.public_metrics;
      const likes = metrics?.like_count ?? 0;
      const comments = metrics?.reply_count ?? 0;
      const shares = (metrics?.retweet_count ?? 0) + (metrics?.quote_count ?? 0);
      const impressions = metrics?.impression_count ?? 0;

      const totalEngagements = likes + comments + shares;
      const engagementRate = impressions > 0 ? totalEngagements / impressions : 0;

      return {
        platformPostId: tweet.id,
        likes,
        comments,
        shares,
        impressions,
        engagementRate: engagementRate || undefined,
        clicks: undefined,
      };
    });
  },
};
