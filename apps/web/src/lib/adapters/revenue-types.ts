export interface RevenueCredentials {
  secretKey: string;
  webhookSecret?: string;
  metadata?: Record<string, string>;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  currency: string;
  mrr?: number;
  arr?: number;
  churnRate?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  customerId?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface TransactionPage {
  transactions: Transaction[];
  hasMore: boolean;
  cursor?: string;
}

export interface SubscriptionMetrics {
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  churnRate: number;
  ltv: number;
}

export interface RevenueEvent {
  id: string;
  type: string;
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  occurredAt: string;
}

export interface RevenueAdapter {
  platform: string;
  validateCredentials(credentials: RevenueCredentials): Promise<boolean>;
  getRevenueSummary(credentials: RevenueCredentials, dateRange: { start: string; end: string }): Promise<RevenueSummary>;
  getTransactions(credentials: RevenueCredentials, dateRange: { start: string; end: string }, cursor?: string): Promise<TransactionPage>;
  getSubscriptionMetrics?(credentials: RevenueCredentials): Promise<SubscriptionMetrics>;
  processWebhookEvent?(payload: unknown, signature: string): Promise<RevenueEvent>;
}
