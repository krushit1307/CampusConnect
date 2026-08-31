/**
 * Radar Security Incident Service & State Machine Orchestrator (Issue #5139).
 *
 * Receives verified weapon detection radar threat events, creates security incidents,
 * executes emergency access-control door lockdown via CampusSafetyAccessControlService,
 * notifies authorized security personnel, and tracks complete audit trails.
 */

import { CampusSafetyAccessControlService } from "@/services/campusSafetyAccessControlService";
import { RadarSecurityIncident, RadarThreatEvent } from "@/types/radarSafety";

export class RadarSecurityIncidentService {
  private incidents: Map<string, RadarSecurityIncident> = new Map();

  /**
   * Processes a verified radar threat event and executes emergency incident lockdown pipeline.
   */
  public async processRadarThreatEvent(
    event: RadarThreatEvent,
    isSimulatedMode: boolean = false,
  ): Promise<RadarSecurityIncident> {
    const incidentId = `inc_radar_${event.building.replace(/\s+/g, "_")}_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const auditLogs: string[] = [];

    auditLogs.push(
      `[Radar Incident] Incident ${incidentId} created for ${event.building} (${event.checkpointId}).`,
    );
    auditLogs.push(
      `[Radar Incident] Threat level: ${event.threatSeverity} (Confidence: ${(event.confidenceScore * 100).toFixed(0)}%).`,
    );

    const incident: RadarSecurityIncident = {
      incidentId,
      externalEventId: event.eventId,
      provider: event.provider,
      venueId: event.venueId,
      building: event.building,
      checkpointId: event.checkpointId,
      threatSeverity: event.threatSeverity,
      status: "VALIDATED",
      detectedAtIso: event.detectedAtIso,
      validatedAtIso: nowIso,
      auditLogs,
      isSimulatedMode,
    };

    this.incidents.set(incidentId, incident);

    // Filter out low severity / unverified threats
    if (event.threatSeverity === "UNVERIFIED") {
      incident.status = "RESOLVED";
      auditLogs.push(
        "[Radar Incident] Event marked unverified. No access-control lockdown required.",
      );
      return incident;
    }

    // 1. Confirm Threat & Request Door Lockdown
    incident.status = "THREAT_CONFIRMED";
    incident.lockRequestedAtIso = new Date().toISOString();
    auditLogs.push(
      `[Access Control Integration] Requesting lockdown for building "${event.building}"...`,
    );

    try {
      // Execute access-control lockdown via CampusSafetyAccessControlService
      const lockdownResult = await CampusSafetyAccessControlService.lockDoors(event.building, {
        simulateNetworkBlackout: isSimulatedMode,
      });

      incident.accessControlMethod = lockdownResult.method;
      incident.doorsLockedCount = lockdownResult.doorsUpdated;

      lockdownResult.logs.forEach((log) => auditLogs.push(`  [AccessControl] ${log}`));

      if (lockdownResult.success) {
        incident.status = "LOCK_CONFIRMED";
        incident.lockConfirmedAtIso = new Date().toISOString();
        auditLogs.push(
          `[Access Control Integration] Lock confirmed! Method: ${lockdownResult.method}, Doors Locked: ${lockdownResult.doorsUpdated}.`,
        );
      } else {
        incident.status = "LOCK_FAILED";
        auditLogs.push(`[Warning] Access control lockdown incomplete or failed.`);
      }
    } catch (err: any) {
      incident.status = "LOCK_FAILED";
      auditLogs.push(
        `[Fatal Error] Access control execution threw exception: ${err.message || err}`,
      );
    }

    // 2. Dispatch Emergency Notification to Campus Security Personnel
    try {
      this.dispatchSecurityAlert(incident);
      incident.status =
        incident.status === "LOCK_CONFIRMED" ? "SECURITY_NOTIFIED" : incident.status;
      incident.securityNotifiedAtIso = new Date().toISOString();
      auditLogs.push(
        `[Security Notification] Emergency dispatch sent to Campus Police & Security Officers.`,
      );
    } catch (err: any) {
      auditLogs.push(`[Warning] Security notification dispatch failed: ${err.message || err}`);
    }

    this.incidents.set(incidentId, incident);
    return incident;
  }

  /**
   * Resets an active incident state to RESOLVED and unlocks doors for drills/clearance.
   */
  public async resolveIncident(incidentId: string): Promise<RadarSecurityIncident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    // Unlock building exterior doors
    await CampusSafetyAccessControlService.unlockAllDoors(incident.building);

    incident.status = "RESOLVED";
    incident.resolvedAtIso = new Date().toISOString();
    incident.auditLogs.push(
      `[Incident Resolution] Security clearance confirmed. All doors unlocked for "${incident.building}".`,
    );

    this.incidents.set(incidentId, incident);
    return incident;
  }

  /**
   * Dispatches alert to Campus Police & Security dispatchers.
   */
  private dispatchSecurityAlert(incident: RadarSecurityIncident) {
    console.info(`[SECURITY ALERT DISPATCH] *** CRITICAL WEAPON RADAR ALERT ***`);
    console.info(`Location: ${incident.building} (${incident.checkpointId})`);
    console.info(`Threat: ${incident.threatSeverity} | Status: ${incident.status}`);
  }

  public getIncidents(): RadarSecurityIncident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.detectedAtIso).getTime() - new Date(a.detectedAtIso).getTime(),
    );
  }

  public getIncidentById(incidentId: string): RadarSecurityIncident | null {
    return this.incidents.get(incidentId) ?? null;
  }
}

export const radarSecurityIncidentService = new RadarSecurityIncidentService();
