import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";

interface SendGridEvent {
  event: string;
  sg_message_id: string;
  timestamp: number;
  email: string;
}

/**
 * POST /api/webhooks/sendgrid — Handle SendGrid Event Webhook.
 * SendGrid sends arrays of events in a single POST.
 * Updates EmailSend records based on event type.
 */
export async function POST(request: NextRequest) {
  try {
    const events = (await request.json()) as SendGridEvent[];

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: "Expected array of events" },
        { status: 400 }
      );
    }

    for (const event of events) {
      if (!event.sg_message_id || !event.event) {
        continue;
      }

      // SendGrid message IDs may contain a ".filter" suffix — strip it
      const externalId = event.sg_message_id.split(".")[0];
      const eventTime = new Date(event.timestamp * 1000);

      switch (event.event) {
        case "delivered": {
          await prisma.emailSend.updateMany({
            where: { externalId, platform: "sendgrid" },
            data: { status: "delivered" },
          });
          break;
        }

        case "open": {
          await prisma.emailSend.updateMany({
            where: { externalId, platform: "sendgrid" },
            data: { status: "opened", openedAt: eventTime },
          });
          break;
        }

        case "click": {
          await prisma.emailSend.updateMany({
            where: { externalId, platform: "sendgrid" },
            data: { status: "clicked", clickedAt: eventTime },
          });
          break;
        }

        case "bounce":
        case "blocked": {
          await prisma.emailSend.updateMany({
            where: { externalId, platform: "sendgrid" },
            data: { status: "bounced" },
          });
          break;
        }

        case "spamreport": {
          await prisma.emailSend.updateMany({
            where: { externalId, platform: "sendgrid" },
            data: { status: "complained" },
          });
          break;
        }

        default:
          // Ignore: processed, deferred, dropped, unsubscribe, group_unsubscribe, group_resubscribe
          break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("SendGrid webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
