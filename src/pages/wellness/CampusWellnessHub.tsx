import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Brain,
  Users,
  AlertTriangle,
  Search,
  Filter,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Download,
  Calendar,
  Clock,
  Star,
  MessageCircle,
  Phone,
  Shield,
  Activity,
  TrendingUp,
  BarChart3,
  Zap,
  Smile,
  Meh,
  Frown,
  Sun,
  Moon,
  Cloud,
  Wind,
  Leaf,
  Coffee,
  Music,
  BookOpen,
  Dumbbell,
  Sparkles,
  Info,
  ExternalLink,
  Send,
  Tag,
  ArrowUpRight,
  CircleDot,
  Thermometer,
  Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────
interface MoodEntry {
  id: string;
  timestamp: Date;
  mood: "excellent" | "good" | "neutral" | "low" | "crisis";
  score: number;
  activities: string[];
  journal: string;
  counselorNotified: boolean;
}

interface CounselingSession {
  id: string;
  counselorName: string;
  counselorTitle: string;
  specialization: string;
  availableSlots: string[];
  rating: number;
  totalSessions: number;
  nextAvailable: string;
  status: "available" | "booked" | "waitlist";
  avatarEmoji: string;
}

interface PeerSupporter {
  id: string;
  name: string;
  year: string;
  major: string;
  trainingLevel: "certified" | "advanced" | "basic";
  specialties: string[];
  online: boolean;
  responseTime: string;
  helpedCount: number;
}

interface CrisisResource {
  id: string;
  name: string;
  type: "hotline" | "text" | "chat" | "in-person" | "app";
  contact: string;
  description: string;
  availability: string;
  confidential: boolean;
}

interface WellnessActivity {
  id: string;
  name: string;
  category: string;
  duration: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  completed: boolean;
  icon: string;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  timestamp: number;
}

// ─── Mock Data ───────────────────────────────────────────────────────────
const MOOD_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  excellent: { label: "Excellent", color: "text-emerald-400", icon: <Sparkles className="w-4 h-4" /> },
  good: { label: "Good", color: "text-green-400", icon: <Smile className="w-4 h-4" /> },
  neutral: { label: "Neutral", color: "text-yellow-400", icon: <Meh className="w-4 h-4" /> },
  low: { label: "Low", color: "text-orange-400", icon: <Frown className="w-4 h-4" /> },
  crisis: { label: "Needs Support", color: "text-red-400", icon: <AlertTriangle className="w-4 h-4" /> },
};

const ACTIVITY_OPTIONS = [
  { id: "meditation", name: "Meditation", icon: "🧘", category: "Mindfulness" },
  { id: "exercise", name: "Exercise", icon: "🏃", category: "Physical" },
  { id: "social", name: "Socializing", icon: "👥", category: "Social" },
  { id: "study", name: "Study Session", icon: "📚", category: "Academic" },
  { id: "nature", name: "Nature Walk", icon: "🌿", category: "Outdoor" },
  { id: "music", name: "Music Therapy", icon: "🎵", category: "Creative" },
  { id: "sleep", name: "Quality Sleep", icon: "😴", category: "Rest" },
  { id: "journal", name: "Journaling", icon: "✍️", category: "Reflection" },
];

const MOCK_COUNSELORS: CounselingSession[] = [
  { id: "c1", counselorName: "Dr. Sarah Chen", counselorTitle: "Licensed Clinical Psychologist", specialization: "Anxiety & Stress Management", availableSlots: ["Mon 10:00", "Wed 14:00", "Fri 09:00"], rating: 4.9, totalSessions: 342, nextAvailable: "Tomorrow 10:00 AM", status: "available", avatarEmoji: "👩‍⚕️" },
  { id: "c2", counselorName: "Dr. James Rodriguez", counselorTitle: "Psychiatrist", specialization: "Depression & Mood Disorders", availableSlots: ["Tue 11:00", "Thu 15:00"], rating: 4.8, totalSessions: 289, nextAvailable: "Wednesday 11:00 AM", status: "available", avatarEmoji: "👨‍⚕️" },
  { id: "c3", counselorName: "Dr. Amara Okafor", counselorTitle: "Trauma Therapist", specialization: "PTSD & Trauma Recovery", availableSlots: ["Mon 16:00", "Wed 10:00", "Fri 13:00"], rating: 4.95, totalSessions: 198, nextAvailable: "Today 4:00 PM", status: "available", avatarEmoji: "🧑‍⚕️" },
  { id: "c4", counselorName: "Ms. Priya Sharma", counselorTitle: "Wellness Coach", specialization: "Work-Life Balance & Burnout", availableSlots: ["Tue 09:00", "Thu 11:00"], rating: 4.7, totalSessions: 156, nextAvailable: "Tuesday 9:00 AM", status: "waitlist", avatarEmoji: "👩‍🏫" },
  { id: "c5", counselorName: "Dr. Michael Torres", counselorTitle: "Addiction Counselor", specialization: "Substance Use & Recovery", availableSlots: ["Wed 13:00", "Fri 10:00"], rating: 4.85, totalSessions: 231, nextAvailable: "Wednesday 1:00 PM", status: "available", avatarEmoji: "🧑‍⚕️" },
  { id: "c6", counselorName: "Dr. Lisa Park", counselorTitle: "Eating Disorder Specialist", specialization: "Eating Disorders & Body Image", availableSlots: ["Mon 09:00", "Thu 14:00"], rating: 4.9, totalSessions: 178, nextAvailable: "Thursday 2:00 PM", status: "booked", avatarEmoji: "👩‍⚕️" },
];

