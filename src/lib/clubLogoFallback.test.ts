import { describe, it, expect } from "vitest";
import {
  resolveClubLogoUrl,
  getClubInitials,
  handleClubLogoError,
  DEFAULT_CLUB_LOGO_PLACEHOLDER,
} from "./clubLogoFallback";

describe("Add Placeholder Image Fallback for Club Logos Suite (#3821)", () => {
  it("resolves valid logo URL or defaults to placeholder when missing or empty", () => {
    expect(
      resolveClubLogoUrl({ logoUrl: "https://storage.campusconnect.edu/logos/robotics.png" }),
    ).toBe("https://storage.campusconnect.edu/logos/robotics.png");

    expect(resolveClubLogoUrl({ logoUrl: "" })).toBe(DEFAULT_CLUB_LOGO_PLACEHOLDER);
    expect(resolveClubLogoUrl({ logoUrl: null })).toBe(DEFAULT_CLUB_LOGO_PLACEHOLDER);
    expect(resolveClubLogoUrl({ logoUrl: undefined })).toBe(DEFAULT_CLUB_LOGO_PLACEHOLDER);
  });

  it("extracts 2-letter uppercase initials for avatar text fallbacks", () => {
    expect(getClubInitials("Robotics Club")).toBe("RC");
    expect(getClubInitials("Chess")).toBe("CH");
    expect(getClubInitials("")).toBe("CC");
  });

  it("swaps broken image target src to default placeholder and prevents infinite loops", () => {
    const mockImage = { src: "https://broken-link.com/logo.png" };

    const swapped = handleClubLogoError(mockImage, DEFAULT_CLUB_LOGO_PLACEHOLDER);
    expect(swapped).toBe(true);
    expect(mockImage.src).toBe(DEFAULT_CLUB_LOGO_PLACEHOLDER);

    // Second trigger when placeholder is already set should return false to prevent infinite loop
    const repeatTrigger = handleClubLogoError(mockImage, DEFAULT_CLUB_LOGO_PLACEHOLDER);
    expect(repeatTrigger).toBe(false);
  });
});
