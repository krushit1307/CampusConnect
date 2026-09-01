export type ClubRiskLevel = "Standard" | "High_Minors";
export type BackgroundCheckStatus = "pending" | "clear" | "consider" | "failed";

export function requiresLeadershipBackgroundCheck(riskLevel: string | null | undefined): boolean {
  return riskLevel === "High_Minors";
}

export function normalizeBackgroundCheckStatus(
  value: unknown,
): Exclude<BackgroundCheckStatus, "pending"> {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "clear") return "clear";
  if (normalized === "consider" || normalized === "pre_adverse_action") return "consider";
  return "failed";
}

export function shouldGrantLeadershipRole(status: BackgroundCheckStatus): boolean {
  return status === "clear";
}

export function shouldRouteToManualReview(status: BackgroundCheckStatus): boolean {
  return status === "consider";
}
