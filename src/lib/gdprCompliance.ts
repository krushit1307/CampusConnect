export interface UserProfileData {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface UserRsvpRecord {
  id: string;
  eventId: string;
  status: string;
  createdAt: string;
}

export interface UserGdprExportPayload {
  profile: UserProfileData;
  rsvps: UserRsvpRecord[];
  exportedAt: string;
}

export interface ClubAdminRole {
  clubId: string;
  clubName: string;
  soleAdmin: boolean;
}

/**
 * Validates whether a user can safely delete their account without leaving orphaned clubs.
 */
export function validateAccountDeletionSafety(adminRoles: ClubAdminRole[]): {
  canDelete: boolean;
  blockingClubs: string[];
  reason?: string;
} {
  const blockingClubs = adminRoles.filter((role) => role.soleAdmin).map((role) => role.clubName);

  if (blockingClubs.length > 0) {
    return {
      canDelete: false,
      blockingClubs,
      reason: `Account cannot be deleted because you are the sole administrator of: ${blockingClubs.join(
        ", ",
      )}. Please transfer club ownership or delete the club first.`,
    };
  }

  return {
    canDelete: true,
    blockingClubs: [],
  };
}

/**
 * Formats aggregated raw user data into a downloadable JSON file payload.
 */
export function formatGdprExportJson(
  profile: UserProfileData,
  rsvps: UserRsvpRecord[],
): UserGdprExportPayload {
  return {
    profile,
    rsvps,
    exportedAt: new Date().toISOString(),
  };
}
