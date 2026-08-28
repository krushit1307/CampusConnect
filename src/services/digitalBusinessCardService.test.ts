import { describe, it, expect } from "vitest";
import {
  generateVCardString,
  encodeBusinessCardPayload,
  parseBusinessCardPayload,
} from "./digitalBusinessCardService";

describe("digitalBusinessCardService", () => {
  it("generates correct vCard 3.0 string structure", () => {
    const vcard = generateVCardString({
      name: "Jane Doe",
      email: "jane@campus.edu",
      phone: "+1234567890",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      major: "Computer Science",
      metAtEventTitle: "Hackathon 2026",
    });

    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("VERSION:3.0");
    expect(vcard).toContain("FN:Jane Doe");
    expect(vcard).toContain("EMAIL;TYPE=INTERNET:jane@campus.edu");
    expect(vcard).toContain("TEL;TYPE=CELL:+1234567890");
    expect(vcard).toContain("TITLE:Computer Science Student");
    expect(vcard).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/janedoe");
    expect(vcard).toContain("NOTE:Met via CampusConnect at event: Hackathon 2026");
    expect(vcard).toContain("END:VCARD");
  });

  it("encodes and parses business card payloads", () => {
    const payloadStr = encodeBusinessCardPayload({
      userId: "12345678-1234-1234-1234-123456789abc",
      name: "Alex Smith",
      handle: "alexsmith",
      eventId: "event-999",
    });

    const parsed = parseBusinessCardPayload(payloadStr);
    expect(parsed).not.toBeNull();
    expect(parsed?.userId).toBe("12345678-1234-1234-1234-123456789abc");
    expect(parsed?.name).toBe("Alex Smith");
    expect(parsed?.eventId).toBe("event-999");
  });
});
