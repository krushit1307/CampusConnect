import { describe, it, expect } from "vitest";
import {
  isUserEligibleForFacialMatching,
  filterAndProcessFaceMatches,
  buildPersonalizedPhotoSpottedEmail,
  MIN_FACE_MATCH_CONFIDENCE,
  UserBiometricProfile,
  RekognitionFaceMatch,
} from "./photoMatchmaker";

describe("Automated Post-Event Photography Matchmaker Suite (#3667)", () => {
  const optedInUser: UserBiometricProfile = {
    userId: "usr_opted_in",
    hasOptedIn: true,
    referenceSelfieUrl: "https://storage.campusconnect.edu/selfies/usr1.jpg",
  };

  const optedOutUser: UserBiometricProfile = {
    userId: "usr_opted_out",
    hasOptedIn: false,
    referenceSelfieUrl: "https://storage.campusconnect.edu/selfies/usr2.jpg",
  };

  it("verifies explicit biometric consent and reference selfie eligibility", () => {
    expect(isUserEligibleForFacialMatching(optedInUser)).toBe(true);
    expect(isUserEligibleForFacialMatching(optedOutUser)).toBe(false);
    expect(isUserEligibleForFacialMatching(null)).toBe(false);
  });

  it("filters matches strictly above 95% confidence and respects opt-in consent", () => {
    const rawMatches: RekognitionFaceMatch[] = [
      { detectedFaceId: "f1", matchedUserId: "usr_opted_in", confidenceScore: 98.5 }, // Valid
      { detectedFaceId: "f2", matchedUserId: "usr_opted_in", confidenceScore: 91.0 }, // Low confidence (<95%)
      { detectedFaceId: "f3", matchedUserId: "usr_opted_out", confidenceScore: 99.0 }, // No consent
    ];

    const profilesMap = new Map<string, UserBiometricProfile>([
      ["usr_opted_in", optedInUser],
      ["usr_opted_out", optedOutUser],
    ]);

    const processed = filterAndProcessFaceMatches(
      "img_gala_01",
      "https://storage.campusconnect.edu/gallery/gala1.jpg",
      rawMatches,
      profilesMap,
    );

    expect(processed.length).toBe(1);
    expect(processed[0].userId).toBe("usr_opted_in");
    expect(processed[0].confidenceScore).toBe(98.5);
  });

  it("builds personalized notification emails for spotted users", () => {
    const email = buildPersonalizedPhotoSpottedEmail(
      "alice@university.edu",
      "Annual Spring Gala",
      3,
      "https://campusconnect.edu/my-photos?event=gala",
    );

    expect(email.subject).toContain("Annual Spring Gala");
    expect(email.bodyHtml).toContain("3");
    expect(email.bodyHtml).toContain("View Your Personalized Album");
  });
});
