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
  termination_reason?: "term_completed" | "resigned" | "impeached" | "removed" | "role_changed" | string | null;
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
