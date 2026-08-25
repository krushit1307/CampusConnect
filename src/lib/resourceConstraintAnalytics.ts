export interface ResourceBookingLog {
  id: string;
  resourceId: string;
  resourceName: string;
  unitCost: number;
  status: "booked" | "blocked_conflict";
  requestedAtIso: string;
}

export interface ResourceUtilizationScore {
  resourceId: string;
  resourceName: string;
  totalRequests: number;
  successfulBookings: number;
  blockedConflicts: number;
  utilizationPercentage: number;
  isSevereBottleneck: boolean;
  purchasingInsight: string | null;
}

export const BOTTLENECK_CONFLICT_THRESHOLD = 15;
export const BOTTLENECK_UTILIZATION_THRESHOLD = 80.0;

/**
 * Calculates time-series resource utilization telemetry scores and automated purchasing insights.
 */
export function calculateResourceUtilizationAnalytics(
  logs: ResourceBookingLog[],
  totalAvailableSlots = 50,
): ResourceUtilizationScore[] {
  const resourceMap: Record<
    string,
    {
      name: string;
      unitCost: number;
      bookedCount: number;
      conflictCount: number;
    }
  > = {};

  for (const log of logs) {
    if (!resourceMap[log.resourceId]) {
      resourceMap[log.resourceId] = {
        name: log.resourceName,
        unitCost: log.unitCost,
        bookedCount: 0,
        conflictCount: 0,
      };
    }

    if (log.status === "booked") {
      resourceMap[log.resourceId].bookedCount++;
    } else if (log.status === "blocked_conflict") {
      resourceMap[log.resourceId].conflictCount++;
    }
  }

  const results: ResourceUtilizationScore[] = [];

  for (const [resourceId, data] of Object.entries(resourceMap)) {
    const totalRequests = data.bookedCount + data.conflictCount;
    const rawUtilization = (data.bookedCount / totalAvailableSlots) * 100;
    const utilizationPercentage = Number(Math.min(100, Math.max(0, rawUtilization)).toFixed(1));

    const isSevereBottleneck =
      data.conflictCount >= BOTTLENECK_CONFLICT_THRESHOLD ||
      utilizationPercentage >= BOTTLENECK_UTILIZATION_THRESHOLD;

    let purchasingInsight: string | null = null;
    if (isSevereBottleneck) {
      purchasingInsight = `${data.name} is a severe bottleneck, causing ${data.conflictCount} event delays. Consider purchasing an additional unit for $${data.unitCost.toLocaleString()}.`;
    }

    results.push({
      resourceId,
      resourceName: data.name,
      totalRequests,
      successfulBookings: data.bookedCount,
      blockedConflicts: data.conflictCount,
      utilizationPercentage,
      isSevereBottleneck,
      purchasingInsight,
    });
  }

  // Sort by highest conflict count descending for Bar Chart rendering
  return results.sort((a, b) => b.blockedConflicts - a.blockedConflicts);
}
