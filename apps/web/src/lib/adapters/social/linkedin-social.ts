/**
 * LinkedIn Organic Social Posting Adapter
 *
 * Handles organic posting via the LinkedIn REST API.
 * Supports both organization pages and personal profiles.
 */

import type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "../social-types";

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202401";

async function linkedinFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${LINKEDIN_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      ...options.headers,
    },
  });

  // LinkedIn sometimes returns 201 with no body for creates
  if (res.status === 204 || (res.status === 201 && res.headers.get("content-length") === "0")) {
    // Extract ID from x-restli-id header or Location header
    const restliId = res.headers.get("x-restli-id");
    const location = res.headers.get("x-linkedin-id") || res.headers.get("location");
    return { id: restliId || location || "" };
  }

  const data = await res.json();

  if (!res.ok) {
    const message = (data as { message?: string }).message
      || (data as { serviceErrorCode?: number }).serviceErrorCode
      || res.statusText;
    throw new Error(`LinkedIn API error: ${message}`);
  }

  return data;
}

function getAuthorUrn(credentials: SocialCredentials): string {
  const orgUrn = credentials.metadata?.organizationUrn;
  if (orgUrn) return orgUrn;

  const personUrn = credentials.metadata?.personUrn;
  if (personUrn) return personUrn;

  if (credentials.accountId) {
    return `urn:li:organization:${credentials.accountId}`;
  }

  throw new Error("LinkedIn adapter requires organizationUrn or personUrn in credentials metadata");
}

function buildCommentary(post: SocialPostSpec): string {
  let text = post.content;

  if (post.mentions?.length) {
    text += " " + post.mentions.join(" ");
  }

  if (post.hashtags?.length) {
    text += "\n\n" + post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  }

  return text;
}

export const linkedinSocialAdapter: SocialPostingAdapter = {
  platform: "linkedin",

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      const authorUrn = getAuthorUrn(credentials);
      if (authorUrn.includes("organization")) {
        await linkedinFetch(
          `/organizations/${authorUrn.split(":").pop()}`,
          credentials.accessToken
        );
      } else {
        await linkedinFetch("/me", credentials.accessToken);
      }
      return true;
    } catch {
      return false;
    }
  },

  async createPost(
    credentials: SocialCredentials,
    post: SocialPostSpec
  ): Promise<SocialPostResult> {
    const author = getAuthorUrn(credentials);
    const commentary = buildCommentary(post);

    const body: Record<string, unknown> = {
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    };

    // Add article/link content if provided
    if (post.link) {
      body.content = {
        article: {
          source: post.link,
          title: post.content.slice(0, 200),
        },
      };
    }

    // Add image content if provided
    if (post.mediaUrls?.length && !post.link) {
      body.content = {
        media: {
          id: post.mediaUrls[0], // Expects a LinkedIn media URN from prior upload
        },
      };
    }

    const data = (await linkedinFetch("/posts", credentials.accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    })) as { id: string };

    const postId = data.id;

    return {
      platformPostId: postId,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      status: "published",
      publishedAt: new Date().toISOString(),
    };
  },

  async deletePost(
    credentials: SocialCredentials,
    postId: string
  ): Promise<void> {
    await linkedinFetch(`/posts/${postId}`, credentials.accessToken, {
      method: "DELETE",
    });
  },

  async getPostMetrics(
    credentials: SocialCredentials,
    postIds: string[]
  ): Promise<SocialPostMetrics[]> {
    const results: SocialPostMetrics[] = [];
    const authorUrn = getAuthorUrn(credentials);

    // LinkedIn provides share statistics at the organizational entity level
    if (authorUrn.includes("organization")) {
      try {
        const encodedUrn = encodeURIComponent(authorUrn);
        const data = (await linkedinFetch(
          `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}`,
          credentials.accessToken
        )) as {
          elements?: Array<{
            totalShareStatistics?: {
              shareCount?: number;
              clickCount?: number;
              engagement?: number;
              impressionCount?: number;
              likeCount?: number;
              commentCount?: number;
              uniqueImpressionsCount?: number;
            };
          }>;
        };

        const stats = data.elements?.[0]?.totalShareStatistics;

        // Map aggregate stats to each post ID as a best-effort approach
        for (const postId of postIds) {
          results.push({
            platformPostId: postId,
            likes: stats?.likeCount ?? 0,
            comments: stats?.commentCount ?? 0,
            shares: stats?.shareCount ?? 0,
            impressions: stats?.impressionCount ?? 0,
            reach: stats?.uniqueImpressionsCount ?? undefined,
            engagementRate: stats?.engagement ?? undefined,
            clicks: stats?.clickCount ?? undefined,
          });
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
    } else {
      // Personal profiles have limited analytics access
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
