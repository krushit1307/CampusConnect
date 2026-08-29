/**
 * IRS Compliance Service
 * 
 * Verifies charitable partner compliance via the IRS Tax Exempt Organization
 * Search (TEOS) API. Checks 501(c)(3) status and Form 990 filing history.
 * 
 * Issue #4993: Automated "Club Spending" IRS 990 Filer Tracker
 */

import { query } from "../../db/client";

// --- Configuration ---

const IRS_TEOS_API_BASE = process.env.IRS_TEOS_API_BASE || "https://apps.irs.gov/app/eos";
const IRS_API_KEY = process.env.IRS_API_KEY || "";

/** How many months back to check for Form 990 filings */
const FILING_LOOKBACK_MONTHS = 18;

/** How far in advance to schedule next verification (days) */
const VERIFICATION_INTERVAL_DAYS = 30;

// --- Types ---

export interface IRS OrganizationRecord {
  ein: string;
  name: string;
  rulingDate: string;           // When 501(c)(3) was granted
  revocationDate?: string;      // When status was revoked (if applicable)
  filingStatus?: string;        // "01" = current, "02" = delinquent, "03" = revoked
  mostRecentFilingDate?: string;
  organizationType?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface ComplianceCheckResult {
  partnerId: string;
  ein: string;
  status: "pass" | "fail" | "error";
  
  // Filing information
  filingStatus: string;
  lastFilingDate: Date | null;
  revocationDate: Date | null;
  revocationReason: string | null;
  
  // Raw response for audit
  irsResponse: any;
  
  // Error information (if status === "error")
  errorMessage: string | null;
}

// --- IRS TEOS API Client ---

/**
 * Query the IRS TEOS API for organization information.
 * 
 * Uses the public EOS search endpoint. Falls back to mock data for
 * development when IRS_API_KEY is not configured.
 */
export async function queryIRSByEIN(ein: string): Promise<IRS OrganizationRecord | null> {
  const normalizedEIN = ein.replace(/[^0-9]/g, "");
  
  if (normalizedEIN.length !== 9) {
    throw new Error(`Invalid EIN format: ${ein}. Must be 9 digits.`);
  }

  // In production, use the IRS TEOS API
  if (IRS_API_KEY) {
    return await queryIRSProduction(normalizedEIN);
  }
  
  // Development mode: return mock data or simulate API call
  return await queryIRSMock(normalizedEIN);
}

/**
 * Production IRS TEOS API query.
 */
async function queryIRSProduction(ein: string): Promise<IRS OrganizationRecord | null> {
  try {
    // IRS TEOS API endpoint for organization lookup
    const response = await fetch(`${IRS_TEOS_API_BASE}/SearchResults`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${IRS_API_KEY}`,
      },
      body: JSON.stringify({
        ein: ein,
        organizationName: "",
        city: "",
        state: "",
        country: "US",
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Organization not found
      }
      throw new Error(`IRS API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || !data.organizations || data.organizations.length === 0) {
      return null;
    }

    const org = data.organizations[0];
    
    return {
      ein: org.ein || ein,
      name: org.name || "Unknown",
      rulingDate: org.rulingDate || "",
      revocationDate: org.revocationDate,
      filingStatus: org.filingStatus || "01",
      mostRecentFilingDate: org.mostRecentFilingDate,
      organizationType: org.organizationType,
      address: org.address,
      city: org.city,
      state: org.state,
      zip: org.zip,
    };
  } catch (error) {
    console.error("[IRS API] Production query failed:", error);
    throw error;
  }
}

/**
 * Mock IRS TEOS API for development/testing.
 * Returns realistic test data based on EIN patterns.
 */
async function queryIRSMock(ein: string): Promise<IRS OrganizationRecord | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Test EINs for different scenarios
  const mockData: Record<string, IRS OrganizationRecord> = {
    // Valid, compliant organization
    "123456789": {
      ein: "123456789",
      name: "Community Foundation Inc",
      rulingDate: "2010-01-15",
      filingStatus: "01", // Current
      mostRecentFilingDate: "2025-03-15",
      organizationType: "501(c)(3)",
    },
    // Delinquent - hasn't filed in 2 years
    "987654321": {
      ein: "987654321",
      name: "Stale Filing Charity",
      rulingDate: "2005-06-20",
      filingStatus: "02", // Delinquent
      mostRecentFilingDate: "2023-01-10", // Over 18 months ago
      organizationType: "501(c)(3)",
    },
    // Revoked status
    "111111111": {
      ein: "111111111",
      name: "Revoked Foundation",
      rulingDate: "2000-01-01",
      revocationDate: "2024-05-15",
      filingStatus: "03", // Revoked
      organizationType: "501(c)(3)",
    },
  };

  return mockData[ein] || null;
}

// --- Compliance Evaluation ---

/**
 * Evaluate compliance status based on IRS data and filing history.
 */