const MOCK_PEER_SUPPORTERS: PeerSupporter[] = [
  { id: "p1", name: "Alex Kim", year: "Senior", major: "Psychology", trainingLevel: "certified", specialties: ["Active Listening", "Anxiety", "Academic Stress"], online: true, responseTime: "< 2 min", helpedCount: 87 },
  { id: "p2", name: "Jordan Rivera", year: "Junior", major: "Nursing", trainingLevel: "advanced", specialties: ["Grief Support", "Transition Stress", "Sleep Issues"], online: true, responseTime: "< 5 min", helpedCount: 54 },
  { id: "p3", name: "Sam Patel", year: "Senior", major: "Social Work", trainingLevel: "certified", specialties: ["Depression", "Loneliness", "Identity"], online: false, responseTime: "~15 min", helpedCount: 112 },
  { id: "p4", name: "Casey Morgan", year: "Sophomore", major: "Computer Science", trainingLevel: "basic", specialties: ["Peer Listening", "Study Stress"], online: true, responseTime: "< 3 min", helpedCount: 23 },
  { id: "p5", name: "Riley Chen", year: "Senior", major: "Public Health", trainingLevel: "certified", specialties: ["Crisis De-escalation", "Substance Awareness", "Self-Harm Prevention"], online: true, responseTime: "< 1 min", helpedCount: 95 },
  { id: "p6", name: "Dana Williams", year: "Junior", major: "Counseling Psychology", trainingLevel: "advanced", specialties: ["Cultural Identity", "Family Issues", "Relationship Stress"], online: false, responseTime: "~10 min", helpedCount: 68 },
];

const MOCK_CRISIS_RESOURCES: CrisisResource[] = [
  { id: "cr1", name: "988 Suicide & Crisis Lifeline", type: "hotline", contact: "988", description: "Free, confidential 24/7 support for people in suicidal crisis or emotional distress.", availability: "24/7", confidential: true },
  { id: "cr2", name: "Crisis Text Line", type: "text", contact: "Text HOME to 741741", description: "Free crisis counseling via text message. Trained crisis counselors available 24/7.", availability: "24/7", confidential: true },
  { id: "cr3", name: "Campus Emergency Counseling", type: "in-person", contact: "Student Health Center, Room 204", description: "Immediate walk-in crisis support during business hours. No appointment needed.", availability: "Mon-Fri 8AM-6PM", confidential: true },
  { id: "cr4", name: "NAMI Helpline", type: "hotline", contact: "1-800-950-NAMI (6264)", description: "Information and referral service for mental health conditions and treatment options.", availability: "Mon-Fri 10AM-10PM ET", confidential: true },
  { id: "cr5", name: "Trevor Project", type: "chat", contact: "thetrevorproject.org", description: "LGBTQ+ young people crisis support — call, text, or chat with trained counselors.", availability: "24/7", confidential: true },
  { id: "cr6", name: "Campus Safety Escort", type: "app", contact: "Download SafeWalk App", description: "Request a safe walk or ride across campus during nighttime hours. Peer safety volunteers.", availability: "Sun-Thu 8PM-2AM", confidential: false },
];

