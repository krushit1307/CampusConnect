import { describe, it, expect } from "vitest";
import {
  isLateNightEvent,
  validateEscortRequestInput,
  formatDispatchWebhookPayload,
  cancelEscortRequest,
  EscortRequestInput,
  SafetyEscortRecord,
} from "./campusSafetyEscort";

describe("Campus Safety Escort Integration Suite (#3666)", () => {
  const lateNightEventEnd = "2026-08-20T23:00:00Z"; // 11:00 PM
  const daytimeEventEnd = "2026-08-20T14:00:00Z"; // 2:00 PM

  const validRequestInput: EscortRequestInput = {
    eventId: "evt_hackathon",
    userId: "usr_alice",
    phoneNumber: "+15550192834",
    destination: "Dorm 4, Room 202",
    latitude: 37.774929,
    longitude: -122.419418,
    eventEndTimeIso: lateNightEventEnd,
  };

  it("identifies late-night events ending after 9:00 PM", () => {
    expect(isLateNightEvent(lateNightEventEnd)).toBe(true);
    expect(isLateNightEvent(daytimeEventEnd)).toBe(false);
  });

  it("validates safety escort request inputs and enforces late-night rule", () => {
    expect(validateEscortRequestInput(validRequestInput).isValid).toBe(true);

    const daytimeRequest = { ...validRequestInput, eventEndTimeIso: daytimeEventEnd };
    const result = validateEscortRequestInput(daytimeRequest);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("after 9:00 PM");
  });

  it("formats dispatch webhook payload accurately for campus security software", () => {
    const payload = formatDispatchWebhookPayload("req_999", validRequestInput);

    expect(payload.requestId).toBe("req_999");
    expect(payload.studentUserId).toBe("usr_alice");
    expect(payload.dropoffDestination).toBe("Dorm 4, Room 202");
    expect(payload.gpsCoordinates).toEqual({ lat: 37.774929, lng: -122.419418 });
  });

  it("allows immediate cancellation of active requests", () => {
    const activeRecord: SafetyEscortRecord = {
      id: "req_999",
      eventId: "evt_hackathon",
      userId: "usr_alice",
      phoneNumber: "+15550192834",
      destination: "Dorm 4",
      latitude: 37.774929,
      longitude: -122.419418,
      status: "DISPATCHED",
      etaMinutes: 4,
      createdAt: "2026-08-20T23:05:00Z",
    };

    const cancelled = cancelEscortRequest(activeRecord);
    expect(cancelled.status).toBe("CANCELLED");
  });
});
