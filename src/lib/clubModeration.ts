export type ClubApprovalStatus = "pending" | "approved" | "rejected";

export interface PendingClubRegistration {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  submitterName: string;
}

export function mergeClubSubmitters(
  clubs: Omit<PendingClubRegistration, "submitterName">[],
  profiles: { id: string; first_name: string | null; last_name: string | null }[],
): PendingClubRegistration[] {
  const namesById = new Map(
    profiles.map((profile) => [
      profile.id,
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown user",
    ]),
  );

  return clubs.map((club) => ({
    ...club,
    submitterName: club.created_by
      ? namesById.get(club.created_by) || "Unknown user"
      : "Unknown user",
  }));
}

export function formatSubmissionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
