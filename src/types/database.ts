/**
 * Database Type Definitions
 *
 * These interfaces map directly to the tables in our Supabase Postgres database.
 *
 * REFACTOR NOTE: All primary keys (`id`) and foreign keys have been migrated
 * from random UUIDv4s to time-sortable UUIDv7s. This means the `id` string
 * itself contains the creation timestamp in its prefix.
 *
 * As a result, we no longer need to rely heavily on `created_at` for sorting
 * or cursor-based pagination. The `id` column serves both as the unique
 * identifier and the chronological index.
 */

/**
 * Represents a user profile in the `profiles` table.
 * Auto-created via database trigger on `auth.users` insertion.
 */
export interface Profile {
  /** UUIDv7 matching auth.users.id */
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  college: string | null;
  major: string | null;
  bio: string | null;
  role: "student" | "club_admin";
  /** Fallback timestamp, kept for legacy queries but not used for primary sorting */
  created_at: string;
  updated_at: string;
  /** Set when the profile is soft-deleted; NULL means active */
  deleted_at: string | null;
}

/**
 * Represents a campus club/society in the `clubs` table.
 */
export interface Club {
  /** UUIDv7 primary key */
  id: string;
  name: string;
  /** Unique URL slug for the club (e.g., 'robotics-society') */
  slug: string;
  category: string | null;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  /** UUIDv7 of the user who created the club */
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Set when the club is soft-deleted; NULL means active */
  deleted_at: string | null;
  /** Current renewal status of the club */
  status: "active" | "pending_renewal" | "in_review" | "suspended";
}

/**
 * Join table linking users to clubs with role and approval status.
 */
export interface ClubMember {
  /** UUIDv7 primary key */
  id: string;
  /** UUIDv7 foreign key to clubs.id */
  club_id: string;
  /** UUIDv7 foreign key to profiles.id */
  user_id: string;
  role: "member" | "admin";
  status: "pending" | "approved" | "rejected" | "removed";
  joined_at?: string | null;
  removed_at?: string | null;
  termination_reason?:
    "term_completed" | "resigned" | "impeached" | "removed" | "role_changed" | string | null;
  created_at: string;
}

/**
 * Represents an event hosted by a club.
 */
export interface Event {
  /** UUIDv7 primary key (Time-sortable) */
  id: string;
  /** UUIDv7 foreign key to clubs.id */
  club_id: string;
  title: string;
  description: string | null;
  event_date: string; // timestamptz
  location: string | null;
  banner_url: string | null;
  /** UUIDv7 foreign key to profiles.id */
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Set when the event is soft-deleted; NULL means active */
  deleted_at: string | null;
  /** Flag indicating whether event generates attendance certificates */
  generates_certificate?: boolean;
  accommodation_deadline: string | null;
}

/**
 * Represents an RSVP record for a user attending an event.
 */
export interface EventRsvp {
  /** UUIDv7 primary key */
  id: string;
  /** UUIDv7 foreign key to events.id */
  event_id: string;
  /** UUIDv7 foreign key to profiles.id */
  user_id: string;
  status: "going" | "maybe" | "not_going";
  checked_in: boolean;
  created_at: string;
  accommodations_requested?: string | null;
  updated_at: string;
}

/**
 * Represents a post created within a club feed.
 */
