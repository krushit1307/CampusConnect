export const CONSTITUTION_RATIFICATION_COPY = {
  title: "Constitution Ratification Required",
  description:
    "This club's constitution has been updated. Review the current document and agree to it to retain your active membership.",
  reviewLabel: "I have reviewed the current club constitution and understand its terms.",
  legalNameLabel: "Type your full legal name",
  legalNameHint: "Your name is recorded as your digital signature for this constitution version.",
  submit: "Agree & Retain Membership",
} as const;

export function normalizeLegalName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidLegalName(value: string): boolean {
  const normalized = normalizeLegalName(value);
  return normalized.length >= 2 && normalized.split(" ").filter(Boolean).length >= 2;
}

export function getLegalNameValidationMessage(value: string): string | null {
  if (!isValidLegalName(value)) {
    return "Enter your full legal name, including at least a first and last name.";
  }
  return null;
}
