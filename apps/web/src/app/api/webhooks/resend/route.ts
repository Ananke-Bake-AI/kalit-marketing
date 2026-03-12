import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kalit/db";

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject: string;
  };
}

/**
 * POST /api/webhooks/resend — Handle Resend delivery events.
 * Updates EmailSend records based on event type.
 */
export async function POST(request: NextRequest) {
  try {
    const event = (await request.json()) as ResendWebhookEvent;

    if (!event.type || !event.data?.email_id) {
      return NextResponse.json(
        { error: "Invalid event payload" },
        { status: 400 }
      );
    }

    const externalId = event.data.email_id;
    const eventTime = new Date(event.created_at);

    switch (event.type) {
      case "email.delivered": {
        await prisma.emailSend.updateMany({
          where: { externalId, platform: "resend" },
          data: { status: "delivered" },
        });
        break;
      }

      case "email.opened": {
        await prisma.emailSend.updateMany({
          where: { externalId, platform: "resend" },
          data: { status: "opened", openedAt: eventTime },
        });
        break;
      }

      case "email.clicked": {
        await prisma.emailSend.updateMany({
          where: { externalId, platform: "resend" },
          data: { status: "clicked", clickedAt: eventTime },
        });
        break;
      }

      case "email.bounced": {
        await prisma.emailSend.updateMany({
          where: { externalId, platform: "resend" },
          data: { status: "bounced" },
        });
        break;
      }

      case "email.complained": {
        await prisma.emailSend.updateMany({
          where: { externalId, platform: "resend" },
          data: { status: "complained" },
        });
        break;
      }

      default:
        // Ignore unknown event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