export interface Post {
  /** UUIDv7 primary key */
  id: string;
  /** UUIDv7 foreign key to clubs.id */
  club_id: string;
  /** UUIDv7 foreign key to profiles.id */
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a comment on a club post.
 */
export interface Comment {
  /** UUIDv7 primary key */
  id: string;
  /** UUIDv7 foreign key to posts.id */
  post_id: string;
  /** UUIDv7 foreign key to profiles.id */
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a generated certificate issued to a user for attending an event or leadership service.
 */
export interface Certificate {
  /** UUIDv7 primary key */
  id: string;
  /** UUIDv7 foreign key to events.id */
  event_id?: string | null;
  /** UUIDv7 foreign key to clubs.id */
  club_id?: string | null;
  /** UUIDv7 foreign key to profiles.id */
  user_id: string;
  /** Snapshotted attendee name at issuance time */
  attendee_name?: string | null;
  /** Snapshotted event title at issuance time */
  event_title?: string | null;
  /** Snapshotted event date at issuance time */
  event_date?: string | null;
  /** Type of certificate issued */
  certificate_type?: "attendance" | "leadership";
  /** Snapshotted role title for leadership certificates */
  role_title?: string | null;
  /** Start of tenure for leadership certificates */
  tenure_start?: string | null;
  /** End of tenure for leadership certificates */
  tenure_end?: string | null;
  /** Reason for role termination if applicable */
  termination_reason?: string | null;
  /** URL to the generated PDF in Supabase Storage */
  certificate_url: string;
  issued_at: string;
  /** Timestamp when delivery email was sent */
  email_sent_at?: string | null;
}

/**
 * Represents an attendee live DJ song request in `event_song_requests`.
 */
export interface EventSongRequest {
  id: string;
  event_id: string;
  user_id: string;
  song_title: string;
  artist: string;
  album_art_url?: string | null;
  upvotes: number;
  played: boolean;
  user_has_upvoted?: boolean;
  created_at?: string;
}

export interface EventCatererContract {
  id: string;
  event_id: string;
  caterer_name: string;
  caterer_email: string;
  caterer_phone?: string | null;
  rfp_finalized_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CatererDietaryAlert {
  id: string;
  event_id: string;
  user_id?: string | null;
  attendee_name: string;
  dietary_tag: string;
  severity_level: string;
  caterer_email: string;
  caterer_phone?: string | null;
  token: string;
  alert_sent_at: string;
  acknowledgment_status: "PENDING" | "ACKNOWLEDGED";
  acknowledged_at?: string | null;
  created_at?: string;
}

export interface RefundPolicyRule {
  min_hours_before: number;
  refund_percentage: number;
}

export interface RefundPolicy {
  rules: RefundPolicyRule[];
}

export interface ProratedRefundCalculation {
  hours_before_event: number;
  refund_percentage: number;
  refund_amount_dollars: number;
  cancellation_fee_dollars: number;
  policy_description: string;
}

export interface SeatMapConfig {
  rows: number;
  cols: number;
  vip_rows: string[];
  aisle_cols: number[];
}

export interface SeatNode {
  seat_id: string;
  row_label: string;
  col_num: number;
  seat_label: string;
  section: "VIP" | "General" | "Balcony";
  status: "AVAILABLE" | "SELECTED" | "LOCKED" | "RESERVED";
}

export interface EventSeat {
  id: string;
  event_id: string;
  seat_id: string;
  seat_label: string;
  section: string;
  status: "AVAILABLE" | "LOCKED" | "RESERVED";
  reserved_by_user_id?: string | null;
  rsvp_id?: string | null;
  locked_until?: string | null;
  created_at?: string;
}

export interface SeatLockResult {
  success: boolean;
  seat_id: string;
  seat_label: string;
  status: string;
  error?: string;
}

/**
 * Database Table Enums
 */
export type UserRole = Profile["role"];
export type ClubMemberRole = ClubMember["role"];
export type ClubMemberStatus = ClubMember["status"];
export type ClubStatus = Club["status"];

/**
 * Helper type for extracting the table names from the database schema.
 * Useful for generic query builders or type-safe Supabase wrappers.
 */
export type DatabaseTable =
  | "profiles"
  | "clubs"
  | "club_members"
  | "events"
  | "event_rsvps"
  | "posts"
  | "comments"
  | "certificates";

export interface CrossClubMatch {
  id: string;
  draft_a_id: string;
  draft_b_id: string;
  club_a_id: string;
  club_b_id: string;
  club_a_name: string;
  club_b_name: string;
  similarity_score: number;
  status: "PENDING" | "PROPOSED" | "ACCEPTED" | "DECLINED";
  draft_a_budget: number;
  draft_b_budget: number;
  pooled_budget: number;
  created_at: string;
  updated_at?: string;
}

export interface TicketBundle {
  id: string;
  club_id: string;
  bundle_name: string;
  description?: string | null;
  price_dollars: number;
  original_total_price: number;
  discount_percentage: number;
  status: "ACTIVE" | "ARCHIVED";
  created_at: string;
}

export interface BundleEventItem {
  bundle_id: string;
  event_id: string;
  event_title: string;
  event_date?: string | null;
  ticket_price: number;
  max_attendees?: number | null;
  rsvp_count: number;
  is_sold_out: boolean;
}

export interface BundlePurchaseRecord {
  id: string;
  bundle_id: string;
  user_id: string;
  amount_paid: number;
  stripe_session_id?: string | null;
  status: "COMPLETED" | "REFUNDED";
  created_at: string;
}

export interface BundleAvailabilityStatus {
  available: boolean;
  bundle: TicketBundle;
  events: BundleEventItem[];
  sold_out_event_name?: string | null;
  total_savings_dollars: number;
}

export interface AlumniMentorshipAvailability {
  id: string;
  mentor_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface MentorshipSession {
  id: string;
  mentor_id: string;
  mentee_id: string;
  start_time: string;
  end_time: string;
  topic?: string | null;
  meeting_link: string;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
}

export interface BookMentorshipSessionResult {
  success: boolean;
  session_id?: string;
  mentor_id?: string;
  mentee_id?: string;
  start_time?: string;
  end_time?: string;
  meeting_link?: string;
  points_deducted?: number;
  remaining_points?: number;
  error?: string;
}

export interface CoHostRevenueSplitConfig {
  clubId: string;
  stripeAccountId: string;
  pct: number;
  isPrimary?: boolean;
}

export interface CoHostTransferItem {
  club_id: string;
  stripe_account_id: string;
  pct: number;
  amount_cents: number;
  transfer_id: string;
  status: "completed" | "refunded" | "failed";
}

export interface CoHostFinancialSplitResult {
  success: boolean;
  audit_id?: string;
  message?: string;
  transfers?: CoHostTransferItem[];
}

export interface UserLeaderboardEntry {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  monthly_points: number;
  rank_position: number;
}

export interface ClubLeaderboardEntry {
  club_id: string;
  club_name: string;
  logo_url?: string | null;
  slug: string;
  monthly_points: number;
  rank_position: number;
export interface VolunteerShift {
  id: string;
  event_id: string;
  role_name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  points_per_hour: number;
  claimed_count?: number;
  user_has_claimed?: boolean;
  created_at: string;
}

export interface ShiftClaim {
  id: string;
  shift_id: string;
  user_id: string;
  status: "claimed" | "completed" | "cancelled";
  claimed_at: string;
}

export interface ClaimShiftResult {
  success: boolean;
  claim_id?: string;
  shift_id?: string;
  user_id?: string;
  role_name?: string;
  duration_hours?: number;
  points_awarded?: number;
  error?: string;
}

/**
 * Generic Row Type
 * Maps a table name to its corresponding TypeScript interface.
 */
export type DatabaseRow<T extends DatabaseTable> = T extends "profiles"
  ? Profile
  : T extends "clubs"
    ? Club
    : T extends "club_members"
      ? ClubMember
      : T extends "events"
        ? Event
        : T extends "event_rsvps"
          ? EventRsvp
          : T extends "posts"
            ? Post
            : T extends "comments"
              ? Comment
              : T extends "certificates"
                ? Certificate
                : never;
