export interface CookieConsentPreferences {
  essential: true; // Always true for platform operation
  analytics: boolean;
  marketing: boolean;
  version: string;
}

export interface ScriptExecutionState {
  googleAnalyticsLoaded: boolean;
  mixpanelLoaded: boolean;
  metaPixelLoaded: boolean;
  purgedCookies: string[];
}

export const CONSENT_COOKIE_NAME = "campusconnect_gdpr_consent";
export const CURRENT_CONSENT_VERSION = "2026.1";

export const TRACKING_COOKIES: Record<string, string[]> = {
  analytics: ["_ga", "_ga_*", "mp_*_mixpanel"],
  marketing: ["_fbp", "fr", "_gcl_au"],
};

/**
 * Parses raw Cookie header string or document.cookie to retrieve stored GDPR consent preferences.
 */
export function parseStoredConsentCookie(cookieHeader: string): CookieConsentPreferences | null {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`));
  if (!match || !match[1]) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    if (parsed.version !== CURRENT_CONSENT_VERSION) return null;
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

/**
 * Generates Set-Cookie header string for stored consent preferences.
 */
export function serializeConsentCookie(analytics: boolean, marketing: boolean): string {
  const payload: CookieConsentPreferences = {
    essential: true,
    analytics,
    marketing,
    version: CURRENT_CONSENT_VERSION,
  };

  const encoded = encodeURIComponent(JSON.stringify(payload));
  return `${CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

/**
 * Conditionally executes or halts third-party tracking scripts based on granular consent.
 */
export function evaluateAndExecuteTrackingScripts(
  preferences: CookieConsentPreferences,
): ScriptExecutionState {
  const state: ScriptExecutionState = {
    googleAnalyticsLoaded: false,
    mixpanelLoaded: false,
    metaPixelLoaded: false,
    purgedCookies: [],
  };

  if (preferences.analytics) {
    state.googleAnalyticsLoaded = true;
    state.mixpanelLoaded = true;
  } else {
    state.purgedCookies.push(...TRACKING_COOKIES.analytics);
  }
  if (preferences.marketing) {
    state.metaPixelLoaded = true;
  } else {
    state.purgedCookies.push(...TRACKING_COOKIES.marketing);
  }

  return state;
}
