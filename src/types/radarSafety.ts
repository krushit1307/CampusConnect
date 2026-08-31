/**
 * Data Models & Types for Real-Time Weapon Detection Radar Emergency Door Locking (Issue #5139).
 */

export type RadarThreatSeverity =
  "WEAPON_DETECTED" | "HIGH_RISK" | "SUSPICIOUS_OBJECT" | "UNVERIFIED";

export type RadarProviderType = "evolv_radar" | "liberty_defense" | "generic_radar";

export type RadarIncidentState =
  | "RECEIVED"
  | "VALIDATED"
  | "THREAT_CONFIRMED"
  | "LOCK_REQUESTED"
  | "LOCK_CONFIRMED"
  | "SECURITY_NOTIFIED"
  | "RESOLVED"
  | "INVALID_WEBHOOK"
  | "DUPLICATE_EVENT"
  | "LOCK_FAILED"
  | "NOTIFICATION_FAILED";

export interface RadarThreatEvent {
  eventId: string;
  provider: RadarProviderType;
  venueId: string;
  building: string;
  checkpointId: string;
  threatSeverity: RadarThreatSeverity;
  confidenceScore: number; // 0.0 to 1.0
  detectedAtIso: string;
  rawSignature?: string;
  payloadHash?: string;
}

export interface SecurityIncidentRecord {
  incidentId: string;
  externalEventId: string;
  provider: RadarProviderType;
  venueId: string;
  building: string;
  checkpointId: string;
  threatSeverity: RadarThreatSeverity;
  status: RadarIncidentState;
  accessControlMethod?: "REST" | "LORAWAN";
  doorsLockedCount?: number;
  detectedAtIso: string;
  validatedAtIso?: string;
  lockRequestedAtIso?: string;
  lockConfirmedAtIso?: string;
  securityNotifiedAtIso?: string;
  resolvedAtIso?: string;
  auditLogs: string[];
  isSimulatedMode: boolean;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: string;
  event?: RadarThreatEvent;
}
