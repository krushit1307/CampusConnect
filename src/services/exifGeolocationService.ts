import { extractExifFromBuffer, GpsCoordinates, ExifExtractionResult } from "../utils/exifParser";

export interface EventVenueGeofence {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}

export interface EventTemporalWindow {
  startTime: Date;
  endTime: Date;
  allowedMarginMinutes?: number;
}

export interface GeolocationValidationRequest {
  photoBuffer: ArrayBuffer | Uint8Array;
  venueGeofence: EventVenueGeofence;
  temporalWindow: EventTemporalWindow;
  eventId: string;
  userId: string;
  strictGpsRequired?: boolean;
}

export interface GeolocationValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  spatialDistanceMeters?: number;
  temporalDifferenceMinutes?: number;
  extractedMetadata?: ExifExtractionResult;
  processedBuffer?: Uint8Array;
}

/**
 * Calculates Haversine distance between two latitude/longitude coordinates in meters.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const EARTH_RADIUS_METERS = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Strips EXIF metadata from raw image buffer once validation passes.
 */
export function stripExifMetadata(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // If JPEG, locate APP1 (0xFFE1) segments and strip them
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const cleaned: number[] = [0xff, 0xd8];
    let offset = 2;
    while (offset < bytes.length - 1) {
      if (bytes[offset] === 0xff) {
        const marker = bytes[offset + 1];
        if (marker === 0xe1) {
          // Skip APP1 segment (EXIF)
          const segLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
          offset += 2 + segLength;
          continue;
        }
      }
      cleaned.push(bytes[offset]);
      offset++;
    }
    cleaned.push(bytes[bytes.length - 1]);
    return new Uint8Array(cleaned);
  }

  // Return cleaned buffer copy
  return new Uint8Array(bytes);
}

/**
 * Core Geolocation Anomaly Detection engine (#4904).
 * Validates spatial origin and temporal freshness before EXIF metadata stripping.
 */
export async function validatePhotoGeolocationAnomaly(
  request: GeolocationValidationRequest,
): Promise<GeolocationValidationResult> {
  const { photoBuffer, venueGeofence, temporalWindow, strictGpsRequired = true } = request;

  // 1. Extract EXIF metadata before stripping
  const exifResult = extractExifFromBuffer(photoBuffer, {
    requireGps: strictGpsRequired,
  });

  if (!exifResult.hasExif && strictGpsRequired) {
    return {
      isValid: false,
      rejectionReason:
        "Fraud Detected: This photo does not contain valid GPS metadata to verify event attendance.",
      extractedMetadata: exifResult,
    };
  }

  const { gps, timestamp } = exifResult;

  // 2. Validate Spatial Origin (Geofence Check)
  let distanceMeters = 0;
  if (gps) {
    distanceMeters = calculateHaversineDistanceMeters(
      gps.latitude,
      gps.longitude,
      venueGeofence.centerLatitude,
      venueGeofence.centerLongitude,
    );

    if (distanceMeters > venueGeofence.radiusMeters) {
      const distanceMiles = (distanceMeters / 1609.34).toFixed(1);
      return {
        isValid: false,
        rejectionReason: `Fraud Detected: This photo was not taken at the event venue during the event. (Location detected ${distanceMiles} miles away from venue)`,
        spatialDistanceMeters: distanceMeters,
        extractedMetadata: exifResult,
      };
    }
  } else if (strictGpsRequired) {
    return {
      isValid: false,
      rejectionReason:
        "Fraud Detected: Missing photo GPS location coordinates for geofence verification.",
      extractedMetadata: exifResult,
    };
  }

  // 3. Validate Temporal Window (Timestamp Check)
  const temporalDiffMinutes = 0;
  if (timestamp) {
    const photoTimeMs = timestamp.getTime();
    const marginMs = (temporalWindow.allowedMarginMinutes || 30) * 60 * 1000;

    const windowStartMs = temporalWindow.startTime.getTime() - marginMs;
    const windowEndMs = temporalWindow.endTime.getTime() + marginMs;

    if (photoTimeMs < windowStartMs || photoTimeMs > windowEndMs) {
      if (photoTimeMs < windowStartMs) {
        const daysOld = Math.round((windowStartMs - photoTimeMs) / (1000 * 60 * 60 * 24));
        return {
          isValid: false,
          rejectionReason: `Fraud Detected: This photo was taken ${daysOld > 0 ? daysOld + " days" : "too long"} before the event started.`,
          temporalDifferenceMinutes: Math.round((windowStartMs - photoTimeMs) / (1000 * 60)),
          extractedMetadata: exifResult,
        };
      } else {
        return {
          isValid: false,
          rejectionReason: "Fraud Detected: This photo was captured after the event ended.",
          temporalDifferenceMinutes: Math.round((photoTimeMs - windowEndMs) / (1000 * 60)),
          extractedMetadata: exifResult,
        };
      }
    }
  } else if (strictGpsRequired) {
    return {
      isValid: false,
      rejectionReason:
        "Fraud Detected: Missing photo original timestamp for temporal verification.",
      extractedMetadata: exifResult,
    };
  }

  // 4. Verification Passed -> Strip EXIF metadata for user privacy
  const sanitizedBuffer = stripExifMetadata(photoBuffer);

  return {
    isValid: true,
    spatialDistanceMeters: distanceMeters,
    temporalDifferenceMinutes: temporalDiffMinutes,
    extractedMetadata: exifResult,
    processedBuffer: sanitizedBuffer,
  };
}
