import { createClient } from "../lib/supabase/client";
import {
  AccessControlDoor,
  DoorConfiguration,
  BadgeSwipe,
  CameraDevice,
  CameraFrameEvent,
  DetectionWindow,
  PersonCrossing,
  TailgatingDetection,
  SecurityEvent,
  SecurityAlert,
  AlarmAction,
  EvidenceClip,
  IncidentStatus,
  ProviderHealth,
  AuditLog,
  SecuritySeverity,
} from "../types/tailgating";

const supabase = createClient();

// In-memory caches to manage active windows and temporary tracking states
const activeWindows = new Map<string, DetectionWindow>();
const processedBadges = new Set<string>(); // duplicate suppression cache
const processedFrames = new Set<string>(); // duplicate frame track suppression cache
const activeObservations = new Map<string, PersonCrossing[]>(); // doorId -> PersonCrossing[]

// Mock lists for demo/development when DB records don't exist
const mockDoors: AccessControlDoor[] = [
  {
    id: "door-1111-2222-3333-4444",
    name: "North Science Lab Lobby",
    building: "Science Hall",
    locationDetails: "First floor main entry door",
    isActive: true,
    latitude: 30.3564,
    longitude: 76.3647,
    createdAt: new Date().toISOString(),
  },
  {
    id: "door-5555-6666-7777-8888",
    name: "Engineering Library Rear",
    building: "Engineering Block",
    locationDetails: "Ground floor basement gate",
    isActive: true,
    latitude: 30.3599,
    longitude: 76.3621,
    createdAt: new Date().toISOString(),
  },
];

const mockDoorConfigs: DoorConfiguration[] = [
  {
    doorId: "door-1111-2222-3333-4444",
    cameraId: "cam-lobby-01",
    expectedCrossingCount: 1,
    detectionWindowSeconds: 5,
    confidenceThreshold: 0.75,
    alertSeverity: "HIGH",
    alarmSimulationMode: true,
    evidenceRetentionDays: 7,
    updatedAt: new Date().toISOString(),
  },
  {
    doorId: "door-5555-6666-7777-8888",
    cameraId: "cam-basement-02",
    expectedCrossingCount: 1,
    detectionWindowSeconds: 8,
    confidenceThreshold: 0.65,
    alertSeverity: "CRITICAL",
    alarmSimulationMode: true,
    evidenceRetentionDays: 14,
    updatedAt: new Date().toISOString(),
  },
];

const mockCameras: CameraDevice[] = [
  {
    id: "cam-lobby-01",
    name: "High-Definition Entry Lobby Camera",
    locationDetails: "Mounted above Science Lab lobby entry doors",
    isActive: true,
    healthState: "HEALTHY",
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: "cam-basement-02",
    name: "Thermal Motion Camera",
    locationDetails: "Mounted above Engineering basement door threshold",
    isActive: true,
    healthState: "HEALTHY",
    lastCheckedAt: new Date().toISOString(),
  },
];

let mockIncidents: SecurityEvent[] = [];
let mockAlerts: SecurityAlert[] = [];
let mockAlarms: AlarmAction[] = [];
let mockClips: EvidenceClip[] = [];
let mockAuditLogs: AuditLog[] = [];
let mockProviderHealths: Record<string, ProviderHealth> = {
  access_control: "HEALTHY",
  camera_counting: "HEALTHY",
  alarms: "HEALTHY",
  notifications: "HEALTHY",
};

