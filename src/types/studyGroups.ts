/**
 * Campus Study Groups
 *
 * Students create study groups for courses, schedule study sessions,
 * invite members, and share resources. Groups can be public or invite-only.
 */

export type GroupPrivacy = "public" | "private" | "invite_only";
export type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MemberRole = "owner" | "admin" | "member";

export interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  course_code: string | null;
  course_name: string | null;
  privacy: GroupPrivacy;
  max_members: number | null;
  member_count: number;
  is_member: boolean;
  user_role: MemberRole | null;
  created_by: string;
  created_by_name: string;
  created_by_avatar: string | null;
  tags: string[];
  next_session_at: string | null;
  meeting_location: string | null;
  resource_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_link: string | null;
  status: SessionStatus;
  attendee_count: number;
  user_is_attending: boolean;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  role: MemberRole;
  joined_at: string;
}

export interface GroupResource {
  id: string;
  group_id: string;
  title: string;
  url: string | null;
  description: string | null;
  resource_type: "link" | "document" | "video" | "note";
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface StudyGroupFilters {
  privacy: GroupPrivacy | "all";
  search: string;
  sort: "newest" | "most_members" | "next_session";
  has_my_groups: boolean;
}

export interface StudyGroupStats {
  total_groups: number;
  my_groups: number;
  total_sessions_scheduled: number;
  total_resources: number;
}

export const PRIVACY_META: Record<
  GroupPrivacy,
  { label: string; icon: string; bgClass: string; description: string }
> = {
  public: {
    label: "Public",
    icon: "🌍",
    bgClass: "bg-green-100 text-green-700",
    description: "Anyone can find and join",
  },
  private: {
    label: "Private",
    icon: "🔒",
    bgClass: "bg-red-100 text-red-700",
    description: "Only invited members",
  },
  invite_only: {
    label: "Invite Only",
    icon: "📩",
    bgClass: "bg-amber-100 text-amber-700",
    description: "Request to join",
  },
};

export const SESSION_STATUS_META: Record<
  SessionStatus,
  { label: string; bgClass: string; dotClass: string }
> = {
  scheduled: { label: "Scheduled", bgClass: "bg-blue-50 text-blue-700", dotClass: "bg-blue-500" },
  in_progress: {
    label: "In Progress",
    bgClass: "bg-green-50 text-green-700",
    dotClass: "bg-green-500 animate-pulse",
  },
  completed: { label: "Completed", bgClass: "bg-gray-100 text-gray-600", dotClass: "bg-gray-400" },
  cancelled: { label: "Cancelled", bgClass: "bg-red-50 text-red-600", dotClass: "bg-red-400" },
};

export const RESOURCE_TYPE_META: Record<string, { label: string; icon: string; bgClass: string }> =
  {
    link: { label: "Link", icon: "🔗", bgClass: "bg-blue-100 text-blue-700" },
    document: { label: "Document", icon: "📄", bgClass: "bg-green-100 text-green-700" },
    video: { label: "Video", icon: "🎬", bgClass: "bg-purple-100 text-purple-700" },
    note: { label: "Note", icon: "📝", bgClass: "bg-amber-100 text-amber-700" },
  };
