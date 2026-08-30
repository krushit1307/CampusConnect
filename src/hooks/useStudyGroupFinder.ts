import { useState, useMemo, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StudyGroupStatus = "active" | "upcoming" | "full" | "completed" | "cancelled";
export type StudySubject =
  "math" | "science" | "cs" | "english" | "history" | "business" | "art" | "languages";
export type StudyGroupSize = "small" | "medium" | "large";
export type MeetingFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "flexible";

export interface StudyGroupMember {
  id: string;
  name: string;
  avatarUrl: string;
  joinedAt: string;
  role: "owner" | "moderator" | "member";
}

export interface StudyGroupSession {
  id: string;
  groupId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  topic: string;
  attended: string[];
  notes: string;
}

export interface StudyGroupMessage {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
  reactions: { emoji: string; count: number }[];
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: StudySubject;
  course: string;
  courseCode: string;
  status: StudyGroupStatus;
  size: StudyGroupSize;
  maxMembers: number;
  currentMembers: number;
  meetingFrequency: MeetingFrequency;
  nextSession: string;
  nextSessionTime: string;
  location: string;
  campusBuilding: string;
  createdBy: string;
  createdAt: string;
  isJoined: boolean;
  isOwner: boolean;
  tags: string[];
  members: StudyGroupMember[];
  sessions: StudyGroupSession[];
  messages: StudyGroupMessage[];
  avgRating: number;
  totalRatings: number;
  materialCount: number;
  attendanceRate: number;
}

export interface StudyGroupStats {
  totalGroups: number;
  joinedGroups: number;
  totalSessions: number;
  attendedSessions: number;
  studyHours: number;
  avgGroupSize: number;
  subjectBreakdown: Record<StudySubject, number>;
  weeklyGoalHours: number;
  currentWeekHours: number;
  streakDays: number;
  strongestSubject: string;
  peerConnections: number;
}

export interface StudyResource {
  id: string;
  groupId: string;
  title: string;
  type: "notes" | "flashcards" | "practice-problems" | "video" | "document" | "code";
  uploadedBy: string;
  uploadedAt: string;
  downloads: number;
  url: string;
}

export type StudyGroupSortOption = "relevance" | "members" | "nextSession" | "rating" | "newest";
export type StudyGroupViewMode = "grid" | "list" | "map";

export interface UseStudyGroupFinderReturn {
  groups: StudyGroup[];
  filteredGroups: StudyGroup[];
  stats: StudyGroupStats;
  resources: StudyResource[];
  subjectFilter: StudySubject | "all";
  setSubjectFilter: (f: StudySubject | "all") => void;
  statusFilter: StudyGroupStatus | "all";
  setStatusFilter: (f: StudyGroupStatus | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: StudyGroupSortOption;
  setSortBy: (s: StudyGroupSortOption) => void;
  viewMode: StudyGroupViewMode;
  setViewMode: (v: StudyGroupViewMode) => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  createGroup: (group: Partial<StudyGroup>) => void;
  sendMessage: (groupId: string, content: string) => void;
  rateGroup: (groupId: string, rating: number) => void;
  getGroupById: (groupId: string) => StudyGroup | undefined;
  getGroupsBySubject: (subject: StudySubject) => StudyGroup[];
  getRecommendedGroups: () => StudyGroup[];
  getUpcomingSessions: () => { group: StudyGroup; session: StudyGroupSession }[];
  getStudyStreak: () => number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS: Record<
  StudySubject,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  math: {
    label: "Mathematics",
    icon: "📐",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  science: {
    label: "Science",
    icon: "🔬",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  cs: {
    label: "Computer Science",
    icon: "💻",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
  },
  english: {
    label: "English",
    icon: "📖",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  history: {
    label: "History",
    icon: "🏛️",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  business: {
    label: "Business",
    icon: "📊",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  art: {
    label: "Art & Design",
    icon: "🎨",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
  },
  languages: {
    label: "Languages",
    icon: "🌍",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
  },
};

const STATUS_MAP: Record<StudyGroupStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  upcoming: { label: "Upcoming", color: "text-blue-400", bg: "bg-blue-500/10" },
  full: { label: "Full", color: "text-amber-400", bg: "bg-amber-500/10" },
  completed: { label: "Completed", color: "text-slate-400", bg: "bg-slate-500/10" },
  cancelled: { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/10" },
};

const SIZE_MAP: Record<StudyGroupSize, { label: string; range: string }> = {
  small: { label: "Small", range: "2-5" },
  medium: { label: "Medium", range: "6-12" },
  large: { label: "Large", range: "13-25" },
};

const FREQUENCY_MAP: Record<MeetingFrequency, { label: string; icon: string }> = {
  daily: { label: "Daily", icon: "📅" },
  weekly: { label: "Weekly", icon: "📆" },
  biweekly: { label: "Bi-weekly", icon: "🗓️" },
  monthly: { label: "Monthly", icon: "🕋" },
  flexible: { label: "Flexible", icon: "🔄" },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_MEMBERS_1: StudyGroupMember[] = [
  { id: "u-1", name: "Alice Chen", avatarUrl: "", joinedAt: "2026-08-01", role: "owner" },
  { id: "u-2", name: "Bob Martinez", avatarUrl: "", joinedAt: "2026-08-02", role: "moderator" },
  { id: "u-3", name: "Carol Davis", avatarUrl: "", joinedAt: "2026-08-05", role: "member" },
  { id: "u-4", name: "David Kim", avatarUrl: "", joinedAt: "2026-08-08", role: "member" },
];

const MOCK_MEMBERS_2: StudyGroupMember[] = [
  { id: "u-5", name: "Eva Wilson", avatarUrl: "", joinedAt: "2026-07-20", role: "owner" },
  { id: "u-6", name: "Frank Lee", avatarUrl: "", joinedAt: "2026-07-22", role: "member" },
  { id: "u-7", name: "Grace Park", avatarUrl: "", joinedAt: "2026-07-25", role: "member" },
];

const MOCK_MEMBERS_3: StudyGroupMember[] = [
  { id: "u-8", name: "Henry Zhang", avatarUrl: "", joinedAt: "2026-08-10", role: "owner" },
  { id: "u-9", name: "Ivy Patel", avatarUrl: "", joinedAt: "2026-08-11", role: "member" },
  { id: "u-10", name: "Jack Thompson", avatarUrl: "", joinedAt: "2026-08-12", role: "member" },
  { id: "u-11", name: "Kate Brown", avatarUrl: "", joinedAt: "2026-08-14", role: "member" },
  { id: "u-12", name: "Leo Garcia", avatarUrl: "", joinedAt: "2026-08-15", role: "member" },
  { id: "u-13", name: "Mia Johnson", avatarUrl: "", joinedAt: "2026-08-16", role: "member" },
];

const MOCK_GROUPS: StudyGroup[] = [
  {
    id: "sg-1",
    name: "Calculus II Study Squad",
    description:
      "Tackling integrals, series, and differential equations together. We meet weekly to work through problem sets, review lecture material, and prepare for exams. All levels welcome—peer teaching is encouraged!",
    subject: "math",
    course: "Calculus II",
    courseCode: "MATH 202",
    status: "active",
    size: "small",
    maxMembers: 6,
    currentMembers: 4,
    meetingFrequency: "weekly",
    nextSession: "2026-09-02",
    nextSessionTime: "18:00",
    location: "Library Room 204",
    campusBuilding: "Main Library",
    createdBy: "u-1",
    createdAt: "2026-08-01",
    isJoined: true,
    isOwner: true,
    tags: ["calculus", "problem-solving", "exams"],
    members: MOCK_MEMBERS_1,
    sessions: [
      {
        id: "ss-1",
        groupId: "sg-1",
        date: "2026-08-26",
        startTime: "18:00",
        endTime: "20:00",
        location: "Library Room 204",
        topic: "Integration by Parts Review",
        attended: ["u-1", "u-2", "u-3", "u-4"],
        notes: "Covered Ch. 7 problems",
      },
      {
        id: "ss-2",
        groupId: "sg-1",
        date: "2026-08-19",
        startTime: "18:00",
        endTime: "20:00",
        location: "Library Room 204",
        topic: "Series Convergence Tests",
        attended: ["u-1", "u-2", "u-3"],
        notes: "Practiced ratio and root tests",
      },
    ],
    messages: [
      {
        id: "m-1",
        authorId: "u-1",
        authorName: "Alice Chen",
        content: "Hey everyone! Ready for tomorrow's session on Taylor series?",
        timestamp: "2026-08-30T14:00:00Z",
        reactions: [{ emoji: "👍", count: 3 }],
      },
      {
        id: "m-2",
        authorId: "u-2",
        authorName: "Bob Martinez",
        content:
          "I found a great video on Taylor series intuition. Will share it during the session.",
        timestamp: "2026-08-30T15:30:00Z",
        reactions: [{ emoji: "🔥", count: 2 }],
      },
      {
        id: "m-3",
        authorId: "u-3",
        authorName: "Carol Davis",
        content: "Can we also review the error bounds? I'm struggling with that part.",
        timestamp: "2026-08-30T16:15:00Z",
        reactions: [],
      },
    ],
    avgRating: 4.8,
    totalRatings: 12,
    materialCount: 15,
    attendanceRate: 92,
  },
  {
    id: "sg-2",
    name: "Data Structures & Algorithms",
    description:
      "LeetCode grinding and DS&A mastery. We tackle 2-3 problems per session, discuss time/space complexity, and share problem-solving patterns. Perfect for interview prep or acing CS courses.",
    subject: "cs",
    course: "Data Structures & Algorithms",
    courseCode: "CS 301",
    status: "active",
    size: "medium",
    maxMembers: 10,
    currentMembers: 7,
    meetingFrequency: "biweekly",
    nextSession: "2026-09-04",
    nextSessionTime: "19:00",
    location: "CS Building Lab 105",
    campusBuilding: "Computer Science Building",
    createdBy: "u-5",
    createdAt: "2026-07-20",
    isJoined: true,
    isOwner: false,
    tags: ["leetcode", "algorithms", "interview-prep", "graphs"],
    members: MOCK_MEMBERS_2,
    sessions: [
      {
        id: "ss-3",
        groupId: "sg-2",
        date: "2026-08-21",
        startTime: "19:00",
        endTime: "21:30",
        location: "CS Building Lab 105",
        topic: "Binary Search Variations",
        attended: ["u-5", "u-6", "u-7"],
        notes: "Solved 4 medium problems",
      },
    ],
    messages: [
      {
        id: "m-4",
        authorId: "u-5",
        authorName: "Eva Wilson",
        content: "Who's up for a graph problems marathon this Thursday?",
        timestamp: "2026-08-29T10:00:00Z",
        reactions: [{ emoji: "🚀", count: 5 }],
      },
      {
        id: "m-5",
        authorId: "u-6",
        authorName: "Frank Lee",
        content: "Count me in! I've been stuck on topological sort problems.",
        timestamp: "2026-08-29T11:00:00Z",
        reactions: [],
      },
    ],
    avgRating: 4.6,
    totalRatings: 18,
    materialCount: 23,
    attendanceRate: 85,
  },
  {
    id: "sg-3",
    name: "Organic Chemistry Explorers",
    description:
      "Mastering OChem reactions, mechanisms, and stereochemistry. We use molecular model kits, practice mechanism drawing, and quiz each other before exams.",
    subject: "science",
    course: "Organic Chemistry I",
    courseCode: "CHEM 310",
    status: "active",
    size: "medium",
    maxMembers: 8,
    currentMembers: 6,
    meetingFrequency: "weekly",
    nextSession: "2026-09-03",
    nextSessionTime: "17:00",
    location: "Chemistry Building Room 312",
    campusBuilding: "Chemistry Building",
    createdBy: "u-8",
    createdAt: "2026-08-10",
    isJoined: false,
    isOwner: false,
    tags: ["organic-chemistry", "reactions", "mechanisms", "stereochemistry"],
    members: MOCK_MEMBERS_3,
    sessions: [
      {
        id: "ss-4",
        groupId: "sg-3",
        date: "2026-08-27",
        startTime: "17:00",
        endTime: "19:00",
        location: "Chemistry Building Room 312",
        topic: "SN1 vs SN2 Reactions",
        attended: ["u-8", "u-9", "u-10", "u-11", "u-12", "u-13"],
        notes: "Great session with model kit demos",
      },
    ],
    messages: [
      {
        id: "m-6",
        authorId: "u-8",
        authorName: "Henry Zhang",
        content: "Reminder: Midterm review session next week. Bring your practice problems!",
        timestamp: "2026-08-28T09:00:00Z",
        reactions: [{ emoji: "📝", count: 4 }],
      },
    ],
    avgRating: 4.9,
    totalRatings: 22,
    materialCount: 31,
    attendanceRate: 95,
  },
  {
    id: "sg-4",
    name: "Essay Writing Workshop",
    description:
      "Collaborative essay workshops. We peer-review drafts, discuss thesis construction, practice citation styles, and share writing strategies for humanities courses.",
    subject: "english",
    course: "Academic Writing",
    courseCode: "ENG 102",
    status: "upcoming",
    size: "small",
    maxMembers: 5,
    currentMembers: 2,
    meetingFrequency: "weekly",
    nextSession: "2026-09-05",
    nextSessionTime: "14:00",
    location: "Humanities Center Room 110",
    campusBuilding: "Humanities Center",
    createdBy: "u-14",
    createdAt: "2026-08-20",
    isJoined: false,
    isOwner: false,
    tags: ["essay-writing", "peer-review", "thesis", "citations"],
    members: [
      { id: "u-14", name: "Nina Rodriguez", avatarUrl: "", joinedAt: "2026-08-20", role: "owner" },
      { id: "u-15", name: "Oscar Wright", avatarUrl: "", joinedAt: "2026-08-22", role: "member" },
    ],
    sessions: [],
    messages: [],
    avgRating: 4.3,
    totalRatings: 5,
    materialCount: 8,
    attendanceRate: 88,
  },
  {
    id: "sg-5",
    name: "Microeconomics Masterclass",
    description:
      "Breaking down supply/demand curves, market equilibrium, and game theory. We solve problem sets together and prepare for Prof. Adams' notoriously tricky exams.",
    subject: "business",
    course: "Principles of Microeconomics",
    courseCode: "ECON 201",
    status: "active",
    size: "large",
    maxMembers: 20,
    currentMembers: 14,
    meetingFrequency: "weekly",
    nextSession: "2026-09-01",
    nextSessionTime: "16:00",
    location: "Business School Auditorium B",
    campusBuilding: "Business School",
    createdBy: "u-16",
    createdAt: "2026-07-15",
    isJoined: false,
    isOwner: false,
    tags: ["economics", "game-theory", "supply-demand", "problem-sets"],
    members: Array.from({ length: 14 }, (_, i) => ({
      id: `u-econ-${i}`,
      name: `Student ${i + 1}`,
      avatarUrl: "",
      joinedAt: `2026-07-${String(15 + i).padStart(2, "0")}`,
      role: i === 0 ? ("owner" as const) : ("member" as const),
    })),
    sessions: [
      {
        id: "ss-5",
        groupId: "sg-5",
        date: "2026-08-25",
        startTime: "16:00",
        endTime: "18:00",
        location: "Business School Auditorium B",
        topic: "Market Structures Review",
        attended: Array.from({ length: 12 }, (_, i) => `u-econ-${i}`),
        notes: "Covered perfect competition and monopoly",
      },
    ],
    messages: [
      {
        id: "m-7",
        authorId: "u-econ-0",
        authorName: "Student 1",
        content: "Practice exam posted in the resources tab. Try it before our next session!",
        timestamp: "2026-08-28T12:00:00Z",
        reactions: [{ emoji: "📄", count: 8 }],
      },
    ],
    avgRating: 4.4,
    totalRatings: 30,
    materialCount: 42,
    attendanceRate: 78,
  },
  {
    id: "sg-6",
    name: "AP Art History Prep",
    description:
      "Visual analysis practice and art movement review. We discuss key works, practice essay responses, and use flashcards for identification quizzes.",
    subject: "art",
    course: "Art History",
    courseCode: "ART 205",
    status: "active",
    size: "small",
    maxMembers: 4,
    currentMembers: 3,
    meetingFrequency: "biweekly",
    nextSession: "2026-09-06",
    nextSessionTime: "11:00",
    location: "Fine Arts Building Gallery",
    campusBuilding: "Fine Arts Building",
    createdBy: "u-17",
    createdAt: "2026-08-05",
    isJoined: false,
    isOwner: false,
    tags: ["art-history", "visual-analysis", "flashcards", "essay-prep"],
    members: [
      { id: "u-17", name: "Priya Sharma", avatarUrl: "", joinedAt: "2026-08-05", role: "owner" },
      { id: "u-18", name: "Quinn Adams", avatarUrl: "", joinedAt: "2026-08-06", role: "member" },
      { id: "u-19", name: "Riley Foster", avatarUrl: "", joinedAt: "2026-08-08", role: "member" },
    ],
    sessions: [],
    messages: [],
    avgRating: 4.7,
    totalRatings: 8,
    materialCount: 12,
    attendanceRate: 90,
  },
  {
    id: "sg-7",
    name: "French Conversation Circle",
    description:
      "Practice French speaking in a relaxed, judgment-free environment. We discuss current events, play word games, and watch French films together.",
    subject: "languages",
    course: "Intermediate French",
    courseCode: "FREN 201",
    status: "active",
    size: "medium",
    maxMembers: 12,
    currentMembers: 9,
    meetingFrequency: "weekly",
    nextSession: "2026-09-03",
    nextSessionTime: "12:00",
    location: "Language Lab 3",
    campusBuilding: "Modern Languages Hall",
    createdBy: "u-20",
    createdAt: "2026-07-30",
    isJoined: false,
    isOwner: false,
    tags: ["french", "conversation", "language-practice", "film"],
    members: Array.from({ length: 9 }, (_, i) => ({
      id: `u-fr-${i}`,
      name: `French Student ${i + 1}`,
      avatarUrl: "",
      joinedAt: `2026-07-${String(30 + i).padStart(2, "0")}`,
      role: i === 0 ? ("owner" as const) : ("member" as const),
    })),
    sessions: [
      {
        id: "ss-6",
        groupId: "sg-7",
        date: "2026-08-27",
        startTime: "12:00",
        endTime: "13:30",
        location: "Language Lab 3",
        topic: "Subjunctive Mood Practice",
        attended: Array.from({ length: 8 }, (_, i) => `u-fr-${i}`),
        notes: "Practiced subjunctive with emotion verbs",
      },
    ],
    messages: [],
    avgRating: 4.5,
    totalRatings: 15,
    materialCount: 19,
    attendanceRate: 82,
  },
  {
    id: "sg-8",
    name: "US History Think Tank",
    description:
      "Deep dives into American history from Reconstruction to the present. We analyze primary sources, debate historical interpretations, and write practice DBQs.",
    subject: "history",
    course: "US History Since 1877",
    courseCode: "HIST 305",
    status: "full",
    size: "small",
    maxMembers: 5,
    currentMembers: 5,
    meetingFrequency: "weekly",
    nextSession: "2026-09-02",
    nextSessionTime: "15:00",
    location: "History Department Seminar Room",
    campusBuilding: "Liberal Arts Building",
    createdBy: "u-21",
    createdAt: "2026-07-10",
    isJoined: false,
    isOwner: false,
    tags: ["history", "primary-sources", "DBQ", "debate"],
    members: Array.from({ length: 5 }, (_, i) => ({
      id: `u-hist-${i}`,
      name: `History Student ${i + 1}`,
      avatarUrl: "",
      joinedAt: `2026-07-${String(10 + i).padStart(2, "0")}`,
      role: i === 0 ? ("owner" as const) : ("member" as const),
    })),
    sessions: [
      {
        id: "ss-7",
        groupId: "sg-8",
        date: "2026-08-26",
        startTime: "15:00",
        endTime: "17:00",
        location: "History Department Seminar Room",
        topic: "Reconstruction Era Analysis",
        attended: Array.from({ length: 5 }, (_, i) => `u-hist-${i}`),
        notes: "Discussed 14th and 15th Amendments",
      },
    ],
    messages: [],
    avgRating: 4.2,
    totalRatings: 10,
    materialCount: 7,
    attendanceRate: 96,
  },
];

const MOCK_RESOURCES: StudyResource[] = [
  {
    id: "r-1",
    groupId: "sg-1",
    title: "Integration Techniques Cheat Sheet",
    type: "document",
    uploadedBy: "Alice Chen",
    uploadedAt: "2026-08-25",
    downloads: 34,
    url: "#",
  },
  {
    id: "r-2",
    groupId: "sg-1",
    title: "Practice Problem Set - Taylor Series",
    type: "practice-problems",
    uploadedBy: "Bob Martinez",
    uploadedAt: "2026-08-28",
    downloads: 28,
    url: "#",
  },
  {
    id: "r-3",
    groupId: "sg-2",
    title: "LeetCode Patterns Guide",
    type: "document",
    uploadedBy: "Eva Wilson",
    uploadedAt: "2026-08-20",
    downloads: 56,
    url: "#",
  },
  {
    id: "r-4",
    groupId: "sg-2",
    title: "Graph Algorithms Flashcards",
    type: "flashcards",
    uploadedBy: "Frank Lee",
    uploadedAt: "2026-08-22",
    downloads: 41,
    url: "#",
  },
  {
    id: "r-5",
    groupId: "sg-2",
    title: "Sorting Algorithm Visualizer Code",
    type: "code",
    uploadedBy: "Grace Park",
    uploadedAt: "2026-08-24",
    downloads: 33,
    url: "#",
  },
  {
    id: "r-6",
    groupId: "sg-3",
    title: "Reaction Mechanism Notes",
    type: "notes",
    uploadedBy: "Henry Zhang",
    uploadedAt: "2026-08-26",
    downloads: 45,
    url: "#",
  },
  {
    id: "r-7",
    groupId: "sg-3",
    title: "SN1 vs SN2 Decision Tree",
    type: "flashcards",
    uploadedBy: "Ivy Patel",
    uploadedAt: "2026-08-27",
    downloads: 38,
    url: "#",
  },
  {
    id: "r-8",
    groupId: "sg-5",
    title: "Econ Problem Set Solutions",
    type: "document",
    uploadedBy: "Student 1",
    uploadedAt: "2026-08-24",
    downloads: 62,
    url: "#",
  },
  {
    id: "r-9",
    groupId: "sg-5",
    title: "Supply/Demand Video Lecture",
    type: "video",
    uploadedBy: "Student 3",
    uploadedAt: "2026-08-20",
    downloads: 78,
    url: "#",
  },
  {
    id: "r-10",
    groupId: "sg-6",
    title: "Art Movement Timeline",
    type: "notes",
    uploadedBy: "Priya Sharma",
    uploadedAt: "2026-08-15",
    downloads: 19,
    url: "#",
  },
  {
    id: "r-11",
    groupId: "sg-7",
    title: "French Verb Conjugation Table",
    type: "document",
    uploadedBy: "French Student 1",
    uploadedAt: "2026-08-18",
    downloads: 24,
    url: "#",
  },
  {
    id: "r-12",
    groupId: "sg-1",
    title: "Calculus II Exam Review Video",
    type: "video",
    uploadedBy: "Carol Davis",
    uploadedAt: "2026-08-29",
    downloads: 15,
    url: "#",
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

function getSortComparator(sortBy: StudyGroupSortOption) {
  return (a: StudyGroup, b: StudyGroup): number => {
    switch (sortBy) {
      case "members":
        return b.currentMembers - a.currentMembers;
      case "nextSession":
        return new Date(a.nextSession).getTime() - new Date(b.nextSession).getTime();
      case "rating":
        return b.avgRating - a.avgRating;
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "relevance":
      default: {
        const aScore = (a.isJoined ? 100 : 0) + a.avgRating * 20 + a.currentMembers;
        const bScore = (b.isJoined ? 100 : 0) + b.avgRating * 20 + b.currentMembers;
        return bScore - aScore;
      }
    }
  };
}

function computeStudyStreak(groups: StudyGroup[]): number {
  const attendedDates = new Set<string>();
  groups.forEach((g) => {
    g.sessions.forEach((s) => {
      if (s.attended.includes("u-1")) {
        attendedDates.add(s.date);
      }
    });
  });

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (attendedDates.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStudyGroupFinder(): UseStudyGroupFinderReturn {
  const [groups, setGroups] = useState<StudyGroup[]>(MOCK_GROUPS);
  const [resources] = useState<StudyResource[]>(MOCK_RESOURCES);
  const [subjectFilter, setSubjectFilter] = useState<StudySubject | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StudyGroupStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<StudyGroupSortOption>("relevance");
  const [viewMode, setViewMode] = useState<StudyGroupViewMode>("grid");

  const joinGroup = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              isJoined: true,
              currentMembers: g.currentMembers + 1,
              status: g.currentMembers + 1 >= g.maxMembers ? "full" : g.status,
              members: [
                ...g.members,
                {
                  id: `u-self-${Date.now()}`,
                  name: "You",
                  avatarUrl: "",
                  joinedAt: new Date().toISOString().split("T")[0],
                  role: "member" as const,
                },
              ],
            }
          : g,
      ),
    );
  }, []);

  const leaveGroup = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              isJoined: false,
              isOwner: false,
              currentMembers: Math.max(0, g.currentMembers - 1),
              status: g.status === "full" ? "active" : g.status,
            }
          : g,
      ),
    );
  }, []);

  const createGroup = useCallback((partial: Partial<StudyGroup>) => {
    const newGroup: StudyGroup = {
      id: `sg-${Date.now()}`,
      name: partial.name || "Untitled Group",
      description: partial.description || "",
      subject: partial.subject || "cs",
      course: partial.course || "",
      courseCode: partial.courseCode || "",
      status: "active",
      size: partial.size || "small",
      maxMembers: partial.maxMembers || 5,
      currentMembers: 1,
      meetingFrequency: partial.meetingFrequency || "weekly",
      nextSession: partial.nextSession || new Date().toISOString().split("T")[0],
      nextSessionTime: partial.nextSessionTime || "18:00",
      location: partial.location || "TBD",
      campusBuilding: partial.campusBuilding || "TBD",
      createdBy: "u-self",
      createdAt: new Date().toISOString().split("T")[0],
      isJoined: true,
      isOwner: true,
      tags: partial.tags || [],
      members: [
        {
          id: "u-self",
          name: "You",
          avatarUrl: "",
          joinedAt: new Date().toISOString().split("T")[0],
          role: "owner",
        },
      ],
      sessions: [],
      messages: [],
      avgRating: 0,
      totalRatings: 0,
      materialCount: 0,
      attendanceRate: 0,
      ...partial,
    };
    setGroups((prev) => [newGroup, ...prev]);
  }, []);

  const sendMessage = useCallback((groupId: string, content: string) => {
    const msg: StudyGroupMessage = {
      id: `m-${Date.now()}`,
      authorId: "u-self",
      authorName: "You",
      content,
      timestamp: new Date().toISOString(),
      reactions: [],
    };
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, messages: [...g.messages, msg] } : g)),
    );
  }, []);

  const rateGroup = useCallback((groupId: string, rating: number) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const newTotal = g.totalRatings + 1;
        const newAvg = (g.avgRating * g.totalRatings + rating) / newTotal;
        return { ...g, avgRating: Math.round(newAvg * 10) / 10, totalRatings: newTotal };
      }),
    );
  }, []);

  const filteredGroups = useMemo(() => {
    return groups
      .filter((g) => subjectFilter === "all" || g.subject === subjectFilter)
      .filter((g) => statusFilter === "all" || g.status === statusFilter)
      .filter((g) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          g.name.toLowerCase().includes(q) ||
          g.course.toLowerCase().includes(q) ||
          g.courseCode.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort(getSortComparator(sortBy));
  }, [groups, subjectFilter, statusFilter, searchQuery, sortBy]);

  const stats = useMemo<StudyGroupStats>(() => {
    const joinedGroups = groups.filter((g) => g.isJoined);
    const totalSessions = joinedGroups.reduce((s, g) => s + g.sessions.length, 0);
    const attendedSessions = joinedGroups.reduce(
      (s, g) =>
        s +
        g.sessions.filter((ss) => ss.attended.includes("u-1") || ss.attended.includes("u-self"))
          .length,
      0,
    );

    const subjectBreakdown: Record<StudySubject, number> = {
      math: 0,
      science: 0,
      cs: 0,
      english: 0,
      history: 0,
      business: 0,
      art: 0,
      languages: 0,
    };
    joinedGroups.forEach((g) => {
      subjectBreakdown[g.subject] = (subjectBreakdown[g.subject] || 0) + 1;
    });

    const strongestSubject = Object.entries(subjectBreakdown).sort(([, a], [, b]) => b - a)[0];

    return {
      totalGroups: groups.length,
      joinedGroups: joinedGroups.length,
      totalSessions,
      attendedSessions,
      studyHours: attendedSessions * 2.5,
      avgGroupSize:
        groups.length > 0 ? groups.reduce((s, g) => s + g.currentMembers, 0) / groups.length : 0,
      subjectBreakdown,
      weeklyGoalHours: 10,
      currentWeekHours: 5,
      streakDays: computeStudyStreak(groups),
      strongestSubject: strongestSubject
        ? SUBJECTS[strongestSubject[0] as StudySubject].label
        : "N/A",
      peerConnections: joinedGroups.reduce((s, g) => s + g.currentMembers, 0),
    };
  }, [groups]);

  const getGroupById = useCallback(
    (groupId: string) => groups.find((g) => g.id === groupId),
    [groups],
  );

  const getGroupsBySubject = useCallback(
    (subject: StudySubject) => groups.filter((g) => g.subject === subject),
    [groups],
  );

  const getRecommendedGroups = useCallback(() => {
    return groups
      .filter((g) => !g.isJoined && g.status !== "full" && g.status !== "cancelled")
      .sort((a, b) => {
        const aScore = a.avgRating * 20 + a.currentMembers + (a.attendanceRate > 90 ? 50 : 0);
        const bScore = b.avgRating * 20 + b.currentMembers + (b.attendanceRate > 90 ? 50 : 0);
        return bScore - aScore;
      })
      .slice(0, 5);
  }, [groups]);

  const getUpcomingSessions = useCallback(() => {
    const upcoming: { group: StudyGroup; session: StudyGroupSession }[] = [];
    groups.forEach((g) => {
      if (g.isJoined) {
        g.sessions.forEach((s) => {
          upcoming.push({ group: g, session: s });
        });
      }
    });
    return upcoming.sort(
      (a, b) => new Date(a.session.date).getTime() - new Date(b.session.date).getTime(),
    );
  }, [groups]);

  const getStudyStreak = useCallback(() => computeStudyStreak(groups), [groups]);

  return {
    groups,
    filteredGroups,
    stats,
    resources,
    subjectFilter,
    setSubjectFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    joinGroup,
    leaveGroup,
    createGroup,
    sendMessage,
    rateGroup,
    getGroupById,
    getGroupsBySubject,
    getRecommendedGroups,
    getUpcomingSessions,
    getStudyStreak,
  };
}

export { SUBJECTS, STATUS_MAP, SIZE_MAP, FREQUENCY_MAP };
