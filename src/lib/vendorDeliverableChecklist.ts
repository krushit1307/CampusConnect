export interface DeliverableItem {
  id: string;
  contractId: string;
  title: string;
  description?: string;
  vendorChecked: boolean;
  vendorCheckedAtIso?: string | null;
  organizerCountersigned: boolean;
  organizerCountersignedAtIso?: string | null;
}

export interface EscrowReleaseEvaluation {
  totalDeliverables: number;
  completedDeliverables: number;
  completionPercentage: number;
  isEscrowUnlocked: boolean;
  statusMessage: string;
}

/**
 * Computes mutual completion status and escrow release availability.
 */
export function evaluateDeliverableEscrowRelease(
  items: DeliverableItem[],
): EscrowReleaseEvaluation {
  if (items.length === 0) {
    return {
      totalDeliverables: 0,
      completedDeliverables: 0,
      completionPercentage: 0,
      isEscrowUnlocked: false,
      statusMessage: "No contract deliverables defined.",
    };
  }

  const completedDeliverables = items.filter(
    (item) => item.vendorChecked && item.organizerCountersigned,
  ).length;

  const rawPercentage = (completedDeliverables / items.length) * 100;
  const completionPercentage = Number(rawPercentage.toFixed(1));
  const isEscrowUnlocked = completedDeliverables === items.length;

  let statusMessage = `${completedDeliverables}/${items.length} deliverables mutually verified (${completionPercentage}%). Escrow locked.`;
  if (isEscrowUnlocked) {
    statusMessage = "100% of deliverables mutually verified! Escrow payment release unlocked.";
  }

  return {
    totalDeliverables: items.length,
    completedDeliverables,
    completionPercentage,
    isEscrowUnlocked,
    statusMessage,
  };
}

/**
 * Simulates toggling vendor checkmark or organizer countersignature on a deliverable item.
 */
export function signoffDeliverableItem(
  item: DeliverableItem,
  role: "vendor" | "organizer",
): DeliverableItem {
  const updated = { ...item };
  const now = new Date().toISOString();

  if (role === "vendor") {
    updated.vendorChecked = true;
    updated.vendorCheckedAtIso = now;
  } else if (role === "organizer") {
    updated.organizerCountersigned = true;
    updated.organizerCountersignedAtIso = now;
  }

  return updated;
}
