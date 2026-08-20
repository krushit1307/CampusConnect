import { describe, it, expect } from "vitest";
import {
  evaluateSeriesProgression,
  generateCertificateCode,
  buildCertificatePayload,
  EventSeriesTrack,
  AttendanceRecord,
} from "./seriesCertificateEngine";

describe("Automated Event Series Certificate Generator Suite (#3670)", () => {
  const sampleSeries: EventSeriesTrack = {
    id: "ser_business_101",
    clubId: "club_biz",
    seriesTitle: "Leadership Seminar Series",
    requiredEventIds: ["evt_sem_1", "evt_sem_2", "evt_sem_3"],
  };

  it("calculates partial progression percentage accurately", () => {
    const attendance: AttendanceRecord[] = [
      { eventId: "evt_sem_1", userId: "usr_student_1", status: "attended" },
      { eventId: "evt_sem_2", userId: "usr_student_1", status: "attending" }, // Not 'attended' yet
    ];

    const result = evaluateSeriesProgression(sampleSeries, "usr_student_1", attendance);

    expect(result.attendedCount).toBe(1);
    expect(result.totalRequired).toBe(3);
    expect(result.completionPercentage).toBe(33.33);
    expect(result.isComplete).toBe(false);
  });

  it("triggers 100% completion state when all required events are marked attended", () => {
    const fullAttendance: AttendanceRecord[] = [
      { eventId: "evt_sem_1", userId: "usr_student_1", status: "attended" },
      { eventId: "evt_sem_2", userId: "usr_student_1", status: "attended" },
      { eventId: "evt_sem_3", userId: "usr_student_1", status: "attended" },
    ];

    const result = evaluateSeriesProgression(sampleSeries, "usr_student_1", fullAttendance);

    expect(result.completionPercentage).toBe(100.0);
    expect(result.isComplete).toBe(true);
  });

  it("constructs verified certificate payload with unique identification code", () => {
    const payload = buildCertificatePayload(
      "Jane Doe",
      "Leadership Seminar Series",
      "Business Club",
      "ser_business_101",
      "usr_student_1",
    );

    expect(payload.studentName).toBe("Jane Doe");
    expect(payload.certificateNumber).toContain("CERT-2026-SER_");
    expect(payload.verificationUrl).toContain("/verify-certificate/CERT-2026-");
  });
});
