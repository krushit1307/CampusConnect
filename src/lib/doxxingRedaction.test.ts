import { describe, expect, it } from "vitest";
import { PII_REDACTION_TOKEN, interceptChatPayload, redactDoxxingPii } from "./doxxingRedaction";

describe("doxxing PII redaction (#5286)", () => {
  it("redacts phone numbers and campus addresses before broadcast", () => {
    const result = redactDoxxingPii(
      "The President's cell phone is 555-123-4567 and they live in Dorm Room 4B.",
    );
    expect(result.detected).toBe(true);
    expect(result.kinds).toEqual(expect.arrayContaining(["phone", "address"]));
    expect(result.redacted).toBe(
      `The President's cell phone is ${PII_REDACTION_TOKEN} and they live in ${PII_REDACTION_TOKEN}.`,
    );
  });

  it("redacts SSNs and street addresses", () => {
    const result = redactDoxxingPii("SSN 123-45-6789 at 12 Main Street");
    expect(result.detected).toBe(true);
    expect(result.kinds).toEqual(expect.arrayContaining(["ssn", "address"]));
    expect(result.redacted).toContain(PII_REDACTION_TOKEN);
    expect(result.redacted).not.toContain("123-45-6789");
    expect(result.redacted).not.toContain("12 Main Street");
  });

  it("uses NER for leftover names and locations", () => {
    const result = redactDoxxingPii("Ask Dr Jane Smith. She lives in Springfield Hall.");
    expect(result.detected).toBe(true);
    expect(result.redacted).toContain(PII_REDACTION_TOKEN);
    expect(result.redacted).not.toContain("Dr Jane Smith");
  });

  it("leaves ordinary chat untouched", async () => {
    const result = await interceptChatPayload("See you at the keynote tonight!");
    expect(result.detected).toBe(false);
    expect(result.redacted).toBe("See you at the keynote tonight!");
  });
});
