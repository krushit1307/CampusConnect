import { describe, it, expect } from "vitest";
import {
  validatePhotoGeolocationAnomaly,
  calculateHaversineDistanceMeters,
  stripExifMetadata,
  EventVenueGeofence,
  EventTemporalWindow,
} from "../src/services/exifGeolocationService";
import { extractExifFromBuffer } from "../src/utils/exifParser";

describe("EXIF Geolocation Anomaly Detection Service (#4904)", () => {
  const sampleVenue: EventVenueGeofence = {
    id: "venue-101",
    name: "Campus Student Center Plaza",
    centerLatitude: 37.7749,
    centerLongitude: -122.4194,
    radiusMeters: 500, // 500 meter geofence
  };

  const sampleEventWindow: EventTemporalWindow = {
    startTime: new Date("2026-08-30T19:00:00Z"),
    endTime: new Date("2026-08-30T21:00:00Z"),
    allowedMarginMinutes: 15,
  };

  it("should correctly calculate haversine distance between two coordinates", () => {
    // Distance between SF City Hall and Coit Tower ~2.4 km
    const dist = calculateHaversineDistanceMeters(37.7793, -122.4192, 37.8024, -122.4058);
    expect(dist).toBeGreaterThan(2000);
    expect(dist).toBeLessThan(3000);
  });

  it("should accept valid photo taken inside geofence during event window", async () => {
    // Create simulated image buffer with valid EXIF metadata matching venue
    const mockJsonHeader = JSON.stringify({
      latitude: 37.775, // within ~100m of venue center
      longitude: -122.4195,
      timestamp: "2026-08-30T19:30:00Z",
    });
    const encoder = new TextEncoder();
    const photoBuffer = encoder.encode(mockJsonHeader);

    const result = await validatePhotoGeolocationAnomaly({
      photoBuffer,
      venueGeofence: sampleVenue,
      temporalWindow: sampleEventWindow,
      eventId: "evt-campus-pizza-party",
      userId: "user-student-1",
      strictGpsRequired: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.rejectionReason).toBeUndefined();
    expect(result.processedBuffer).toBeDefined();
  });

  it("should reject photo taken 5 miles away from venue", async () => {
    // Photo taken in Oakland (~8 miles away)
    const mockJsonHeader = JSON.stringify({
      latitude: 37.8044,
      longitude: -122.2712,
      timestamp: "2026-08-30T19:30:00Z",
    });
    const encoder = new TextEncoder();
    const photoBuffer = encoder.encode(mockJsonHeader);

    const result = await validatePhotoGeolocationAnomaly({
      photoBuffer,
      venueGeofence: sampleVenue,
      temporalWindow: sampleEventWindow,
      eventId: "evt-campus-pizza-party",
      userId: "user-student-cheat",
      strictGpsRequired: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain(
      "Fraud Detected: This photo was not taken at the event venue",
    );
  });

  it("should reject photo taken 3 days before event", async () => {
    // Photo taken 3 days ago
    const mockJsonHeader = JSON.stringify({
      latitude: 37.775,
      longitude: -122.4195,
      timestamp: "2026-08-27T19:30:00Z",
    });
    const encoder = new TextEncoder();
    const photoBuffer = encoder.encode(mockJsonHeader);

    const result = await validatePhotoGeolocationAnomaly({
      photoBuffer,
      venueGeofence: sampleVenue,
      temporalWindow: sampleEventWindow,
      eventId: "evt-campus-pizza-party",
      userId: "user-student-old-photo",
      strictGpsRequired: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain("Fraud Detected: This photo was taken 3 days");
  });

  it("should strip EXIF data from buffer after successful validation", () => {
    const rawBuffer = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const stripped = stripExifMetadata(rawBuffer);
    expect(stripped).toBeDefined();
  });
});
