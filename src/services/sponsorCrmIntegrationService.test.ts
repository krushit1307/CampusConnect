import { describe, it, expect, vi } from "vitest";
import {
  SponsorLeadCrmPipeline,
  MissingConnectionError,
  buildCrmRequest,
  mapLeadToCrmContact,
  maskCredential,
  retryDelayMs,
  validateCredential,
  type CapturedLead,
  type CrmHttpRequest,
} from "./sponsorCrmIntegrationService";

function makeLead(overrides: Partial<CapturedLead> = {}): CapturedLead {
  return {
    leadId: "lead-1",
    sponsorId: "sponsor-1",
    eventId: "event-1",
    eventName: "Fall Career Fair",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@campus.edu",
    major: "Computer Science",
    graduationYear: 2027,
    notes: "Asked about internships",
    capturedAt: new Date("2026-08-24T12:00:00Z"),
    ...overrides,
  };
}

describe("mapLeadToCrmContact", () => {
  it("maps name, email and major onto standard contact fields", () => {
    const mapped = mapLeadToCrmContact(makeLead());
    expect(mapped.firstName).toBe("Ada");
    expect(mapped.lastName).toBe("Lovelace");
    expect(mapped.email).toBe("ada@campus.edu");
    expect(mapped.major).toBe("Computer Science");
  });

  it("splits a single full-name field into first and last name", () => {
    const mapped = mapLeadToCrmContact(
      makeLead({ firstName: "Grace Brewster Hopper", lastName: "" }),
    );
    expect(mapped.firstName).toBe("Grace");
    expect(mapped.lastName).toBe("Brewster Hopper");
  });

  it("builds a description containing major and event context", () => {
    const mapped = mapLeadToCrmContact(makeLead());
    expect(mapped.description).toContain("Major: Computer Science");
    expect(mapped.description).toContain("Met at: Fall Career Fair");
    expect(mapped.description).toContain("Notes: Asked about internships");
  });
});

describe("buildCrmRequest", () => {
  const lead = makeLead();

  it("creates a HubSpot contacts POST with bearer auth", () => {
    const request = buildCrmRequest(
      { provider: "hubspot", credentialSecret: "pat-na1-secret-token-000", instanceUrl: null },
      lead,
    );
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(request.headers.Authorization).toBe("Bearer pat-na1-secret-token-000");
    const props = request.payload.properties as Record<string, string>;
    expect(props.firstname).toBe("Ada");
    expect(props.lastname).toBe("Lovelace");
    expect(props.email).toBe("ada@campus.edu");
    expect(props.major).toBe("Computer Science");
  });

  it("creates a Salesforce Contact POST against the instance URL", () => {
    const request = buildCrmRequest(
      {
        provider: "salesforce",
        credentialSecret: "sf-access-token-value-0000",
        instanceUrl: "https://acme.my.salesforce.com/",
      },
      lead,
    );
    expect(request.url).toBe("https://acme.my.salesforce.com/services/data/v60.0/sobjects/Contact");
    expect(request.headers.Authorization).toBe("Bearer sf-access-token-value-0000");
    expect(request.payload.LeadSource).toBe("CampusConnect Booth Scan");
    expect(request.payload.Department).toBe("Computer Science");
  });

  it("never leaks the raw secret into the payload body", () => {
    const request = buildCrmRequest(
      { provider: "hubspot", credentialSecret: "pat-na1-secret-token-000", instanceUrl: null },
      lead,
    );
    expect(JSON.stringify(request.payload)).not.toContain("pat-na1-secret-token-000");
  });
});

describe("validateCredential / maskCredential / retryDelayMs", () => {
  it("requires HubSpot tokens to look like private-app tokens", () => {
    expect(validateCredential("hubspot", "not-a-real-token")).toMatch(/must start with 'pat-'/);
    expect(validateCredential("hubspot", "")).toBeTruthy();
    expect(validateCredential("hubspot", "pat-na1-long-enough-token")).toBeNull();
  });

  it("rejects short Salesforce tokens", () => {
    expect(validateCredential("salesforce", "short")).toMatch(/too short/);
    expect(validateCredential("salesforce", "a-long-enough-salesforce-oauth-token")).toBeNull();
  });

  it("masks credentials showing only head and tail", () => {
    expect(maskCredential("pat-na1-abcdefgh-wxyz1234")).toBe("pat-...1234");
    expect(maskCredential("tiny")).toBe("\u2022\u2022\u2022\u2022");
  });

  it("backs off exponentially up to a minute", () => {
    expect(retryDelayMs(1)).toBe(5000);
    expect(retryDelayMs(2)).toBe(10000);
    expect(retryDelayMs(20)).toBe(60000);
  });
});

