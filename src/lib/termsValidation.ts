export interface RegistrationFormData {
  email: string;
  fullName: string;
  acceptedTerms: boolean;
}

export interface TermsValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export const TERMS_REQUIRED_ERROR_MESSAGE =
  "You must agree to the Terms of Service to create an account.";

/**
 * Validates registration form submission payload ensuring Terms of Service acceptance.
 */
export function validateRegistrationTerms(
  data: Partial<RegistrationFormData>,
): TermsValidationResult {
  if (!data.acceptedTerms) {
    return {
      isValid: false,
      errorMessage: TERMS_REQUIRED_ERROR_MESSAGE,
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Generates HTML input attribute configuration for the Terms of Service checkbox input.
 */
export function getTermsCheckboxInputProps(acceptedTerms: boolean) {
  return {
    type: "checkbox" as const,
    required: true,
    "aria-required": true,
    checked: acceptedTerms,
  };
}
