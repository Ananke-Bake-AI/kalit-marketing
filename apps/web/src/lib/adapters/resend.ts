import { Resend } from "resend";
import type {
  EmailAdapter,
  EmailCredentials,
  EmailSpec,
  EmailResult,
  ContactSpec,
  EmailStats,
} from "./email-types";

function createClient(credentials: EmailCredentials): Resend {
  return new Resend(credentials.apiKey);
}

function normalizeRecipients(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

export const resendAdapter: EmailAdapter = {
  platform: "resend",

  async validateCredentials(credentials: EmailCredentials): Promise<boolean> {
    try {
      const client = createClient(credentials);
      await client.domains.list();
      return true;
    } catch {
      return false;
    }
  },

  async sendEmail(
    credentials: EmailCredentials,
    email: EmailSpec
  ): Promise<EmailResult> {
    const client = createClient(credentials);

    try {
      const payload = {
        from: email.from,
        to: normalizeRecipients(email.to),
        subject: email.subject,
        html: email.html ?? "",
        replyTo: email.replyTo,
        tags: email.tags?.map((tag) => ({ name: tag, value: tag })),
      };
      const { data, error } = await client.emails.send(payload);

      if (error || !data) {
        return {
          id: "",
          status: "failed",
          error: error?.message ?? "Unknown error",
        };
      }

      return { id: data.id, status: "sent" };
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
    const client = createClient(credentials);

    try {
      const { data, error } = await client.batch.send(
        emails.map((email) => ({
          from: email.from,
          to: normalizeRecipients(email.to),
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: email.replyTo,
          tags: email.tags?.map((tag) => ({ name: tag, value: tag })),
        }))
      );

      if (error || !data) {
        return emails.map(() => ({
          id: "",
          status: "failed" as const,
          error: error?.message ?? "Unknown error",
        }));
      }

      return data.data.map((item) => ({
        id: item.id,
        status: "sent" as const,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      return emails.map(() => ({
        id: "",
        status: "failed" as const,
        error: errorMessage,
      }));
    }
  },

  async addContact(
    credentials: EmailCredentials,
    contact: ContactSpec,
    listId?: string
  ): Promise<string> {
    const client = createClient(credentials);
    const audienceId =
      listId ?? credentials.metadata?.audienceId ?? "";

    const { data, error } = await client.contacts.create({
      audienceId,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to add contact");
    }

    return data.id;
  },

  async removeContact(
    credentials: EmailCredentials,
    contactId: string,
    listId?: string
  ): Promise<void> {
    const client = createClient(credentials);
    const audienceId =
      listId ?? credentials.metadata?.audienceId ?? "";

    const { error } = await client.contacts.remove({
      audienceId,
      id: contactId,
    });

    if (error) {
      throw new Error(error.message ?? "Failed to remove contact");
    }
  },

  async getEmailStats(
    credentials: EmailCredentials,
    emailIds: string[]
  ): Promise<EmailStats[]> {
    const client = createClient(credentials);
    const results: EmailStats[] = [];

    for (const emailId of emailIds) {
      try {
        const { data, error } = await client.emails.get(emailId);

        if (error || !data) {
          results.push({
            emailId,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            complained: 0,
          });
          continue;
        }

        const lastEvent = data.last_event;

        results.push({
          emailId,
          sent: 1,
          delivered: lastEvent === "delivered" || lastEvent === "opened" || lastEvent === "clicked" ? 1 : 0,
          opened: lastEvent === "opened" || lastEvent === "clicked" ? 1 : 0,
          clicked: lastEvent === "clicked" ? 1 : 0,
          bounced: lastEvent === "bounced" ? 1 : 0,
          complained: lastEvent === "complained" ? 1 : 0,
        });
      } catch {
        results.push({
          emailId,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
        });
      }
    }

    return results;
  },
};