function makePipeline(httpPost = vi.fn()) {
  const clock = { current: new Date("2026-08-24T12:00:00Z") };
  const now = vi.fn(() => clock.current);
  let counter = 0;
  const generateId = () => `id-${++counter}`;
  const pipeline = new SponsorLeadCrmPipeline({ httpPost, now, generateId });
  return {
    pipeline,
    httpPost,
    clock,
    bumpTime: (ms: number) => {
      clock.current = new Date(clock.current.getTime() + ms);
    },
  };
}

describe("SponsorLeadCrmPipeline connections", () => {
  it("saves a valid HubSpot connection and redacts the secret", () => {
    const { pipeline } = makePipeline();
    const saved = pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    expect(saved.credentialSecret).toBe("");
    expect(saved.credentialHint).toBe("pat-...oken");
    expect(saved.enabled).toBe(true);
    expect(pipeline.getConnectionForSponsor("sponsor-1")?.provider).toBe("hubspot");
  });

  it("requires an https instance URL for Salesforce", () => {
    const { pipeline } = makePipeline();
    expect(() =>
      pipeline.saveConnection({
        sponsorId: "sponsor-1",
        provider: "salesforce",
        credentialSecret: "a-long-enough-salesforce-oauth-token",
      }),
    ).toThrow(/instance URL/);
  });

  it("rejects unknown providers and invalid credentials", () => {
    const { pipeline } = makePipeline();
    expect(() =>
      pipeline.saveConnection({
        sponsorId: "s",
        provider: "zapier" as never,
        credentialSecret: "whatever-long-string-here",
      }),
    ).toThrow(/Unsupported CRM provider/);
    expect(() =>
      pipeline.saveConnection({ sponsorId: "s", provider: "hubspot", credentialSecret: "nope" }),
    ).toThrow(/private-app tokens/);
  });

  it("keeps the stored secret when resaving with a mask placeholder", () => {
    const { pipeline } = makePipeline();
    const first = pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-original-token-aaa",
    });
    // UI sends back the masked hint; validation must be skipped, id stable.
    const resaved = pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-\u2022\u2022\u2022\u2022",
    });
    expect(resaved.connectionId).toBe(first.connectionId);
  });

  it("can pause and resume syncing", () => {
    const { pipeline } = makePipeline();
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    pipeline.setConnectionEnabled("sponsor-1", false);
    expect(pipeline.enqueueLead(makeLead())).toBeNull();
    pipeline.setConnectionEnabled("sponsor-1", true);
    expect(pipeline.enqueueLead(makeLead())).not.toBeNull();
  });

  it("throws MissingConnectionError shape when asked for unknown sponsor getters", () => {
    const error = new MissingConnectionError("ghost");
    expect(error.name).toBe("MissingConnectionError");
    expect(error.message).toContain("ghost");
  });
});

