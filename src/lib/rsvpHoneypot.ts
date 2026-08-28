export const HONEYPOT_TIER_ID = "hidden_admin_pass";

export const HONEYPOT_DOM_STYLING = {
  display: "none",
  opacity: 0,
  position: "absolute" as const,
  left: "-9999px",
  pointerEvents: "none" as const,
};

export interface RsvpClaimPayload {
  eventId: string;
  ticketTierId: string;
  userEmail: string;
  clientIp: string;
}

export interface HoneypotTrapResult {
  isBotDetected: boolean;
  actionTaken: "PERMIT" | "INSTANT_BAN";
  bannedIp?: string;
  blacklistedDomain?: string;
  errorMessage?: string;
}

/**
 * Returns HTML/CSS attributes required to render the hidden honeypot ticket element in the DOM.
 */
export function getHoneypotElementProps() {
  return {
    id: `ticket_tier_${HONEYPOT_TIER_ID}`,
    name: "ticket_tier_id",
    value: HONEYPOT_TIER_ID,
    tabIndex: -1,
    ariaHidden: true,
    style: HONEYPOT_DOM_STYLING,
    className: "sr-only hidden-honeypot-input",
  };
}

/**
 * Evaluates incoming RSVP POST request claims.
 * Instantly traps and bans requests attempting to claim the hidden honeypot tier ID.
 */
export function evaluateRsvpClaimHoneypot(payload: RsvpClaimPayload): HoneypotTrapResult {
  if (payload.ticketTierId === HONEYPOT_TIER_ID) {
    const emailDomain = payload.userEmail.includes("@")
      ? payload.userEmail.trim().toLowerCase().split("@")[1]
      : "unknown";

    return {
      isBotDetected: true,
      actionTaken: "INSTANT_BAN",
      bannedIp: payload.clientIp,
      blacklistedDomain: emailDomain,
      errorMessage: "Automated bot activity detected. Access permanently denied.",
    };
  }

  return {
    isBotDetected: false,
    actionTaken: "PERMIT",
  };
}
