export interface CspPolicyOptions {
  nonce: string;
  reportUri?: string;
  isDevelopment?: boolean;
}

export interface CspViolationReport {
  documentUri: string;
  blockedUri: string;
  violatedDirective: string;
  originalPolicy: string;
  timestamp: string;
}

/**
 * Generates a cryptographically secure random base64 nonce.
 */
export function generateCspNonce(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    // Base64 encoding
    return btoa(String.fromCharCode(...array));
  }
  // Fallback for non-crypto environments
  return btoa(Math.random().toString(36).substring(2) + Date.now().toString());
}

/**
 * Constructs a strict Content-Security-Policy header string.
 */
export function buildStrictCspHeader(options: CspPolicyOptions): string {
  const { nonce, reportUri, isDevelopment } = options;

  const scriptSrc = isDevelopment
    ? `'self' 'unsafe-eval' 'nonce-${nonce}' https://js.stripe.com`
    : `'self' 'nonce-${nonce}' https://js.stripe.com`;

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`, // Required for Framer Motion and UI libraries
    `img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com`,
    `connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co`,
    `font-src 'self' data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Parses and sanitizes CSP violation reports received from browser endpoints.
 */
export function parseCspViolationReport(
  rawBody: Record<string, unknown>,
): CspViolationReport | null {
  const report = (rawBody["csp-report"] || rawBody) as Record<string, string>;

  if (!report || !report["blocked-uri"] || !report["violated-directive"]) {
    return null;
  }

  return {
    documentUri: report["document-uri"] || report["documentUri"] || "unknown",
    blockedUri: report["blocked-uri"] || report["blockedUri"],
    violatedDirective: report["violated-directive"] || report["violatedDirective"],
    originalPolicy: report["original-policy"] || report["originalPolicy"] || "",
    timestamp: new Date().toISOString(),
  };
}