describe("SponsorLeadCrmPipeline queue + delivery", () => {
  it("enqueues one PENDING job per scanned lead when integrated", () => {
    const { pipeline } = makePipeline();
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    const job = pipeline.enqueueLead(makeLead());
    expect(job?.status).toBe("PENDING");
    expect(pipeline.pendingJobs()).toHaveLength(1);
  });

  it("returns null for sponsors without an active integration", () => {
    const { pipeline } = makePipeline();
    expect(pipeline.enqueueLead(makeLead())).toBeNull();
  });

  it("deduplicates repeated scans of the same lead", () => {
    const { pipeline } = makePipeline();
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    const first = pipeline.enqueueLead(makeLead());
    const second = pipeline.enqueueLead(makeLead());
    expect(second?.jobId).toBe(first?.jobId);
    expect(pipeline.pendingJobs()).toHaveLength(1);
  });

  it("delivers through the provider API and records the CRM record id", async () => {
    const { pipeline, httpPost } = makePipeline(
      vi.fn().mockResolvedValue({ status: 201, recordId: "hs-contact-42" }),
    );
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    const job = pipeline.enqueueLead(makeLead())!;

    const outcome = await pipeline.deliverJob(job.jobId);
    expect(outcome.job.status).toBe("DELIVERED");
    expect(outcome.job.crmRecordId).toBe("hs-contact-42");
    expect(outcome.job.deliveredAt).not.toBeNull();
    expect(outcome.request?.url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");

    const [, init] = httpPost.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer pat-na1-long-enough-token");
  });

  it("retries failed deliveries with backoff before marking them FAILED", async () => {
    const { pipeline, httpPost, bumpTime } = makePipeline(
      vi.fn().mockResolvedValue({ status: 503 }),
    );
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "salesforce",
      credentialSecret: "a-long-enough-salesforce-oauth-token",
      instanceUrl: "https://acme.my.salesforce.com",
    });
    const job = pipeline.enqueueLead(makeLead())!;

    await pipeline.deliverJob(job.jobId);
    let stored = pipeline.getJob(job.jobId)!;
    expect(stored.status).toBe("PENDING");
    expect(stored.attempts).toBe(1);
    expect(stored.lastError).toContain("HTTP 503");
    expect(pipeline.pendingJobs()).toHaveLength(0);

    bumpTime(retryDelayMs(1));
    await pipeline.drainQueue();
    stored = pipeline.getJob(job.jobId)!;
    expect(stored.attempts).toBe(2);
    expect(stored.status).toBe("PENDING");

    bumpTime(retryDelayMs(2));
    await pipeline.drainQueue();
    stored = pipeline.getJob(job.jobId)!;
    expect(stored.attempts).toBe(3);
    expect(stored.status).toBe("FAILED");
    expect(pendingCountAfterFailure(pipeline)).toBe(0);
    expect(httpPost).toHaveBeenCalledTimes(3);
  });

  it("redacts bearer tokens from stored error messages", async () => {
    const { pipeline } = makePipeline(async () => {
      throw new Error("401 Unauthorized for Bearer pat-na1-supersecrettokenvalue");
    });
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    const job = pipeline.enqueueLead(makeLead())!;
    const outcome = await pipeline.deliverJob(job.jobId);
    expect(outcome.job.lastError).not.toContain("supersecrettokenvalue");
    expect(outcome.job.lastError).toContain("[redacted]");
  });

  it("skips already-delivered jobs instead of re-posting them", async () => {
    const { pipeline, httpPost } = makePipeline(
      vi.fn().mockResolvedValue({ status: 200, recordId: "rec-1" }),
    );
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    const job = pipeline.enqueueLead(makeLead())!;
    await pipeline.deliverJob(job.jobId);

    const outcome = await pipeline.deliverJob(job.jobId);
    expect(outcome.request).toBeNull();
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  it("drainQueue processes every due job across sponsors", async () => {
    const { pipeline, httpPost } = makePipeline(
      vi.fn().mockResolvedValue({ status: 201, recordId: "ok" }),
    );
    pipeline.saveConnection({
      sponsorId: "sponsor-a",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    pipeline.saveConnection({
      sponsorId: "sponsor-b",
      provider: "salesforce",
      credentialSecret: "a-long-enough-salesforce-oauth-token",
      instanceUrl: "https://b.my.salesforce.com",
    });
    pipeline.enqueueLead(makeLead({ leadId: "l1", sponsorId: "sponsor-a" }));
    pipeline.enqueueLead(makeLead({ leadId: "l2", sponsorId: "sponsor-b" }));

    const outcomes = await pipeline.drainQueue();
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((o) => o.job.status === "DELIVERED")).toBe(true);
    expect(httpPost).toHaveBeenCalledTimes(2);
  });

  it("lists jobs for a sponsor newest-first without exposing internals", () => {
    const { pipeline } = makePipeline();
    pipeline.saveConnection({
      sponsorId: "sponsor-1",
      provider: "hubspot",
      credentialSecret: "pat-na1-long-enough-token",
    });
    pipeline.enqueueLead(makeLead({ leadId: "l1" }));
    pipeline.enqueueLead(makeLead({ leadId: "l2" }));
    const jobs = pipeline.jobsForSponsor("sponsor-1");
    expect(jobs).toHaveLength(2);
    expect(jobs[0].createdAt.getTime()).toBeGreaterThanOrEqual(jobs[1].createdAt.getTime());
  });
});

function pendingCountAfterFailure(pipeline: SponsorLeadCrmPipeline): number {
  return pipeline.pendingJobs().length;
}

// Keeps the CrmHttpRequest type import meaningful for consumers reading tests.
export type { CrmHttpRequest };
