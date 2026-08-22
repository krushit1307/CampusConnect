export interface MailtoLinkOptions {
  email?: string | null;
  clubName?: string;
  subject?: string;
  body?: string;
}

export interface RenderedMailtoProps {
  href: string;
  displayEmail: string;
  isValid: boolean;
  cssClass: string;
}

export const DEFAULT_LINK_CLASSES =
  "text-blue-500 hover:underline hover:text-blue-600 transition-colors";

/**
 * Validates and constructs an interactive mailto: link href with optional subject and body query params.
 */
export function buildClubMailtoHref(options: MailtoLinkOptions): string {
  if (!options.email || options.email.trim().length === 0) {
    return "";
  }

  const cleanEmail = options.email.trim();
  const params = new URLSearchParams();

  if (options.subject) {
    params.append("subject", options.subject);
  } else if (options.clubName) {
    params.append("subject", `Inquiry regarding ${options.clubName}`);
  }

  if (options.body) {
    params.append("body", options.body);
  }

  const queryString = params.toString();
  return queryString ? `mailto:${cleanEmail}?${queryString}` : `mailto:${cleanEmail}`;
}

/**
 * Resolves properties for anchor tag rendering on the Club Profile UI.
 */
export function resolveClubContactMailtoProps(
  options: MailtoLinkOptions,
  customCssClass?: string,
): RenderedMailtoProps {
  const href = buildClubMailtoHref(options);
  const displayEmail = options.email?.trim() || "";
  const isValid = href.startsWith("mailto:");

  return {
    href,
    displayEmail,
    isValid,
    cssClass: customCssClass || DEFAULT_LINK_CLASSES,
  };
}
