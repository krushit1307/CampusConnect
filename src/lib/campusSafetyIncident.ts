export type IncidentCategory =
  | "medical_emergency"
  | "security_threat"
  | "facility_issue"
  | "other";

export interface IncidentReportPayload {
  id?: string;
  eventId: string;
  eventTitle: string;
  reporterId?: string;
  category: IncidentCategory;
  description?: string;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  status: "active" | "responded" | "resolved";
  createdAt?: string;
}

export interface SmsDispatchPayload {
  recipientNumber: string;
  message: string;
  mapUrl: string;
}

export const INCIDENT_CATEGORY_META: Record<
  IncidentCategory,
  { label: string; icon: string; alertTitle: string; badgeColor: string }
> = {
  medical_emergency: {
    label: "Medical Emergency",
    icon: "🚑",
    alertTitle: "MEDICAL EMERGENCY ALERT",
    badgeColor: "#ef4444", // Red
  },
  security_threat: {
    label: "Security Threat / Hostile Activity",
    icon: "🚨",
    alertTitle: "SECURITY THREAT ALERT",
    badgeColor: "#dc2626", // Dark Red
  },
  facility_issue: {
    label: "Facility / Structural Hazard",
    icon: "🛠️",
    alertTitle: "FACILITY HAZARD REPORT",
    badgeColor: "#f59e0b", // Amber
  },
  other: {
    label: "General Safety Incident",
    icon: "⚠️",
    alertTitle: "CAMPUS SAFETY ALERT",
    badgeColor: "#6b7280", // Gray
  },
};

/**
 * Metadata lookup helper for incident categories (#4286).
 */
export function getIncidentCategoryMeta(category: IncidentCategory) {
  return INCIDENT_CATEGORY_META[category] || INCIDENT_CATEGORY_META.other;
}

/**
 * Formats a human-readable location label with coordinates (#4286).
 */
export function formatIncidentLocationLabel(lat: number, lng: number, label?: string): string {
  const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (label && label.trim().length > 0) {
    return `${label.trim()} (${coordStr})`;
  }
  return `GPS Coordinates: ${coordStr}`;
}

/**
 * Generates an SMS dispatch payload linking directly to Google Maps for Campus PD (#4286).
 */
export function generateCampusPdSmsPayload(
  report: IncidentReportPayload,
  pdPhone: string = "555-CAMPUS-PD"
): SmsDispatchPayload {
  const meta = getIncidentCategoryMeta(report.category);
  const mapUrl = `https://maps.google.com/?q=${report.latitude},${report.longitude}`;
  const locStr = formatIncidentLocationLabel(report.latitude, report.longitude, report.locationLabel);

  const message = [
    `🚨 HIGH PRIORITY ${meta.alertTitle}`,
    `Event: ${report.eventTitle}`,
    `Location: ${locStr}`,
    `Details: ${report.description || "Immediate response requested."}`,
    `Map Location: ${mapUrl}`,
  ].join("\n");

  return {
    recipientNumber: pdPhone,
    message,
    mapUrl,
  };
}

/**
 * Creates and initializes a Campus Safety incident report (#4286).
 */
export function createIncidentReport(payload: IncidentReportPayload): IncidentReportPayload {
  return {
    id: payload.id || `inc-${Date.now()}`,
    eventId: payload.eventId,
    eventTitle: payload.eventTitle || "Campus Event",
    reporterId: payload.reporterId,
    category: payload.category || "medical_emergency",
    description: payload.description,
    latitude: payload.latitude || 37.7749,
    longitude: payload.longitude || -122.4194,
    locationLabel: payload.locationLabel || "Event Venue Floor",
    status: payload.status || "active",
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}