export const tailgatingService = {
  // --- MOCK INVENTORY MANAGEMENT FOR DEMO & TESTING ---
  resetMockState() {
    mockIncidents = [];
    mockAlerts = [];
    mockAlarms = [];
    mockClips = [];
    mockAuditLogs = [];
    activeWindows.clear();
    processedBadges.clear();
    processedFrames.clear();
    activeObservations.clear();
    mockProviderHealths = {
      access_control: "HEALTHY",
      camera_counting: "HEALTHY",
      alarms: "HEALTHY",
      notifications: "HEALTHY",
    };
  },

  async getDoors(): Promise<AccessControlDoor[]> {
    try {
      const { data, error } = await supabase.from("access_control_doors").select("*");
      if (error || !data || data.length === 0) return mockDoors;
      return data;
    } catch {
      return mockDoors;
    }
  },

  async getDoorConfigurations(): Promise<DoorConfiguration[]> {
    try {
      const { data, error } = await supabase.from("door_configurations").select("*");
      if (error || !data || data.length === 0) return mockDoorConfigs;
      return data;
    } catch {
      return mockDoorConfigs;
    }
  },

  async saveDoorConfiguration(config: DoorConfiguration, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from("door_configurations").upsert(config);
      if (error) {
        // Fallback modification of mock configs
        const idx = mockDoorConfigs.findIndex((c) => c.doorId === config.doorId);
        if (idx !== -1) mockDoorConfigs[idx] = config;
        else mockDoorConfigs.push(config);
      }
      await this.logAudit(
        "UPDATE_CONFIGURATION",
        userId,
        `Updated settings for door: ${config.doorId}`,
      );
      return true;
    } catch {
      const idx = mockDoorConfigs.findIndex((c) => c.doorId === config.doorId);
      if (idx !== -1) mockDoorConfigs[idx] = config;
      else mockDoorConfigs.push(config);
      await this.logAudit(
        "UPDATE_CONFIGURATION",
        userId,
        `Updated settings for door: ${config.doorId} (mock)`,
      );
      return true;
    }
  },

  async getCameras(): Promise<CameraDevice[]> {
    try {
      const { data, error } = await supabase.from("camera_devices").select("*");
      if (error || !data || data.length === 0) return mockCameras;
      return data;
    } catch {
      return mockCameras;
    }
  },

  // --- ACCESS CONTROL INGESTION ---
  async ingestBadgeSwipe(swipeParams: Omit<BadgeSwipe, "id">): Promise<BadgeSwipe> {
    // 1. Duplicate-event protection (1-second suppression rule)
    const idempotencyKey = `${swipeParams.badgeId}:${swipeParams.doorId}:${swipeParams.timestamp.substring(0, 19)}`;
    if (processedBadges.has(idempotencyKey)) {
      throw new Error(`Duplicate badge event detected and suppressed for key: ${idempotencyKey}`);
    }
    processedBadges.add(idempotencyKey);

    // 2. Provider Health check verification
    if (mockProviderHealths.access_control === "DOWN") {
      throw new Error("Access-control provider is offline. Ingestion rejected.");
    }

    const swipe: BadgeSwipe = {
      ...swipeParams,
      id: `swipe-${Math.random().toString(36).substring(2, 9)}`,
    };

    // If authorized, open the short-lived Detection Window
    if (swipe.authorized) {
      this.openDetectionWindow(swipe);
    }

    return swipe;
  },

  // --- CAMERA / OBSERVATION INGESTION ---
  async ingestCameraFrame(frameParams: Omit<CameraFrameEvent, "id">): Promise<CameraFrameEvent> {
    // Duplicate frame protection for identical anonymous tracks within the same second
    const frameKey = `${frameParams.cameraId}:${frameParams.anonymousTrackId}:${frameParams.timestamp.substring(0, 19)}`;
    if (processedFrames.has(frameKey)) {
      return { ...frameParams, id: `frame-dup` };
    }
    processedFrames.add(frameKey);

    if (mockProviderHealths.camera_counting === "DOWN") {
      throw new Error("Camera people-counting provider is offline. Ingestion rejected.");
    }

    const frame: CameraFrameEvent = {
      ...frameParams,
      id: `frame-${Math.random().toString(36).substring(2, 9)}`,
    };

    // Add observation to the active queue for the configured door
    const currentList = activeObservations.get(frame.doorId) || [];
    currentList.push({
      anonymousTrackId: frame.anonymousTrackId,
      timestamp: frame.timestamp,
      confidence: frame.confidence,
      direction: frame.direction,
    });
    activeObservations.set(frame.doorId, currentList);

    // Check if we have an active window and evaluate immediately if window bounds are met
    const window = activeWindows.get(frame.doorId);
    if (window && window.isActive) {
      const now = new Date();
      const end = new Date(window.endTime);
      if (now >= end) {
        await this.closeAndEvaluateWindow(frame.doorId);
      }
    } else {
      // Out of window crossings: Possible unauthorized tailgating entry (no badge swipe opened a window!)
      if (frame.direction === "IN" && frame.confidence >= 0.6) {
        await this.handleUnauthorizedCrossing(frame);
      }
    }

    return frame;
  },

  // --- DETECTION WINDOW MANAGEMENT & ENGINE ---
  openDetectionWindow(swipe: BadgeSwipe) {
    const config = mockDoorConfigs.find((c) => c.doorId === swipe.doorId) || {
      detectionWindowSeconds: 5,
    };

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + config.detectionWindowSeconds * 1000);

    const window: DetectionWindow = {
      id: `win-${Math.random().toString(36).substring(2, 9)}`,
      doorId: swipe.doorId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      expectedCount: swipe.expectedCrossingCount,
      badgeSwipeId: swipe.id,
      isActive: true,
    };

    // Store active window and clean observations queue for the door
    activeWindows.set(swipe.doorId, window);
    activeObservations.set(swipe.doorId, []);

    // Set automatic self-closing timer to prevent windows from staying open indefinitely
    setTimeout(async () => {
      await this.closeAndEvaluateWindow(swipe.doorId);
    }, config.detectionWindowSeconds * 1000);
  },

  async closeAndEvaluateWindow(doorId: string): Promise<TailgatingDetection | null> {
    const window = activeWindows.get(doorId);
    if (!window || !window.isActive) return null;

    window.isActive = false; // close the window

    // Retrieve door config
    const config = mockDoorConfigs.find((c) => c.doorId === doorId) || {
      confidenceThreshold: 0.7,
      cameraId: "cam-unknown",
    };

    // Grab accumulated observations
    const observations = activeObservations.get(doorId) || [];

    // Filter distinct crossings meeting confidence levels and heading "IN" (Entry direction)
    const distinctCrossingsMap = new Map<string, PersonCrossing>();
    observations.forEach((obs) => {
      // Exclude exits and low-confidence readings
      if (obs.direction === "IN" && obs.confidence >= config.confidenceThreshold) {
        const existing = distinctCrossingsMap.get(obs.anonymousTrackId);
        if (!existing || obs.confidence > existing.confidence) {
          distinctCrossingsMap.set(obs.anonymousTrackId, obs);
        }
      }
    });

    const distinctCrossings = Array.from(distinctCrossingsMap.values());
    const observedCount = distinctCrossings.length;
    const avgConfidence =
      observedCount > 0
        ? distinctCrossings.reduce((sum, c) => sum + c.confidence, 0) / observedCount
        : 1.0;

    const isTailgatingDetected = observedCount > window.expectedCount;

    const detection: TailgatingDetection = {
      id: `det-${Math.random().toString(36).substring(2, 9)}`,
      doorId: window.doorId,
      cameraId: config.cameraId,
      badgeSwipeId: window.badgeSwipeId,
      timestamp: new Date().toISOString(),
      expectedCount: window.expectedCount,
      observedCount,
      confidence: parseFloat(avgConfidence.toFixed(2)),
      isTailgatingDetected,
      observedCrossings: distinctCrossings,
    };

    // Attempt database insert
    try {
      await supabase.from("tailgating_detections").insert({
        door_id: detection.doorId,
        camera_id: detection.cameraId,
        badge_swipe_id: detection.badgeSwipeId,
        timestamp: detection.timestamp,
        expected_count: detection.expectedCount,
        observed_count: detection.observedCount,
        confidence: detection.confidence,
        is_tailgating_detected: detection.isTailgatingDetected,
        observed_crossings: detection.observedCrossings,
      });
    } catch {
      // Mock db insertion warning ignored in dev/offline
    }

    // Trigger incident pipeline if tailgating is detected
    if (isTailgatingDetected) {
      await this.createSecurityIncident(detection, "TAILGATING_BREACH");
    } else if (observedCount === 0) {
      // Missing crossing rule
      await this.createSecurityIncident(detection, "MISSING_CROSSING");
    }

    // Clean active states
    activeWindows.delete(doorId);
    activeObservations.delete(doorId);

    return detection;
  },

  async handleUnauthorizedCrossing(frame: CameraFrameEvent) {
    // A crossing head "IN" occurred with no corresponding active badge swipe window
    const detection: TailgatingDetection = {
      id: `det-unauth-${Math.random().toString(36).substring(2, 9)}`,
      doorId: frame.doorId,
      cameraId: frame.cameraId,
      badgeSwipeId: "NONE",
      timestamp: frame.timestamp,
      expectedCount: 0,
      observedCount: 1,
      confidence: frame.confidence,
      isTailgatingDetected: true,
      observedCrossings: [
        {
          anonymousTrackId: frame.anonymousTrackId,
          timestamp: frame.timestamp,
          confidence: frame.confidence,
          direction: frame.direction,
        },
      ],
    };

    await this.createSecurityIncident(detection, "UNAUTHORIZED_CROSSING");
  },

  // --- SECURITY EVENT PIPELINE & ALARM ACTION DISPATCH ---
  async createSecurityIncident(detection: TailgatingDetection, ruleType: string) {
    const config = mockDoorConfigs.find((c) => c.doorId === detection.doorId) || {
      alertSeverity: "HIGH",
      alarmSimulationMode: true,
      evidenceRetentionDays: 7,
    };

    // Setup evidence reference (no raw video copy, metadata references only)
    const clipExpiration = new Date();
    clipExpiration.setDate(clipExpiration.getDate() + config.evidenceRetentionDays);

    const clip: EvidenceClip = {
      id: `clip-${Math.random().toString(36).substring(2, 9)}`,
      detectionId: detection.id,
      cameraId: detection.cameraId,
      startTime: new Date(new Date(detection.timestamp).getTime() - 5000).toISOString(),
      endTime: new Date(new Date(detection.timestamp).getTime() + 5000).toISOString(),
      storageReference: `clips/anom_${detection.cameraId}_${detection.timestamp.replace(/[:.]/g, "")}.mp4`,
      retentionExpiration: clipExpiration.toISOString(),
      accessAuthorizedState: false,
      createdAt: new Date().toISOString(),
    };
    mockClips.push(clip);

    const severity: SecuritySeverity =
      ruleType === "UNAUTHORIZED_CROSSING" ? "HIGH" : (config.alertSeverity as SecuritySeverity);

    const incident: SecurityEvent = {
      id: `evt-${Math.random().toString(36).substring(2, 9)}`,
      doorId: detection.doorId,
      cameraId: detection.cameraId,
      timestamp: detection.timestamp,
      severity,
      confidence: detection.confidence,
      observedCount: detection.observedCount,
      expectedCount: detection.expectedCount,
      correlationId: detection.badgeSwipeId,
      evidenceClipId: clip.id,
      status: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockIncidents.push(incident);

    // Save incident to database
    try {
      await supabase.from("security_events").insert({
        id: incident.id,
        door_id: incident.doorId,
        camera_id: incident.cameraId,
        timestamp: incident.timestamp,
        severity: incident.severity,
        confidence: incident.confidence,
        observed_count: incident.observedCount,
        expected_count: incident.expectedCount,
        correlation_id: incident.correlationId,
        evidence_clip_id: incident.evidenceClipId,
        status: incident.status,
      });
    } catch {
      // Fallback
    }

    // Trigger local alarms (Defensive Actions - siren or lock)
    await this.dispatchAlarmAction(incident, config.alarmSimulationMode);

    // Trigger high-priority alerting notifications
    await this.dispatchSecurityAlert(incident);
  },

  async dispatchAlarmAction(incident: SecurityEvent, isSimMode: boolean) {
    if (mockProviderHealths.alarms === "DOWN") {
      console.warn("Alarm dispatch provider is offline.");
      return;
    }

    const action: AlarmAction = {
      id: `alarm-${Math.random().toString(36).substring(2, 9)}`,
      incidentId: incident.id,
      doorId: incident.doorId,
      actionType: incident.severity === "CRITICAL" ? "LOCK_DOOR" : "LOCALIZED_SIREN",
      status: isSimMode ? "SUCCESS" : "DISPATCHED",
      simulationMode: isSimMode,
      dispatchedAt: new Date().toISOString(),
    };
    mockAlarms.push(action);

    try {
      await supabase.from("alarm_actions").insert({
        id: action.id,
        incident_id: action.incidentId,
        door_id: action.doorId,
        action_type: action.actionType,
        status: action.status,
        simulation_mode: action.simulationMode,
        dispatched_at: action.dispatchedAt,
      });
    } catch {
      // Fallback
    }
  },

  // --- POLICE & SECURITY ALERT DISPATCHER ---
  async dispatchSecurityAlert(incident: SecurityEvent) {
    if (mockProviderHealths.notifications === "DOWN") {
      console.warn("High-priority notification delivery provider is degraded.");
      return;
    }

    const door = mockDoors.find((d) => d.id === incident.doorId) || {
      name: "Protected Facility Entry",
    };

    const alert: SecurityAlert = {
      id: `alert-${Math.random().toString(36).substring(2, 9)}`,
      incidentId: incident.id,
      severity: incident.severity,
      locationName: door.name,
      timestamp: incident.timestamp,
      observedCount: incident.observedCount,
      expectedCount: incident.expectedCount,
      confidence: incident.confidence,
      isAcknowledged: false,
    };
    mockAlerts.push(alert);

    // Save alert delivery to database
    try {
      await supabase.from("alert_deliveries").insert({
        id: alert.id,
        incident_id: alert.incidentId,
        severity: alert.severity,
        location_name: alert.locationName,
        timestamp: alert.timestamp,
        observed_count: alert.observedCount,
        expected_count: alert.expectedCount,
        confidence: alert.confidence,
        is_acknowledged: alert.isAcknowledged,
      });
    } catch {
      // Fallback
    }
  },

  async getSecurityIncidents(): Promise<SecurityEvent[]> {
    try {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error || !data || data.length === 0) return mockIncidents;
      // Map database schema snake_case back to camelCase properties
      return data.map((d: any) => ({
        id: d.id,
        doorId: d.door_id,
        cameraId: d.camera_id,
        timestamp: d.timestamp,
        severity: d.severity,
        confidence: d.confidence,
        observedCount: d.observed_count,
        expectedCount: d.expected_count,
        correlationId: d.correlation_id,
        evidenceClipId: d.evidence_clip_id,
        status: d.status,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch {
      return mockIncidents;
    }
  },

  async acknowledgeIncident(incidentId: string, userId: string): Promise<boolean> {
    const idx = mockIncidents.findIndex((i) => i.id === incidentId);
    if (idx !== -1) {
      mockIncidents[idx].status = "ACKNOWLEDGED";
      mockIncidents[idx].updatedAt = new Date().toISOString();
    }

    try {
      await supabase
        .from("security_events")
        .update({ status: "ACKNOWLEDGED", updated_at: new Date().toISOString() })
        .eq("id", incidentId);
    } catch {
      // Fallback
    }

    await this.logAudit(
      "ACKNOWLEDGE_INCIDENT",
      userId,
      `Acknowledged security breach ID: ${incidentId}`,
    );
    return true;
  },

  async resolveIncident(
    incidentId: string,
    status: IncidentStatus,
    userId: string,
    notes: string,
  ): Promise<boolean> {
    const idx = mockIncidents.findIndex((i) => i.id === incidentId);
    if (idx !== -1) {
      mockIncidents[idx].status = status;
      mockIncidents[idx].updatedAt = new Date().toISOString();
    }

    try {
      await supabase
        .from("security_events")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", incidentId);
    } catch {
      // Fallback
    }

    await this.logAudit(
      "RESOLVE_INCIDENT",
      userId,
      `Resolved security breach ID: ${incidentId}. Result: ${status}. Notes: ${notes}`,
    );
    return true;
  },

  // --- EVIDENCE PRIVACY RETENTION HANDLING ---
  async getEvidenceClip(clipId: string, userId: string): Promise<EvidenceClip | null> {
    const clip = mockClips.find((c) => c.id === clipId);
    if (!clip) return null;

    // Log evidence audit trail access strictly
    await this.logAudit(
      "ACCESS_EVIDENCE_CLIP",
      userId,
      `User requested audit access to evidence clip ID: ${clipId}`,
    );
    return clip;
  },

  async purgeExpiredEvidence(now = new Date()): Promise<number> {
    let purgeCount = 0;
    mockClips = mockClips.filter((clip) => {
      const isExpired = new Date(clip.retentionExpiration) < now;
      if (isExpired) purgeCount++;
      return !isExpired;
    });

    try {
      const { data } = await supabase
        .from("evidence_clips")
        .delete()
        .lt("retention_expiration", now.toISOString())
        .select();
      if (data && data.length > 0) return data.length;
    } catch {
      // Fallback
    }

    return purgeCount;
  },

  // --- HEALTH MONITORING & AUDIT LOGS ---
  async logAudit(action: string, userId: string, details: string): Promise<boolean> {
    const log: AuditLog = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      action,
      userId,
      userRole: "SECURITY_OFFICER",
      timestamp: new Date().toISOString(),
      details,
    };
    mockAuditLogs.push(log);

    try {
      await supabase.from("security_audit_logs").insert({
        action: log.action,
        user_id: log.userId,
        user_role: log.userRole,
        timestamp: log.timestamp,
        details: log.details,
      });
    } catch {
      // Fallback
    }
    return true;
  },

  getAuditLogs(): AuditLog[] {
    return mockAuditLogs;
  },

  setProviderHealth(provider: string, health: ProviderHealth) {
    if (provider in mockProviderHealths) {
      mockProviderHealths[provider] = health;
    }
  },

  getProviderHealths(): Record<string, ProviderHealth> {
    return mockProviderHealths;
  },
};
