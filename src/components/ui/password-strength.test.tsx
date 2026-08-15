import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PasswordStrengthMeter, getPasswordStrength } from "./password-strength";

describe("Password Strength Meter with zxcvbn", () => {
  it("calculates low score for weak passwords like 'password'", () => {
    const result = getPasswordStrength("password");
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.feedback.warning).toBeTruthy();
  });

  it("calculates high score for strong passwords like 'CorrectHorseBatteryStaple'", () => {
    const result = getPasswordStrength("CorrectHorseBatteryStaple");
    expect(result.score).toBe(4);
  });

  it("renders visual strength meter progress bar and label", () => {
    render(<PasswordStrengthMeter password="password" />);
    expect(screen.getByText(/very weak|weak/i)).toBeInTheDocument();
  });
});
