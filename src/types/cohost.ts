export type CoHostStatus = 'pending' | 'approved' | 'declined' | 'revoked';

export interface CoHostClub {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  category: string;
  presidentName: string;
}

export interface CoHostPartnership {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  initiatingClub: CoHostClub;
  invitedClub: CoHostClub;
  status: CoHostStatus;
  requestedAt: string;
  respondedAt?: string;
  responseNote?: string;
  grantExecutivePermissions: boolean; // Full edit/RSVP/check-in access
}

export interface CoHostInvitePayload {
  eventId: string;
  targetClubId: string;
  grantExecutivePermissions: boolean;
  invitationMessage: string;
}
