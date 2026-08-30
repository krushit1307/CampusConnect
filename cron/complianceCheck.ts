/**
 * Compliance Check Cron Job
 * 
 * Runs monthly to verify all charitable partners maintain valid 501(c)(3)
 * status and have filed Form 990 within the required timeframe.
 * 
 * Issue #4993: Automated "Club Spending" IRS 990 Filer Tracker
 */

import {
  queryIRSByEIN,
  evaluateCompliance,
  recordComplianceCheck,
  updatePartnerCompliance,
  lockPartnerLedger,
  getPartnersNeedingVerification,
  type ComplianceCheckResult,
} from "../server/services/irsComplianceService";
import { query } from "../db/client";

// --- Types ---

interface PartnerRecord {
  id: string;
  name: string;
  ein: string;
  compliance_status: string;
}

// --- Main Entry Point ---

/**
 * Process all charitable partners needing compliance verification.
 */
export const processComplianceChecks = async (): Promise<{
  checked: number;
  passed: number;
  failed: number;
  errors: number;
  locked: number;
}> {
  console.log("[COMPLIANCE] Starting monthly compliance check...");
  
  const stats = {
    checked: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    locked: 0,
  };

  try {
    // Get all partners needing verification
    const partners = await getPartnersNeedingVerification();
    console.log(`[COMPLIANCE] Found ${partners.length} partners to verify`);

    for (const partner of partners) {
      try {
        const result = await checkPartnerCompliance(partner.id, partner.ein);
        stats.checked++;
        
        if (result.status === "pass") {
          stats.passed++;
        } else if (result.status === "fail") {
          stats.failed++;
          
          // Lock ledger if non-compliant or revoked
          if (result.revocationDate || result.filingStatus === "03") {
            await lockPartnerLedger(partner.id, "revoked");
            stats.locked++;
            console.log(`[COMPLIANCE] 🔒 LOCKED partner ${partner.name} (EIN: ${partner.ein}) - REVOKED`);
          } else {
            await lockPartnerLedger(partner.id, "non_compliant");
            stats.locked++;
            console.log(`[COMPLIANCE] 🔒 LOCKED partner ${partner.name} (EIN: ${partner.ein}) - NON-COMPLIANT`);
          }
        } else {
          stats.errors++;
        }
      } catch (error) {
        stats.errors++;
        console.error(`[COMPLIANCE] Error checking partner ${partner.name}:`, error);
      }
    }

    // Log summary
    console.log(`[COMPLIANCE] Check complete: ${stats.checked} checked, ${stats.passed} passed, ${stats.failed} failed, ${stats.errors} errors, ${stats.locked} locked`);
    
    // Record summary in audit log
    await recordAuditLog(stats);
    
    return stats;
  } catch (error) {
    console.error("[COMPLIANCE] Fatal error in compliance check:", error);
    throw error;
  }
};

/**
 * Check compliance for a single partner.
 */
async function checkPartnerCompliance(
  partnerId: string,
  ein: string
): Promise<ComplianceCheckResult> {
  console.log(`[COMPLIANCE] Checking partner with EIN: ${ein}`);
  
  // Query IRS TEOS API
  const irsRecord = await queryIRSByEIN(ein);
  
  if (!irsRecord) {
    const result: ComplianceCheckResult = {
      partnerId,
      ein,
      status: "error",
      filingStatus: "unknown",
      lastFilingDate: null,
      revocationDate: null,
      revocationReason: null,
      irsResponse: null,
      errorMessage: "Organization not found in IRS database",
    };
    
    await recordComplianceCheck(partnerId, result);
    return result;
  }
  
  // Evaluate compliance
  const evaluation = evaluateCompliance(irsRecord);
  
  const result: ComplianceCheckResult = {
    partnerId,
    ein,
    status: evaluation.status === "active" ? "pass" : "fail",
    filingStatus: irsRecord.filingStatus || "01",
    lastFilingDate: evaluation.lastFilingDate,
    revocationDate: evaluation.revocationDate,
    revocationReason: evaluation.reason,
    irsResponse: irsRecord,
    errorMessage: null,
  };
  
  // Record check in database
  await recordComplianceCheck(partnerId, result);
  
  // Update partner status
  await updatePartnerCompliance(
    partnerId,
    evaluation.status,
    evaluation.lastFilingDate,
    evaluation.revocationDate
  );
  
  return result;
}

/**
 * Record compliance check summary in audit log.
 */
async function recordAuditLog(stats: {
  checked: number;
  passed: number;
  failed: number;
  errors: number;
  locked: number;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (action, details, created_at)
       VALUES ($1, $2, NOW())`,
      [
        "COMPLIANCE_CHECK_COMPLETE",
        JSON.stringify({
          checked: stats.checked,
          passed: stats.passed,
          failed: stats.failed,
          errors: stats.errors,
          locked: stats.locked,
        }),
      ]
    );
  } catch (error) {
    console.error("[COMPLIANCE] Failed to record audit log:", error);
  }
}

// --- Manual Trigger ---

/**
 * Manually trigger a compliance check for a specific partner.
 */
export const manuallyCheckPartner = async (
  partnerId: string,
  ein: string,
  triggeredBy: string
): Promise<ComplianceCheckResult> => {
  console.log(`[COMPLIANCE] Manual check triggered by ${triggeredBy} for partner ${partnerId}`);
  
  const result = await checkPartnerCompliance(partnerId, ein);
  
  // Record manual trigger
  await query(
    `INSERT INTO compliance_checks (partner_id, check_type, status, checked_by)
     VALUES ($1, 'manual', $2, $3)`,
    [partnerId, result.status, triggeredBy]
  );
  
  return result;
};

// --- CLI Runner ---

/**
 * Run as standalone script.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  processComplianceChecks()
    .then(stats => {
      console.log("Compliance check completed:", stats);
      process.exit(0);
    })
    .catch(error => {
      console.error("Compliance check failed:", error);
      process.exit(1);
    });
}
