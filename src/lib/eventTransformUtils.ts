type Profile = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  full_name?: string | null;
  handle?: string | null;
};

export type EventRsvp = {
  id: string;
  user_id: string;
  status: string;
  checked_in?: boolean;
  profiles: Profile[] | Profile | null;
  accommodations_requested?: string | null;
};

export type EventWaitlist = {
  id: string;
  user_id: string;
  created_at?: string;
  profiles: Profile[] | Profile | null;
};

export type PersonCard = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  rsvpId?: string;
  hasAccommodation?: boolean;
};

export type KanbanColumns = {
  waitlisted: PersonCard[];
  approved: PersonCard[];
  rejected: PersonCard[];
};

export function extractProfile(profiles: Profile[] | Profile | null): Profile | null {
  return Array.isArray(profiles) ? profiles[0] : profiles;
}

export function buildPersonName(profile: Profile | null): string {
  if (!profile) return "Unknown User";
  return profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.full_name || "Unknown User";
}

function toPersonCard(
  entry: EventRsvp | EventWaitlist,
  profile: Profile | null,
  prefix: string,
): PersonCard {
  return {
    id: `${prefix}-${entry.id}`,
    userId: entry.user_id,
    name: buildPersonName(profile),
    avatarUrl: profile?.avatar_url || null,
    hasAccommodation:
      "accommodations_requested" in entry && !!(entry as EventRsvp).accommodations_requested,
    ...("rsvpId" in entry ? { rsvpId: entry.id } : {}),
  };
}

export function buildKanbanColumns(waitlist: EventWaitlist[], rsvps: EventRsvp[]): KanbanColumns {
  const waitlistCards = (waitlist || []).map((w) =>
    toPersonCard(w, extractProfile(w.profiles), "waitlist"),
  );

  const rsvpWaitlistCards = (rsvps || [])
    .filter((r) => r.status === "waitlisted")
    .map((r) => toPersonCard(r, extractProfile(r.profiles), "rsvp"));

  const approvedCards = (rsvps || [])
    .filter((r) => r.status === "approved" || !r.status)
    .map((r) => toPersonCard(r, extractProfile(r.profiles), "rsvp"));

  const rejectedCards = (rsvps || [])
    .filter((r) => r.status === "rejected")
    .map((r) => toPersonCard(r, extractProfile(r.profiles), "rsvp"));

  return {
    waitlisted: [...waitlistCards, ...rsvpWaitlistCards],
    approved: approvedCards,
    rejected: rejectedCards,
  };
}

export function buildRsvpStatus(
  rsvps: EventRsvp[],
  userId: string | undefined,
  endDate: string | null | undefined,
) {
  const list = Array.isArray(rsvps) ? rsvps : [];
  const hasRsvpd = userId ? list.some((r) => r.user_id === userId) : false;
  const isCheckedIn = userId ? list.some((r) => r.user_id === userId && r.checked_in) : false;
  const hasEnded = endDate ? new Date() > new Date(endDate) : false;
  return { hasRsvpd, isCheckedIn, hasEnded };
}

export function buildFeedbackStatus(feedbacks: unknown[] | undefined, userId: string | undefined) {
  const hasSubmittedFeedback = Array.isArray(feedbacks)
    ? feedbacks.some((f) => (f as { user_id: string }).user_id === userId)
    : false;
  return { hasSubmittedFeedback };
}

export function buildWaitlistInfo(rawWaitlist: unknown, userId: string | undefined) {
  const waitlist = Array.isArray(rawWaitlist)
    ? [...(rawWaitlist as { id: string; user_id: string; created_at?: string }[])].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      )
    : [];
  const isOnWaitlist = userId ? waitlist.some((w) => w.user_id === userId) : false;
  const waitlistPosition =
    userId && isOnWaitlist ? waitlist.findIndex((w) => w.user_id === userId) + 1 : 0;
  return { waitlist, isOnWaitlist, waitlistPosition };
}

export function buildGoogleMapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?q=${encodeURIComponent(location)}`;
}
