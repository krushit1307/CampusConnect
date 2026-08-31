export interface GraduatingLeaderProfile {
  userId: string;
  userName: string;
  userEmail: string;
  clubId: string;
  clubName: string;
  executiveRole: string; // e.g. "President", "Admin", "Treasurer"
  graduationYear: number;
}

export interface AlumniConversionPayload {
  userId: string;
  clubId: string;
  assignedRole: "Alumni_Mentor";
  directoryProfile: {
    roleTitle: string;
    pastExperienceSummary: string;
    isMentorAvailable: boolean;
    isSpeakerAvailable: boolean;
  };
  emailNotification: {
    recipientEmail: string;
    subject: string;
    bodyText: string;
  };
}

export const EXCLUDED_NON_EXEC_ROLES = ["member", "guest"];

/**
 * Validates whether a graduating student holds an executive leadership position requiring conversion.
 */
export function isExecutiveRoleEligibleForConversion(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return !EXCLUDED_NON_EXEC_ROLES.includes(normalized);
}

/**
 * Converts a graduating club executive profile into an Alumni Mentor directory entry and welcome notification.
 */
export function convertLeaderToAlumniMentor(
  leader: GraduatingLeaderProfile,
): AlumniConversionPayload | null {
  if (!isExecutiveRoleEligibleForConversion(leader.executiveRole)) {
    return null;
  }

  const roleTitle = `Alumni Mentor (Former ${leader.executiveRole})`;
  const pastExperienceSummary = `Verified former ${leader.executiveRole} at ${leader.clubName} (Class of ${leader.graduationYear}).`;

  const emailNotification = {
    recipientEmail: leader.userEmail,
    subject: `Congratulations on graduating! Join the ${leader.clubName} Alumni Network`,
    bodyText: `Congratulations on graduating! We've automatically added you to the Alumni Mentor network so you can continue guiding ${leader.clubName}.`,
  };

  return {
    userId: leader.userId,
    clubId: leader.clubId,
    assignedRole: "Alumni_Mentor",
    directoryProfile: {
      roleTitle,
      pastExperienceSummary,
      isMentorAvailable: true,
      isSpeakerAvailable: true,
    },
    emailNotification,
  };
}
