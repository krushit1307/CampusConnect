/**
 * Recommendation Engine — Content-based + Collaborative Filtering
 *
 * Provides personalized event recommendations using:
 * - Content-based filtering: match events to user preference vectors
 * - Collaborative filtering: similar users liked similar events
 * - Hybrid scoring: weighted combination of both approaches
 * - Category affinity: learn from RSVP/check-in history
 */

// ── Types ──────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  tags: string[];
  event_date: string;
  location: string;
  capacity: number;
  rsvp_count: number;
  rating: number | null;
  club_name: string;
  is_paid: boolean;
  price: number | null;
  cover_url: string | null;
}

export type EventCategory =
  | "academic"
  | "cultural"
  | "sports"
  | "tech"
  | "social"
  | "workshop"
  | "seminar"
  | "concert"
  | "exhibition"
  | "networking";

export interface UserInteraction {
  eventId: string;
  action: "rsvp" | "view" | "bookmark" | "checkin" | "skip";
  timestamp: string;
  rating?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  interactions: UserInteraction[];
  categoryAffinities: Record<EventCategory, number>;
  tagAffinities: Record<string, number>;
  clubAffinities: Record<string, number>;
  priceSensitivity: number; // 0 = price doesn't matter, 1 = strongly prefers free
  locationPreferences: string[];
  avgRatingGiven: number;
}

export interface ScoredEvent {
  event: Event;
  score: number;
  reasons: RecommendationReason[];
  contentScore: number;
  collaborativeScore: number;
  recencyScore: number;
  popularityScore: number;
}

export interface RecommendationReason {
  type:
    | "category_match"
    | "tag_match"
    | "club_match"
    | "similar_users"
    | "trending"
    | "new_for_you"
    | "price_match"
    | "location_match";
  label: string;
  weight: number;
}

export interface RecommendationSet {
  scored: ScoredEvent[];
  topPicks: ScoredEvent[];
  becauseYouLiked: ScoredEvent[];
  trendingNearYou: ScoredEvent[];
  hiddenGems: ScoredEvent[];
}

// ── Constants ──────────────────────────────────────────────────────

const WEIGHTS = {
  content: 0.4,
  collaborative: 0.25,
  recency: 0.15,
  popularity: 0.2,
} as const;

const ACTION_WEIGHTS: Record<UserInteraction["action"], number> = {
  checkin: 1.0,
  rsvp: 0.8,
  bookmark: 0.6,
  view: 0.2,
  skip: -0.5,
};

const CATEGORY_VECTORS: Record<EventCategory, number[]> = {
  academic: [1, 0, 0, 0.5, 0, 0.3, 0.2, 0, 0, 0],
  cultural: [0, 1, 0, 0, 0.5, 0, 0, 0.8, 0.3, 0.2],
  sports: [0, 0, 1, 0, 0.2, 0, 0, 0, 0, 0.3],
  tech: [0.5, 0, 0, 1, 0, 0.7, 0.3, 0, 0, 0.4],
  social: [0, 0.3, 0.2, 0, 1, 0, 0, 0.2, 0, 0.5],
  workshop: [0.3, 0, 0, 0.7, 0, 1, 0.1, 0, 0, 0.3],
  seminar: [0.7, 0.1, 0, 0.4, 0, 0.2, 1, 0, 0, 0.1],
  concert: [0, 0.8, 0, 0, 0.3, 0, 0, 1, 0.5, 0],
  exhibition: [0.1, 0.5, 0, 0.1, 0, 0, 0, 0.4, 1, 0.1],
  networking: [0.2, 0, 0.1, 0.3, 0.5, 0.3, 0.1, 0, 0, 1],
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  academic: "#3b82f6",
  cultural: "#a855f7",
  sports: "#10b981",
  tech: "#06b6d4",
  social: "#f59e0b",
  workshop: "#ec4899",
  seminar: "#6366f1",
  concert: "#f43f5e",
  exhibition: "#14b8a6",
  networking: "#f97316",
};

// ── Vector Math ────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function buildEventVector(event: Event): number[] {
  const catVec = CATEGORY_VECTORS[event.category] || new Array(10).fill(0);
  const tagBoost = event.tags.length > 0 ? 0.1 : 0;
  return catVec.map((v) => v + tagBoost * (event.tags.length > 0 ? 1 : 0));
}

