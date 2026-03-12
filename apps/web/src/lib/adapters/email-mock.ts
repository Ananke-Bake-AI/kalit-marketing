import type {
  EmailAdapter,
  EmailCredentials,
  EmailSpec,
  EmailResult,
  ContactSpec,
  EmailStats,
} from "./email-types";

function generateId(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const emailMockAdapter: EmailAdapter = {
  platform: "mock",

  async validateCredentials(_credentials: EmailCredentials): Promise<boolean> {
    return true;
  },

  async sendEmail(
    _credentials: EmailCredentials,
    _email: EmailSpec
  ): Promise<EmailResult> {
    return { id: generateId(), status: "sent" };
  },

  async sendBatch(
    _credentials: EmailCredentials,
    emails: EmailSpec[]
  ): Promise<EmailResult[]> {
    return emails.map(() => ({
      id: generateId(),
      status: "sent" as const,
    }));
  },

  async addContact(
    _credentials: EmailCredentials,
    _contact: ContactSpec,
    _listId?: string
  ): Promise<string> {
    return generateId();
  },

  async removeContact(
    _credentials: EmailCredentials,
    _contactId: string,
    _listId?: string
  ): Promise<void> {
    // no-op
  },

  async getEmailStats(
    _credentials: EmailCredentials,
    emailIds: string[]
  ): Promise<EmailStats[]> {
    return emailIds.map((emailId) => ({
      emailId,
      sent: 1,
      delivered: 1,
      opened: Math.random() > 0.3 ? 1 : 0,
      clicked: Math.random() > 0.6 ? 1 : 0,
      bounced: 0,
      complained: 0,
    }));
  },
};
