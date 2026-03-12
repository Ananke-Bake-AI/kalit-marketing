export interface EmailCredentials {
  apiKey: string;
  domain?: string;
  metadata?: Record<string, string>;
}

export interface EmailSpec {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface EmailResult {
  id: string;
  status: "sent" | "queued" | "failed";
  error?: string;
}

export interface ContactSpec {
  email: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, string>;
}

export interface EmailStats {
  emailId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

export interface EmailAdapter {
  platform: string;
  validateCredentials(credentials: EmailCredentials): Promise<boolean>;
  sendEmail(credentials: EmailCredentials, email: EmailSpec): Promise<EmailResult>;
  sendBatch(credentials: EmailCredentials, emails: EmailSpec[]): Promise<EmailResult[]>;
  addContact(credentials: EmailCredentials, contact: ContactSpec, listId?: string): Promise<string>;
  removeContact(credentials: EmailCredentials, contactId: string, listId?: string): Promise<void>;
  getEmailStats(credentials: EmailCredentials, emailIds: string[]): Promise<EmailStats[]>;
}

export interface CrmCredentials {
  accessToken: string;
  portalId?: string;
  metadata?: Record<string, string>;
}

export interface CrmContactSpec {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  properties?: Record<string, string>;
}

export interface CrmContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  properties: Record<string, string>;
}

export interface CrmDealSpec {
  name: string;
  amount?: number;
  stage: string;
  contactId?: string;
  properties?: Record<string, string>;
}

export interface PipelineSummary {
  stages: Array<{ name: string; count: number; value: number }>;
  totalValue: number;
  totalDeals: number;
}

export interface CrmAdapter {
  platform: string;
  validateCredentials(credentials: CrmCredentials): Promise<boolean>;
  createContact(credentials: CrmCredentials, contact: CrmContactSpec): Promise<string>;
  updateContact(credentials: CrmCredentials, contactId: string, updates: Partial<CrmContactSpec>): Promise<void>;
  searchContacts(credentials: CrmCredentials, query: string): Promise<CrmContact[]>;
  createDeal(credentials: CrmCredentials, deal: CrmDealSpec): Promise<string>;
  updateDealStage(credentials: CrmCredentials, dealId: string, stage: string): Promise<void>;
  getPipelineSummary(credentials: CrmCredentials): Promise<PipelineSummary>;
}
