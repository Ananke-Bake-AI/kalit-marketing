import type {
  CrmAdapter,
  CrmCredentials,
  CrmContactSpec,
  CrmContact,
  CrmDealSpec,
  PipelineSummary,
} from "./email-types";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

async function hubspotFetch(
  credentials: CrmCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

function contactToProperties(
  contact: Partial<CrmContactSpec>
): Record<string, string> {
  const properties: Record<string, string> = {};
  if (contact.email) properties.email = contact.email;
  if (contact.firstName) properties.firstname = contact.firstName;
  if (contact.lastName) properties.lastname = contact.lastName;
  if (contact.company) properties.company = contact.company;
  if (contact.phone) properties.phone = contact.phone;
  if (contact.properties) {
    Object.assign(properties, contact.properties);
  }
  return properties;
}

function parseContact(record: {
  id: string;
  properties: Record<string, string | null>;
}): CrmContact {
  return {
    id: record.id,
    email: record.properties.email ?? "",
    firstName: record.properties.firstname ?? undefined,
    lastName: record.properties.lastname ?? undefined,
    company: record.properties.company ?? undefined,
    properties: Object.fromEntries(
      Object.entries(record.properties).filter(
        (entry): entry is [string, string] => entry[1] !== null
      )
    ),
  };
}

export const hubspotAdapter: CrmAdapter = {
  platform: "hubspot",

  async validateCredentials(credentials: CrmCredentials): Promise<boolean> {
    try {
      const response = await hubspotFetch(
        credentials,
        "/crm/v3/objects/contacts?limit=1"
      );
      return response.ok;
    } catch {
      return false;
    }
  },

  async createContact(
    credentials: CrmCredentials,
    contact: CrmContactSpec
  ): Promise<string> {
    const response = await hubspotFetch(
      credentials,
      "/crm/v3/objects/contacts",
      {
        method: "POST",
        body: JSON.stringify({
          properties: contactToProperties(contact),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create contact: ${error}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  },

  async updateContact(
    credentials: CrmCredentials,
    contactId: string,
    updates: Partial<CrmContactSpec>
  ): Promise<void> {
    const response = await hubspotFetch(
      credentials,
      `/crm/v3/objects/contacts/${contactId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: contactToProperties(updates),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update contact: ${error}`);
    }
  },

  async searchContacts(
    credentials: CrmCredentials,
    query: string
  ): Promise<CrmContact[]> {
    const response = await hubspotFetch(
      credentials,
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          query,
          limit: 100,
          properties: [
            "email",
            "firstname",
            "lastname",
            "company",
            "phone",
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to search contacts: ${error}`);
    }

    const data = (await response.json()) as {
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
      }>;
    };

    return data.results.map(parseContact);
  },

  async createDeal(
    credentials: CrmCredentials,
    deal: CrmDealSpec
  ): Promise<string> {
    const properties: Record<string, string | number> = {
      dealname: deal.name,
      dealstage: deal.stage,
      ...(deal.properties ?? {}),
    };

    if (deal.amount !== undefined) {
      properties.amount = deal.amount;
    }

    const body: Record<string, unknown> = { properties };

    if (deal.contactId) {
      body.associations = [
        {
          to: { id: deal.contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 3, // deal-to-contact
            },
          ],
        },
      ];
    }

    const response = await hubspotFetch(
      credentials,
      "/crm/v3/objects/deals",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create deal: ${error}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  },

  async updateDealStage(
    credentials: CrmCredentials,
    dealId: string,
    stage: string
  ): Promise<void> {
    const response = await hubspotFetch(
      credentials,
      `/crm/v3/objects/deals/${dealId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: { dealstage: stage },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update deal stage: ${error}`);
    }
  },

  async getPipelineSummary(
    credentials: CrmCredentials
  ): Promise<PipelineSummary> {
    // Fetch pipeline definitions to get stage names
    const pipelineResponse = await hubspotFetch(
      credentials,
      "/crm/v3/pipelines/deals"
    );

    if (!pipelineResponse.ok) {
      throw new Error("Failed to fetch pipelines");
    }

    const pipelineData = (await pipelineResponse.json()) as {
      results: Array<{
        stages: Array<{ stageId: string; label: string }>;
      }>;
    };

    const stageLabels = new Map<string, string>();
    for (const pipeline of pipelineData.results) {
      for (const stage of pipeline.stages) {
        stageLabels.set(stage.stageId, stage.label);
      }
    }

    // Fetch all deals to aggregate by stage
    const dealsResponse = await hubspotFetch(
      credentials,
      "/crm/v3/objects/deals?limit=100&properties=dealstage,amount"
    );

    if (!dealsResponse.ok) {
      throw new Error("Failed to fetch deals");
    }

    const dealsData = (await dealsResponse.json()) as {
      results: Array<{
        properties: {
          dealstage: string;
          amount: string | null;
        };
      }>;
    };

    const stageMap = new Map<
      string,
      { count: number; value: number }
    >();

    for (const deal of dealsData.results) {
      const stageId = deal.properties.dealstage;
      const amount = deal.properties.amount
        ? parseFloat(deal.properties.amount)
        : 0;

      const existing = stageMap.get(stageId) ?? {
        count: 0,
        value: 0,
      };
      existing.count += 1;
      existing.value += amount;
      stageMap.set(stageId, existing);
    }

    const stages = Array.from(stageMap.entries()).map(
      ([stageId, data]) => ({
        name: stageLabels.get(stageId) ?? stageId,
        count: data.count,
        value: Math.round(data.value * 100) / 100,
      })
    );

    const totalValue = stages.reduce((sum, s) => sum + s.value, 0);
    const totalDeals = stages.reduce((sum, s) => sum + s.count, 0);

    return {
      stages,
      totalValue: Math.round(totalValue * 100) / 100,
      totalDeals,
    };
  },
};
