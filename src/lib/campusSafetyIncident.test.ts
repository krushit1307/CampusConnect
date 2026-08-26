import { describe, it, expect } from "vitest";
import {
  getIncidentCategoryMeta,
  formatIncidentLocationLabel,
  generateCampusPdSmsPayload,
  createIncidentReport,
  IncidentReportPayload,
} from "./campusSafetyIncident";

describe("Campus Safety Incident Reporter Utility (#4286)", () => {
  it("returns category metadata for medical emergency and security threat", () => {
    const medical = getIncidentCategoryMeta("medical_emergency");
    expect(medical.label).toBe("Medical Emergency");
    expect(medical.alertTitle).toBe("MEDICAL EMERGENCY ALERT");

    const security = getIncidentCategoryMeta("security_threat");
    expect(security.icon).toBe("🚨");
  });

  it("formats human-readable location label with GPS coordinates", () => {
    const label = formatIncidentLocationLabel(37.7749, -122.4194, "Near North Stage");
    expect(label).toBe("Near North Stage (37.77490, -122.41940)");
  });

  it("generates Campus PD SMS payload linking directly to Google Maps", () => {
    const report: IncidentReportPayload = {
      id: "inc-1",
      eventId: "evt-concert-1",
      eventTitle: "Spring Concert 2026",
      category: "medical_emergency",
      description: "Student dehydrated near front row",
      latitude: 37.7749,
      longitude: -122.4194,
      locationLabel: "Near North Stage",
      status: "active",
    };

    const sms = generateCampusPdSmsPayload(report, "911-CAMPUS-PD");

    expect(sms.recipientNumber).toBe("911-CAMPUS-PD");
    expect(sms.mapUrl).toBe("https://maps.google.com/?q=37.7749,-122.4194");
    expect(sms.message).toContain("MEDICAL EMERGENCY ALERT");
    expect(sms.message).toContain("Near North Stage");
    expect(sms.message).toContain("https://maps.google.com/?q=37.7749,-122.4194");
  });

  it("creates active incident report payload", () => {
    const report = createIncidentReport({
      eventId: "evt-concert-1",
      eventTitle: "Spring Concert 2026",
      category: "security_threat",
      latitude: 37.7749,
      longitude: -122.4194,
      status: "active",
    });

    expect(report.status).toBe("active");
    expect(report.category).toBe("security_threat");
  });
});