const MOCK_WELLNESS_ACTIVITIES: WellnessActivity[] = [
  { id: "w1", name: "5-Minute Breathing Exercise", category: "Mindfulness", duration: 5, difficulty: "beginner", completed: false, icon: "🌬️" },
  { id: "w2", name: "Guided Progressive Relaxation", category: "Mindfulness", duration: 15, difficulty: "intermediate", completed: true, icon: "🧘" },
  { id: "w3", name: "Gratitude Journal Prompt", category: "Reflection", duration: 10, difficulty: "beginner", completed: false, icon: "📝" },
  { id: "w4", name: "Campus Nature Walk Challenge", category: "Physical", duration: 30, difficulty: "beginner", completed: false, icon: "🌳" },
  { id: "w5", name: "Yoga for Beginners", category: "Physical", duration: 20, difficulty: "beginner", completed: true, icon: "🧘‍♀️" },
  { id: "w6", name: "Digital Detox Hour", category: "Mindfulness", duration: 60, difficulty: "advanced", completed: false, icon: "📵" },
  { id: "w7", name: "Creative Expression Session", category: "Creative", duration: 25, difficulty: "intermediate", completed: false, icon: "🎨" },
  { id: "w8", name: "Sleep Hygiene Workshop", category: "Rest", duration: 45, difficulty: "intermediate", completed: false, icon: "🌙" },
];

// ─── Helper Functions ────────────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function exportToCsv(data: Record<string, string | number | boolean>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-Components ──────────────────────────────────────────────────────

