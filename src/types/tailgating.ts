export type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IncidentStatus =
  "NEW" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";

export type CrossingDirection = "IN" | "OUT" | "UNKNOWN";

export type ProviderHealth = "HEALTHY" | "DEGRADED" | "DOWN";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface AccessControlDoor {
  id: string;
  name: string;
  building: string;
  locationDetails?: string;
  isActive: boolean;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface DoorConfiguration {
  doorId: string;
  cameraId: string;
  expectedCrossingCount: number;
  detectionWindowSeconds: number;
  confidenceThreshold: number; // 0.0 to 1.0
  alertSeverity: SecuritySeverity;
  alarmSimulationMode: boolean;
  evidenceRetentionDays: number;
  updatedAt: string;
}

export interface BadgeSwipe {
  id: string;
  doorId: string;
  badgeId: string;
  timestamp: string; // ISO date-time
  authorized: boolean;
  expectedCrossingCount: number;
  correlationId: string;
}

export interface CameraDevice {
  id: string;
  name: string;
  locationDetails?: string;
  ipAddress?: string;
  isActive: boolean;
  healthState: ProviderHealth;
  lastCheckedAt: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraFrameEvent {
  id: string;
  cameraId: string;
  doorId: string;
  timestamp: string;
  anonymousTrackId: string; // Anonymous ID only for short-lived tracking
  boundingBox?: BoundingBox;
  confidence: number; // 0.0 to 1.0
  direction: CrossingDirection;
}

export interface DetectionWindow {
  id: string;
  doorId: string;
  startTime: string;
  endTime: string;
  expectedCount: number;
  badgeSwipeId: string;
  isActive: boolean;
}

export interface PersonCrossing {
  anonymousTrackId: string;
  timestamp: string;
  confidence: number;
  direction: CrossingDirection;
}

export interface TailgatingDetection {
  id: string;
  doorId: string;
  cameraId: string;
  badgeSwipeId: string;
  timestamp: string;
  expectedCount: number;
  observedCount: number;
  confidence: number; // Average confidence of crossings
  isTailgatingDetected: boolean;
  observedCrossings: PersonCrossing[];
}

export interface EvidenceClip {
  id: string;
  detectionId: string;
  cameraId: string;
  startTime: string;
  endTime: string;
  storageReference: string; // Metadata/URL reference only (no raw data)
  retentionExpiration: string;
  accessAuthorizedState: boolean;
  createdAt: string;
}

export interface SecurityEvent {
  id: string;
  doorId: string;
  cameraId: string;
  timestamp: string;
  severity: SecuritySeverity;
  confidence: number;
  observedCount: number;
  expectedCount: number;
  correlationId: string;
  evidenceClipId?: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityAlert {
  id: string;
  incidentId: string;
  severity: SecuritySeverity;
  locationName: string;
  timestamp: string;
  observedCount: number;
  expectedCount: number;
  confidence: number;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AlarmAction {
  id: string;
  incidentId: string;
  doorId: string;
  actionType: "LOCALIZED_SIREN" | "LOCK_DOOR" | "FLASH_LIGHTS" | "LOG_ONLY";
  status: "PENDING" | "DISPATCHED" | "SUCCESS" | "FAILED";
  simulationMode: boolean;
  dispatchedAt?: string;
}

export interface NotificationDelivery {
  id: string;
  alertId: string;
  channel: "SECURITY_DASHBOARD" | "SMS" | "EMAIL" | "POLICE_DISPATCH";
  recipient: string;
  status: "DELIVERED" | "FAILED" | "PENDING";
  deliveredAt?: string;
}

export interface AuditLog {
  id: string;
  action: string; // e.g. "ACKNOWLEDGE_INCIDENT", "UPDATE_CONFIG"
  userId: string;
  userRole: string;
  timestamp: string;
  details: string; // JSON string or text summary
  ipAddress?: string;
}
