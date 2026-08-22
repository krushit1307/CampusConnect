import { describe, it, expect } from "vitest";
import {
  validateRegistrationTerms,
  getTermsCheckboxInputProps,
  TERMS_REQUIRED_ERROR_MESSAGE,
} from "./termsValidation";

describe("Ensure Terms of Service Checkbox Required Suite (#3838)", () => {
  it("rejects registration submission when acceptedTerms is false or missing", () => {
    const invalidResult = validateRegistrationTerms({ acceptedTerms: false });

    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errorMessage).toBe(TERMS_REQUIRED_ERROR_MESSAGE);
  });

  it("passes validation when acceptedTerms is true", () => {
    const validResult = validateRegistrationTerms({
      email: "student@university.edu",
      fullName: "Jane Doe",
      acceptedTerms: true,
    });

    expect(validResult.isValid).toBe(true);
    expect(validResult.errorMessage).toBeUndefined();
  });

  it("returns HTML checkbox input props with required and aria-required attributes", () => {
    const inputProps = getTermsCheckboxInputProps(false);

    expect(inputProps.required).toBe(true);
    expect(inputProps["aria-required"]).toBe(true);
    expect(inputProps.type).toBe("checkbox");
  });
});
