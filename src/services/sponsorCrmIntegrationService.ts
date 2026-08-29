/**
 * Module: Dynamic "Sponsor Lead" CRM Integration
 * File: src/services/sponsorCrmIntegrationService.ts
 * Issue: #4418
 *
 * Sponsors scan student QR codes at their booth (#4284). Until now those leads
 * lived only inside CampusConnect and sponsors hand-exported CSVs into
 * Salesforce or HubSpot by hand. This module pipes them across instantly:
 *
 *   1. The sponsor stores a HubSpot private-app token or a Salesforce OAuth
 *      token once, from the new "CRM Integrations" dashboard tab.
 *   2. When a booth scan captures a lead, the backend enqueues a background
 *      delivery job (see the paired SQL migration's trigger).
 *   3. A worker drains the queue: it maps the student's data (Name, Email,
 *      Major) onto standard CRM Contact fields and executes the POST that
 *      creates the record in the sponsor's CRM immediately.
 *
 * Everything network-facing is injected (`httpPost`, clock, id factory) so the
 * whole capture -> queue -> map -> deliver lifecycle is unit-testable without
 * touching real CRMs. Credentials are treated as secrets end to end: they are
 * never returned by accessors, never written into logs or error messages, and
 * only ever rendered masked.
 */

export type CrmProvider = "hubspot" | "salesforce";

export type CrmDeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

export const MAX_DELIVERY_ATTEMPTS = 3;

/** Backoff before retry N (1-based), in milliseconds. */
export function retryDelayMs(attempt: number): number {
  return Math.min(60_000, 2 ** Math.max(0, attempt - 1) * 5_000);
}

export interface SponsorCrmConnection {
  connectionId: string;
  sponsorId: string;
  provider: CrmProvider;
  /**
   * HubSpot private-app token ('pat-na1-...') or Salesforce OAuth access
   * token. Treated as a write-only secret: never exposed by getters.
   */
  credentialSecret: string;
  /** Masked preview safe for UI display, e.g. 'pat-...f4c9'. */
  credentialHint: string;
  /** Salesforce only: the instance/portal URL the OAuth token belongs to. */
  instanceUrl: string | null;
  enabled: boolean;
}

export interface CapturedLead {
  leadId: string;
  sponsorId: string;
  eventId: string;
  eventName?: string;
  firstName: string;
  lastName: string;
  email: string;
  major?: string;
  graduationYear?: number;
  notes?: string | null;
  capturedAt: Date;
}

export interface MappedContact {
  firstName: string;
  lastName: string;
  email: string;
  major: string;
  description: string;
}

export interface CrmHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  payload: Record<string, unknown>;
}

export interface CrmHttpResponse {
  status: number;
  /** Provider-specific record id when the contact was created. */
  recordId?: string;
}

export interface CrmDeliveryJob {
  jobId: string;
  leadId: string;
  connectionId: string;
  sponsorId: string;
  provider: CrmProvider;
  status: CrmDeliveryStatus;
  attempts: number;
  crmRecordId: string | null;
  lastError: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  nextAttemptAt: Date;
}

export interface DeliveryOutcome {
  job: CrmDeliveryJob;
  request: CrmHttpRequest | null;
  response: CrmHttpResponse | null;
}

export class MissingConnectionError extends Error {
  constructor(sponsorId: string) {
    super(`No active CRM connection is configured for sponsor '${sponsorId}'.`);
    this.name = "MissingConnectionError";
  }
}

export function isValidProvider(provider: string): provider is CrmProvider {
  return provider === "hubspot" || provider === "salesforce";
}

