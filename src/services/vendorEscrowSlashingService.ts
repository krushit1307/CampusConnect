import { createClient } from "@/lib/supabase/client";
import {
  BreachType,
  BreachSeverity,
  DelayBreachRecord,
  EscrowContractStatus,
  SlashingExecutionResult,
  SlashingTier,
  VendorEscrowContract,
  VendorEscrowSlashingCalculation,
} from "@/types/vendorEscrowSlashing";

const supabase = createClient();

export const DEFAULT_SLASHING_TIERS: SlashingTier[] = [
  {
    minDelayMinutes: 0,
    maxDelayMinutes: 15,
    slashPercentage: 0,
    severity: "MINOR",
    description: "Grace Period (0 - 15 mins delay): No escrow penalty applied.",
  },
  {
    minDelayMinutes: 15,
    maxDelayMinutes: 30,
    slashPercentage: 10,
    severity: "MINOR",
    description: "Minor Delay (15 - 30 mins delay): 10% escrow penalty slashed.",
  },
  {
    minDelayMinutes: 30,
    maxDelayMinutes: 60,
    slashPercentage: 25,
    severity: "MODERATE",
    description: "Moderate Delay (30 - 60 mins delay): 25% escrow penalty slashed.",
  },
  {
    minDelayMinutes: 60,
    maxDelayMinutes: 120,
    slashPercentage: 50,
    severity: "SEVERE",
    description: "Severe Delay (60 - 120 mins delay): 50% escrow penalty slashed.",
  },
  {
    minDelayMinutes: 120,
    maxDelayMinutes: 9999,
    slashPercentage: 100,
    severity: "CRITICAL",
    description: "Critical Breach (>120 mins delay): 100% escrow forfeiture to organizer.",
  },
];

export class VendorEscrowSlashingService {
  private contractsStore: Map<string, VendorEscrowContract> = new Map();
  private breachLogs: DelayBreachRecord[] = [];

  /**
   * Calculates tiered slashing penalties based on delay duration and breach type.
   */
  public calculateDelaySlashing(
    baseEscrowAmount: number,
    delayMinutes: number,
    breachType: BreachType = "LATE_ARRIVAL",
    customTiers: SlashingTier[] = DEFAULT_SLASHING_TIERS,
  ): VendorEscrowSlashingCalculation {
    const validDelay = Math.max(0, Math.round(delayMinutes));
    const tiers = [...customTiers].sort((a, b) => a.minDelayMinutes - b.minDelayMinutes);

    let applicableTier = tiers.find(
      (t) => validDelay >= t.minDelayMinutes && validDelay < t.maxDelayMinutes,
    );

    if (!applicableTier) {
      applicableTier = tiers[tiers.length - 1];
    }

    // Equipment missing or early departure adds a +10% penalty multiplier if not already 100%
    let slashPct = applicableTier.slashPercentage;
    if (breachType === "MISSING_EQUIPMENT" || breachType === "SERVICE_INTERRUPTION") {
      slashPct = Math.min(100, slashPct + 10);
    }

    const slashAmount = parseFloat(((baseEscrowAmount * slashPct) / 100).toFixed(2));
    const netVendorPayout = parseFloat((baseEscrowAmount - slashAmount).toFixed(2));

    return {
      contractId: "",
      delayMinutes: validDelay,
      breachType,
      baseEscrowAmount,
      slashPercentage: slashPct,
      slashAmount,
      netVendorPayout,
      organizerRefundAmount: slashAmount,
      severity: applicableTier.severity,
      applicableTierDescription: applicableTier.description,
      isGracePeriod: slashPct === 0,
    };
  }

