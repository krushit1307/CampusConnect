import { useState, useMemo } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Search from "lucide-react/dist/esm/icons/search";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import Users from "lucide-react/dist/esm/icons/users";
import Clock from "lucide-react/dist/esm/icons/clock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Star from "lucide-react/dist/esm/icons/star";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Zap from "lucide-react/dist/esm/icons/zap";
import Target from "lucide-react/dist/esm/icons/target";
import Award from "lucide-react/dist/esm/icons/award";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Filter from "lucide-react/dist/esm/icons/filter";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Shield from "lucide-react/dist/esm/icons/shield";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";

// ─── Types ──────────────────────────────────────────────────
interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  description: string;
  members: number;
  maxMembers: number;
  creator: string;
  creatorAvatar: string;
  location: string;
  schedule: string;
  nextSession: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  rating: number;
  totalSessions: number;
  attendanceRate: number;
  resources: { name: string; type: "notes" | "video" | "problem-set" | "flashcards" }[];
  announcements: { text: string; date: string }[];
  memberAvatars: string[];
  active: boolean;
}

// ─── Sample Data ────────────────────────────────────────────
const SUBJECTS = [
  "Data Structures & Algorithms",
  "Operating Systems",
  "Database Management",
  "Computer Networks",
  "Machine Learning",
  "Web Development",
  "Linear Algebra",
  "Discrete Mathematics",
  "Compiler Design",
  "Artificial Intelligence",
  "Cloud Computing",
  "Cybersecurity",
];

const LOCATIONS = [
  "Library Room 204",
  "CS Building Lab 3",
  "Student Center B2",
  "Engineering Hall 110",
  "Online (Zoom)",
  "Coffee Corner",
  "Study Room A",
  "Open Air Theatre",
];

const AVATARS = ["🧑‍💻", "👩‍🔬", "👨‍🎓", "👩‍🏫", "🧑‍🔬", "👨‍💻", "👩‍🎓", "🧑‍🏫", "👨‍🔬", "👩‍💻"];

