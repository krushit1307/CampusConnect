// =============================================================================
// Vendor Bidding Escrow Tracker (#4423)
// Maps vendor_contracts financial state onto a 3-stage timeline and stamps
// each reached transition with a SHA-256 cryptographic timestamp.
// =============================================================================

import { sha256Hex } from "./steganography";

export type EscrowStageId = "ledger" | "escrow" | "released";

export interface VendorEscrowContract {
  id: string;
  vendor_name: string;
  amount: number;
  created_at: string;
  escrow_locked_at: string | null;
  released_at: string | null;
}

export interface EscrowTimelineStep {
  id: EscrowStageId;
  label: string;
  reached: boolean;
  current: boolean;
  timestamp: string | null;
  cryptographicTimestamp: string | null;
}

const STAGE_ORDER: EscrowStageId[] = ["ledger", "escrow", "released"];

const STAGE_LABELS: Record<EscrowStageId, string> = {
  ledger: "Funds in Club Ledger",
  escrow: "Funds Locked in Platform Escrow",
  released: "Funds Released to Vendor",
};

export function resolveEscrowStage(contract: VendorEscrowContract): EscrowStageId {
  if (contract.released_at) return "released";
  if (contract.escrow_locked_at) return "escrow";
  return "ledger";
}

export function formatEscrowAmount(amount: number): string {
  const dollars = Number(amount) || 0;
  if (Number.isInteger(dollars)) return `$${dollars}`;
  return `$${dollars.toFixed(2)}`;
}

export function buildEscrowAssuranceMessage(contract: VendorEscrowContract): string {
  const amount = formatEscrowAmount(contract.amount);
  const vendor = contract.vendor_name?.trim() || "vendor";
  const stage = resolveEscrowStage(contract);

  if (stage === "escrow") {
    return `Your ${amount} is currently locked safely in the Stripe Escrow vault. The ${vendor} cannot access it until you scan their QR code on the day of the event.`;
  }
  if (stage === "released") {
    return `Your ${amount} has been released to the ${vendor}.`;
  }
  return `Your ${amount} is currently in the club ledger.`;
}

export async function applyCryptographicTimestamp(
  contractId: string,
  stage: EscrowStageId,
  timestamp: string,
): Promise<string> {
  return sha256Hex(`${contractId}:${stage}:${timestamp}`);
}

function timestampForStage(contract: VendorEscrowContract, stage: EscrowStageId): string | null {
  if (stage === "ledger") return contract.created_at;
  if (stage === "escrow") return contract.escrow_locked_at;
  return contract.released_at;
}

export async function mapVendorEscrowTimeline(
  contract: VendorEscrowContract,
): Promise<EscrowTimelineStep[]> {
  const current = resolveEscrowStage(contract);
  const currentIndex = STAGE_ORDER.indexOf(current);

  return Promise.all(
    STAGE_ORDER.map(async (id, index) => {
      const timestamp = timestampForStage(contract, id);
      const reached = index <= currentIndex && Boolean(timestamp);
      return {
        id,
        label: STAGE_LABELS[id],
        reached,
        current: id === current,
        timestamp,
        cryptographicTimestamp:
          reached && timestamp
            ? await applyCryptographicTimestamp(contract.id, id, timestamp)
            : null,
      };
    }),
  );
}