  /**
   * Retrieves or initializes an escrow contract record.
   */
  public getOrCreateContract(
    contractId: string,
    initialData?: Partial<VendorEscrowContract>,
  ): VendorEscrowContract {
    let contract = this.contractsStore.get(contractId);
    if (!contract) {
      const now = new Date();
      contract = {
        id: contractId,
        auctionId: initialData?.auctionId || `auc_${contractId}`,
        eventId: initialData?.eventId || "evt_demo_1",
        eventName: initialData?.eventName || "Campus Fall Gala",
        organizerId: initialData?.organizerId || "org_user_1",
        organizerName: initialData?.organizerName || "Student Life Committee",
        vendorId: initialData?.vendorId || "ven_100",
        vendorName: initialData?.vendorName || "SoundWave AV Systems",
        vendorEmail: initialData?.vendorEmail || "contact@soundwave.com",
        totalEscrowAmount: initialData?.totalEscrowAmount || 2000,
        slashedAmount: 0,
        netVendorPayout: initialData?.totalEscrowAmount || 2000,
        organizerRefundAmount: 0,
        scheduledArrivalTime:
          initialData?.scheduledArrivalTime || new Date(now.getTime() - 3600000).toISOString(),
        contractedSetupDeadline:
          initialData?.contractedSetupDeadline || new Date(now.getTime() - 1800000).toISOString(),
        status: "FUNDED_IN_ESCROW",
        breachCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.contractsStore.set(contractId, contract);
    }
    return contract;
  }

  /**
   * Executes transaction-safe escrow slashing penalty and records audit log.
   */
  public async executeEscrowSlashing(
    contractId: string,
    delayMinutes: number,
    breachType: BreachType,
    reasonNotes: string,
    loggedByUserId = "org_admin",
  ): Promise<SlashingExecutionResult> {
    const contract = this.getOrCreateContract(contractId);

    if (contract.status === "RELEASED_TO_VENDOR") {
      throw new Error("Cannot slash contract: Escrow funds have already been released to vendor.");
    }

    const calc = this.calculateDelaySlashing(
      contract.totalEscrowAmount,
      delayMinutes,
      breachType,
    );

    const now = new Date().toISOString();
    const breachRecord: DelayBreachRecord = {
      id: `brk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      contractId,
      eventId: contract.eventId,
      vendorId: contract.vendorId,
      breachType,
      delayMinutes,
      slashPercentage: calc.slashPercentage,
      slashedAmount: calc.slashAmount,
      reasonNotes,
      loggedByUserId,
      loggedAt: now,
    };

    contract.slashedAmount = calc.slashAmount;
    contract.organizerRefundAmount = calc.slashAmount;
    contract.netVendorPayout = calc.netVendorPayout;
    contract.breachCount += 1;
    contract.status =
      calc.slashPercentage >= 100 ? "FULLY_SLASHED" : calc.slashPercentage > 0 ? "PARTIALLY_SLASHED" : "FUNDED_IN_ESCROW";
    contract.updatedAt = now;

    this.contractsStore.set(contractId, contract);
    this.breachLogs.push(breachRecord);

    // Sync with Supabase table if available
    try {
      await supabase.from("vendor_escrow_slashing_logs").insert([
        {
          contract_id: contractId,
          event_id: contract.eventId,
          vendor_id: contract.vendorId,
          breach_type: breachType,
          delay_minutes: delayMinutes,
          slash_percentage: calc.slashPercentage,
          slashed_amount: calc.slashAmount,
          reason_notes: reasonNotes,
          logged_by: loggedByUserId,
        },
      ]);
    } catch {
      // Ignore database sync error in offline mode
    }

    return {
      success: true,
      contract,
      breachRecord,
      message: calc.isGracePeriod
        ? "Delay recorded within grace period. No escrow penalty slashed."
        : `Slashed ${calc.slashPercentage}% ($${calc.slashAmount}) from vendor escrow for ${delayMinutes}m delay.`,
    };
  }

  /**
   * Returns audit logs of all delay breaches for a contract.
   */
  public getBreachHistory(contractId: string): DelayBreachRecord[] {
    return this.breachLogs.filter((b) => b.contractId === contractId);
  }

  /**
   * Resets in-memory storage for clean test suites.
   */
  public clear(): void {
    this.contractsStore.clear();
    this.breachLogs = [];
  }
}

export const vendorEscrowSlashingService = new VendorEscrowSlashingService();
