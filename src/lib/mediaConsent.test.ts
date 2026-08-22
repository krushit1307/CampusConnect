import { describe, expect, it } from "vitest";
import {
  consentChoiceToNoMediaConsent,
  getMediaConsentValidationMessage,
  isMediaConsentRequired,
  isValidMediaConsentChoice,
  MEDIA_CONSENT_COPY,
} from "./mediaConsent";

describe("media consent helpers", () => {
  it("requires a choice only when photography is enabled", () => {
    expect(isMediaConsentRequired(true)).toBe(true);
    expect(isMediaConsentRequired(false)).toBe(false);
    expect(isMediaConsentRequired(null)).toBe(false);
  });

  it("accepts only explicit yes or no choices", () => {
    expect(isValidMediaConsentChoice("yes")).toBe(true);
    expect(isValidMediaConsentChoice("no")).toBe(true);
    expect(isValidMediaConsentChoice("maybe")).toBe(false);
    expect(isValidMediaConsentChoice(undefined)).toBe(false);
  });

  it("maps a declined choice to the ticket no-photo flag", () => {
    expect(consentChoiceToNoMediaConsent("yes")).toBe(false);
    expect(consentChoiceToNoMediaConsent("no")).toBe(true);
  });

  it("returns a validation message for missing photography consent", () => {
    expect(getMediaConsentValidationMessage(true, null)).toContain("choose Yes or No");
    expect(getMediaConsentValidationMessage(true, "no")).toBeNull();
    expect(getMediaConsentValidationMessage(false, null)).toBeNull();
    expect(MEDIA_CONSENT_COPY.ticketLabel).toContain("NO PHOTOGRAPHY");
  });
});
