/**
 * Study Group Scheduler — Type Definitions
 *
 * Study group management, session scheduling, attendance tracking,
 * note sharing, and collaboration analytics.
 */

export const SUBJECTS = [
  'Data Structures', 'Algorithms', 'Linear Algebra', 'Calculus',
  'Operating Systems', 'Databases', 'Machine Learning', 'Physics',
  'Economics', 'Statistics', 'Networking', 'Compiler Design',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const GROUP_STATUSES = ['Active', 'Paused', 'Completed', 'Recruiting'] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const SESSION_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const MEMBER_ROLES = ['Owner', 'Admin', 'Member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const NOTE_TYPES = ['Lecture Notes', 'Problem Set', 'Flashcards', 'Summary', 'Past Exam', 'Video Recording'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const SUBJECT_COLORS: Record<Subject, string> = {
  'Data Structures': '#3b82f6', 'Algorithms': '#8b5cf6', 'Linear Algebra': '#06b6d4',
  'Calculus': '#f59e0b', 'Operating Systems': '#22c55e', 'Databases': '#ec4899',
  'Machine Learning': '#ef4444', 'Physics': '#14b8a6', 'Economics': '#f97316',
  'Statistics': '#a855f7', 'Networking': '#6366f1', 'Compiler Design': '#78716c',
};

export const STATUS_COLORS: Record<GroupStatus, string> = {
  'Active': '#22c55e', 'Paused': '#eab308', 'Completed': '#6b7280', 'Recruiting': '#3b82f6',
};

export const SESSION_COLORS: Record<SessionStatus, string> = {
  'Scheduled': '#3b82f6', 'In Progress': '#22c55e', 'Completed': '#6b7280', 'Cancelled': '#ef4444',
};

export const SUBJECT_ICONS: Record<Subject, string> = {
  'Data Structures': '🏗️', 'Algorithms': '🧮', 'Linear Algebra': '📐', 'Calculus': '∫',
  'Operating Systems': '🖥️', 'Databases': '🗄️', 'Machine Learning': '🤖', 'Physics': '⚛️',
  'Economics': '📈', 'Statistics': '📊', 'Networking': '🌐', 'Compiler Design': '⚙️',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface StudyGroup {
  id: string;
  name: string;
  subject: Subject;
  status: GroupStatus;
  description: string;
  owner: string;
  memberCount: number;
  maxMembers: number;
  tags: string[];
  createdAt: string;
  nextSession?: string;
  totalSessions: number;
  avgAttendance: number; // 0-100
  totalNotes: number;
  weeklyGoal: number; // hours
  actualWeeklyHours: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  studentId: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  sessionsAttended: number;
  totalSessions: number;
  contributionScore: number; // 0-100
  isActive: boolean;
}

export interface StudySession {
  id: string;
  groupId: string;
  groupName: string;
  subject: Subject;
  title: string;
  description: string;
  status: SessionStatus;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  isVirtual: boolean;
  host: string;
  attendees: number;
  expectedAttendees: number;
  topicsCovered: string[];
  notes?: string;
  rating?: number; // 1-5
}

export interface SharedNote {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  type: NoteType;
  subject: Subject;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: string;
  downloads: number;
  rating: number; // 1-5
  tags: string[];
}

export interface GroupActivity {
  id: string;
  groupId: string;
  groupName: string;
  type: 'session' | 'note' | 'member' | 'milestone' | 'goal';
  description: string;
  timestamp: string;
  icon: string;
}

export interface CollaborationTrend {
  month: string;
  totalGroups: number;
  totalSessions: number;
  totalNotes: number;
  avgAttendance: number;
  activeMembers: number;
}

export interface SubjectStats {
  subject: Subject;
  groupCount: number;
  totalMembers: number;
  avgAttendance: number;
  totalNotes: number;
  avgSessionRating: number;
}

export interface StudyGroupSummary {
  totalGroups: number;
  activeGroups: number;
  recruitingGroups: number;
  totalMembers: number;
  totalSessions: number;
  totalNotes: number;
  avgAttendance: number;
  avgSessionRating: number;
  topSubject: Subject;
  completionRate: number;
}

export interface StudyInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatCapacity(current: number, max: number): string {
  return `${current}/${max}`;
}
