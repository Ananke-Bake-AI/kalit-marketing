export interface SocialCredentials {
  accessToken: string;
  accountId?: string;
  pageId?: string;
  metadata?: Record<string, string>;
}

export interface SocialPostSpec {
  content: string;
  mediaUrls?: string[];
  link?: string;
  hashtags?: string[];
  mentions?: string[];
  replyToId?: string;
}

export interface SocialPostResult {
  platformPostId: string;
  url?: string;
  status: "published" | "scheduled" | "pending_review";
  publishedAt?: string;
}

export interface SocialPostMetrics {
  platformPostId: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach?: number;
  engagementRate?: number;
  clicks?: number;
}

export interface SocialPostingAdapter {
  platform: string;
  validateCredentials(credentials: SocialCredentials): Promise<boolean>;
  createPost(credentials: SocialCredentials, post: SocialPostSpec): Promise<SocialPostResult>;
  deletePost(credentials: SocialCredentials, postId: string): Promise<void>;
  getPostMetrics(credentials: SocialCredentials, postIds: string[]): Promise<SocialPostMetrics[]>;
  schedulePost?(credentials: SocialCredentials, post: SocialPostSpec, scheduledFor: Date): Promise<SocialPostResult>;
}
