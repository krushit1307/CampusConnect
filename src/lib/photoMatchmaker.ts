export interface UserBiometricProfile {
  userId: string;
  hasOptedIn: boolean;
  referenceSelfieUrl?: string;
}

export interface RekognitionFaceMatch {
  detectedFaceId: string;
  matchedUserId: string;
  confidenceScore: number; // 0.0 to 100.0
}

export interface MatchedPhotoRecord {
  imageId: string;
  imageUrl: string;
  userId: string;
  confidenceScore: number;
}

export const MIN_FACE_MATCH_CONFIDENCE = 95.0; // Strict 95% threshold

/**
 * Validates whether a user has explicitly opted in and uploaded a reference selfie.
 */
export function isUserEligibleForFacialMatching(profile: UserBiometricProfile | null): boolean {
  return !!(
    profile &&
    profile.hasOptedIn &&
    profile.referenceSelfieUrl &&
    profile.referenceSelfieUrl.trim().length > 0
  );
}

/**
 * Filters Rekognition face matches against strict opt-in consent and >= 95% confidence threshold.
 */
export function filterAndProcessFaceMatches(
  imageId: string,
  imageUrl: string,
  rawMatches: RekognitionFaceMatch[],
  optedInProfiles: Map<string, UserBiometricProfile>,
  minConfidence = MIN_FACE_MATCH_CONFIDENCE,
): MatchedPhotoRecord[] {
  const validMatches: MatchedPhotoRecord[] = [];

  for (const match of rawMatches) {
    const profile = optedInProfiles.get(match.matchedUserId);

    // Reject if user has not opted in or confidence is below 95%
    if (
      isUserEligibleForFacialMatching(profile || null) &&
      match.confidenceScore >= minConfidence
    ) {
      validMatches.push({
        imageId,
        imageUrl,
        userId: match.matchedUserId,
        confidenceScore: Number(match.confidenceScore.toFixed(2)),
      });
    }
  }

  return validMatches;
}

/**
 * Builds personalized email notification content when a user is spotted in an event gallery.
 */
export function buildPersonalizedPhotoSpottedEmail(
  userEmail: string,
  eventTitle: string,
  matchedPhotoCount: number,
  albumUrl: string,
): { subject: string; bodyHtml: string } {
  const subject = `We spotted you at ${eventTitle}! 📸`;
  const bodyHtml = `
    <h2>Your event photos are ready!</h2>
    <p>Great news! Our automated photo matchmaker found <strong>${matchedPhotoCount}</strong> photo(s) of you from <strong>${eventTitle}</strong>.</p>
    <p><a href="${albumUrl}">View Your Personalized Album</a></p>
    <br/>
    <small>You received this because you opted into biometric photo matching for CampusConnect events.</small>
  `.trim();

  return { subject, bodyHtml };
}
