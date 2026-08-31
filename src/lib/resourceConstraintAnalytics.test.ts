import { describe, it, expect } from "vitest";
import {
  calculateResourceUtilizationAnalytics,
  ResourceBookingLog,
} from "./resourceConstraintAnalytics";

describe("Develop Dynamic Resource Constraint Usage Analytics Suite (#4485)", () => {
  const sampleLogs: ResourceBookingLog[] = [
    // Projector A1 (High usage & high conflicts)
    ...Array.from({ length: 45 }, (_, i) => ({
      id: `log_proj_b_${i}`,
      resourceId: "res_proj_a1",
      resourceName: "Projector A1",
      unitCost: 500,
      status: "booked" as const,
      requestedAtIso: "2026-08-20T10:00:00Z",
    })),
    ...Array.from({ length: 40 }, (_, i) => ({
      id: `log_proj_c_${i}`,
      resourceId: "res_proj_a1",
      resourceName: "Projector A1",
      unitCost: 500,
      status: "blocked_conflict" as const,
      requestedAtIso: "2026-08-20T11:00:00Z",
    })),
    // Secondary Projector (0 conflicts, low usage)
    {
      id: "log_proj_sec_1",
      resourceId: "res_proj_sec",
      resourceName: "Secondary Projector",
      unitCost: 400,
      status: "booked" as const,
      requestedAtIso: "2026-08-21T09:00:00Z",
    },
  ];

  it("calculates utilization scores and flags severe resource bottlenecks", () => {
    const analytics = calculateResourceUtilizationAnalytics(sampleLogs, 50);

    const mainProjector = analytics.find((r) => r.resourceId === "res_proj_a1");
    expect(mainProjector).toBeDefined();
    expect(mainProjector?.successfulBookings).toBe(45);
    expect(mainProjector?.blockedConflicts).toBe(40);
    expect(mainProjector?.utilizationPercentage).toBe(90.0);
    expect(mainProjector?.isSevereBottleneck).toBe(true);
  });

  it("generates automated purchasing recommendation insights for bottleneck assets", () => {
    const analytics = calculateResourceUtilizationAnalytics(sampleLogs, 50);
    const mainProjector = analytics.find((r) => r.resourceId === "res_proj_a1");

    expect(mainProjector?.purchasingInsight).toContain("Projector A1 is a severe bottleneck");
    expect(mainProjector?.purchasingInsight).toContain("causing 40 event delays");
    expect(mainProjector?.purchasingInsight).toContain(
      "Consider purchasing an additional unit for $500.",
    );
  });

  it("identifies underutilized assets without generating purchasing warnings", () => {
    const analytics = calculateResourceUtilizationAnalytics(sampleLogs, 50);
    const secProjector = analytics.find((r) => r.resourceId === "res_proj_sec");

    expect(secProjector?.isSevereBottleneck).toBe(false);
    expect(secProjector?.purchasingInsight).toBeNull();
  });
});
