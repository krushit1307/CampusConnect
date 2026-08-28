// src/lib/ticket/fraudDetection.test.ts
import { describe, it, expect } from "vitest";

function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    "10minutemail.com",
    "10minutemail.co.za",
    "10minutemail",
    "tempmail.com",
    "tempmail",
    "mailinator.com",
    "yopmail.com",
    "guerrillamail.com",
    "dispostable.com",
    "sharklasers.com",
  ];
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return disposableDomains.some((d) => domain.includes(d) || domain === d);
}

describe("Automated Fraud Detection - Heuristics", () => {
  it("should flag known disposable email domains", () => {
    expect(isDisposableEmail("bot1@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("spammer@tempmail.com")).toBe(true);
    expect(isDisposableEmail("attacker@mailinator.com")).toBe(true);
    expect(isDisposableEmail("bot2@10minutemail.co.za")).toBe(true);
  });

  it("should not flag legitimate student or personal domains", () => {
    expect(isDisposableEmail("student@university.edu")).toBe(false);
    expect(isDisposableEmail("president@club.org")).toBe(false);
    expect(isDisposableEmail("john.doe@gmail.com")).toBe(false);
    expect(isDisposableEmail("jane.smith@yahoo.com")).toBe(false);
  });
});
