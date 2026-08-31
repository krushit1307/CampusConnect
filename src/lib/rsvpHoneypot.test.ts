import { describe, it, expect } from "vitest";
import {
  getHoneypotElementProps,
  evaluateRsvpClaimHoneypot,
  HONEYPOT_TIER_ID,
  RsvpClaimPayload,
} from "./rsvpHoneypot";

describe("Implement Automated Fraudulent RSVP Honeypot Suite (#4413)", () => {
  it("provides hidden DOM element props with aria-hidden and position offscreen", () => {
    const props = getHoneypotElementProps();

    expect(props.value).toBe(HONEYPOT_TIER_ID);
    expect(props.ariaHidden).toBe(true);
    expect(props.style.display).toBe("none");
    expect(props.style.left).toBe("-9999px");
  });

  it("permits standard human RSVP claims targeting legitimate ticket tiers", () => {
    const humanClaim: RsvpClaimPayload = {
      eventId: "evt_concert_2026",
      ticketTierId: "tier_general_admission",
      userEmail: "student@university.edu",
      clientIp: "192.168.1.50",
    };

    const result = evaluateRsvpClaimHoneypot(humanClaim);

    expect(result.isBotDetected).toBe(false);
    expect(result.actionTaken).toBe("PERMIT");
  });

  it("traps headless bots submitting hidden_admin_pass tier and triggers instant IP & domain ban", () => {
    const botClaim: RsvpClaimPayload = {
      eventId: "evt_concert_2026",
      ticketTierId: HONEYPOT_TIER_ID,
      userEmail: "bot99@scrapenetwork.com",
      clientIp: "198.51.100.42",
    };

    const result = evaluateRsvpClaimHoneypot(botClaim);

    expect(result.isBotDetected).toBe(true);
    expect(result.actionTaken).toBe("INSTANT_BAN");
    expect(result.bannedIp).toBe("198.51.100.42");
    expect(result.blacklistedDomain).toBe("scrapenetwork.com");
    expect(result.errorMessage).toContain("Automated bot activity detected");
  });
});
