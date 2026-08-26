export interface PhoneLinkAttributes {
  href: string;
  formattedDisplay: string;
  className: string;
}

export const DEFAULT_PHONE_LINK_CLASSES =
  "text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 font-medium";

/**
 * Sanitizes phone number string into clean tel: URI protocol format (removing spaces, dashes, parens).
 */
export function sanitizeTelHref(phoneNumber: string): string {
  if (!phoneNumber) return "";
  // Strip non-numeric characters except leading '+' for country codes
  const cleaned = phoneNumber.replace(/(?!^\+)[^\d]/g, "");
  return `tel:${cleaned}`;
}

/**
 * Resolves attributes for rendering a clickable tel: phone link.
 */
export function getPhoneLinkProps(
  phoneNumber?: string | null,
  customClassName = DEFAULT_PHONE_LINK_CLASSES,
): PhoneLinkAttributes | null {
  if (!phoneNumber || phoneNumber.trim().length === 0) {
    return null;
  }

  const raw = phoneNumber.trim();
  const href = sanitizeTelHref(raw);

  return {
    href,
    formattedDisplay: raw,
    className: customClassName,
  };
}
