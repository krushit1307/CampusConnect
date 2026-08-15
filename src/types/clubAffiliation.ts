// src/types/clubAffiliation.ts

export interface ClubAffiliation {
  club_id: string;
  club_name: string;
  club_slug?: string;
  club_logo_url?: string;
  role_name: string;
}

export function isExecutiveRole(roleName: string): boolean {
  if (!roleName) return false;
  const normalized = roleName.trim().toLowerCase();
  const nonExecRoles = ["member", "general member", "subscriber", "applicant", "guest"];
  return !nonExecRoles.includes(normalized);
}
