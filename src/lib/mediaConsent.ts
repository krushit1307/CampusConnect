export type MediaConsentChoice = "yes" | "no";

export const MEDIA_CONSENT_COPY = {
  prompt: "Do you consent to being photographed or filmed at this event?",
  yes: "Yes, I consent",
  no: "No, please do not photograph or film me",
  ticketLabel: "NO PHOTOGRAPHY / FILMING",
  staffInstruction: "Issue a red wristband at the door. Do not photograph or film this attendee.",
} as const;

export function isMediaConsentRequired(hasPhotography: boolean | null | undefined): boolean {
  return hasPhotography === true;
}

export function isValidMediaConsentChoice(value: unknown): value is MediaConsentChoice {
  return value === "yes" || value === "no";
}

export function consentChoiceToNoMediaConsent(choice: MediaConsentChoice): boolean {
  return choice === "no";
}

export function getMediaConsentValidationMessage(
  hasPhotography: boolean | null | undefined,
  choice: unknown,
): string | null {
  if (isMediaConsentRequired(hasPhotography) && !isValidMediaConsentChoice(choice)) {
    return "Please choose Yes or No for media consent before confirming your RSVP.";
  }
  return null;
}