// ── User Profile Builder ───────────────────────────────────────────

export function buildUserProfile(
  userId: string,
  userName: string,
  interactions: UserInteraction[],
): UserProfile {
  const categoryAffinities: Record<EventCategory, number> = {
    academic: 0,
    cultural: 0,
    sports: 0,
    tech: 0,
    social: 0,
    workshop: 0,
    seminar: 0,
    concert: 0,
    exhibition: 0,
    networking: 0,
  };

  const tagAffinities: Record<string, number> = {};
  const clubAffinities: Record<string, number> = {};
  const ratings: number[] = [];

  // Compute affinities from interaction history
  interactions.forEach((inter) => {
    const weight = ACTION_WEIGHTS[inter.action];
    if (inter.rating) ratings.push(inter.rating);
    // Weighted decay: recent interactions matter more
    const daysAgo = (Date.now() - new Date(inter.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-daysAgo / 90); // 90-day half-life
    const finalWeight = weight * decay;

    // These would be populated from event lookups in production
    // For now, we store the interaction data
  });

  return {
    id: userId,
    name: userName,
    interactions,
    categoryAffinities,
    tagAffinities,
    clubAffinities,
    priceSensitivity: 0.5,
    locationPreferences: [],
    avgRatingGiven: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 4.0,
  };
}

// ── Content-Based Scoring ──────────────────────────────────────────

export function contentScore(
  event: Event,
  userAffinities: Record<EventCategory, number>,
  tagAffinities: Record<string, number>,
): { score: number; reasons: RecommendationReason[] } {
  const reasons: RecommendationReason[] = [];
  let score = 0;

  // Category match
  const affinity = userAffinities[event.category] || 0;
  const categoryScore = Math.min(affinity / 5, 1); // normalize 0-5 to 0-1
  score += categoryScore * 0.5;

  if (affinity > 2) {
    reasons.push({
      type: "category_match",
      label: `You enjoy ${event.category} events`,
      weight: categoryScore,
    });
  }

  // Tag overlap
  let tagOverlap = 0;
  event.tags.forEach((tag) => {
    const tagAff = tagAffinities[tag] || 0;
    tagOverlap += Math.min(tagAff / 3, 1);
  });
  const tagScore = event.tags.length > 0 ? tagOverlap / event.tags.length : 0;
  score += tagScore * 0.3;

  if (tagScore > 0.3) {
    const topTag = event.tags.reduce(
      (best, t) => ((tagAffinities[t] || 0) > (tagAffinities[best] || 0) ? t : best),
      event.tags[0],
    );
    reasons.push({
      type: "tag_match",
      label: `Matches "${topTag}"`,
      weight: tagScore,
    });
  }

  // Club affinity
  const clubAff = userAffinities[event.category as EventCategory] || 0; // simplified
  const clubScore = Math.min(clubAff / 5, 1) * 0.2;
  score += clubScore;

  return { score: Math.min(score, 1), reasons };
}

// ── Collaborative Scoring ──────────────────────────────────────────

export function collaborativeScore(
  event: Event,
  similarUserRatings: number[],
): { score: number; reasons: RecommendationReason[] } {
  const reasons: RecommendationReason[] = [];

  if (similarUserRatings.length === 0) {
    return { score: 0, reasons };
  }

  const avgRating = similarUserRatings.reduce((a, b) => a + b, 0) / similarUserRatings.length;
  const score = Math.min(avgRating / 5, 1);

  if (avgRating >= 4.0) {
    reasons.push({
      type: "similar_users",
      label: `Loved by ${similarUserRatings.length} similar users`,
      weight: score,
    });
  }

  return { score, reasons };
}

// ── Popularity Score ───────────────────────────────────────────────

export function popularityScore(event: Event, maxRsvps: number): number {
  if (maxRsvps === 0) return 0;
  const rsvpNorm = event.rsvp_count / maxRsvps;
  const ratingNorm = event.rating ? event.rating / 5 : 0.5;
  return rsvpNorm * 0.6 + ratingNorm * 0.4;
}

// ── Recency Score ──────────────────────────────────────────────────

export function recencyScore(eventDate: string): number {
  const now = Date.now();
  const eventTime = new Date(eventDate).getTime();
  const daysUntil = (eventTime - now) / (1000 * 60 * 60 * 24);

  // Events in 1-14 days get highest recency score
  if (daysUntil < 0) return 0; // past events
  if (daysUntil <= 7) return 1.0;
  if (daysUntil <= 14) return 0.8;
  if (daysUntil <= 30) return 0.5;
  if (daysUntil <= 60) return 0.3;
  return 0.1;
}

// ── Hybrid Recommendation ──────────────────────────────────────────

export function scoreEvents(
  events: Event[],
  userCategoryAffinities: Record<EventCategory, number>,
  userTagAffinities: Record<string, number>,
  similarUserRatings: Record<string, number[]>,
): ScoredEvent[] {
  const maxRsvps = Math.max(...events.map((e) => e.rsvp_count), 1);

  return events
    .map((event) => {
      const { score: cScore, reasons: cReasons } = contentScore(
        event,
        userCategoryAffinities,
        userTagAffinities,
      );
      const { score: coScore, reasons: coReasons } = collaborativeScore(
        event,
        similarUserRatings[event.id] || [],
      );
      const pScore = popularityScore(event, maxRsvps);
      const rScore = recencyScore(event.event_date);

      const totalScore =
        cScore * WEIGHTS.content +
        coScore * WEIGHTS.collaborative +
        pScore * WEIGHTS.popularity +
        rScore * WEIGHTS.recency;

      const allReasons: RecommendationReason[] = [...cReasons, ...coReasons];

      if (rScore > 0.7) {
        allReasons.push({ type: "trending", label: "Happening soon", weight: rScore });
      }
      if (pScore > 0.7) {
        allReasons.push({ type: "trending", label: "Trending on campus", weight: pScore });
      }

      return {
        event,
        score: totalScore,
        reasons: allReasons.sort((a, b) => b.weight - a.weight).slice(0, 3),
        contentScore: cScore,
        collaborativeScore: coScore,
        recencyScore: rScore,
        popularityScore: pScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Recommendation Set Builder ─────────────────────────────────────

export function buildRecommendationSet(scored: ScoredEvent[]): RecommendationSet {
  const topPicks = scored.slice(0, 6);

  const becauseYouLiked = scored
    .filter((s) => s.reasons.some((r) => r.type === "category_match" || r.type === "tag_match"))
    .slice(0, 4);

  const trendingNearYou = scored
    .filter((s) => s.reasons.some((r) => r.type === "trending"))
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 4);

  const hiddenGems = scored
    .filter((s) => s.event.rsvp_count < s.event.capacity * 0.5 && s.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return { scored, topPicks, becauseYouLiked, trendingNearYou, hiddenGems };
}

// ── Mock Data Generator ────────────────────────────────────────────

export const MOCK_EVENTS: Event[] = [
  {
    id: "r1",
    title: "Full-Stack Web Dev Workshop",
    description:
      "Build a complete MERN stack app in 4 hours. Hands-on coding with expert guidance.",
    category: "workshop",
    tags: ["React", "Node.js", "MongoDB", "Hands-on"],
    event_date: "2026-09-10T10:00:00Z",
    location: "CS Lab B",
    capacity: 40,
    rsvp_count: 35,
    rating: 4.8,
    club_name: "Web Dev Club",
    is_paid: true,
    price: 200,
    cover_url: null,
  },
  {
    id: "r2",
    title: "Startup Pitch Night",
    description: "5 student startups pitch to VCs. Networking session after!",
    category: "networking",
    tags: ["Startup", "VC", "Pitch", "Networking"],
    event_date: "2026-09-12T18:00:00Z",
    location: "Seminar Hall 2",
    capacity: 150,
    rsvp_count: 120,
    rating: 4.7,
    club_name: "E-Cell",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r3",
    title: "Hackathon 48H — CodeSprint",
    description: "48-hour hackathon. Teams of 2-4. ₹5L prize pool.",
    category: "tech",
    tags: ["Hackathon", "Coding", "Prizes", "48hr"],
    event_date: "2026-09-05T09:00:00Z",
    location: "Innovation Hub",
    capacity: 200,
    rsvp_count: 156,
    rating: 4.9,
    club_name: "CS Club",
    is_paid: true,
    price: 200,
    cover_url: null,
  },
  {
    id: "r4",
    title: "Classical Music Night",
    description: "Hindustani classical music — sitar, tabla, and vocals.",
    category: "concert",
    tags: ["Music", "Classical", "Sitar", "Free"],
    event_date: "2026-09-08T18:00:00Z",
    location: "Open Air Theatre",
    capacity: 500,
    rsvp_count: 312,
    rating: 4.7,
    club_name: "Music Society",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r5",
    title: "AI/ML Hands-on Workshop",
    description: "Build ML models with Python. Regression, classification, neural nets.",
    category: "workshop",
    tags: ["AI", "ML", "Python", "Hands-on"],
    event_date: "2026-09-15T10:00:00Z",
    location: "Computer Lab A",
    capacity: 60,
    rsvp_count: 55,
    rating: 4.8,
    club_name: "AI/ML Club",
    is_paid: true,
    price: 150,
    cover_url: null,
  },
  {
    id: "r6",
    title: "Career Fair — Fall 2026",
    description: "30+ companies hiring for internships and full-time roles.",
    category: "networking",
    tags: ["Career", "Jobs", "Companies", "Resume"],
    event_date: "2026-09-20T09:00:00Z",
    location: "Convention Center",
    capacity: 1500,
    rsvp_count: 1100,
    rating: 4.7,
    club_name: "Placement Cell",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r7",
    title: "Photography Exhibition",
    description: "Student photography showcasing campus life and street photography.",
    category: "exhibition",
    tags: ["Photography", "Art", "Exhibition"],
    event_date: "2026-09-18T10:00:00Z",
    location: "Art Gallery",
    capacity: 300,
    rsvp_count: 89,
    rating: 4.4,
    club_name: "Photography Club",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r8",
    title: "International Food Festival",
    description: "Taste cuisines from 15 countries. Vegetarian and vegan options.",
    category: "cultural",
    tags: ["Food", "International", "Festival", "Cultural"],
    event_date: "2026-09-22T11:00:00Z",
    location: "Food Court",
    capacity: 1000,
    rsvp_count: 780,
    rating: 4.8,
    club_name: "International Club",
    is_paid: true,
    price: 100,
    cover_url: null,
  },
  {
    id: "r9",
    title: "Ethics in AI Guest Lecture",
    description: "Prof. Torres from Stanford on responsible AI development.",
    category: "seminar",
    tags: ["AI", "Ethics", "Stanford", "Lecture"],
    event_date: "2026-09-25T14:00:00Z",
    location: "Seminar Hall 1",
    capacity: 200,
    rsvp_count: 134,
    rating: 4.8,
    club_name: "Philosophy Dept",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r10",
    title: "Robotics Bot Wars",
    description: "Build and battle robots! Autonomous and manual categories.",
    category: "tech",
    tags: ["Robotics", "Competition", "Bots", "Prizes"],
    event_date: "2026-09-28T10:00:00Z",
    location: "Engineering Lab",
    capacity: 100,
    rsvp_count: 95,
    rating: 4.8,
    club_name: "Robotics Club",
    is_paid: true,
    price: 100,
    cover_url: null,
  },
  {
    id: "r11",
    title: "Open Mic Night",
    description: "Music, comedy, poetry — share your talent!",
    category: "social",
    tags: ["Open Mic", "Music", "Comedy", "Poetry"],
    event_date: "2026-09-14T19:00:00Z",
    location: "Student Center",
    capacity: 200,
    rsvp_count: 175,
    rating: 4.5,
    club_name: "Music Society",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r12",
    title: "Blockchain Seminar",
    description: "Understanding decentralized systems and smart contracts.",
    category: "seminar",
    tags: ["Blockchain", "Crypto", "Web3", "Smart Contracts"],
    event_date: "2026-09-16T14:00:00Z",
    location: "CS Seminar Room",
    capacity: 150,
    rsvp_count: 110,
    rating: 4.3,
    club_name: "CS Club",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r13",
    title: "Spring Dance Recital",
    description: "Student dance performances — classical, contemporary, hip-hop.",
    category: "cultural",
    tags: ["Dance", "Performance", "Cultural"],
    event_date: "2026-09-30T19:00:00Z",
    location: "Main Auditorium",
    capacity: 400,
    rsvp_count: 320,
    rating: 4.6,
    club_name: "Dance Club",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r14",
    title: "Data Science Workshop",
    description: "Pandas, NumPy, visualization. Bring your laptop!",
    category: "workshop",
    tags: ["Data Science", "Python", "Pandas", "Hands-on"],
    event_date: "2026-10-02T10:00:00Z",
    location: "Computer Lab B",
    capacity: 45,
    rsvp_count: 42,
    rating: 4.7,
    club_name: "AI/ML Club",
    is_paid: true,
    price: 100,
    cover_url: null,
  },
  {
    id: "r15",
    title: "Film Screening Night",
    description: "Indie film + director Q&A. Popcorn provided!",
    category: "social",
    tags: ["Film", "Cinema", "Q&A", "Free"],
    event_date: "2026-10-05T20:00:00Z",
    location: "Media Room",
    capacity: 120,
    rsvp_count: 98,
    rating: 4.2,
    club_name: "Film Society",
    is_paid: false,
    price: null,
    cover_url: null,
  },
  {
    id: "r16",
    title: "Basketball Tournament",
    description: "Inter-department basketball. Cheer for your team!",
    category: "sports",
    tags: ["Basketball", "Tournament", "Sports"],
    event_date: "2026-10-08T08:00:00Z",
    location: "Sports Complex",
    capacity: 500,
    rsvp_count: 380,
    rating: 4.4,
    club_name: "Sports Council",
    is_paid: false,
    price: null,
    cover_url: null,
  },
];

export const MOCK_SIMILAR_USER_RATINGS: Record<string, number[]> = {
  r3: [4.9, 4.8, 5.0, 4.7],
  r5: [4.8, 4.9, 4.7],
  r1: [4.8, 4.6, 4.9],
  r2: [4.7, 4.5, 4.8],
  r8: [4.8, 4.9, 4.7, 4.6],
  r9: [4.8, 4.7, 4.9],
  r10: [4.8, 4.6, 4.7],
  r4: [4.7, 4.5, 4.8],
  r6: [4.7, 4.6, 4.8, 4.9],
};

export function getCategoryColor(category: EventCategory): string {
  return CATEGORY_COLORS[category] || "#6b7280";
}

// ── User Interaction Simulator ─────────────────────────────────────

export const MOCK_USER_INTERACTIONS: UserInteraction[] = [
  { eventId: "r3", action: "checkin", timestamp: "2026-08-20T09:00:00Z", rating: 5 },
  { eventId: "r5", action: "rsvp", timestamp: "2026-08-25T10:00:00Z" },
  { eventId: "r1", action: "bookmark", timestamp: "2026-08-28T14:00:00Z" },
  { eventId: "r12", action: "view", timestamp: "2026-08-30T11:00:00Z" },
  { eventId: "r10", action: "rsvp", timestamp: "2026-09-01T09:00:00Z" },
  { eventId: "r2", action: "view", timestamp: "2026-09-02T16:00:00Z" },
  { eventId: "r14", action: "bookmark", timestamp: "2026-09-03T10:00:00Z" },
  { eventId: "r9", action: "view", timestamp: "2026-09-04T14:00:00Z" },
];

export const MOCK_USER_PREFERENCES = {
  categoryAffinities: {
    tech: 4,
    workshop: 3.5,
    seminar: 3,
    networking: 2,
    social: 2.5,
    cultural: 1,
    sports: 1,
    concert: 1.5,
    exhibition: 1,
    academic: 2,
  } as Record<EventCategory, number>,
  tagAffinities: {
    AI: 4,
    ML: 4,
    Python: 3,
    Hackathon: 5,
    Coding: 5,
    Blockchain: 3,
    "Data Science": 3,
    "Hands-on": 4,
    Prizes: 3,
  } as Record<string, number>,
};