export function evaluateCompliance(
  irsRecord: IRS OrganizationRecord,
  currentDate: Date = new Date()
): {
  status: "active" | "non_compliant" | "revoked";
  reason: string;
  lastFilingDate: Date | null;
  revocationDate: Date | null;
} {
  // Check for explicit revocation
  if (irsRecord.revocationDate) {
    return {
      status: "revoked",
      reason: `Organization revoked on ${irsRecord.revocationDate}`,
      lastFilingDate: irsRecord.mostRecentFilingDate 
        ? new Date(irsRecord.mostRecentFilingDate) 
        : null,
      revocationDate: new Date(irsRecord.revocationDate),
    };
  }

  // Check filing status code
  if (irsRecord.filingStatus === "03") {
    return {
      status: "revoked",
      reason: "IRS filing status indicates revocation",
      lastFilingDate: irsRecord.mostRecentFilingDate 
        ? new Date(irsRecord.mostRecentFilingDate) 
        : null,
      revocationDate: null,
    };
  }

  // Check if filing is delinquent
  if (irsRecord.filingStatus === "02") {
    return {
      status: "non_compliant",
      reason: "Organization has delinquent filings",
      lastFilingDate: irsRecord.mostRecentFilingDate 
        ? new Date(irsRecord.mostRecentFilingDate) 
        : null,
      revocationDate: null,
    };
  }

  // Check most recent filing date
  if (irsRecord.mostRecentFilingDate) {
    const lastFiling = new Date(irsRecord.mostRecentFilingDate);
    const cutoffDate = new Date(currentDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - FILING_LOOKBACK_MONTHS);

    if (lastFiling < cutoffDate) {
      return {
        status: "non_compliant",
        reason: `Last filing was ${irsRecord.mostRecentFilingDate}, exceeds ${FILING_LOOKBACK_MONTHS}-month window`,
        lastFilingDate: lastFiling,
        revocationDate: null,
      };
    }
  }

  // All checks passed
  return {
    status: "active",
    reason: "Organization is compliant",
    lastFilingDate: irsRecord.mostRecentFilingDate 
      ? new Date(irsRecord.mostRecentFilingDate) 
      : null,
    revocationDate: null,
  };
}

/**
 * Calculate the next verification date.
 */
export function calculateNextVerificationDate(
  status: "active" | "non_compliant" | "revoked",
  currentDate: Date = new Date()
): Date {
  const nextDate = new Date(currentDate);
  
  if (status === "active") {
    // Re-verify monthly for active partners
    nextDate.setDate(nextDate.getDate() + VERIFICATION_INTERVAL_DAYS);
  } else {
    // Re-verify more frequently for non-compliant partners
    nextDate.setDate(nextDate.getDate() + 7);
  }
  
  return nextDate;
}

// --- Database Operations ---

/**
 * Record a compliance check result in the database.
 */
export async function recordComplianceCheck(
  partnerId: string,
  result: ComplianceCheckResult
): Promise<void> {
  await query(
    `INSERT INTO compliance_checks (
      partner_id, check_type, status,
      irs_filing_status, last_990_filed_date, revocation_date, revocation_reason,
      irs_response, error_message, checked_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      partnerId,
      result.errorMessage ? "manual" : "monthly",
      result.status,
      result.filingStatus,
      result.lastFilingDate,
      result.revocationDate,
      result.revocationReason,
      JSON.stringify(result.irsResponse),
      result.errorMessage,
      "system",
    ]
  );
}

/**
 * Update partner compliance status and schedule next verification.
 */
export async function updatePartnerCompliance(
  partnerId: string,
  status: "active" | "non_compliant" | "revoked",
  lastFilingDate: Date | null,
  revocationDate: Date | null
): Promise<void> {
  const nextVerification = calculateNextVerificationDate(status);
  
  await query(
    `UPDATE charitable_partners 
     SET compliance_status = $1,
         last_verified_at = NOW(),
         next_verification_at = $2,
         last_filing_date = $3,
         revocation_date = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [status, nextVerification, lastFilingDate, revocationDate, partnerId]
  );
}

/**
 * Lock a partner's ledger (prevent transfers).
 */
export async function lockPartnerLedger(
  partnerId: string,
  reason: "non_compliant" | "revoked" | "manual",
  lockedBy: string = "system"
): Promise<void> {
  // Check if already locked
  const existing = await query(
    `SELECT id FROM partner_ledger_locks 
     WHERE partner_id = $1 AND is_active = true`,
    [partnerId]
  );

  if (existing.rows.length > 0) {
    return; // Already locked
  }

  await query(
    `INSERT INTO partner_ledger_locks (partner_id, lock_reason, locked_by)
     VALUES ($1, $2, $3)`,
    [partnerId, reason, lockedBy]
  );
}

/**
 * Check if a partner's ledger is locked.
 */
export async function isPartnerLedgerLocked(partnerId: string): Promise<boolean> {
  const result = await query(
    `SELECT id FROM partner_ledger_locks 
     WHERE partner_id = $1 AND is_active = true`,
    [partnerId]
  );
  
  return result.rows.length > 0;
}

/**
 * Get all partners needing verification.
 */
export async function getPartnersNeedingVerification(): Promise<Array<{
  id: string;
  name: string;
  ein: string;
  complianceStatus: string;
}>> {
  const result = await query(
    `SELECT id, name, ein, compliance_status 
     FROM charitable_partners 
     WHERE is_active = true 
       AND compliance_status != 'revoked'
       AND (next_verification_at IS NULL OR next_verification_at <= NOW())`
  );
  
  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    ein: row.ein,
    complianceStatus: row.compliance_status,
  }));
}
