import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@kalit/db";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const HANDLED_EVENTS = new Set([
  "payment_intent.succeeded",
  "invoice.paid",
  "customer.subscription.created",
  "customer.subscription.deleted",
]);

export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    });
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    // Acknowledge but do not process unhandled event types
    return NextResponse.json({ received: true });
  }

  const obj = event.data.object as unknown as Record<string, unknown>;

  // Extract amount and currency
  let amount = 0;
  let currency = "USD";

  if ("amount" in obj && typeof obj.amount === "number") {
    amount = obj.amount / 100;
  } else if ("amount_paid" in obj && typeof obj.amount_paid === "number") {
    amount = obj.amount_paid / 100;
  } else if ("plan" in obj && typeof obj.plan === "object" && obj.plan !== null) {
    const plan = obj.plan as Record<string, unknown>;
    if (typeof plan.amount === "number") {
      amount = plan.amount / 100;
    }
  }

  if ("currency" in obj && typeof obj.currency === "string") {
    currency = obj.currency.toUpperCase();
  }

  // Extract customer ID
  let customerId: string | undefined;
  if ("customer" in obj) {
    customerId = typeof obj.customer === "string" ? obj.customer : undefined;
  }

  // Extract metadata — look for workspaceId in Stripe metadata
  const stripeMetadata = (
    "metadata" in obj && typeof obj.metadata === "object" && obj.metadata !== null
      ? obj.metadata
      : {}
  ) as Record<string, string>;

  // Resolve workspaceId: first check Stripe object metadata, then match by connected account
  let workspaceId: string | undefined = stripeMetadata.workspaceId ?? stripeMetadata.workspace_id;

  if (!workspaceId && event.account) {
    // Try to find workspace by connected Stripe account ID
    const connectedAccount = await prisma.connectedAccount.findFirst({
      where: {
        platform: "stripe",
        accountId: event.account,
        isActive: true,
      },
      select: { workspaceId: true },
    });
    workspaceId = connectedAccount?.workspaceId;
  }

  if (!workspaceId) {
    // Try matching by customer ID if available
    if (customerId) {
      const existingEvent = await prisma.revenueEvent.findFirst({
        where: { customerId },
        select: { workspaceId: true },
        orderBy: { createdAt: "desc" },
      });
      workspaceId = existingEvent?.workspaceId;
    }
  }

  if (!workspaceId) {
    // Cannot associate this event with a workspace — log and acknowledge
    console.warn(
      `[stripe-webhook] Cannot resolve workspaceId for event ${event.id} (type: ${event.type}). ` +
      `Set metadata.workspaceId on your Stripe objects or connect via ConnectedAccount.`
    );
    return NextResponse.json({ received: true, warning: "no_workspace_match" });
  }

  // Upsert the revenue event (idempotent via externalId unique constraint)
  try {
    await prisma.revenueEvent.upsert({
      where: { externalId: event.id },
      create: {
        workspaceId,
        externalId: event.id,
        type: event.type,
        amount,
        currency,
        customerId,
        metadata: stripeMetadata,
        occurredAt: new Date(event.created * 1000),
      },
      update: {
        // If re-delivered, update fields in case of corrections
        amount,
        currency,
        customerId,
        metadata: stripeMetadata,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[stripe-webhook] Failed to store event ${event.id}: ${message}`);
    return NextResponse.json(
      { error: "Failed to store event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true, eventId: event.id });
}
