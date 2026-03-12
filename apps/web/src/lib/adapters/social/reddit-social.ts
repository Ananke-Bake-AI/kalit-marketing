/**
 * Reddit Organic Social Posting Adapter
 *
 * Handles organic posting via the Reddit OAuth API.
 * Supports self (text) posts and link posts to specified subreddits.
 */

import type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "../social-types";

const REDDIT_API_BASE = "https://oauth.reddit.com";

async function redditFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${REDDIT_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "KalitMarketing/1.0",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const message = (data as { message?: string }).message || res.statusText;
    throw new Error(`Reddit API error: ${message}`);
  }

  return data;
}

function getSubreddit(credentials: SocialCredentials): string {
  const subreddit = credentials.metadata?.subreddit;
  if (!subreddit) {
    throw new Error("Reddit adapter requires subreddit in credentials metadata");
  }
  return subreddit;
}

export const redditSocialAdapter: SocialPostingAdapter = {
  platform: "reddit",

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await redditFetch("/api/v1/me", credentials.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  async createPost(
    credentials: SocialCredentials,
    post: SocialPostSpec
  ): Promise<SocialPostResult> {
    const subreddit = getSubreddit(credentials);

    // Determine post type: link post if there's a URL, otherwise self (text) post
    const isLinkPost = !!post.link;

    const formParams = new URLSearchParams();
    formParams.set("sr", subreddit);
    formParams.set("kind", isLinkPost ? "link" : "self");
    formParams.set("resubmit", "true");
    formParams.set("api_type", "json");

    if (isLinkPost) {
      // Link posts use the first line of content as title
      const title = post.content.split("\n")[0].slice(0, 300);
      formParams.set("title", title);
      formParams.set("url", post.link!);
    } else {
      // Self posts: first line is title, rest is body
      const lines = post.content.split("\n");
      const title = lines[0].slice(0, 300);
      const body = lines.slice(1).join("\n").trim();
      formParams.set("title", title);
      if (body) {
        formParams.set("text", body);
      }
    }

    // Add flair if specified
    if (credentials.metadata?.flairId) {
      formParams.set("flair_id", credentials.metadata.flairId);
    }
    if (credentials.metadata?.flairText) {
      formParams.set("flair_text", credentials.metadata.flairText);
    }

    const data = (await redditFetch("/api/submit", credentials.accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formParams.toString(),
    })) as {
      json?: {
        data?: {
          id?: string;
          name?: string;
          url?: string;
        };
        errors?: Array<unknown>;
      };
    };

    if (data.json?.errors?.length) {
      throw new Error(
        `Reddit submit error: ${JSON.stringify(data.json.errors)}`
      );
    }

    const postId = data.json?.data?.name || data.json?.data?.id || "";
    const postUrl = data.json?.data?.url;

    return {
      platformPostId: postId,
      url: postUrl,
      status: "published",
      publishedAt: new Date().toISOString(),
    };
  },

  async deletePost(
    credentials: SocialCredentials,
    postId: string
  ): Promise<void> {
    const formParams = new URLSearchParams();
    // Reddit expects fullname (t3_xxx format)
    const fullname = postId.startsWith("t3_") ? postId : `t3_${postId}`;
    formParams.set("id", fullname);

    await redditFetch("/api/del", credentials.accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formParams.toString(),
    });
  },

  async getPostMetrics(
    credentials: SocialCredentials,
    postIds: string[]
  ): Promise<SocialPostMetrics[]> {
    if (postIds.length === 0) return [];

    const results: SocialPostMetrics[] = [];

    // Reddit's /api/info endpoint accepts comma-separated fullnames
    const fullnames = postIds
      .map((id) => (id.startsWith("t3_") ? id : `t3_${id}`))
      .join(",");

    try {
      const data = (await redditFetch(
        `/api/info?id=${fullnames}`,
        credentials.accessToken
      )) as {
        data?: {
          children?: Array<{
            data: {
              name: string;
              ups: number;
              num_comments: number;
              score: number;
              upvote_ratio: number;
              view_count?: number;
            };
          }>;
        };
      };

      if (data.data?.children) {
        for (const child of data.data.children) {
          const post = child.data;
          results.push({
            platformPostId: post.name,
            likes: post.ups,
            comments: post.num_comments,
            shares: 0, // Reddit doesn't expose share/crosspost count via API
            impressions: post.view_count ?? 0,
            engagementRate: post.upvote_ratio,
          });
        }
      }

      // Fill in any missing post IDs
      const returnedIds = new Set(results.map((r) => r.platformPostId));
      for (const postId of postIds) {
        const fullname = postId.startsWith("t3_") ? postId : `t3_${postId}`;
        if (!returnedIds.has(fullname) && !returnedIds.has(postId)) {
          results.push({
            platformPostId: postId,
            likes: 0,
            comments: 0,
            shares: 0,
            impressions: 0,
          });
        }
      }
    } catch {
      for (const postId of postIds) {
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
