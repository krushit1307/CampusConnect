import { describe, it, expect, vi, beforeEach } from "vitest";
import { tailgatingService } from "../tailgatingService";
import { BadgeSwipe, CameraFrameEvent } from "../../types/tailgating";

// Mock Supabase client module
vi.mock("@/lib/supabase/client", () => {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const mockSelect = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
  const mockDelete = vi.fn().mockReturnValue({
    lt: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });

  return {
    createClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelect,
        delete: mockDelete,
      }),
    }),
  };
});

describe("tailgatingService - Access Control Badge Ingestion", () => {
  beforeEach(() => {
    tailgatingService.resetMockState();
  });

  it("ingests normal authorized badge swipe and opens window", async () => {
    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-999",
      timestamp: new Date().toISOString(),
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "corr-101",
    };

    const result = await tailgatingService.ingestBadgeSwipe(swipe);
    expect(result.id).toBeDefined();
    expect(result.authorized).toBe(true);
  });

  it("suppresses duplicate badge swipes within same second window", async () => {
    const timestamp = new Date().toISOString();
    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-999",
      timestamp,
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "corr-101",
    };

    await tailgatingService.ingestBadgeSwipe(swipe);

    // Identical swipe within same second should trigger rejection error
    await expect(tailgatingService.ingestBadgeSwipe(swipe)).rejects.toThrow(
      /Duplicate badge event detected/,
    );
  });

  it("rejects ingestion when access-control provider is reported down", async () => {
    tailgatingService.setProviderHealth("access_control", "DOWN");

    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-999",
      timestamp: new Date().toISOString(),
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "corr-101",
    };

    await expect(tailgatingService.ingestBadgeSwipe(swipe)).rejects.toThrow(
      "Access-control provider is offline",
    );
  });
});

describe("tailgatingService - Camera Ingestion & Filtering rules", () => {
  beforeEach(() => {
    tailgatingService.resetMockState();
  });

  it("ingests camera frames and handles duplicate suppression", async () => {
    const timestamp = new Date().toISOString();
    const frame: Omit<CameraFrameEvent, "id"> = {
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp,
      anonymousTrackId: "track-xyz",
      confidence: 0.9,
      direction: "IN",
    };

    const first = await tailgatingService.ingestCameraFrame(frame);
    const second = await tailgatingService.ingestCameraFrame(frame);

    expect(first.id).not.toBe("frame-dup");
    expect(second.id).toBe("frame-dup"); // suppressed duplicate track ID
  });

  it("ignores OUT direction crossings for entering threshold calculations", async () => {
    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-1",
      timestamp: new Date().toISOString(),
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "c-1",
    };

    await tailgatingService.ingestBadgeSwipe(swipe);

    const outFrame: Omit<CameraFrameEvent, "id"> = {
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-out",
      confidence: 0.95,
      direction: "OUT",
    };

    await tailgatingService.ingestCameraFrame(outFrame);
    const detection = await tailgatingService.closeAndEvaluateWindow("door-1111-2222-3333-4444");

    expect(detection?.observedCount).toBe(0); // OUT crossing ignored
    expect(detection?.isTailgatingDetected).toBe(false);
  });
});

describe("tailgatingService - Threshold Detection Scenarios", () => {
  beforeEach(() => {
    tailgatingService.resetMockState();
  });

  it("processes expected=1, observed=1 entry: Normal state", async () => {
    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-abc",
      timestamp: new Date().toISOString(),
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "corr-norm",
    };
    await tailgatingService.ingestBadgeSwipe(swipe);

    // Exactly 1 camera crossing enters
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-1",
      confidence: 0.85,
      direction: "IN",
    });

    const result = await tailgatingService.closeAndEvaluateWindow("door-1111-2222-3333-4444");

    expect(result?.observedCount).toBe(1);
    expect(result?.isTailgatingDetected).toBe(false);
    expect(tailgatingService.getAuditLogs().length).toBe(0); // No warning events triggered
  });

  it("detects tailgating when expected=1, observed=2 entry", async () => {
    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-abc",
      timestamp: new Date().toISOString(),
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "corr-tail",
    };
    await tailgatingService.ingestBadgeSwipe(swipe);

    // Two distinct camera crossings enter
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-1",
      confidence: 0.85,
      direction: "IN",
    });
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-2",
      confidence: 0.88,
      direction: "IN",
    });

    const result = await tailgatingService.closeAndEvaluateWindow("door-1111-2222-3333-4444");

    expect(result?.observedCount).toBe(2);
    expect(result?.isTailgatingDetected).toBe(true);

    const incidents = await tailgatingService.getSecurityIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0].severity).toBe("HIGH"); // config default
  });

  it("filters out low confidence crossings", async () => {
    const swipe: Omit<BadgeSwipe, "id"> = {
      doorId: "door-1111-2222-3333-4444",
      badgeId: "badge-abc",
      timestamp: new Date().toISOString(),
      authorized: true,
      expectedCrossingCount: 1,
      correlationId: "corr-conf",
    };
    await tailgatingService.ingestBadgeSwipe(swipe);

    // 1 high confidence entry, 1 low confidence entry (e.g. 0.40)
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-1",
      confidence: 0.85,
      direction: "IN",
    });
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-low",
      confidence: 0.4, // below 0.75 threshold
      direction: "IN",
    });

    const result = await tailgatingService.closeAndEvaluateWindow("door-1111-2222-3333-4444");

    // Only 1 person should be counted
    expect(result?.observedCount).toBe(1);
    expect(result?.isTailgatingDetected).toBe(false);
  });

  it("flags unauthorized entries when crossing occurs with no active window", async () => {
    // Ingest crossing entry without any badge swipe opening a window
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-unauth",
      confidence: 0.85,
      direction: "IN",
    });

    const incidents = await tailgatingService.getSecurityIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0].expectedCount).toBe(0);
    expect(incidents[0].observedCount).toBe(1);
    expect(incidents[0].severity).toBe("HIGH");
  });
});

describe("tailgatingService - Alerts & Evidence Auditing", () => {
  beforeEach(() => {
    tailgatingService.resetMockState();
  });

  it("audits log access to evidence clips strictly", async () => {
    // Generate an incident with clip first
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-unauth",
      confidence: 0.85,
      direction: "IN",
    });

    const incidents = await tailgatingService.getSecurityIncidents();
    const clipId = incidents[0].evidenceClipId!;

    // Request evidence clip access
    const clip = await tailgatingService.getEvidenceClip(clipId, "officer-john");
    expect(clip).not.toBeNull();

    // Verify audit log has registered entry
    const auditLogs = tailgatingService.getAuditLogs();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe("ACCESS_EVIDENCE_CLIP");
    expect(auditLogs[0].userId).toBe("officer-john");
  });

  it("purges expired evidence clips correctly", async () => {
    // Ingest crossing to create evidence clip
    await tailgatingService.ingestCameraFrame({
      cameraId: "cam-lobby-01",
      doorId: "door-1111-2222-3333-4444",
      timestamp: new Date().toISOString(),
      anonymousTrackId: "track-unauth",
      confidence: 0.85,
      direction: "IN",
    });

    // Retention for this door is 7 days.
    // Call purge with date 8 days in future.
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 8);

    const purged = await tailgatingService.purgeExpiredEvidence(futureDate);
    expect(purged).toBe(1);
  });
});
