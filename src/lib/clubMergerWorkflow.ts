export interface MemberRosterItem {
  userId: string;
  userEmail: string;
  clubId: string;
  role: "PRESIDENT" | "OFFICER" | "MEMBER";
}

export interface MergerProposalInput {
  sourceClubAId: string;
  sourceClubBId: string;
  newClubName: string;
  presidentAUserId: string;
}

export interface MergerExecutionPayload {
  newClubId: string;
  newClubName: string;
  mergedMemberEmails: string[];
  totalEventsMigrated: number;
}

/**
  Validates that two distinct clubs and valid presidential authorization are present for merger initiation.
 */
export function validateMergerProposal(input: MergerProposalInput): {
  isValid: boolean;
  error?: string;
} {
  if (input.sourceClubAId === input.sourceClubBId) {
    return { isValid: false, error: "Cannot merge a club into itself." };
  }

  if (!input.newClubName || input.newClubName.trim().length < 3) {
    return { isValid: false, error: "A valid new club name is required (min 3 chars)." };
  }

  if (!input.presidentAUserId) {
    return { isValid: false, error: "President authorization from proposing club is required." };
  }

  return { isValid: true };
}

/**
  Deduplicates rosters from Club A and Club B to prevent duplicate user constraint violations.
 */
export function deduplicateMergedRoster(
  rosterA: MemberRosterItem[],
  rosterB: MemberRosterItem[],
  newClubId: string,
): { uniqueRoster: MemberRosterItem[]; uniqueEmails: string[] } {
  const seenUserIds = new Set<string>();
  const uniqueRoster: MemberRosterItem[] = [];
  const uniqueEmails: string[] = [];

  const combined = [...rosterA, ...rosterB];

  for (const member of combined) {
    if (!seenUserIds.has(member.userId)) {
      seenUserIds.add(member.userId);
      uniqueRoster.push({
        ...member,
        clubId: newClubId,
      });
      uniqueEmails.push(member.userEmail);
    }
  }

  return { uniqueRoster, uniqueEmails };
}

/**
  Builds automated email notification payloads explaining the merger to all combined members.
 */
export function buildMergerNotificationEmail(
  memberEmail: string,
  oldClubNames: string[],
  newClubName: string,
): { subject: string; bodyHtml: string } {
  const subject = `Welcome to ${newClubName}! (Club Merger Announcement)`;
  const clubsList = oldClubNames.join(" and ");

  const bodyHtml = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
      <h2>Exciting News About Your Club Membership</h2>
      <p>We are thrilled to announce that <strong>${clubsList}</strong> have officially merged to create <strong>${newClubName}</strong>!</p>
      <p>Your membership, event history, and active balances have been seamlessly transferred. No action is required on your part.</p>
      <p><a href="https://campusconnect.edu/clubs">Explore the New Club Page</a></p>
    </div>
  `.trim();

  return { subject, bodyHtml };
}
