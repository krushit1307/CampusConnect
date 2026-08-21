import { describe, expect, it } from "vitest";
import { generateVCard } from "./vcardUtils";

describe("generateVCard", () => {
  it("should generate a valid vCard string for a standard full name", () => {
    const user = { full_name: "John Doe", email: "john@example.com" };
    const result = generateVCard(user);

    expect(result).toContain("BEGIN:VCARD");
    expect(result).toContain("VERSION:3.0");
    expect(result).toContain("FN:John Doe");
    expect(result).toContain("N:Doe;John;;;");
    expect(result).toContain("EMAIL;TYPE=INTERNET:john@example.com");
    expect(result).toContain("END:VCARD");
  });

  it("should handle single word names correctly", () => {
    const user = { full_name: "Admin", email: "admin@campusconnect.com" };
    const result = generateVCard(user);

    expect(result).toContain("FN:Admin");
    expect(result).toContain("N:Admin;;;");
    expect(result).toContain("EMAIL;TYPE=INTERNET:admin@campusconnect.com");
  });

  it("should handle multi-word names correctly", () => {
    const user = { full_name: "Mary Jane Watson", email: "mary@example.com" };
    const result = generateVCard(user);

    expect(result).toContain("FN:Mary Jane Watson");
    expect(result).toContain("N:Watson;Jane Mary;;;");
    expect(result).toContain("EMAIL;TYPE=INTERNET:mary@example.com");
  });
});
