/**
 * Mock Social Posting Adapter
 *
 * Returns fake post IDs and metrics for development/testing.
 */

import type {
  SocialPostingAdapter,
  SocialCredentials,
  SocialPostSpec,
  SocialPostResult,
  SocialPostMetrics,
} from "./social-types";

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class MockSocialAdapter implements SocialPostingAdapter {
  platform: string;

  constructor(platform: string = "mock") {
    this.platform = platform;
  }

  async validateCredentials(_credentials: SocialCredentials): Promise<boolean> {
    return true;
  }

  async createPost(
    _credentials: SocialCredentials,
    _post: SocialPostSpec
  ): Promise<SocialPostResult> {
    const postId = `mock_post_${this.platform}_${Date.now()}`;

    return {
      platformPostId: postId,
      url: `https://${this.platform}.mock/posts/${postId}`,
      status: "published",
      publishedAt: new Date().toISOString(),
    };
  }

  async deletePost(
    _credentials: SocialCredentials,
    _postId: string
  ): Promise<void> {
    // No-op for mock
  }

  async getPostMetrics(
    _credentials: SocialCredentials,
    postIds: string[]
  ): Promise<SocialPostMetrics[]> {
    return postIds.map((postId) => {
      const impressions = Math.round(randomBetween(500, 50000));
      const likes = Math.round(randomBetween(10, impressions * 0.05));
      const comments = Math.round(randomBetween(0, likes * 0.3));
      const shares = Math.round(randomBetween(0, likes * 0.15));
      const reach = Math.round(impressions * randomBetween(0.6, 0.95));
      const totalEngagements = likes + comments + shares;
      const engagementRate = impressions > 0 ? totalEngagements / impressions : 0;
      const clicks = Math.round(randomBetween(0, impressions * 0.03));

      return {
        platformPostId: postId,
        likes,
        comments,
        shares,
        impressions,
        reach,
        engagementRate: Math.round(engagementRate * 10000) / 10000,
        clicks,
      };
    });
  }

  async schedulePost(
    _credentials: SocialCredentials,
    _post: SocialPostSpec,
    _scheduledFor: Date
  ): Promise<SocialPostResult> {
    const postId = `mock_scheduled_${this.platform}_${Date.now()}`;

    return {
      platformPostId: postId,
      url: `https://${this.platform}.mock/posts/${postId}`,
      status: "scheduled",
    };
  }
}

export const mockSocialAdapter = new MockSocialAdapter();
