export interface EventSeriesTrack {
  id: string;
  clubId: string;
  seriesTitle: string;
  requiredEventIds: string[];
}

export interface AttendanceRecord {
  eventId: string;
  userId: string;
  status: "attended" | "attending" | "declined";
}

export interface SeriesProgressionResult {
  userId: string;
  seriesId: string;
  totalRequired: number;
  attendedCount: number;
  completionPercentage: number;
  isComplete: boolean;
}

export interface CertificateMetadataPayload {
  certificateNumber: string;
  studentName: string;
  seriesTitle: string;
  clubName: string;
  completionDate: string;
  verificationUrl: string;
}

/**
  Evaluates an attendee's progression across required events in a series.
 */
export function evaluateSeriesProgression(
  series: EventSeriesTrack,
  userId: string,
  userAttendanceRecords: AttendanceRecord[],
): SeriesProgressionResult {
  const attendedEventIds = new Set(
    userAttendanceRecords
      .filter((a) => a.userId === userId && a.status === "attended")
      .map((a) => a.eventId),
  );

  let attendedCount = 0;
  for (const reqId of series.requiredEventIds) {
    if (attendedEventIds.has(reqId)) {
      attendedCount++;
    }
  }

  const totalRequired = series.requiredEventIds.length;
  const completionPercentage =
    totalRequired > 0 ? Number(((attendedCount / totalRequired) * 100).toFixed(2)) : 0;
  const isComplete = attendedCount === totalRequired && totalRequired > 0;

  return {
    userId,
    seriesId: series.id,
    totalRequired,
    attendedCount,
    completionPercentage,
    isComplete,
  };
}

/**
  Generates a unique, verifiable certificate identification code.
 */
export function generateCertificateCode(seriesId: string, userId: string): string {
  const hashSeed = `${seriesId.slice(0, 4)}-${userId.slice(0, 4)}`.toUpperCase();
  const year = new Date().getFullYear();
  return `CERT-${year}-${hashSeed}`;
}

/**
  Constructs a certificate payload ready for PDF rendering and distribution.
 */
export function buildCertificatePayload(
  studentName: string,
  seriesTitle: string,
  clubName: string,
  seriesId: string,
  userId: string,
  completionDateIso: string = new Date().toISOString(),
  baseUrl = "https://campusconnect.edu",
): CertificateMetadataPayload {
  const certificateNumber = generateCertificateCode(seriesId, userId);
  const verificationUrl = `${baseUrl}/verify-certificate/${certificateNumber}`;

  return {
    certificateNumber,
    studentName,
    seriesTitle,
    clubName,
    completionDate: completionDateIso.split("T")[0],
    verificationUrl,
  };
}
