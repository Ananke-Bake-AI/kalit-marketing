import sgMail from "@sendgrid/mail";
import type {
  EmailAdapter,
  EmailCredentials,
  EmailSpec,
  EmailResult,
  ContactSpec,
  EmailStats,
} from "./email-types";

const SENDGRID_API_BASE = "https://api.sendgrid.com";

function configureMail(credentials: EmailCredentials): void {
  sgMail.setApiKey(credentials.apiKey);
}

async function sendGridFetch(
  credentials: EmailCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${SENDGRID_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

export const sendgridAdapter: EmailAdapter = {
  platform: "sendgrid",

  async validateCredentials(credentials: EmailCredentials): Promise<boolean> {
    try {
      const response = await sendGridFetch(
        credentials,
        "/v3/user/profile"
      );
      return response.ok;
    } catch {
      return false;
    }
  },

  async sendEmail(
    credentials: EmailCredentials,
    email: EmailSpec
  ): Promise<EmailResult> {
    configureMail(credentials);

    try {
      const [response] = await sgMail.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html ?? "",
        text: email.text ?? "",
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        categories: email.tags,
        customArgs: email.metadata,
      });

      const messageId =
        response.headers["x-message-id"]?.toString() ??
        `sg_${Date.now()}`;

      return { id: messageId, status: "queued" };
    } catch (err) {
      return {
        id: "",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async sendBatch(
    credentials: EmailCredentials,
    emails: EmailSpec[]
  ): Promise<EmailResult[]> {
    configureMail(credentials);

    const results: EmailResult[] = [];

    for (const email of emails) {
      try {
        const [response] = await sgMail.send({
          from: email.from,
          to: email.to,
          subject: email.subject,
          html: email.html ?? "",
          text: email.text ?? "",
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
          categories: email.tags,
          customArgs: email.metadata,
        });

        const messageId =
          response.headers["x-message-id"]?.toString() ??
          `sg_${Date.now()}`;

        results.push({ id: messageId, status: "queued" });
      } catch (err) {
        results.push({
          id: "",
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  },

  async addContact(
    credentials: EmailCredentials,
    contact: ContactSpec,
    listId?: string
  ): Promise<string> {
    const body: Record<string, unknown> = {
      contacts: [
        {
          email: contact.email,
          first_name: contact.firstName,
          last_name: contact.lastName,
          custom_fields: contact.metadata,
        },
      ],
    };

    if (listId) {
      body.list_ids = [listId];
    }

    const response = await sendGridFetch(
      credentials,
      "/v3/marketing/contacts",
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add contact: ${error}`);
    }

    const data = (await response.json()) as { job_id: string };
    return data.job_id;
  },

  async removeContact(
    credentials: EmailCredentials,
    contactId: string,
    _listId?: string
  ): Promise<void> {
    const response = await sendGridFetch(
      credentials,
      `/v3/marketing/contacts?ids=${contactId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to remove contact: ${error}`);
    }
  },

  async getEmailStats(
    credentials: EmailCredentials,
    emailIds: string[]
  ): Promise<EmailStats[]> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      );
      const startDate = thirtyDaysAgo.toISOString().split("T")[0];

      const response = await sendGridFetch(
        credentials,
        `/v3/stats?start_date=${startDate}&aggregated_by=day`
      );

      if (!response.ok) {
        return emailIds.map((emailId) => ({
          emailId,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
        }));
      }

      const data = (await response.json()) as Array<{
        stats: Array<{
          metrics: {
            requests: number;
            delivered: number;
            unique_opens: number;
            unique_clicks: number;
            bounces: number;
            spam_reports: number;
          };
        }>;
      }>;

      // Aggregate stats across all days
      let totalSent = 0;
      let totalDelivered = 0;
      let totalOpened = 0;
      let totalClicked = 0;
      let totalBounced = 0;
      let totalComplained = 0;

      for (const day of data) {
        for (const stat of day.stats) {
          totalSent += stat.metrics.requests;
          totalDelivered += stat.metrics.delivered;
          totalOpened += stat.metrics.unique_opens;
          totalClicked += stat.metrics.unique_clicks;
          totalBounced += stat.metrics.bounces;
          totalComplained += stat.metrics.spam_reports;
        }
      }

      // SendGrid stats are aggregate; distribute evenly across requested IDs
      const count = emailIds.length || 1;
      return emailIds.map((emailId) => ({
        emailId,
        sent: Math.round(totalSent / count),
        delivered: Math.round(totalDelivered / count),
        opened: Math.round(totalOpened / count),
        clicked: Math.round(totalClicked / count),
        bounced: Math.round(totalBounced / count),
        complained: Math.round(totalComplained / count),
      }));
    } catch {
      return emailIds.map((emailId) => ({
        emailId,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      }));
    }
  },
};
