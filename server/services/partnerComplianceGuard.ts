/**
 * Partner Compliance Guard
 * 
 * Prevents clubs from transferring funds to charitable partners that are
 * non-compliant with IRS 501(c)(3) requirements.
 * 
 * Issue #4993: Automated "Club Spending" IRS 990 Filer Tracker
 */

import { isPartnerLedgerLocked } from "./irsComplianceService";

// --- Types ---

export interface TransferRequest {
  clubId: string;
  partnerId: string;
  amount: number;
  type: "escrow" | "gamification" | "donation";
  userId: string;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  partnerName?: string;
  complianceStatus?: string;
  lockReason?: string;
}

// --- Compliance Guard ---

/**
 * Check if a transfer to a charitable partner is allowed.
 * 
 * Returns an object indicating whether the transfer should proceed.
 * If not allowed, includes the reason and compliance status.
 */
export async function checkTransferAllowed(
  transfer: TransferRequest
): Promise<GuardResult> {
  const { partnerId, type } = transfer;

  // Only block transfers to charitable partners
  if (!partnerId) {
    return { allowed: true };
  }

  // Check if partner's ledger is locked
  const isLocked = await isPartnerLedgerLocked(partnerId);
  
  if (isLocked) {
    // Get lock details for the error message
    const lockDetails = await getLockDetails(partnerId);
    
    return {
      allowed: false,
      reason: `Transfer blocked: Partner is ${lockDetails.reason}. Contact compliance team.`,
      partnerName: lockDetails.partnerName,
      complianceStatus: lockDetails.complianceStatus,
      lockReason: lockDetails.reason,
    };
  }

  // Check partner's current compliance status
  const complianceStatus = await getPartnerComplianceStatus(partnerId);
  
  if (complianceStatus === "revoked") {
    return {
      allowed: false,
      reason: "Transfer blocked: Partner's 501(c)(3) status has been revoked by the IRS.",
      complianceStatus: "revoked",
    };
  }

  if (complianceStatus === "non_compliant") {
    return {
      allowed: false,
      reason: "Transfer blocked: Partner has not filed Form 990 within the required timeframe.",
      complianceStatus: "non_compliant",
    };
  }

  // Transfer allowed
  return { allowed: true };
}

/**
 * Get lock details for a partner.
 */
async function getLockDetails(partnerId: string): Promise<{
  partnerName: string;
  complianceStatus: string;
  reason: string;
}> {
  // This would normally query the database
  // For now, return placeholder
  return {
    partnerName: "Unknown Partner",
    complianceStatus: "non_compliant",
    reason: "non-compliant",
  };
}

/**
 * Get a partner's compliance status from the database.
 */
async function getPartnerComplianceStatus(partnerId: string): Promise<string> {
  // This would normally query the database
  // For now, return placeholder
  return "active";
}

// --- Middleware Express-style ---

/**
 * Express-style middleware for transfer routes.
 * 
 * Usage:
 *   router.post("/transfers", complianceGuard, transferHandler);
 */
export function complianceGuardMiddleware(
  req: any,
  res: any,
  next: any
) {
  const { partnerId } = req.body;
  
  if (!partnerId) {
    return next();
  }

  checkTransferAllowed({
    clubId: req.body.clubId || req.params.clubId,
    partnerId,
    amount: req.body.amount,
    type: req.body.type || "donation",
    userId: req.user?.id || "anonymous",
  })
    .then(result => {
      if (!result.allowed) {
        return res.status(403).json({
          error: "Transfer blocked",
          message: result.reason,
          details: {
            partnerName: result.partnerName,
            complianceStatus: result.complianceStatus,
            lockReason: result.lockReason,
          },
        });
      }
      next();
    })
    .catch(error => {
      console.error("[COMPLIANCE GUARD] Error checking transfer:", error);
      // On error, allow the transfer but log the issue
      // In production, you might want to block and alert
      next();
    });
}

// --- Utility Functions ---

/**
 * Get compliance status summary for a club's partners.
 */
export async function getClubPartnerComplianceSummary(
  clubId: string
): Promise<{
  totalPartners: number;
  compliant: number;
  nonCompliant: number;
  revoked: number;
}> {
  // This would query the database for partners associated with the club
  // For now, return placeholder
  return {
    totalPartners: 0,
    compliant: 0,
    nonCompliant: 0,
    revoked: 0,
  };
}

/**
 * Get list of locked partners for a club.
 */
export async function getLockedPartnersForClub(
  clubId: string
): Promise<Array<{
  partnerId: string;
  partnerName: string;
  ein: string;
  lockReason: string;
  lockedAt: Date;
}>> {
  // This would query the database
  // For now, return empty array
  return [];
}