export function maskCredential(secret: string): string {
  const trimmed = (secret ?? "").trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/**
 * Validates a credential's shape without ever calling the provider. HubSpot
 * private-app tokens start with 'pat-'; Salesforce access tokens are opaque,
 * so only a minimum length can be enforced there.
 */
export function validateCredential(provider: CrmProvider, secret: string): string | null {
  const trimmed = (secret ?? "").trim();
  if (!trimmed) return "A credential is required.";
  if (provider === "hubspot") {
    if (!trimmed.startsWith("pat-")) {
      return "HubSpot credentials are private-app tokens and must start with 'pat-'.";
    }
    if (trimmed.length < 20) return "That HubSpot token looks truncated.";
    return null;
  }
  if (trimmed.length < 20) return "That Salesforce access token looks too short.";
  return null;
}

/** Split 'Ada Lovelace' defensively even when data arrived with one name. */
function splitName(lead: Pick<CapturedLead, "firstName" | "lastName">): {
  firstName: string;
  lastName: string;
} {
  let firstName = (lead.firstName ?? "").trim();
  let lastName = (lead.lastName ?? "").trim();
  if (!lastName && firstName.includes(" ")) {
    const parts = firstName.split(/\s+/);
    lastName = parts.slice(1).join(" ");
    firstName = parts[0];
  }
  return { firstName, lastName };
}

export function mapLeadToCrmContact(lead: CapturedLead): MappedContact {
  const { firstName, lastName } = splitName(lead);
  const contextBits = [
    lead.major ? `Major: ${lead.major}` : null,
    lead.graduationYear ? `Graduation year: ${lead.graduationYear}` : null,
    lead.eventName ? `Met at: ${lead.eventName}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
  ].filter(Boolean);

  return {
    firstName,
    lastName,
    email: (lead.email ?? "").trim(),
    major: (lead.major ?? "").trim(),
    description: `CampusConnect booth lead.${contextBits.length ? ` ${contextBits.join(". ")}.` : ""}`,
  };
}

const HUBSPOT_CONTACTS_ENDPOINT = "https://api.hubapi.com/crm/v3/objects/contacts";

export function buildCrmRequest(
  connection: Pick<SponsorCrmConnection, "provider" | "credentialSecret" | "instanceUrl">,
  lead: CapturedLead,
): CrmHttpRequest {
  const mapped = mapLeadToCrmContact(lead);

  if (connection.provider === "hubspot") {
    return {
      url: HUBSPOT_CONTACTS_ENDPOINT,
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.credentialSecret}`,
        "Content-Type": "application/json",
      },
      payload: {
        properties: {
          firstname: mapped.firstName,
          lastname: mapped.lastName || "(unknown)",
          email: mapped.email,
          ...(mapped.major ? { major: mapped.major } : {}),
          jobtitle: "Student",
          hs_lead_status: "CONNECTED",
          description: mapped.description,
        },
      },
    };
  }

  const base = (connection.instanceUrl ?? "").replace(/\/+$/, "");
  return {
    url: `${base}/services/data/v60.0/sobjects/Contact`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.credentialSecret}`,
      "Content-Type": "application/json",
    },
    payload: {
      FirstName: mapped.firstName,
      LastName: mapped.lastName || "(unknown)",
      Email: mapped.email,
      LeadSource: "CampusConnect Booth Scan",
      Description: mapped.description,
      ...(mapped.major ? { Department: mapped.major } : {}),
    },
  };
}

type HttpPost = (
  url: string,
  init: { headers: Record<string, string>; payload: Record<string, unknown> },
) => Promise<CrmHttpResponse>;

export interface SponsorLeadCrmDeps {
  httpPost?: HttpPost;
  now?: () => Date;
  generateId?: () => string;
}

/**
 * Owns the sponsor -> CRM wiring and the background delivery queue. One
 * instance per backend worker process; all persistence hooks stay external so
 * Supabase remains the source of truth (see the paired migration).
 */
export class SponsorLeadCrmPipeline {
  private readonly connections = new Map<string, SponsorCrmConnection>();
  private readonly jobs = new Map<string, CrmDeliveryJob>();
  private readonly leads = new Map<string, CapturedLead>();

  private readonly httpPost: HttpPost;
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(deps: SponsorLeadCrmDeps = {}) {
    this.httpPost = deps.httpPost ?? (async () => ({ status: 503, recordId: undefined }));
    this.now = deps.now ?? (() => new Date());
    this.generateId =
      deps.generateId ??
      (() => `crmjob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
  }

  // -------------------------------------------------------------------------
  // Connection management (step 2 of the issue)
  // -------------------------------------------------------------------------

  saveConnection(input: {
    sponsorId: string;
    provider: CrmProvider;
    credentialSecret: string;
    instanceUrl?: string | null;
    enabled?: boolean;
  }): SponsorCrmConnection {
    if (!isValidProvider(input.provider)) {
      throw new Error(`Unsupported CRM provider '${input.provider}'.`);
    }

    const existing = [...this.connections.values()].find(
      (candidate) => candidate.sponsorId === input.sponsorId,
    );
    // A UI round-trip may send back the masked hint instead of a fresh
    // token; that means "keep whatever is stored".
    const trimmedSecret = (input.credentialSecret ?? "").trim();
    const reusesStoredSecret = trimmedSecret.includes("\u2022\u2022\u2022\u2022");
    if (!reusesStoredSecret) {
      const problem = validateCredential(input.provider, trimmedSecret);
      if (problem) throw new Error(problem);
    } else if (!existing) {
      throw new Error("No stored credential to keep - please paste a new one.");
    }
    if (input.provider === "salesforce") {
      const base = (input.instanceUrl ?? "").trim();
      if (!/^https:\/\/.+/.test(base)) {
        throw new Error("Salesforce requires the OAuth token's instance URL (https://...).");
      }
    }

    const connection: SponsorCrmConnection = {
      connectionId: existing?.connectionId ?? this.generateId(),
      sponsorId: input.sponsorId,
      provider: input.provider,
      credentialSecret: reusesStoredSecret && existing ? existing.credentialSecret : trimmedSecret,
      credentialHint:
        reusesStoredSecret && existing ? existing.credentialHint : maskCredential(trimmedSecret),
      instanceUrl:
        input.provider === "salesforce"
          ? (input.instanceUrl ?? "").trim().replace(/\/+$/, "")
          : null,
      enabled: input.enabled ?? true,
    };
    this.connections.set(connection.connectionId, connection);
    return this.redact(connection);
  }

  getConnectionForSponsor(sponsorId: string): SponsorCrmConnection | null {
    const found = [...this.connections.values()].find((c) => c.sponsorId === sponsorId);
    return found ? this.redact(found) : null;
  }

  setConnectionEnabled(sponsorId: string, enabled: boolean): SponsorCrmConnection | null {
    const found = [...this.connections.values()].find((c) => c.sponsorId === sponsorId);
    if (!found) return null;
    found.enabled = enabled;
    this.connections.set(found.connectionId, { ...found });
    return this.redact(found);
  }

  // -------------------------------------------------------------------------
  // Queueing (step 3+4 of the issue)
  // -------------------------------------------------------------------------

  /**
   * Called right after a successful booth scan. Returns the queued job, or
   * null when the sponsor has no active integration (the CSV flow keeps
   * working for them).
   */
  enqueueLead(lead: CapturedLead): CrmDeliveryJob | null {
    const existingJob = [...this.jobs.values()].find((j) => j.leadId === lead.leadId);
    if (existingJob) return { ...existingJob };

    const connection = [...this.connections.values()].find(
      (candidate) => candidate.sponsorId === lead.sponsorId && candidate.enabled,
    );
    if (!connection) return null;

    const job: CrmDeliveryJob = {
      jobId: this.generateId(),
      leadId: lead.leadId,
      connectionId: connection.connectionId,
      sponsorId: lead.sponsorId,
      provider: connection.provider,
      status: "PENDING",
      attempts: 0,
      crmRecordId: null,
      lastError: null,
      createdAt: this.now(),
      deliveredAt: null,
      nextAttemptAt: this.now(),
    };
    this.leads.set(lead.leadId, lead);
    this.jobs.set(job.jobId, job);
    return { ...job };
  }

  pendingJobs(): CrmDeliveryJob[] {
    const at = this.now();
    return [...this.jobs.values()]
      .filter((job) => job.status === "PENDING")
      .filter((job) => job.nextAttemptAt.getTime() <= at.getTime())
      .map((job) => ({ ...job }));
  }

  // -------------------------------------------------------------------------
  // Delivery (step 5 of the issue)
  // -------------------------------------------------------------------------

  async deliverJob(jobId: string): Promise<DeliveryOutcome> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown CRM delivery job '${jobId}'.`);
    if (job.status === "DELIVERED") {
      return { job: { ...job }, request: null, response: null };
    }
    const connection = this.connections.get(job.connectionId);
    if (!connection) {
      throw new Error(`CRM connection '${job.connectionId}' has been removed.`);
    }

    const lead = this.leads.get(job.leadId);
    if (!lead) {
      throw new Error(`Captured lead '${job.leadId}' is no longer available.`);
    }

    const request = buildCrmRequest(connection, lead);
    job.attempts += 1;
    try {
      const response = await this.httpPost(request.url, {
        headers: request.headers,
        payload: request.payload,
      });
      const ok = response.status >= 200 && response.status < 300;
      if (ok) {
        job.status = "DELIVERED";
        job.crmRecordId = response.recordId ?? null;
        job.lastError = null;
        job.deliveredAt = this.now();
      } else {
        this.markRetryOrFailed(job, `CRM responded with HTTP ${response.status}.`);
      }
      this.jobs.set(job.jobId, { ...job });
      return { job: { ...job }, request, response };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.markRetryOrFailed(job, message);
      this.jobs.set(job.jobId, { ...job });
      return { job: { ...job }, request, response: null };
    }
  }

  /** Drain every due job. Returns each outcome so callers can persist logs. */
  async drainQueue(): Promise<DeliveryOutcome[]> {
    const outcomes: DeliveryOutcome[] = [];
    for (const job of this.pendingJobs()) {
      outcomes.push(await this.deliverJob(job.jobId));
    }
    return outcomes;
  }

  getJob(jobId: string): CrmDeliveryJob | null {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  jobsForSponsor(sponsorId: string): CrmDeliveryJob[] {
    return [...this.jobs.values()]
      .filter((job) => job.sponsorId === sponsorId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((job) => ({ ...job }));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private markRetryOrFailed(job: CrmDeliveryJob, message: string): void {
    job.lastError = message.replace(/\b(Bearer|pat-)[\w.\-=]+/gi, "[redacted]");
    if (job.attempts >= MAX_DELIVERY_ATTEMPTS) {
      job.status = "FAILED";
    } else {
      job.nextAttemptAt = new Date(this.now().getTime() + retryDelayMs(job.attempts));
    }
  }

  private redact(connection: SponsorCrmConnection): SponsorCrmConnection {
    return { ...connection, credentialSecret: "" };
  }
}