const STUDY_GROUPS: StudyGroup[] = [
  {
    id: "sg-1",
    name: "DSA Problem Solvers",
    subject: "Data Structures & Algorithms",
    description:
      "Weekly problem-solving sessions covering arrays, trees, graphs, DP, and system design. We solve 5 problems per session with peer explanations.",
    members: 12,
    maxMembers: 15,
    creator: "Priya Sharma",
    creatorAvatar: "👩‍💻",
    location: "CS Building Lab 3",
    schedule: "Tue & Thu, 6:00 PM - 8:00 PM",
    nextSession: "Tomorrow, 6:00 PM",
    difficulty: "intermediate",
    tags: ["LeetCode", "Arrays", "Trees", "DP", "Graphs"],
    rating: 4.8,
    totalSessions: 24,
    attendanceRate: 87,
    resources: [
      { name: "DSA Cheat Sheet", type: "notes" },
      { name: "NeetCode Roadmap", type: "problem-set" },
      { name: "Graph Theory Playlist", type: "video" },
    ],
    announcements: [
      { text: "Next session: Graph DFS/BFS patterns", date: "2 hours ago" },
      { text: "Welcome new members! Check the resource bank.", date: "3 days ago" },
    ],
    memberAvatars: ["🧑‍💻", "👩‍🔬", "👨‍🎓", "👩‍🏫", "🧑‍🔬"],
    active: true,
  },
  {
    id: "sg-2",
    name: "OS Study Circle",
    subject: "Operating Systems",
    description:
      "Deep dive into process management, memory management, file systems, and concurrency. Includes quiz sessions before exams.",
    members: 8,
    maxMembers: 10,
    creator: "Arjun Patel",
    creatorAvatar: "👨‍💻",
    location: "Library Room 204",
    schedule: "Wed, 5:00 PM - 7:00 PM",
    nextSession: "Wednesday, 5:00 PM",
    difficulty: "advanced",
    tags: ["OS", "Processes", "Threads", "Memory", "Deadlock"],
    rating: 4.6,
    totalSessions: 18,
    attendanceRate: 82,
    resources: [
      { name: "OS Concepts PDF", type: "notes" },
      { name: "Process Scheduling Simulator", type: "problem-set" },
      { name: "GATE OS Previous Papers", type: "flashcards" },
    ],
    announcements: [
      { text: "Midterm review session this week!", date: "1 day ago" },
    ],
    memberAvatars: ["👨‍💻", "👩‍🔬", "🧑‍🎓", "👨‍🎓"],
    active: true,
  },
  {
    id: "sg-3",
    name: "ML Research Lab",
    subject: "Machine Learning",
    description:
      "Hands-on ML sessions with paper readings, model implementations, and Kaggle competition prep. All skill levels welcome.",
    members: 15,
    maxMembers: 20,
    creator: "Sneha Reddy",
    creatorAvatar: "👩‍🔬",
    location: "Engineering Hall 110",
    schedule: "Sat, 10:00 AM - 1:00 PM",
    nextSession: "Saturday, 10:00 AM",
    difficulty: "intermediate",
    tags: ["ML", "Python", "TensorFlow", "Kaggle", "Papers"],
    rating: 4.9,
    totalSessions: 30,
    attendanceRate: 91,
    resources: [
      { name: "ML Paper Collection", type: "notes" },
      { name: "Kaggle Starter Kit", type: "problem-set" },
      { name: "Stanford CS229 Lectures", type: "video" },
    ],
    announcements: [
      { text: "Kaggle competition starts next week!", date: "5 hours ago" },
      { text: "Paper reading: Attention Is All You Need", date: "2 days ago" },
    ],
    memberAvatars: ["👩‍🔬", "🧑‍💻", "👨‍🎓", "👩‍🏫", "🧑‍🔬", "👨‍💻"],
    active: true,
  },
  {
    id: "sg-4",
    name: "Web Dev Bootcamp",
    subject: "Web Development",
    description:
      "Full-stack web development study group. Weekly projects, code reviews, and tech talks on React, Node.js, and modern frameworks.",
    members: 20,
    maxMembers: 25,
    creator: "Rohan Mehta",
    creatorAvatar: "🧑‍🏫",
    location: "Student Center B2",
    schedule: "Mon & Fri, 4:00 PM - 6:00 PM",
    nextSession: "Friday, 4:00 PM",
    difficulty: "beginner",
    tags: ["React", "Node.js", "TypeScript", "Tailwind", "Projects"],
    rating: 4.7,
    totalSessions: 35,
    attendanceRate: 85,
    resources: [
      { name: "React Hooks Guide", type: "notes" },
      { name: "30 Projects in 30 Days", type: "problem-set" },
      { name: "Traversy Media Playlist", type: "video" },
    ],
    announcements: [
      { text: "Project showcase this Friday!", date: "12 hours ago" },
    ],
    memberAvatars: ["🧑‍🏫", "👨‍💻", "👩‍💻", "🧑‍💻", "👨‍🎓"],
    active: true,
  },
  {
    id: "sg-5",
    name: "DBMS Masters",
    subject: "Database Management",
    description:
      "SQL practice, normalization, indexing, and transaction management. Includes mock interview prep for database roles.",
    members: 10,
    maxMembers: 12,
    creator: "Ananya Singh",
    creatorAvatar: "👩‍🎓",
    location: "Online (Zoom)",
    schedule: "Thu, 7:00 PM - 9:00 PM",
    nextSession: "Thursday, 7:00 PM",
    difficulty: "intermediate",
    tags: ["SQL", "PostgreSQL", "Normalization", "Indexing", "NoSQL"],
    rating: 4.5,
    totalSessions: 16,
    attendanceRate: 78,
    resources: [
      { name: "SQL Practice Problems", type: "problem-set" },
      { name: "DB Design Patterns", type: "notes" },
      { name: "CMU 15-445 Lectures", type: "video" },
    ],
    announcements: [],
    memberAvatars: ["👩‍🎓", "🧑‍💻", "👨‍💻"],
    active: true,
  },
  {
    id: "sg-6",
    name: "CN Study Squad",
    subject: "Computer Networks",
    description:
      "Networking fundamentals through Wireshark labs, protocol analysis, and OSI model deep dives. Perfect for exam prep.",
    members: 6,
    maxMembers: 10,
    creator: "Vikram Kumar",
    creatorAvatar: "🧑‍🔬",
    location: "CS Building Lab 3",
    schedule: "Wed & Fri, 6:00 PM - 7:30 PM",
    nextSession: "Friday, 6:00 PM",
    difficulty: "beginner",
    tags: ["TCP/IP", "OSI", "Wireshark", "HTTP", "DNS"],
    rating: 4.3,
    totalSessions: 12,
    attendanceRate: 75,
    resources: [
      { name: "Network+ Study Guide", type: "notes" },
      { name: "Wireshark Labs", type: "problem-set" },
    ],
    announcements: [
      { text: "Wireshark lab session this Friday!", date: "1 day ago" },
    ],
    memberAvatars: ["🧑‍🔬", "👩‍💻", "👨‍🎓"],
    active: true,
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400",
  intermediate: "bg-amber-500/20 text-amber-400",
  advanced: "bg-red-500/20 text-red-400",
};

const RESOURCE_ICONS: Record<string, string> = {
  notes: "📝",
  video: "🎬",
  "problem-set": "🧩",
  flashcards: "🗂️",
};

// ─── Main Component ─────────────────────────────────────────
export default function StudyGroupFinder() {
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("All");
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "members" | "sessions">(
    "rating"
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return STUDY_GROUPS.filter((g) => {
      if (
        search &&
        !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !g.subject.toLowerCase().includes(search.toLowerCase()) &&
        !g.tags.some((t) =>
          t.toLowerCase().includes(search.toLowerCase())
        )
      )
        return false;
      if (filterSubject !== "All" && g.subject !== filterSubject) return false;
      if (
        filterDifficulty !== "All" &&
        g.difficulty !== filterDifficulty.toLowerCase()
      )
        return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "members") return b.members - a.members;
      return b.totalSessions - a.totalSessions;
    });
  }, [search, filterSubject, filterDifficulty, sortBy]);

  const totalMembers = STUDY_GROUPS.reduce((s, g) => s + g.members, 0);
  const avgRating =
    STUDY_GROUPS.reduce((s, g) => s + g.rating, 0) / STUDY_GROUPS.length;

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4 md:p-6">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <Users size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Study Group Finder
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Find or create study groups, schedule sessions, and collaborate
                with peers
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                icon: <Users size={20} />,
                label: "Active Groups",
                value: `${STUDY_GROUPS.length}`,
                color: "bg-blue-500/20",
              },
              {
                icon: <Users size={20} />,
                label: "Total Members",
                value: `${totalMembers}`,
                color: "bg-emerald-500/20",
              },
              {
                icon: <Star size={20} />,
                label: "Avg Rating",
                value: avgRating.toFixed(1),
                color: "bg-amber-500/20",
              },
              {
                icon: <Zap size={20} />,
                label: "Sessions/Week",
                value: "14+",
                color: "bg-purple-500/20",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center`}
                  >
                    {s.icon}
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {s.label}
                  </span>
                </div>
                <div className="text-xl font-black text-white">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                placeholder="Search groups, subjects, or tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
              >
                <option value="All">All Subjects</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} className="bg-gray-900">
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
              >
                <option value="All">All Levels</option>
                <option value="Beginner" className="bg-gray-900">
                  Beginner
                </option>
                <option value="Intermediate" className="bg-gray-900">
                  Intermediate
                </option>
                <option value="Advanced" className="bg-gray-900">
                  Advanced
                </option>
              </select>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "rating" | "members" | "sessions")
                }
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
              >
                <option value="rating">Top Rated</option>
                <option value="members">Most Members</option>
                <option value="sessions">Most Active</option>
              </select>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2"
              >
                <Plus size={16} /> Create Group
              </Button>
            </div>
          </div>
        </div>

        {/* Group Cards */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <div
              key={g.id}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-blue-500/20 transition-all cursor-pointer group"
              onClick={() => setSelectedGroup(g)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${DIFFICULTY_COLORS[g.difficulty]}`}
                    >
                      {g.difficulty}
                    </span>
                    {g.active && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-bold text-white text-lg group-hover:text-blue-300 transition-colors">
                    {g.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{g.subject}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={14} className="fill-amber-400" />
                    <span className="text-sm font-bold">{g.rating}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                {g.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {g.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {g.tags.length > 4 && (
                  <span className="text-[10px] text-gray-500">
                    +{g.tags.length - 4}
                  </span>
                )}
              </div>

              {/* Info Row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {g.members}/{g.maxMembers}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {g.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {g.totalSessions}
                </span>
              </div>

              {/* Members */}
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {g.memberAvatars.slice(0, 5).map((a, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm"
                    >
                      {a}
                    </div>
                  ))}
                  {g.members > 5 && (
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] text-blue-300 font-bold">
                      +{g.members - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  Next: <span className="text-blue-400">{g.nextSession}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Group Detail Modal */}
        {selectedGroup && (
          <Dialog
            open={true}
            onOpenChange={(open) => !open && setSelectedGroup(null)}
          >
            <DialogContent className="bg-gray-900 border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${DIFFICULTY_COLORS[selectedGroup.difficulty]}`}
                  >
                    {selectedGroup.difficulty}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={14} className="fill-amber-400" />
                    <span className="text-sm font-bold">
                      {selectedGroup.rating}
                    </span>
                  </div>
                </div>
                <DialogTitle className="text-xl font-black">
                  {selectedGroup.name}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {selectedGroup.subject}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-4">
                {/* Description */}
                <p className="text-sm text-gray-300">
                  {selectedGroup.description}
                </p>

                {/* Quick Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      icon: <Users size={16} />,
                      label: "Members",
                      value: `${selectedGroup.members}/${selectedGroup.maxMembers}`,
                    },
                    {
                      icon: <MapPin size={16} />,
                      label: "Location",
                      value: selectedGroup.location,
                    },
                    {
                      icon: <Clock size={16} />,
                      label: "Schedule",
                      value: selectedGroup.schedule,
                    },
                    {
                      icon: <Target size={16} />,
                      label: "Attendance",
                      value: `${selectedGroup.attendanceRate}%`,
                    },
                  ].map((info, i) => (
                    <div
                      key={i}
                      className="bg-white/5 rounded-xl p-3 border border-white/10"
                    >
                      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                        {info.icon}
                        <span className="text-[10px] uppercase">
                          {info.label}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white truncate">
                        {info.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Next Session */}
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase">
                      Next Session
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {selectedGroup.nextSession}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                    Topics
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Resources */}
                <div>
                  <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                    Resources ({selectedGroup.resources.length})
                  </div>
                  <div className="space-y-2">
                    {selectedGroup.resources.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10"
                      >
                        <span className="text-lg">
                          {RESOURCE_ICONS[r.type]}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm text-white font-medium">
                            {r.name}
                          </div>
                          <div className="text-[10px] text-gray-500 uppercase">
                            {r.type.replace("-", " ")}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            copyText(r.name, `res-${selectedGroup.id}-${i}`)
                          }
                          className="text-gray-500 hover:text-white transition-colors text-xs"
                        >
                          {copiedId === `res-${selectedGroup.id}-${i}`
                            ? "Copied!"
                            : "Copy"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Announcements */}
                {selectedGroup.announcements.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                      Announcements
                    </div>
                    <div className="space-y-2">
                      {selectedGroup.announcements.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 bg-amber-500/5 rounded-lg p-3 border border-amber-500/20"
                        >
                          <Zap
                            size={14}
                            className="text-amber-400 mt-0.5 flex-shrink-0"
                          />
                          <div>
                            <p className="text-sm text-gray-200">{a.text}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              {a.date}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creator & Join */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {selectedGroup.creatorAvatar}
                    </span>
                    <div>
                      <div className="text-sm text-white font-semibold">
                        {selectedGroup.creator}
                      </div>
                      <div className="text-[10px] text-gray-500">Creator</div>
                    </div>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2">
                    Join Group
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Create Group Modal */}
        {showCreate && (
          <Dialog open={true} onOpenChange={(open) => !open && setShowCreate(false)}>
            <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">
                  Create Study Group
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Set up a new study group for your subject
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                    Group Name
                  </label>
                  <Input
                    placeholder="e.g., Algorithm Study Squad"
                    className="bg-white/5 border-white/10 text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                    Subject
                  </label>
                  <select className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s} className="bg-gray-900">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                    Description
                  </label>
                  <textarea
                    placeholder="What will this group focus on?"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 resize-none h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                      Location
                    </label>
                    <select className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l} className="bg-gray-900">
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                      Difficulty
                    </label>
                    <select className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                      <option value="beginner" className="bg-gray-900">
                        Beginner
                      </option>
                      <option value="intermediate" className="bg-gray-900">
                        Intermediate
                      </option>
                      <option value="advanced" className="bg-gray-900">
                        Advanced
                      </option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                    Schedule
                  </label>
                  <Input
                    placeholder="e.g., Tue & Thu, 6:00 PM - 8:00 PM"
                    className="bg-white/5 border-white/10 text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">
                    Max Members
                  </label>
                  <Input
                    type="number"
                    placeholder="15"
                    className="bg-white/5 border-white/10 text-white placeholder-gray-500"
                  />
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                  onClick={() => setShowCreate(false)}
                >
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Footer */}
        <div className="max-w-7xl mx-auto mt-12 text-center text-xs text-gray-600 pb-8">
          Learn together, grow together — find your study group today 📚
        </div>
      </div>
    </SiteShell>
  );
}
