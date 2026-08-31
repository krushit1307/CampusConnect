import { describe, it, expect, beforeEach } from "vitest";
import { CampusSafetyEmergencyRollCallService } from "../campusSafetyEmergencyRollCallService";

describe("CampusSafetyEmergencyRollCallService", () => {
  let service: CampusSafetyEmergencyRollCallService;

  beforeEach(() => {
    service = new CampusSafetyEmergencyRollCallService();
    service.resetToSampleData();
  });

  describe("initiateEmergencyRollCall", () => {
    it("should initiate active roll call check and create attendee response records", () => {
      const check = service.initiateEmergencyRollCall({
        eventId: "evt-test-1",
        eventTitle: "Campus Night Hike",
        campusLocation: "East Forest Quad",
        emergencyType: "FIRE_EVACUATION",
        durationMinutes: 10,
      });

      expect(check.id).toBeDefined();
      expect(check.status).toBe("ACTIVE");
      expect(check.emergencyType).toBe("FIRE_EVACUATION");
      expect(check.totalAttendeesCount).toBeGreaterThan(0);

      const responses = service.getResponsesForCheck(check.id);
      expect(responses.length).toBe(check.totalAttendeesCount);
      expect(responses[0].status).toBe("PENDING");
    });
  });

  describe("submitAttendeeStatus", () => {
    it("should update attendee status to SAFE with GPS coordinates", () => {
      const check = service.initiateEmergencyRollCall({
        eventId: "evt-test-2",
        eventTitle: "Lab Drill",
        campusLocation: "Science Hall",
        emergencyType: "HAZMAT_LEAK",
      });

      const responses = service.getResponsesForCheck(check.id);
      const student = responses[0];

      const updated = service.submitAttendeeStatus({
        rollCallCheckId: check.id,
        userId: student.userId,
        status: "SAFE",
        latitude: 40.718,
        longitude: -74.008,
      });

      expect(updated.status).toBe("SAFE");
      expect(updated.respondedAt).toBeDefined();
      expect(updated.latitude).toBe(40.718);
    });

    it("should record NEED_ASSISTANCE status with injury/assistance details", () => {
      const check = service.initiateEmergencyRollCall({
        eventId: "evt-test-3",
        eventTitle: "Field Trip",
        campusLocation: "Valley Park",
        emergencyType: "SEVERE_WEATHER",
      });

      const responses = service.getResponsesForCheck(check.id);
      const student = responses[1];

      const updated = service.submitAttendeeStatus({
        rollCallCheckId: check.id,
        userId: student.userId,
        status: "NEED_ASSISTANCE",
        assistanceDetails: "Trapped behind fallen branch",
      });

      expect(updated.status).toBe("NEED_ASSISTANCE");
      expect(updated.assistanceDetails).toBe("Trapped behind fallen branch");
    });
  });

  describe("evaluateRollCallMetrics", () => {
    it("should calculate safe count, assistance count, and safe percentage", () => {
      const check = service.getActiveCheck("evt-mountain-hike");
      expect(check).toBeDefined();

      if (check) {
        const metrics = service.evaluateRollCallMetrics(check.id);

        expect(metrics.totalCount).toBe(4);
        expect(metrics.safeCount).toBe(2);
        expect(metrics.assistanceNeededCount).toBe(1);
        expect(metrics.safePercentage).toBe(50);
      }
    });

    it("should mark PENDING attendees as OVERDUE when timer is expired", () => {
      const check = service.initiateEmergencyRollCall({
        eventId: "evt-test-expired",
        eventTitle: "Evacuation",
        campusLocation: "Main Quad",
        emergencyType: "ACTIVE_THREAT",
        durationMinutes: -1, // already expired
      });

      const metrics = service.evaluateRollCallMetrics(check.id);

      expect(metrics.isTimerExpired).toBe(true);
      expect(metrics.overdueCount).toBe(metrics.totalCount);
    });
  });

  describe("dispatchDroneToAttendee", () => {
    it("should mark droneDispatched flag true for target attendee", () => {
      const check = service.getActiveCheck("evt-mountain-hike");
      if (check) {
        const success = service.dispatchDroneToAttendee(check.id, "usr-stu-4");
        expect(success).toBe(true);

        const responses = service.getResponsesForCheck(check.id);
        const target = responses.find((r) => r.userId === "usr-stu-4");
        expect(target?.droneDispatched).toBe(true);
      }
    });
  });

  describe("resolveEmergencyRollCall", () => {
    it("should mark check status as RESOLVED", () => {
      const check = service.getActiveCheck("evt-mountain-hike");
      if (check) {
        const resolved = service.resolveEmergencyRollCall(check.id);
        expect(resolved.status).toBe("RESOLVED");
      }
    });
  });
});
