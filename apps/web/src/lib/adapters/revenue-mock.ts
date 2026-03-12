import type {
  RevenueAdapter,
  RevenueCredentials,
  RevenueSummary,
  TransactionPage,
  SubscriptionMetrics,
  RevenueEvent,
} from "./revenue-types";

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.round(randomBetween(min, max));
}

function randomId(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class MockRevenueAdapter implements RevenueAdapter {
  platform: string;

  constructor(platform: string = "mock_revenue") {
    this.platform = platform;
  }

  async validateCredentials(_credentials: RevenueCredentials): Promise<boolean> {
    return true;
  }

  async getRevenueSummary(
    _credentials: RevenueCredentials,
    _dateRange: { start: string; end: string }
  ): Promise<RevenueSummary> {
    const totalTransactions = randomInt(50, 500);
    const averageOrderValue = Math.round(randomBetween(30, 300) * 100) / 100;
    const totalRevenue = Math.round(totalTransactions * averageOrderValue * 100) / 100;
    const mrr = Math.round(randomBetween(5000, 50000) * 100) / 100;

    return {
      totalRevenue,
      totalTransactions,
      averageOrderValue,
      currency: "USD",
      mrr,
      arr: Math.round(mrr * 12 * 100) / 100,
      churnRate: Math.round(randomBetween(0.01, 0.08) * 10000) / 10000,
    };
  }

  async getTransactions(
    _credentials: RevenueCredentials,
    _dateRange: { start: string; end: string },
    _cursor?: string
  ): Promise<TransactionPage> {
    const count = randomInt(5, 20);
    const transactions = Array.from({ length: count }, () => {
      const daysAgo = randomInt(0, 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      return {
        id: randomId(),
        amount: Math.round(randomBetween(10, 500) * 100) / 100,
        currency: "USD",
        customerId: `cus_${Math.random().toString(36).slice(2, 10)}`,
        customerEmail: `user${randomInt(1, 999)}@example.com`,
        metadata: { source: "mock" },
        createdAt: date.toISOString(),
      };
    });

    return {
      transactions,
      hasMore: false,
    };
  }

  async getSubscriptionMetrics(
    _credentials: RevenueCredentials
  ): Promise<SubscriptionMetrics> {
    const activeSubscriptions = randomInt(50, 500);
    const mrr = Math.round(randomBetween(5000, 50000) * 100) / 100;
    const churnRate = Math.round(randomBetween(0.02, 0.08) * 10000) / 10000;
    const avgRevenuePerUser = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0;
    const ltv = churnRate > 0 ? avgRevenuePerUser / churnRate : avgRevenuePerUser * 24;

    return {
      activeSubscriptions,
      mrr,
      arr: Math.round(mrr * 12 * 100) / 100,
      churnRate,
      ltv: Math.round(ltv * 100) / 100,
    };
  }

  async processWebhookEvent(
    _payload: unknown,
    _signature: string
  ): Promise<RevenueEvent> {
    return {
      id: randomId(),
      type: "payment_intent.succeeded",
      amount: Math.round(randomBetween(10, 500) * 100) / 100,
      currency: "USD",
      customerId: `cus_${Math.random().toString(36).slice(2, 10)}`,
      metadata: { source: "mock_webhook" },
      occurredAt: new Date().toISOString(),
    };
  }
}

export const mockRevenueAdapter = new MockRevenueAdapter();
