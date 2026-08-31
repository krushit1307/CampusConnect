import { describe, it, expect, beforeEach, vi } from "vitest";
import { RadarSecurityIncidentService } from "../incident/radarSecurityIncidentService";
import { RadarThreatEvent } from "@/types/radarSafety";
import { CampusSafetyAccessControlService } from "@/services/campusSafetyAccessControlService";

describe("RadarSecurityIncidentService", () => {
  let service: RadarSecurityIncidentService;

  beforeEach(() => {
    service = new RadarSecurityIncidentService();

    // Mock CampusSafetyAccessControlService.lockDoors & unlockAllDoors
    vi.spyOn(CampusSafetyAccessControlService, "lockDoors").mockResolvedValue({
      success: true,
      method: "REST",
      logs: ["REST API connected", "Locked 3 doors"],
      doorsUpdated: 3,
    });

    vi.spyOn(CampusSafetyAccessControlService, "unlockAllDoors").mockResolvedValue(true);
  });

  it("processes verified weapon detection event, locks building doors, and dispatches security alert", async () => {
    const event: RadarThreatEvent = {
      eventId: "radar_evt_999",
      provider: "evolv_radar",
      venueId: "v_science_quad",
      building: "Science Building",
      checkpointId: "cp_north_entrance",
      threatSeverity: "WEAPON_DETECTED",
      confidenceScore: 0.98,
      detectedAtIso: new Date().toISOString(),
    };

    const incident = await service.processRadarThreatEvent(event, false);

    expect(incident.status).toBe("SECURITY_NOTIFIED");
    expect(incident.doorsLockedCount).toBe(3);
    expect(incident.accessControlMethod).toBe("REST");
    expect(incident.auditLogs.length).toBeGreaterThan(0);

    expect(CampusSafetyAccessControlService.lockDoors).toHaveBeenCalledWith("Science Building", {
      simulateNetworkBlackout: false,
    });
  });

  it("resolves incident and unlocks building doors upon security clearance", async () => {
    const event: RadarThreatEvent = {
      eventId: "radar_evt_888",
      provider: "generic_radar",
      venueId: "v_library",
      building: "Library Building",
      checkpointId: "cp_main_turnstile",
      threatSeverity: "HIGH_RISK",
      confidenceScore: 0.92,
      detectedAtIso: new Date().toISOString(),
    };

    const incident = await service.processRadarThreatEvent(event, false);
    const resolved = await service.resolveIncident(incident.incidentId);

    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAtIso).toBeDefined();
    expect(CampusSafetyAccessControlService.unlockAllDoors).toHaveBeenCalledWith(
      "Library Building",
    );
  });
});