const ToastContainer: React.FC<{ toasts: ToastMessage[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm animate-slide-in ${
          t.type === "success"
            ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
            : t.type === "error"
            ? "bg-red-950/90 border-red-700 text-red-200"
            : t.type === "warning"
            ? "bg-amber-950/90 border-amber-700 text-amber-200"
            : "bg-slate-800/90 border-slate-600 text-slate-200"
        }`}
      >
        {t.type === "success" && <Check className="w-4 h-4 flex-shrink-0" />}
        {t.type === "error" && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
        {t.type === "warning" && <Info className="w-4 h-4 flex-shrink-0" />}
        {t.type === "info" && <Info className="w-4 h-4 flex-shrink-0" />}
        <span className="text-sm font-medium flex-1">{t.message}</span>
        <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-white flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
);

const ModalOverlay: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({
  onClose,
  title,
  children,
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <div
      className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-5 border-b border-slate-800">
        <h3 className="text-lg font-bold text-slate-100">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────
const CampusWellnessHub: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<"mood" | "counseling" | "peers" | "crisis" | "activities">("mood");

  // Toast state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((type: ToastMessage["type"], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message, timestamp: Date.now() }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Mood entries state
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([
    { id: "me1", timestamp: new Date(Date.now() - 86400000 * 2), mood: "good", score: 72, activities: ["meditation", "exercise"], journal: "Felt productive after morning yoga. Classes were engaging.", counselorNotified: false },
    { id: "me2", timestamp: new Date(Date.now() - 86400000), mood: "neutral", score: 55, activities: ["study", "social"], journal: "Long study session. Need more sleep tonight.", counselorNotified: false },
    { id: "me3", timestamp: new Date(Date.now() - 3600000 * 6), mood: "low", score: 35, activities: [], journal: "Feeling overwhelmed with midterm deadlines. Anxiety is high.", counselorNotified: true },
    { id: "me4", timestamp: new Date(Date.now() - 3600000 * 2), mood: "good", score: 68, activities: ["nature", "music"], journal: "Nature walk helped a lot. Feeling more grounded now.", counselorNotified: false },
    { id: "me5", timestamp: new Date(Date.now() - 1800000), mood: "excellent", score: 88, activities: ["meditation", "social", "journal"], journal: "Great therapy session. Feeling hopeful about recovery progress.", counselorNotified: false },
  ]);

  // Simulation state
  const [simRunning, setSimRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(1);
  const [simTick, setSimTick] = useState(0);
  const [simData, setSimData] = useState<number[]>(() => Array.from({ length: 30 }, () => Math.floor(Math.random() * 60 + 30)));
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"counselor" | "peer" | "crisis" | "mood-detail" | "new-mood">("counselor");
  const [selectedItem, setSelectedItem] = useState<CounselingSession | PeerSupporter | CrisisResource | MoodEntry | null>(null);

  // New mood entry form
  const [newMood, setNewMood] = useState<"excellent" | "good" | "neutral" | "low" | "crisis">("neutral");
  const [newMoodScore, setNewMoodScore] = useState(50);
  const [newMoodJournal, setNewMoodJournal] = useState("");
  const [newMoodActivities, setNewMoodActivities] = useState<string[]>([]);

  // ─── Simulation Loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (simRunning) {
      tickRef.current = setInterval(() => {
        setSimTick((prev) => prev + 1);
        setSimData((prev) => {
          const newPoint = Math.min(100, Math.max(0, prev[prev.length - 1] + (Math.random() - 0.45) * 15));
          return [...prev.slice(1), Math.round(newPoint)];
        });
      }, 1000 / simSpeed);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [simRunning, simSpeed]);

  const resetSim = useCallback(() => {
    setSimRunning(false);
    setSimTick(0);
    setSimData(Array.from({ length: 30 }, () => Math.floor(Math.random() * 60 + 30)));
    addToast("info", "Simulation reset to initial state");
  }, [addToast]);

  // ─── Mood Helpers ────────────────────────────────────────────────────
  const getMoodScoreColor = (score: number): string => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    if (score >= 20) return "text-orange-400";
    return "text-red-400";
  };

  const getMoodBarColor = (score: number): string => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    if (score >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const avgMoodScore = moodEntries.length > 0 ? Math.round(moodEntries.reduce((s, e) => s + e.score, 0) / moodEntries.length) : 0;

  // ─── Simulation Chart Mini-Renderer ──────────────────────────────────
  const SimChart: React.FC = () => {
    const max = Math.max(...simData, 1);
    const chartWidth = 100;
    const chartHeight = 40;
    const points = simData.map((v, i) => `${(i / (simData.length - 1)) * chartWidth},${chartHeight - (v / max) * chartHeight}`).join(" ");

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="simGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(139,92,246)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(139,92,246)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="rgb(139,92,246)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,${chartHeight} ${points} ${chartWidth},${chartHeight}`} fill="url(#simGrad)" />
      </svg>
    );
  };

  // ─── CSV Export ──────────────────────────────────────────────────────
  const handleExportMood = () => {
    const data = moodEntries.map((e) => ({
      Date: e.timestamp.toLocaleDateString(),
      Time: e.timestamp.toLocaleTimeString(),
      Mood: MOOD_LABELS[e.mood].label,
      Score: e.score,
      Activities: e.activities.join("; "),
      Journal: e.journal,
      CounselorNotified: e.counselorNotified ? "Yes" : "No",
    }));
    exportToCsv(data, `campus-wellness-mood-${new Date().toISOString().slice(0, 10)}.csv`);
    addToast("success", "Mood history exported to CSV successfully");
  };

  const handleExportCounseling = () => {
    const data = MOCK_COUNSELORS.map((c) => ({
      Name: c.counselorName,
      Title: c.counselorTitle,
      Specialization: c.specialization,
      Rating: c.rating,
      TotalSessions: c.totalSessions,
      NextAvailable: c.nextAvailable,
      Status: c.status,
    }));
    exportToCsv(data, `campus-counselors-${new Date().toISOString().slice(0, 10)}.csv`);
    addToast("success", "Counselor directory exported to CSV");
  };

  // ─── Tab Definitions ─────────────────────────────────────────────────
  const tabs = [
    { id: "mood" as const, label: "Mood Tracker", icon: <Brain className="w-4 h-4" />, count: moodEntries.length },
    { id: "counseling" as const, label: "Counseling", icon: <Calendar className="w-4 h-4" />, count: MOCK_COUNSELORS.length },
    { id: "peers" as const, label: "Peer Support", icon: <Users className="w-4 h-4" />, count: MOCK_PEER_SUPPORTERS.filter((p) => p.online).length },
    { id: "crisis" as const, label: "Crisis Resources", icon: <AlertTriangle className="w-4 h-4" />, count: MOCK_CRISIS_RESOURCES.length },
    { id: "activities" as const, label: "Wellness Activities", icon: <Leaf className="w-4 h-4" />, count: MOCK_WELLNESS_ACTIVITIES.length },
  ];

  // ─── Submit New Mood Entry ───────────────────────────────────────────
  const handleSubmitMood = () => {
    const entry: MoodEntry = {
      id: generateId(),
      timestamp: new Date(),
      mood: newMood,
      score: newMoodScore,
      activities: newMoodActivities,
      journal: newMoodJournal,
      counselorNotified: newMood === "crisis" || newMoodScore < 30,
    };
    setMoodEntries((prev) => [entry, ...prev]);
    setModalOpen(false);
    setNewMood("neutral");
    setNewMoodScore(50);
    setNewMoodJournal("");
    setNewMoodActivities([]);
    addToast("success", "Mood entry logged successfully" + (entry.counselorNotified ? " — counselor notified" : ""));
  };

  const handleBookCounselor = (counselor: CounselingSession) => {
    addToast("success", `Appointment request sent to ${counselor.counselorName}`);
    setModalOpen(false);
  };

  // ─── Filtered Data ───────────────────────────────────────────────────
  const filteredMoodEntries = moodEntries.filter((e) => {
    const matchesSearch = e.journal.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = moodFilter === "all" || e.mood === moodFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredCounselors = MOCK_COUNSELORS.filter((c) => {
    const matchesSearch =
      c.counselorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.specialization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = categoryFilter === "all" || c.status === categoryFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredPeers = MOCK_PEER_SUPPORTERS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specialties.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const filteredActivities = MOCK_WELLNESS_ACTIVITIES.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = categoryFilter === "all" || a.category === categoryFilter;
    return matchesSearch && matchesFilter;
  });

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* ── Header Banner ── */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider">
                <Heart className="w-4 h-4 text-violet-400" />
                Campus Wellness & Mental Health Hub
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                Your Wellness Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Track your mood, book counseling sessions, connect with peer supporters, access crisis resources, and build healthy daily habits — all in one secure, confidential space.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <Activity className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                <div className={`text-lg font-black font-mono ${getMoodScoreColor(avgMoodScore)}`}>{avgMoodScore}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Avg Score</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-lg font-black font-mono text-emerald-400">{moodEntries.length}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Entries</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-lg font-black font-mono text-blue-400">{MOCK_PEER_SUPPORTERS.filter((p) => p.online).length}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Online Now</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setMoodFilter("all");
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
            />
          </div>
          {activeTab === "mood" && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={moodFilter}
                onChange={(e) => setMoodFilter(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-600 appearance-none cursor-pointer"
              >
                <option value="all">All Moods</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="neutral">Neutral</option>
                <option value="low">Low</option>
                <option value="crisis">Needs Support</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          )}
          {activeTab === "counseling" && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-600 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="waitlist">Waitlist</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          )}
          {activeTab === "activities" && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-600 appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="Mindfulness">Mindfulness</option>
                <option value="Physical">Physical</option>
                <option value="Reflection">Reflection</option>
                <option value="Creative">Creative</option>
                <option value="Rest">Rest</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          )}
          {(activeTab === "mood" || activeTab === "counseling") && (
            <button
              onClick={activeTab === "mood" ? handleExportMood : handleExportCounseling}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">

        {/* ════════ MOOD TRACKER TAB ════════ */}
        {activeTab === "mood" && (
          <div className="space-y-6">
            {/* Simulation Sandbox */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Community Mood Simulation</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">Tick: {simTick}</span>
                  <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                    {([1, 2, 4] as const).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setSimSpeed(speed)}
                        className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                          simSpeed === speed ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSimRunning(!simRunning)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      simRunning ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {simRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={resetSim} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <SimChart />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-500">30-day rolling community wellness index</span>
                <span className={`text-xs font-bold font-mono ${getMoodScoreColor(simData[simData.length - 1])}`}>
                  Current: {simData[simData.length - 1]}%
                </span>
              </div>
            </div>

            {/* New Entry Button + Stats Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Log New Mood Entry
              </button>
              <div className="flex-1 grid grid-cols-5 gap-2">
                {Object.entries(MOOD_LABELS).map(([key, val]) => {
                  const count = moodEntries.filter((e) => e.mood === key).length;
                  return (
                    <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center">
                      <div className={`flex items-center justify-center gap-1 ${val.color}`}>{val.icon}<span className="text-xs font-bold">{count}</span></div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{val.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mood Entries List */}
            <div className="space-y-3">
              {filteredMoodEntries.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No mood entries match your search</p>
                </div>
              )}
              {filteredMoodEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedItem(entry);
                    setModalType("mood-detail");
                    setModalOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        entry.score >= 80 ? "bg-emerald-900/50" : entry.score >= 60 ? "bg-green-900/50" : entry.score >= 40 ? "bg-yellow-900/50" : entry.score >= 20 ? "bg-orange-900/50" : "bg-red-900/50"
                      }`}>
                        {MOOD_LABELS[entry.mood].icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${MOOD_LABELS[entry.mood].color}`}>
                            {MOOD_LABELS[entry.mood].label}
                          </span>
                          {entry.counselorNotified && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400 font-bold">
                              Counselor Notified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{entry.journal}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-black font-mono ${getMoodScoreColor(entry.score)}`}>{entry.score}</div>
                      <div className="text-[10px] text-slate-500">{formatTimeAgo(entry.timestamp)}</div>
                    </div>
                  </div>
                  {entry.activities.length > 0 && (
                    <div className="flex gap-1.5 mt-3">
                      {entry.activities.map((actId) => {
                        const act = ACTIVITY_OPTIONS.find((a) => a.id === actId);
                        return act ? (
                          <span key={actId} className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                            {act.icon} {act.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3">
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${getMoodBarColor(entry.score)}`} style={{ width: `${entry.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ COUNSELING TAB ════════ */}
        {activeTab === "counseling" && (
          <div className="space-y-4">
            {filteredCounselors.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No counselors match your search</p>
              </div>
            )}
            {filteredCounselors.map((counselor) => (
              <div
                key={counselor.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-violet-800/50 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedItem(counselor);
                  setModalType("counselor");
                  setModalOpen(true);
                }}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl flex-shrink-0">
                    {counselor.avatarEmoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100">{counselor.counselorName}</h3>
                        <p className="text-xs text-slate-400">{counselor.counselorTitle}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        counselor.status === "available"
                          ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800"
                          : counselor.status === "booked"
                          ? "bg-blue-900/50 text-blue-400 border border-blue-800"
                          : "bg-amber-900/50 text-amber-400 border border-amber-800"
                      }`}>
                        {counselor.status === "available" ? "● Available" : counselor.status === "booked" ? "● Booked" : "● Waitlist"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-violet-400">
                        <Star className="w-3 h-3" /> {counselor.rating}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <BookOpen className="w-3 h-3" /> {counselor.totalSessions} sessions
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" /> {counselor.nextAvailable}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {counselor.specialization.split(" & ").map((spec) => (
                        <span key={spec} className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                          <Tag className="w-2.5 h-2.5 inline mr-0.5" />{spec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════ PEER SUPPORT TAB ════════ */}
        {activeTab === "peers" && (
          <div className="space-y-4">
            {filteredPeers.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No peer supporters match your search</p>
              </div>
            )}
            {filteredPeers.map((peer) => (
              <div
                key={peer.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-blue-800/50 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedItem(peer);
                  setModalType("peer");
                  setModalOpen(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                        {peer.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                        peer.online ? "bg-emerald-400" : "bg-slate-600"
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{peer.name}</h3>
                      <p className="text-xs text-slate-400">{peer.year} · {peer.major}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    peer.trainingLevel === "certified"
                      ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800"
                      : peer.trainingLevel === "advanced"
                      ? "bg-blue-900/50 text-blue-400 border border-blue-800"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}>
                    {peer.trainingLevel === "certified" ? "✦ Certified" : peer.trainingLevel === "advanced" ? "★ Advanced" : "○ Basic"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" /> {peer.responseTime}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Heart className="w-3 h-3" /> {peer.helpedCount} helped
                  </span>
                  <span className={`text-xs font-medium ${peer.online ? "text-emerald-400" : "text-slate-500"}`}>
                    {peer.online ? "● Online now" : "○ Offline"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {peer.specialties.map((spec) => (
                    <span key={spec} className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════ CRISIS RESOURCES TAB ════════ */}
        {activeTab === "crisis" && (
          <div className="space-y-4">
            {/* Emergency Banner */}
            <div className="bg-red-950/50 border border-red-800 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-200">In Immediate Danger?</h3>
                  <p className="text-xs text-red-300/70">
                    If you or someone you know is in immediate danger, call <strong className="text-red-200">911</strong> or go to your nearest emergency room.
                  </p>
                </div>
              </div>
            </div>

            {/* Resource Cards */}
            {MOCK_CRISIS_RESOURCES.map((resource) => (
              <div
                key={resource.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-red-800/50 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedItem(resource);
                  setModalType("crisis");
                  setModalOpen(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      resource.type === "hotline"
                        ? "bg-red-900/50 text-red-400"
                        : resource.type === "text"
                        ? "bg-blue-900/50 text-blue-400"
                        : resource.type === "chat"
                        ? "bg-violet-900/50 text-violet-400"
                        : resource.type === "in-person"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-amber-900/50 text-amber-400"
                    }`}>
                      {resource.type === "hotline" && <Phone className="w-5 h-5" />}
                      {resource.type === "text" && <MessageCircle className="w-5 h-5" />}
                      {resource.type === "chat" && <Send className="w-5 h-5" />}
                      {resource.type === "in-person" && <Shield className="w-5 h-5" />}
                      {resource.type === "app" && <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{resource.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{resource.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500">
                          <Clock className="w-3 h-3 inline mr-0.5" />{resource.availability}
                        </span>
                        {resource.confidential && (
                          <span className="text-[10px] text-emerald-400 font-bold">
                            <Shield className="w-3 h-3 inline mr-0.5" />Confidential
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-300 bg-slate-800 px-3 py-1 rounded-lg whitespace-nowrap">
                    {resource.contact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════ WELLNESS ACTIVITIES TAB ════════ */}
        {activeTab === "activities" && (
          <div className="space-y-4">
            {/* Completion Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Daily Wellness Progress</h2>
                <span className="text-xs font-mono text-emerald-400">
                  {MOCK_WELLNESS_ACTIVITIES.filter((a) => a.completed).length}/{MOCK_WELLNESS_ACTIVITIES.length} completed
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-violet-600 to-emerald-500 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${(MOCK_WELLNESS_ACTIVITIES.filter((a) => a.completed).length / MOCK_WELLNESS_ACTIVITIES.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Activity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                    activity.completed ? "border-emerald-800/50 bg-emerald-950/20" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{activity.icon}</span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{activity.name}</h3>
                        <p className="text-[10px] text-slate-500">{activity.category}</p>
                      </div>
                    </div>
                    {activity.completed && <Check className="w-5 h-5 text-emerald-400" />}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock className="w-3 h-3" /> {activity.duration} min
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      activity.difficulty === "beginner"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : activity.difficulty === "intermediate"
                        ? "bg-amber-900/50 text-amber-400"
                        : "bg-red-900/50 text-red-400"
                    }`}>
                      {activity.difficulty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════ MODALS ════════ */}
      {modalOpen && (
        <ModalOverlay
          onClose={() => setModalOpen(false)}
          title={
            modalType === "new-mood"
              ? "Log Mood Entry"
              : modalType === "mood-detail"
              ? "Mood Entry Detail"
              : modalType === "counselor"
              ? "Book Counseling Session"
              : modalType === "peer"
              ? "Connect with Peer"
              : "Crisis Resource"
          }
        >
          {/* New Mood Modal */}
          {modalType === "new-mood" && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">How are you feeling?</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(MOOD_LABELS).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setNewMood(key as typeof newMood);
                        const scoreMap: Record<string, number> = { excellent: 90, good: 72, neutral: 50, low: 30, crisis: 15 };
                        setNewMoodScore(scoreMap[key]);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                        newMood === key
                          ? "bg-violet-900/50 border-violet-600 text-white"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <span className={`text-lg ${val.color}`}>{React.cloneElement(val.icon as React.ReactElement, { className: "w-6 h-6" })}</span>
                      <span className="text-[9px] font-bold">{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Wellness Score: {newMoodScore}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newMoodScore}
                  onChange={(e) => setNewMoodScore(Number(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0 — Crisis</span>
                  <span>50 — Neutral</span>
                  <span>100 — Excellent</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Activities Today</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((act) => (
                    <button
                      key={act.id}
                      onClick={() => {
                        setNewMoodActivities((prev) =>
                          prev.includes(act.id) ? prev.filter((a) => a !== act.id) : [...prev, act.id]
                        );
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        newMoodActivities.includes(act.id)
                          ? "bg-violet-900/50 border-violet-600 text-violet-200"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {act.icon} {act.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Journal (optional)</label>
                <textarea
                  value={newMoodJournal}
                  onChange={(e) => setNewMoodJournal(e.target.value)}
                  placeholder="Write about how you're feeling today..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-600 resize-none"
                />
              </div>
              {newMood === "crisis" && (
                <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">A counselor will be notified automatically for safety. You are not alone.</p>
                </div>
              )}
              <button
                onClick={handleSubmitMood}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
              >
                Save Mood Entry
              </button>
            </div>
          )}

          {/* Mood Detail Modal */}
          {modalType === "mood-detail" && selectedItem && "mood" in selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  (selectedItem as MoodEntry).score >= 60 ? "bg-emerald-900/50" : "bg-orange-900/50"
                }`}>
                  {MOOD_LABELS[(selectedItem as MoodEntry).mood].icon}
                </div>
                <div>
                  <span className={`text-lg font-bold ${MOOD_LABELS[(selectedItem as MoodEntry).mood].color}`}>
                    {MOOD_LABELS[(selectedItem as MoodEntry).mood].label}
                  </span>
                  <p className="text-xs text-slate-500">{(selectedItem as MoodEntry).timestamp.toLocaleString()}</p>
                </div>
                <div className="ml-auto">
                  <span className={`text-3xl font-black font-mono ${getMoodScoreColor((selectedItem as MoodEntry).score)}`}>
                    {(selectedItem as MoodEntry).score}
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${getMoodBarColor((selectedItem as MoodEntry).score)}`} style={{ width: `${(selectedItem as MoodEntry).score}%` }} />
              </div>
              {(selectedItem as MoodEntry).journal && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2">Journal Entry</p>
                  <p className="text-sm text-slate-200">{(selectedItem as MoodEntry).journal}</p>
                </div>
              )}
              {(selectedItem as MoodEntry).activities.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2">Activities</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedItem as MoodEntry).activities.map((actId) => {
                      const act = ACTIVITY_OPTIONS.find((a) => a.id === actId);
                      return act ? (
                        <span key={actId} className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-300">
                          {act.icon} {act.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              {(selectedItem as MoodEntry).counselorNotified && (
                <div className="bg-amber-950/50 border border-amber-800 rounded-xl p-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-300">A counselor was notified for this entry for your safety.</span>
                </div>
              )}
            </div>
          )}

          {/* Counselor Booking Modal */}
          {modalType === "counselor" && selectedItem && "counselorName" in selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{(selectedItem as CounselingSession).avatarEmoji}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{(selectedItem as CounselingSession).counselorName}</h3>
                  <p className="text-xs text-slate-400">{(selectedItem as CounselingSession).counselorTitle}</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Specialization</p>
                <p className="text-sm text-slate-200">{(selectedItem as CounselingSession).specialization}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-slate-200">{(selectedItem as CounselingSession).rating}</span>
                </div>
                <span className="text-xs text-slate-500">{(selectedItem as CounselingSession).totalSessions} total sessions</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Available Slots</p>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedItem as CounselingSession).availableSlots.map((slot) => (
                    <div key={slot} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        <span className="text-sm text-slate-200">{slot}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold">Available</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleBookCounselor(selectedItem as CounselingSession)}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
              >
                Request Appointment
              </button>
            </div>
          )}

          {/* Peer Connection Modal */}
          {modalType === "peer" && selectedItem && "trainingLevel" in selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-300">
                  {(selectedItem as PeerSupporter).name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{(selectedItem as PeerSupporter).name}</h3>
                  <p className="text-xs text-slate-400">{(selectedItem as PeerSupporter).year} · {(selectedItem as PeerSupporter).major}</p>
                  <span className={`text-[10px] font-bold ${
                    (selectedItem as PeerSupporter).trainingLevel === "certified" ? "text-emerald-400" : "text-blue-400"
                  }`}>
                    {(selectedItem as PeerSupporter).trainingLevel === "certified" ? "✦ Certified Peer Supporter" : "★ Advanced Peer Supporter"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
                  <Clock className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                  <span className="text-xs text-slate-300 font-bold">{(selectedItem as PeerSupporter).responseTime}</span>
                  <p className="text-[9px] text-slate-500">Avg Response</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
                  <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <span className="text-xs text-slate-300 font-bold">{(selectedItem as PeerSupporter).helpedCount}</span>
                  <p className="text-[9px] text-slate-500">Students Helped</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Specialties</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedItem as PeerSupporter).specialties.map((spec: string) => (
                    <span key={spec} className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-300">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                to="/peer-support"
                onClick={() => setModalOpen(false)}
                className="block w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-center text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all"
              >
                Start Anonymous Peer Room
              </Link>
            </div>
          )}

          {/* Crisis Resource Modal */}
          {modalType === "crisis" && selectedItem && "contact" in selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  (selectedItem as CrisisResource).type === "hotline" ? "bg-red-900/50 text-red-400" :
                  (selectedItem as CrisisResource).type === "text" ? "bg-blue-900/50 text-blue-400" :
                  "bg-violet-900/50 text-violet-400"
                }`}>
                  {(selectedItem as CrisisResource).type === "hotline" && <Phone className="w-6 h-6" />}
                  {(selectedItem as CrisisResource).type === "text" && <MessageCircle className="w-6 h-6" />}
                  {(selectedItem as CrisisResource).type === "chat" && <Send className="w-6 h-6" />}
                  {(selectedItem as CrisisResource).type === "in-person" && <Shield className="w-6 h-6" />}
                  {(selectedItem as CrisisResource).type === "app" && <Zap className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{(selectedItem as CrisisResource).name}</h3>
                  <p className="text-[10px] text-slate-500 uppercase">{(selectedItem as CrisisResource).type}</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-sm text-slate-200">{(selectedItem as CrisisResource).description}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Contact</p>
                <p className="text-lg font-black font-mono text-slate-100">{(selectedItem as CrisisResource).contact}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  <Clock className="w-3 h-3 inline mr-0.5" />{(selectedItem as CrisisResource).availability}
                </span>
                {(selectedItem as CrisisResource).confidential && (
                  <span className="text-xs text-emerald-400 font-bold">
                    <Shield className="w-3 h-3 inline mr-0.5" />100% Confidential
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  addToast("info", `Opening ${selectedItem ? (selectedItem as CrisisResource).name : "resource"}...`);
                  setModalOpen(false);
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Access Resource Now
              </button>
            </div>
          )}
        </ModalOverlay>
      )}

      {/* ── Global Styles for Animations ── */}
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CampusWellnessHub;
