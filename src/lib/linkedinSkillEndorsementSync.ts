export const LINKEDIN_AUTHORIZATION_SCOPES = ["openid", "profile", "w_member_social"] as const;

export interface SeriesCertificateForLinkedIn {
  id: string;
  series_name: string;
  user_name: string;
  completion_date: string;
  verification_hash: string;
}

export interface LinkedInCertificationPayload {
  authority: {
    localized: { en_US: string };
    preferredLocale: { country: "US"; language: "en" };
  };
  name: {
    localized: { en_US: string };
    preferredLocale: { country: "US"; language: "en" };
  };
  licenseNumber: {
    localized: { en_US: string };
    preferredLocale: { country: "US"; language: "en" };
  };
  startMonthYear: { month: number; year: number };
  url: string;
}

export function normalizeSkillName(skill: string): string {
  return skill.trim().replace(/\s+/g, " ").slice(0, 120);
}

export function buildVerificationUrl(baseUrl: string, verificationHash: string): string {
  return `${baseUrl.replace(/\/$/, "")}/verify-certificate?hash=${encodeURIComponent(verificationHash)}`;
}

export function buildLinkedInAuthorizationUrl(
  authorizationEndpoint: string,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_AUTHORIZATION_SCOPES.join(" "),
  });
  return `${authorizationEndpoint}?${params.toString()}`;
}

export function buildCertificationPayload(
  certificate: SeriesCertificateForLinkedIn,
  skill: string,
  verificationUrl: string,
  authority = "CampusConnect",
): LinkedInCertificationPayload {
  const normalizedSkill = normalizeSkillName(skill);
  const completed = new Date(`${certificate.completion_date}T00:00:00Z`);
  const year = Number.isNaN(completed.getTime())
    ? new Date().getUTCFullYear()
    : completed.getUTCFullYear();
  const month = Number.isNaN(completed.getTime()) ? 1 : completed.getUTCMonth() + 1;
  const licenseNumber = `CampusConnect-${certificate.id}`;
  return {
    authority: {
      localized: { en_US: authority },
      preferredLocale: { country: "US", language: "en" },
    },
    name: {
      localized: { en_US: `${normalizedSkill} — ${certificate.series_name}` },
      preferredLocale: { country: "US", language: "en" },
    },
    licenseNumber: {
      localized: { en_US: licenseNumber },
      preferredLocale: { country: "US", language: "en" },
    },
    startMonthYear: { month, year },
    url: verificationUrl,
  };
}

export function isRetryableLinkedInStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
