import Stripe from "stripe";
import type {
  RevenueAdapter,
  RevenueCredentials,
  RevenueSummary,
  TransactionPage,
  SubscriptionMetrics,
  RevenueEvent,
} from "./revenue-types";

function createClient(credentials: RevenueCredentials): Stripe {
  return new Stripe(credentials.secretKey, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

export class StripeAdapter implements RevenueAdapter {
  platform = "stripe";

  async validateCredentials(credentials: RevenueCredentials): Promise<boolean> {
    try {
      const stripe = createClient(credentials);
      await stripe.accounts.retrieve();
      return true;
    } catch {
      return false;
    }
  }

  async getRevenueSummary(
    credentials: RevenueCredentials,
    dateRange: { start: string; end: string }
  ): Promise<RevenueSummary> {
    const stripe = createClient(credentials);
    const startTimestamp = Math.floor(new Date(dateRange.start).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(dateRange.end + "T23:59:59Z").getTime() / 1000);

    // Fetch charges in the date range
    const charges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.ChargeListParams = {
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
      };
      if (startingAfter) params.starting_after = startingAfter;

      const batch = await stripe.charges.list(params);
      const succeeded = batch.data.filter((c) => c.status === "succeeded");
      charges.push(...succeeded);
      hasMore = batch.has_more;
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    const totalRevenue = charges.reduce((sum, c) => sum + c.amount, 0) / 100;
    const totalTransactions = charges.length;
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const currency = charges[0]?.currency?.toUpperCase() ?? "USD";

    // Calculate MRR from active subscriptions
    let mrr = 0;
    let subHasMore = true;
    let subStartingAfter: string | undefined;

    while (subHasMore) {
      const subParams: Stripe.SubscriptionListParams = {
        status: "active",
        limit: 100,
      };
      if (subStartingAfter) subParams.starting_after = subStartingAfter;

      const subs = await stripe.subscriptions.list(subParams);
      for (const sub of subs.data) {
        for (const item of sub.items.data) {
          const amount = item.price?.unit_amount ?? 0;
          const interval = item.price?.recurring?.interval;
          if (interval === "month") {
            mrr += amount / 100;
          } else if (interval === "year") {
            mrr += amount / 100 / 12;
          } else if (interval === "week") {
            mrr += (amount / 100) * (52 / 12);
          }
        }
      }
      subHasMore = subs.has_more;
      if (subs.data.length > 0) {
        subStartingAfter = subs.data[subs.data.length - 1].id;
      }
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      currency,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
    };
  }

  async getTransactions(
    credentials: RevenueCredentials,
    dateRange: { start: string; end: string },
    cursor?: string
  ): Promise<TransactionPage> {
    const stripe = createClient(credentials);
    const startTimestamp = Math.floor(new Date(dateRange.start).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(dateRange.end + "T23:59:59Z").getTime() / 1000);

    const params: Stripe.PaymentIntentListParams = {
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
    };
    if (cursor) params.starting_after = cursor;

    const result = await stripe.paymentIntents.list(params);

    const transactions = result.data
      .filter((pi) => pi.status === "succeeded")
      .map((pi) => ({
        id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency.toUpperCase(),
        customerId: typeof pi.customer === "string" ? pi.customer : pi.customer?.id,
        customerEmail: pi.receipt_email ?? undefined,
        metadata: pi.metadata as Record<string, string> | undefined,
        createdAt: new Date(pi.created * 1000).toISOString(),
      }));

    return {
      transactions,
      hasMore: result.has_more,
      cursor: result.data.length > 0 ? result.data[result.data.length - 1].id : undefined,
    };
  }

  async getSubscriptionMetrics(
    credentials: RevenueCredentials
  ): Promise<SubscriptionMetrics> {
    const stripe = createClient(credentials);

    const activeSubs: Stripe.Subscription[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.SubscriptionListParams = {
        status: "active",
        limit: 100,
      };
      if (startingAfter) params.starting_after = startingAfter;

      const batch = await stripe.subscriptions.list(params);
      activeSubs.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    // Calculate MRR
    let mrr = 0;
    for (const sub of activeSubs) {
      for (const item of sub.items.data) {
        const amount = item.price?.unit_amount ?? 0;
        const interval = item.price?.recurring?.interval;
        if (interval === "month") {
          mrr += amount / 100;
        } else if (interval === "year") {
          mrr += amount / 100 / 12;
        } else if (interval === "week") {
          mrr += (amount / 100) * (52 / 12);
        }
      }
    }

    // Approximate churn: canceled subs in last 30 days / total at start
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const canceledParams: Stripe.SubscriptionListParams = {
      status: "canceled",
      created: { gte: thirtyDaysAgo },
      limit: 100,
    };
    const canceled = await stripe.subscriptions.list(canceledParams);
    const canceledCount = canceled.data.length;
    const totalAtStart = activeSubs.length + canceledCount;
    const churnRate = totalAtStart > 0 ? canceledCount / totalAtStart : 0;

    // Approximate LTV
    const avgRevenuePerUser = activeSubs.length > 0 ? mrr / activeSubs.length : 0;
    const ltv = churnRate > 0 ? avgRevenuePerUser / churnRate : avgRevenuePerUser * 24; // fallback: 24 months

    return {
      activeSubscriptions: activeSubs.length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      churnRate: Math.round(churnRate * 10000) / 10000,
      ltv: Math.round(ltv * 100) / 100,
    };
  }

  async processWebhookEvent(
    payload: unknown,
    signature: string,
    credentials?: RevenueCredentials
  ): Promise<RevenueEvent> {
    if (!credentials?.webhookSecret) {
      throw new Error("Webhook secret is required to verify Stripe webhook events");
    }

    const stripe = createClient(credentials);
    const event = stripe.webhooks.constructEvent(
      payload as string | Buffer,
      signature,
      credentials.webhookSecret
    );

    let amount = 0;
    let currency = "usd";
    let customerId: string | undefined;
    let metadata: Record<string, string> | undefined;

    const obj = event.data.object as unknown as Record<string, unknown>;

    if ("amount" in obj && typeof obj.amount === "number") {
      amount = obj.amount / 100;
    } else if ("amount_paid" in obj && typeof obj.amount_paid === "number") {
      amount = obj.amount_paid / 100;
    }

    if ("currency" in obj && typeof obj.currency === "string") {
      currency = obj.currency;
    }

    if ("customer" in obj) {
      customerId = typeof obj.customer === "string" ? obj.customer : undefined;
    }

    if ("metadata" in obj && typeof obj.metadata === "object" && obj.metadata !== null) {
      metadata = obj.metadata as Record<string, string>;
    }

    return {
      id: event.id,
      type: event.type,
      amount,
      currency: currency.toUpperCase(),
      customerId,
      metadata,
      occurredAt: new Date(event.created * 1000).toISOString(),
    };
  }
}

export const stripeAdapter = new StripeAdapter();
