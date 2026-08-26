import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CrmIntegrationsPanel from "./CrmIntegrationsPanel";

type ResultRow = Record<string, unknown>;

interface TableQuery {
  rows: ResultRow[];
  singleResult: ResultRow | null;
}

function createMockSupabase(tables: Record<string, TableQuery>) {
  const calls = {
    upserts: [] as Array<{ table: string; row: ResultRow }>,
    updates: [] as Array<{ table: string; values: ResultRow; id: string }>,
  };

  const makeBuilder = (table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: tables[table]?.singleResult ?? null, error: null })),
      // Terminal promise for list queries.
      then: undefined,
    };
    builder.upsert = vi.fn(async (row: ResultRow) => {
      calls.upserts.push({ table, row });
      return { error: null };
    });
    builder.update = vi.fn((values: ResultRow) => {
      const updateBuilder: any = {
        eq: vi.fn(async (_col: string, id: string) => {
          calls.updates.push({ table, values, id });
          return { error: null };
        }),
      };
      return updateBuilder;
    });
    // Allow awaiting the builder directly for list selects.
    (builder as any).then = (
      resolve: (value: unknown) => void,
      reject?: (reason?: unknown) => void,
    ) => Promise.resolve({ data: tables[table]?.rows ?? [], error: null }).then(resolve, reject);
    return builder;
  };

  const client = {
    from: vi.fn((table: string) => makeBuilder(table)),
  };
  return { client, calls };
}

let mockClient: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockClient.client),
}));

describe("CrmIntegrationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockSupabase({
      sponsor_crm_connections: { rows: [], singleResult: null },
      sponsor_crm_deliveries: { rows: [], singleResult: null },
    });
  });

  it("renders the provider picker once loaded", async () => {
    render(<CrmIntegrationsPanel sponsorId="sponsor-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("crm-integrations-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("provider-hubspot")).toBeInTheDocument();
    expect(screen.getByTestId("provider-salesforce")).toBeInTheDocument();
  });

  it("shows the instance URL field only for Salesforce", async () => {
    render(<CrmIntegrationsPanel sponsorId="sponsor-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("crm-secret-input")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("crm-instance-url")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("provider-salesforce"));
    expect(screen.getByTestId("crm-instance-url")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("provider-hubspot"));
    expect(screen.queryByTestId("crm-instance-url")).not.toBeInTheDocument();
  });

  it("rejects malformed HubSpot tokens without calling the backend", async () => {
    render(<CrmIntegrationsPanel sponsorId="sponsor-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("crm-secret-input")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByTestId("crm-secret-input"), "definitely-not-valid");
    await userEvent.click(screen.getByTestId("save-connection"));

    expect(await screen.findByTestId("crm-feedback")).toHaveTextContent(/private-app tokens/);
    expect(mockClient.calls.upserts).toHaveLength(0);
  });

  it("requires an https instance URL for Salesforce", async () => {
    render(<CrmIntegrationsPanel sponsorId="sponsor-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("crm-secret-input")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("provider-salesforce"));
    await userEvent.type(
      screen.getByTestId("crm-secret-input"),
      "a-long-enough-salesforce-oauth-token",
    );
    await userEvent.type(screen.getByTestId("crm-instance-url"), "not-a-url");
    await userEvent.click(screen.getByTestId("save-connection"));

    expect(await screen.findByTestId("crm-feedback")).toHaveTextContent(/instance URL/);
    expect(mockClient.calls.upserts).toHaveLength(0);
  });

  it("upserts a valid HubSpot connection with a masked hint", async () => {
    render(<CrmIntegrationsPanel sponsorId="sponsor-9" />);
    await waitFor(() => {
      expect(screen.getByTestId("crm-secret-input")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByTestId("crm-secret-input"), "pat-na1-long-enough-token");
    await userEvent.click(screen.getByTestId("save-connection"));

    await waitFor(() => {
      expect(mockClient.calls.upserts).toHaveLength(1);
    });
    const { row } = mockClient.calls.upserts[0];
    expect(row.sponsor_id).toBe("sponsor-9");
    expect(row.provider).toBe("hubspot");
    expect(row.credential_secret).toBe("pat-na1-long-enough-token");
    expect(row.credential_hint).toBe("pat-...oken");

    expect(await screen.findByTestId("crm-feedback")).toHaveTextContent(/Connected!/);
  });

  it("displays an existing integration with its status badge and toggle", async () => {
    mockClient = createMockSupabase({
      sponsor_crm_connections: {
        rows: [],
        singleResult: {
          id: "conn-1",
          provider: "salesforce",
          credential_hint: "00Df...9x2k",
          instance_url: "https://acme.my.salesforce.com",
          enabled: true,
        },
      },
      sponsor_crm_deliveries: {
        rows: [
          {
            id: "d1",
            status: "DELIVERED",
            attempts: 1,
            crm_record_id: "003ABC",
            last_error: null,
            created_at: "2026-08-24T12:00:00Z",
          },
          {
            id: "d2",
            status: "FAILED",
            attempts: 3,
            crm_record_id: null,
            last_error: "CRM responded with HTTP 503",
            created_at: "2026-08-24T11:00:00Z",
          },
        ],
        singleResult: null,
      },
    });

    render(<CrmIntegrationsPanel sponsorId="sponsor-1" />);

    expect(await screen.findByTestId("toggle-connection")).toHaveTextContent("Sync Active");
    expect(screen.getByTestId("delivery-status-d1")).toHaveTextContent("DELIVERED");
    expect(screen.getByTestId("delivery-status-d2")).toHaveTextContent("FAILED");

    await userEvent.click(screen.getByTestId("toggle-connection"));
    await waitFor(() => {
      expect(mockClient.calls.updates).toHaveLength(1);
    });
    expect(mockClient.calls.updates[0].values.enabled).toBe(false);
  });
});
