import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Brain,
  Moon,
  Droplets,
  Dumbbell,
  Apple,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Star,
  Trophy,
  Flame,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Zap,
  Target,
  Activity,
  Smile,
  Frown,
  Meh,
  BookOpen,
  Headphones,
  Wind,
  Timer,
  Award,
  BarChart3,
  ArrowUpRight,
  Leaf,
  Sun,
  Coffee,
  Footprints,
  Bike,
  Shield,
  Bell,
  Search,
  Filter,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface WellnessResource {
  id: string;
  name: string;
  category: "counseling" | "hotline" | "workshop" | "app" | "group";
  description: string;
  contact: string;
  availability: string;
  rating: number;
  icon: React.ReactNode;
  color: string;
}

interface WellnessChallenge {
  id: string;
  title: string;
  description: string;
  duration: string;
  participants: number;
  maxParticipants: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  reward: string;
  progress: number;
  status: "active" | "upcoming" | "completed";
  color: string;
}

interface WellnessMetric {
  label: string;
  value: string;
  unit: string;
  change: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

interface MoodEntry {
  date: string;
  mood: "great" | "good" | "okay" | "bad" | "terrible";
  note: string;
}

interface HealthTip {
  id: string;
  title: string;
  content: string;
  category: string;
  readTime: string;
  color: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const WELLNESS_METRICS: WellnessMetric[] = [
  { label: "Wellness Score", value: "78", unit: "/100", change: 5, icon: <Heart className="w-5 h-5" />, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30" },
  { label: "Sleep Quality", value: "7.2", unit: "hrs avg", change: 0.3, icon: <Moon className="w-5 h-5" />, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  { label: "Stress Level", value: "4.2", unit: "/10", change: -0.8, icon: <Brain className="w-5 h-5" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
  { label: "Active Minutes", value: "45", unit: "min/day", change: 12, icon: <Dumbbell className="w-5 h-5" />, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
  { label: "Water Intake", value: "2.4", unit: "L/day", change: 0.2, icon: <Droplets className="w-5 h-5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { label: "Mindfulness", value: "12", unit: "min/day", change: 3, icon: <Wind className="w-5 h-5" />, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950/30" },
];

const WELLNESS_RESOURCES: WellnessResource[] = [
  { id: "1", name: "Campus Counseling Center", category: "counseling", description: "Free confidential counseling for all enrolled students. Individual and group sessions available.", contact: "(555) 123-4567", availability: "Mon-Fri 9AM-5PM", rating: 4.8, icon: <Brain className="w-5 h-5" />, color: "bg-purple-500" },
  { id: "2", name: "Crisis Hotline", category: "hotline", description: "24/7 crisis support line. Trained counselors available for immediate help.", contact: "988", availability: "24/7", rating: 4.9, icon: <Phone className="w-5 h-5" />, color: "bg-red-500" },
  { id: "3", name: "Mindfulness Workshop", category: "workshop", description: "Weekly guided meditation and mindfulness sessions. Learn stress management techniques.", contact: "wellness@campus.edu", availability: "Wed 5PM", rating: 4.6, icon: <Wind className="w-5 h-5" />, color: "bg-teal-500" },
  { id: "4", name: "Headspace for Students", category: "app", description: "Free premium access to Headspace meditation app for all campus students.", contact: "Download App", availability: "Always available", rating: 4.7, icon: <Headphones className="w-5 h-5" />, color: "bg-orange-500" },
  { id: "5", name: "Peer Support Network", category: "group", description: "Trained peer mentors available for confidential conversations and support.", contact: "peer-support@campus.edu", availability: "Daily 10AM-8PM", rating: 4.5, icon: <Users className="w-5 h-5" />, color: "bg-blue-500" },
  { id: "6", name: "Yoga & Movement Studio", category: "workshop", description: "Free yoga classes for stress relief and physical wellness. All levels welcome.", contact: "rec-center@campus.edu", availability: "Tue/Thu 7AM", rating: 4.8, icon: <Activity className="w-5 h-5" />, color: "bg-green-500" },
];

const WELLNESS_CHALLENGES: WellnessChallenge[] = [
  { id: "1", title: "30-Day Meditation Streak", description: "Meditate for at least 10 minutes every day for 30 days.", duration: "30 days", participants: 234, maxParticipants: 500, difficulty: "beginner", category: "Mindfulness", reward: "Wellness Champion Badge", progress: 65, status: "active", color: "bg-teal-500" },
  { id: "2", title: "10K Steps Daily", description: "Walk 10,000 steps every day for 2 weeks.", duration: "14 days", participants: 189, maxParticipants: 300, difficulty: "intermediate", category: "Physical", reward: "Step Master Badge", progress: 42, status: "active", color: "bg-blue-500" },
  { id: "3", title: "Sleep Hygiene Reset", description: "Follow optimal sleep schedule for 21 days. Track bedtime and wake time.", duration: "21 days", participants: 156, maxParticipants: 400, difficulty: "beginner", category: "Sleep", reward: "Restful Night Badge", progress: 78, status: "active", color: "bg-indigo-500" },
  { id: "4", title: "No-Social-Media Weekend", description: "Stay off social media for entire weekends for 4 weeks.", duration: "4 weeks", participants: 98, maxParticipants: 200, difficulty: "advanced", category: "Digital Detox", reward: "Digital Detox Badge", progress: 30, status: "active", color: "bg-purple-500" },
  { id: "5", title: "Gratitude Journal", description: "Write 3 things you're grateful for every evening.", duration: "21 days", participants: 312, maxParticipants: 500, difficulty: "beginner", category: "Mental Health", reward: "Gratitude Guru Badge", progress: 88, status: "active", color: "bg-amber-500" },
  { id: "6", title: "Campus Fitness Frenzy", description: "Complete 20 workout sessions at the campus gym.", duration: "30 days", participants: 267, maxParticipants: 400, difficulty: "intermediate", category: "Physical", reward: "Fitness Freak Badge", progress: 55, status: "active", color: "bg-red-500" },
];

const MOOD_HISTORY: MoodEntry[] = [
  { date: "Mon", mood: "good", note: "Productive day" },
  { date: "Tue", mood: "great", note: "Aced my presentation" },
  { date: "Wed", mood: "okay", note: "Midterm stress" },
  { date: "Thu", mood: "good", note: "Great workout" },
  { date: "Fri", mood: "great", note: "Weekend vibes!" },
  { date: "Sat", mood: "good", note: "Relaxing day" },
  { date: "Sun", mood: "okay", note: "Prep for Monday" },
];

const HEALTH_TIPS: HealthTip[] = [
  { id: "1", title: "The 20-20-20 Rule", content: "Every 20 minutes, look at something 20 feet away for 20 seconds. Reduces eye strain from screens.", category: "Ergonomics", readTime: "1 min", color: "bg-blue-500" },
  { id: "2", title: "Power Nap Strategy", content: "A 20-minute nap between 1-3 PM can boost alertness by 34% and performance by 16%.", category: "Sleep", readTime: "2 min", color: "bg-indigo-500" },
  { id: "3", title: "Brain Food", content: "Blueberries, fatty fish, dark chocolate, and nuts are proven to boost cognitive function.", category: "Nutrition", readTime: "1 min", color: "bg-green-500" },
  { id: "4", title: "4-7-8 Breathing", content: "Inhale for 4s, hold for 7s, exhale for 8s. Activates parasympathetic nervous system for instant calm.", category: "Stress Relief", readTime: "1 min", color: "bg-teal-500" },
  { id: "5", title: "Walking Meetings", content: "Taking meetings while walking increases creativity by 60% and reduces sitting time.", category: "Physical", readTime: "1 min", color: "bg-orange-500" },
  { id: "6", title: "Digital Sunset", content: "Stop screens 1 hour before bed. Blue light suppresses melatonin by 50%.", category: "Sleep", readTime: "1 min", color: "bg-purple-500" },
];

const WEEKLY_WELLNESS_DATA = [
  { day: "Mon", sleep: 7.0, exercise: 30, mood: 7, water: 2.2 },
  { day: "Tue", sleep: 7.5, exercise: 45, mood: 9, water: 2.8 },
  { day: "Wed", sleep: 6.5, exercise: 20, mood: 5, water: 2.0 },
  { day: "Thu", sleep: 7.2, exercise: 50, mood: 7, water: 2.5 },
  { day: "Fri", sleep: 7.8, exercise: 35, mood: 9, water: 2.6 },
  { day: "Sat", sleep: 8.5, exercise: 60, mood: 8, water: 3.0 },
  { day: "Sun", sleep: 8.0, exercise: 25, mood: 6, water: 2.4 },
];

// ── Utility Components ─────────────────────────────────────────────────────

function MoodIcon({ mood, size = "w-6 h-6" }: { mood: string; size?: string }) {
  const icons: Record<string, React.ReactNode> = {
    great: <Smile className={`${size} text-green-500`} />,
    good: <Smile className={`${size} text-blue-500`} />,
    okay: <Meh className={`${size} text-yellow-500`} />,
    bad: <Frown className={`${size} text-orange-500`} />,
    terrible: <Frown className={`${size} text-red-500`} />,
  };
  return <>{icons[mood] || icons.okay}</>;
}

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full ${color} rounded-full`}
      />
    </div>
  );
}

function StatCard({ metric }: { metric: WellnessMetric }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl ${metric.bg} border border-gray-100 dark:border-gray-800`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`${metric.color}`}>{metric.icon}</div>
        <div className={`flex items-center text-xs font-medium ${metric.change >= 0 ? "text-green-600" : "text-red-600"}`}>
          {metric.change >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {Math.abs(metric.change)}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</span>
        <span className="text-sm text-gray-500">{metric.unit}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{metric.label}</p>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CampusWellnessHub() {
  const [activeTab, setActiveTab] = useState<"overview" | "resources" | "challenges" | "mood" | "tips">("overview");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodNote, setMoodNote] = useState("");
  const [expandedResource, setExpandedResource] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "resources" as const, label: "Resources", icon: <BookOpen className="w-4 h-4" /> },
    { id: "challenges" as const, label: "Challenges", icon: <Trophy className="w-4 h-4" /> },
    { id: "mood" as const, label: "Mood Tracker", icon: <Smile className="w-4 h-4" /> },
    { id: "tips" as const, label: "Health Tips", icon: <Sparkles className="w-4 h-4" /> },
  ];

  const filteredResources = WELLNESS_RESOURCES.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || r.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const moodColors: Record<string, string> = {
    great: "bg-green-500",
    good: "bg-blue-500",
    okay: "bg-yellow-500",
    bad: "bg-orange-500",
    terrible: "bg-red-500",
  };

  const difficultyColors: Record<string, string> = {
    beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-teal-500 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Campus Wellness Hub</h1>
                <p className="text-xs text-gray-500">Your well-being companion</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Search className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-rose-500 via-purple-500 to-teal-500 rounded-2xl p-6 mb-8 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Good evening! 🌙</h2>
              <p className="text-white/80">Your wellness score is <span className="font-bold">78/100</span> — up 5 points this week!</p>
              <p className="text-white/60 text-sm mt-1">Keep up the great work with your meditation streak.</p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold">🔥</div>
                <div className="text-sm font-medium">12 Day</div>
                <div className="text-xs text-white/60">Streak</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">🏆</div>
                <div className="text-sm font-medium">Level 5</div>
                <div className="text-xs text-white/60">Wellness</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Wellness Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {WELLNESS_METRICS.map((metric, i) => (
                  <StatCard key={i} metric={metric} />
                ))}
              </div>

              {/* Weekly Chart */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Weekly Wellness Trends</h3>
                <div className="flex items-end gap-3 h-48">
                  {WEEKLY_WELLNESS_DATA.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col gap-1 items-center">
                        <div
                          className="w-full bg-gradient-to-t from-teal-500 to-teal-300 rounded-t-lg transition-all hover:from-teal-600 hover:to-teal-400"
                          style={{ height: `${(d.mood / 10) * 100}px` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{d.day}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {[
                    { label: "Mood", color: "bg-teal-500" },
                    { label: "Sleep", color: "bg-indigo-500" },
                    { label: "Exercise", color: "bg-orange-500" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="text-xs text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Log Mood", desc: "How are you feeling today?", icon: <Smile className="w-6 h-6" />, color: "from-rose-500 to-pink-500", action: () => setActiveTab("mood") },
                  { title: "Find Help", desc: "Connect with support resources", icon: <Phone className="w-6 h-6" />, color: "from-blue-500 to-indigo-500", action: () => setActiveTab("resources") },
                  { title: "Join Challenge", desc: "Boost your wellness journey", icon: <Trophy className="w-6 h-6" />, color: "from-amber-500 to-orange-500", action: () => setActiveTab("challenges") },
                ].map((item, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={item.action}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-left hover:shadow-lg transition-shadow"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-4`}>
                      {item.icon}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "resources" && (
            <motion.div
              key="resources"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search resources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {["all", "counseling", "hotline", "workshop", "app", "group"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        filterCategory === cat
                          ? "bg-rose-500 text-white"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resources Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <motion.div
                    key={resource.id}
                    layout
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-10 h-10 rounded-xl ${resource.color} flex items-center justify-center text-white`}>
                          {resource.icon}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{resource.rating}</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">{resource.name}</h3>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{resource.description}</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4" />
                          <span>{resource.contact}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>{resource.availability}</span>
                        </div>
                      </div>
                      <button className="w-full mt-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        Contact Now
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Emergency Banner */}
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white flex-shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-800 dark:text-red-300 mb-1">In Crisis? Get Help Now</h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                      If you or someone you know is in immediate danger, please reach out.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a href="tel:988" className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                        <Phone className="w-4 h-4" />
                        Call 988 Crisis Line
                      </a>
                      <a href="sms:741741" className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        Text HOME to 741741
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "challenges" && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {WELLNESS_CHALLENGES.map((challenge) => (
                  <motion.div
                    key={challenge.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[challenge.difficulty]}`}>
                        {challenge.difficulty}
                      </div>
                      <span className="text-xs text-gray-500">{challenge.duration}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{challenge.title}</h3>
                    <p className="text-sm text-gray-500 mb-4">{challenge.description}</p>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{challenge.progress}%</span>
                      </div>
                      <ProgressBar value={challenge.progress} max={100} color={challenge.color} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-gray-500">
                        <Users className="w-4 h-4" />
                        <span>{challenge.participants}/{challenge.maxParticipants}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-600">
                        <Award className="w-4 h-4" />
                        <span className="text-xs">{challenge.reward}</span>
                      </div>
                    </div>
                    <button className="w-full mt-4 py-2.5 bg-gradient-to-r from-rose-500 to-teal-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                      {challenge.progress > 0 ? "Continue" : "Join Challenge"}
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Leaderboard Preview */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Wellness Champions Leaderboard
                </h3>
                <div className="space-y-3">
                  {[
                    { rank: 1, name: "Priya Sharma", score: 2450, badge: "🥇", streak: 28 },
                    { rank: 2, name: "Rohan Mehta", score: 2280, badge: "🥈", streak: 21 },
                    { rank: 3, name: "Ananya Patel", score: 2150, badge: "🥉", streak: 18 },
                    { rank: 4, name: "You", score: 1890, badge: "⭐", streak: 12, isUser: true },
                    { rank: 5, name: "Kabir Singh", score: 1720, badge: "", streak: 9 },
                  ].map((entry) => (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-4 p-3 rounded-xl ${
                        entry.isUser ? "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span className="text-lg font-bold w-8 text-center">{entry.badge || entry.rank}</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-teal-400 flex items-center justify-center text-white text-sm font-bold">
                        {entry.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{entry.name}</p>
                        <p className="text-xs text-gray-500">🔥 {entry.streak} day streak</p>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{entry.score.toLocaleString()} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "mood" && (
            <motion.div
              key="mood"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Log Mood */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">How are you feeling right now?</h3>
                <div className="flex justify-center gap-4 mb-6">
                  {["great", "good", "okay", "bad", "terrible"].map((mood) => (
                    <motion.button
                      key={mood}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSelectedMood(mood)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedMood === mood
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
                          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                      }`}
                    >
                      <MoodIcon mood={mood} size="w-8 h-8" />
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 capitalize">{mood}</p>
                    </motion.button>
                  ))}
                </div>
                <textarea
                  placeholder="Add a note about your day (optional)..."
                  value={moodNote}
                  onChange={(e) => setMoodNote(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
                  rows={3}
                />
                <button className="mt-4 px-6 py-2.5 bg-gradient-to-r from-rose-500 to-teal-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                  Log Mood
                </button>
              </div>

              {/* Mood History */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">This Week's Mood</h3>
                <div className="grid grid-cols-7 gap-2">
                  {MOOD_HISTORY.map((entry, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs text-gray-500 mb-2">{entry.date}</p>
                      <div className={`w-12 h-12 rounded-xl ${moodColors[entry.mood]} flex items-center justify-center mx-auto`}>
                        <MoodIcon mood={entry.mood} size="w-6 h-6" />
                      </div>
                      <p className="text-xs text-gray-400 mt-2 line-clamp-1">{entry.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mood Insights */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 text-white">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Mood Insights
                </h3>
                <p className="text-white/80 text-sm mb-4">Based on your mood patterns this week:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-sm font-medium">Best Day</p>
                    <p className="text-2xl font-bold">Tuesday 😊</p>
                    <p className="text-xs text-white/60">Aced your presentation!</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-sm font-medium">Average Mood</p>
                    <p className="text-2xl font-bold">Good (7.1/10)</p>
                    <p className="text-xs text-white/60">Consistent positive trend</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-sm font-medium">Recommendation</p>
                    <p className="text-2xl font-bold">More Rest 🌙</p>
                    <p className="text-xs text-white/60">Wed mood dip correlates with less sleep</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "tips" && (
            <motion.div
              key="tips"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {HEALTH_TIPS.map((tip) => (
                  <motion.div
                    key={tip.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl ${tip.color} flex items-center justify-center text-white`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">{tip.category}</span>
                        <p className="text-xs text-gray-400">{tip.readTime} read</p>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tip.title}</h3>
                    <p className="text-sm text-gray-500">{tip.content}</p>
                  </motion.div>
                ))}
              </div>

              {/* Daily Wellness Checklist */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  Daily Wellness Checklist
                </h3>
                <div className="space-y-3">
                  {[
                    { task: "Drink 8 glasses of water", done: true, icon: <Droplets className="w-4 h-4" /> },
                    { task: "10 minutes of mindfulness", done: true, icon: <Wind className="w-4 h-4" /> },
                    { task: "30 minutes of exercise", done: false, icon: <Dumbbell className="w-4 h-4" /> },
                    { task: "Eat 5 servings of fruits/veggies", done: false, icon: <Apple className="w-4 h-4" /> },
                    { task: "7+ hours of sleep", done: true, icon: <Moon className="w-4 h-4" /> },
                    { task: "Connect with a friend", done: false, icon: <Users className="w-4 h-4" /> },
                    { task: "Limit screen time before bed", done: true, icon: <Shield className="w-4 h-4" /> },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        item.done ? "bg-green-50 dark:bg-green-950/30" : "bg-gray-50 dark:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          item.done ? "bg-green-500 text-white" : "border-2 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {item.done && <Check className="w-4 h-4" />}
                      </div>
                      <span className={`text-sm ${item.done ? "text-gray-500 line-through" : "text-gray-700 dark:text-gray-300"}`}>
                        {item.task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
