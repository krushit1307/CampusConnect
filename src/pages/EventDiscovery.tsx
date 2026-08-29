import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  Star,
  Heart,
  Share2,
  Bookmark,
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  X,
  ExternalLink,
  Tag,
  Sparkles,
  TrendingUp,
  Eye,
  MessageCircle,
  Send,
  Map,
  Navigation,
  Zap,
  Music,
  GraduationCap,
  Trophy,
  Palette,
  Code,
  Dumbbell,
  Coffee,
  Mic,
  Camera,
  Globe,
  Info,
  ArrowRight,
  List,
  Grid,
  CalendarDays,
  Layers,
  RefreshCw,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type EventCategory = "academic" | "cultural" | "sports" | "tech" | "social" | "workshop" | "seminar" | "concert" | "exhibition" | "networking";
type EventStatus = "upcoming" | "live" | "past";
type RSVPStatus = "going" | "interested" | "invited" | "none";

interface CampusEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  building: string;
  organizer: string;
  organizerAvatar: string;
  organizerRole: string;
  coverColor: string;
  capacity: number;
  attendees: number;
  interested: number;
  views: number;
  rating: number;
  tags: string[];
  speakers?: string[];
  isPaid: boolean;
  price?: number;
  isFeatured: boolean;
  rsvpStatus: RSVPStatus;
  hasLiveStream: boolean;
  hasRecording: boolean;
}

interface EventCalendarDay {
  date: number;
  month: number;
  year: number;
  events: CampusEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

interface EventStats {
  totalEvents: number;
  thisWeekEvents: number;
  totalAttendees: number;
  avgRating: number;
  popularCategory: string;
  upcomingLiveStreams: number;
  weeklyAttendance: { day: string; count: number }[];
  categoryDistribution: { category: string; count: number; color: string }[];
  monthlyEvents: { month: string; events: number; attendees: number }[];
}

// ─── Data ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: { id: EventCategory; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { id: "academic", label: "Academic", icon: <GraduationCap className="w-4 h-4" />, color: "text-blue-400", bg: "bg-blue-500/20" },
  { id: "cultural", label: "Cultural", icon: <Music className="w-4 h-4" />, color: "text-purple-400", bg: "bg-purple-500/20" },
  { id: "sports", label: "Sports", icon: <Dumbbell className="w-4 h-4" />, color: "text-emerald-400", bg: "bg-emerald-500/20" },
  { id: "tech", label: "Tech", icon: <Code className="w-4 h-4" />, color: "text-cyan-400", bg: "bg-cyan-500/20" },
  { id: "social", label: "Social", icon: <Coffee className="w-4 h-4" />, color: "text-amber-400", bg: "bg-amber-500/20" },
  { id: "workshop", label: "Workshop", icon: <Palette className="w-4 h-4" />, color: "text-pink-400", bg: "bg-pink-500/20" },
  { id: "seminar", label: "Seminar", icon: <Mic className="w-4 h-4" />, color: "text-indigo-400", bg: "bg-indigo-500/20" },
  { id: "concert", label: "Concert", icon: <Music className="w-4 h-4" />, color: "text-rose-400", bg: "bg-rose-500/20" },
  { id: "exhibition", label: "Exhibition", icon: <Camera className="w-4 h-4" />, color: "text-teal-400", bg: "bg-teal-500/20" },
  { id: "networking", label: "Networking", icon: <Globe className="w-4 h-4" />, color: "text-orange-400", bg: "bg-orange-500/20" },
];

const EVENTS: CampusEvent[] = [
  { id: "E1", title: "Annual Tech Fest — CodeSprint 2026", description: "48-hour hackathon with ₹5L prize pool. Teams of 2-4. Build, pitch, win!", category: "tech", status: "upcoming", date: "2026-09-05", startTime: "09:00", endTime: "09:00+1", location: "Innovation Hub", building: "CS Department", organizer: "CS Club", organizerAvatar: "CC", organizerRole: "Student Club", coverColor: "from-cyan-600 to-blue-700", capacity: 200, attendees: 156, interested: 89, views: 1234, rating: 4.9, tags: ["Hackathon", "Coding", "Prizes", "48hr"], speakers: ["Dr. Rajesh Kumar", "Priya Mehta (Google)"], isPaid: true, price: 200, isFeatured: true, rsvpStatus: "going", hasLiveStream: false, hasRecording: false },
  { id: "E2", title: "Classical Music Night — Raga Vibes", description: "An evening of Hindustani classical music featuring sitar, tabla, and vocal performances by student artists.", category: "concert", status: "upcoming", date: "2026-08-30", startTime: "18:00", endTime: "21:00", location: "Open Air Theatre", building: "Student Center", organizer: "Music Society", organizerAvatar: "MS", organizerRole: "Student Club", coverColor: "from-rose-600 to-purple-700", capacity: 500, attendees: 312, interested: 145, views: 890, rating: 4.7, tags: ["Music", "Classical", "Sitar", "Free"], isPaid: false, isFeatured: true, rsvpStatus: "interested", hasLiveStream: true, hasRecording: false },
  { id: "E3", title: "AI & Machine Learning Workshop", description: "Hands-on workshop on building ML models with Python. Bring your laptop! Covers regression, classification, and neural nets.", category: "workshop", status: "upcoming", date: "2026-09-01", startTime: "10:00", endTime: "16:00", location: "Computer Lab A", building: "CS Department", organizer: "AI/ML Club", organizerAvatar: "AI", organizerRole: "Student Club", coverColor: "from-purple-600 to-indigo-700", capacity: 60, attendees: 58, interested: 34, views: 678, rating: 4.8, tags: ["AI", "ML", "Python", "Hands-on"], speakers: ["Prof. Ananya Roy", "Vikram Shah (Microsoft)"], isPaid: true, price: 150, isFeatured: false, rsvpStatus: "none", hasLiveStream: true, hasRecording: false },
  { id: "E4", title: "Inter-College Cricket Tournament", description: "Annual cricket tournament with 8 colleges competing. Cheer for your team!", category: "sports", status: "upcoming", date: "2026-09-10", startTime: "07:00", endTime: "18:00", location: "Main Cricket Ground", building: "Sports Complex", organizer: "Sports Council", organizerAvatar: "SC", organizerRole: "Administration", coverColor: "from-emerald-600 to-green-700", capacity: 2000, attendees: 1200, interested: 450, views: 2340, rating: 4.6, tags: ["Cricket", "Tournament", "Inter-college", "Free"], isPaid: false, isFeatured: true, rsvpStatus: "none", hasLiveStream: false, hasRecording: false },
  { id: "E5", title: "Fresher's Welcome Party 2026", description: "Welcome new students! DJ, food, games, and networking. Dress code: Smart Casuals.", category: "social", status: "upcoming", date: "2026-09-02", startTime: "17:00", endTime: "22:00", location: "Main Auditorium", building: "Main Campus", organizer: "Student Council", organizerAvatar: "ST", organizerRole: "Student Government", coverColor: "from-amber-500 to-orange-600", capacity: 800, attendees: 645, interested: 210, views: 3456, rating: 4.5, tags: ["Party", "Fresher", "DJ", "Food"], isPaid: true, price: 300, isFeatured: true, rsvpStatus: "going", hasLiveStream: false, hasRecording: false },
  { id: "E6", title: "Guest Lecture: Quantum Computing", description: "Dr. Sarah Chen from MIT discusses the future of quantum computing and its impact on cryptography.", category: "seminar", status: "upcoming", date: "2026-09-08", startTime: "14:00", endTime: "16:00", location: "Seminar Hall 1", building: "Science Block", organizer: "Physics Department", organizerAvatar: "PD", organizerRole: "Faculty", coverColor: "from-indigo-600 to-violet-700", capacity: 200, attendees: 134, interested: 78, views: 567, rating: 4.8, tags: ["Quantum", "Lecture", "MIT", "Physics"], speakers: ["Dr. Sarah Chen (MIT)"], isPaid: false, isFeatured: false, rsvpStatus: "none", hasLiveStream: true, hasRecording: false },
  { id: "E7", title: "Photography Exhibition — Campus Through Lens", description: "Student photography exhibition showcasing campus life, nature, and street photography. 50+ entries.", category: "exhibition", status: "upcoming", date: "2026-09-03", startTime: "10:00", endTime: "18:00", location: "Art Gallery", building: "Student Center", organizer: "Photography Club", organizerAvatar: "PC", organizerRole: "Student Club", coverColor: "from-teal-500 to-cyan-600", capacity: 300, attendees: 89, interested: 56, views: 432, rating: 4.4, tags: ["Photography", "Art", "Exhibition", "Free"], isPaid: false, isFeatured: false, rsvpStatus: "none", hasLiveStream: false, hasRecording: false },
  { id: "E8", title: "Career Fair — Spring 2026", description: "30+ companies hiring for internships and full-time roles. Bring printed resumes!", category: "networking", status: "upcoming", date: "2026-09-12", startTime: "09:00", endTime: "17:00", location: "Convention Center", building: "Main Campus", organizer: "Placement Cell", organizerAvatar: "PL", organizerRole: "Administration", coverColor: "from-orange-500 to-red-600", capacity: 1500, attendees: 1100, interested: 380, views: 4567, rating: 4.7, tags: ["Career", "Jobs", "Companies", "Resume"], isPaid: false, isFeatured: true, rsvpStatus: "interested", hasLiveStream: false, hasRecording: false },
  { id: "E9", title: "Annual Day Celebration 2026", description: "College annual day with cultural performances, awards ceremony, and dinner. All students welcome!", category: "cultural", status: "upcoming", date: "2026-09-15", startTime: "16:00", endTime: "23:00", location: "Main Auditorium + Grounds", building: "Main Campus", organizer: "Cultural Committee", organizerAvatar: "CC", organizerRole: "Administration", coverColor: "from-purple-500 to-pink-600", capacity: 3000, attendees: 2200, interested: 500, views: 5678, rating: 4.9, tags: ["Annual Day", "Cultural", "Awards", "Dinner"], isPaid: false, isFeatured: true, rsvpStatus: "going", hasLiveStream: true, hasRecording: false },
  { id: "E10", title: "Web Development Bootcamp", description: "5-day intensive bootcamp covering React, Node.js, and MongoDB. Build a full-stack app!", category: "workshop", status: "upcoming", date: "2026-09-06", startTime: "10:00", endTime: "17:00", location: "Computer Lab B", building: "CS Department", organizer: "Web Dev Club", organizerAvatar: "WD", organizerRole: "Student Club", coverColor: "from-blue-600 to-indigo-700", capacity: 40, attendees: 38, interested: 22, views: 567, rating: 4.6, tags: ["Web Dev", "React", "Node.js", "Bootcamp"], speakers: ["Amit Patel (Startup Founder)"], isPaid: true, price: 500, isFeatured: false, rsvpStatus: "none", hasLiveStream: true, hasRecording: false },
  { id: "E11", title: "Yoga & Meditation Morning Session", description: "Start your day right! 1-hour yoga and meditation session every Wednesday. All levels welcome.", category: "sports", status: "upcoming", date: "2026-08-27", startTime: "06:30", endTime: "07:30", location: "Central Lawn", building: "Main Campus", organizer: "Wellness Committee", organizerAvatar: "WC", organizerRole: "Student Government", coverColor: "from-green-500 to-teal-600", capacity: 100, attendees: 45, interested: 23, views: 234, rating: 4.3, tags: ["Yoga", "Meditation", "Morning", "Free"], isPaid: false, isFeatured: false, rsvpStatus: "none", hasLiveStream: true, hasRecording: false },
  { id: "E12", title: "Startup Pitch Night", description: "5 student startups pitch to a panel of VCs and angel investors. Free to attend!", category: "networking", status: "upcoming", date: "2026-09-04", startTime: "18:00", endTime: "21:00", location: "Seminar Hall 2", building: "Business School", organizer: "Entrepreneurship Cell", organizerAvatar: "EC", organizerRole: "Student Club", coverColor: "from-yellow-500 to-orange-600", capacity: 150, attendees: 120, interested: 67, views: 789, rating: 4.7, tags: ["Startup", "Pitch", "VC", "Investors"], isPaid: false, isFeatured: false, rsvpStatus: "none", hasLiveStream: true, hasRecording: false },
  { id: "E13", title: "Hack Night — Build in 12 Hours", description: "Rapid prototyping event. Form teams, pick a problem, build a solution. Prizes for top 3!", category: "tech", status: "upcoming", date: "2026-09-07", startTime: "18:00", endTime: "06:00+1", location: "Innovation Hub", building: "CS Department", organizer: "Hack Club", organizerAvatar: "HC", organizerRole: "Student Club", coverColor: "from-violet-600 to-purple-700", capacity: 80, attendees: 62, interested: 41, views: 456, rating: 4.5, tags: ["Hackathon", "12hr", "Prizes", "Team"], isPaid: false, isFeatured: false, rsvpStatus: "none", hasLiveStream: false, hasRecording: false },
  { id: "E14", title: "International Food Festival", description: "Taste cuisines from 15 countries prepared by international students. Vegetarian and vegan options available.", category: "cultural", status: "upcoming", date: "2026-09-11", startTime: "11:00", endTime: "20:00", location: "Food Court + Grounds", building: "Student Center", organizer: "International Students Club", organizerAvatar: "IC", organizerRole: "Student Club", coverColor: "from-pink-500 to-rose-600", capacity: 1000, attendees: 780, interested: 320, views: 3456, rating: 4.8, tags: ["Food", "International", "Festival", "Cultural"], isPaid: true, price: 100, isFeatured: true, rsvpStatus: "interested", hasLiveStream: false, hasRecording: false },
  { id: "E15", title: "Robotics Competition — Bot Wars", description: "Build and battle robots! Autonomous and manual categories. Exciting prizes!", category: "tech", status: "past", date: "2026-08-20", startTime: "10:00", endTime: "18:00", location: "Engineering Lab", building: "Engineering Block", organizer: "Robotics Club", organizerAvatar: "RC", organizerRole: "Student Club", coverColor: "from-slate-600 to-gray-700", capacity: 100, attendees: 95, interested: 0, views: 1890, rating: 4.8, tags: ["Robotics", "Competition", "Bots", "Prizes"], isPaid: true, price: 100, isFeatured: false, rsvpStatus: "going", hasLiveStream: false, hasRecording: true },
  { id: "E16", title: "Guest Lecture: Ethics in AI", description: "Prof. Michael Torres from Stanford discusses responsible AI development and bias mitigation.", category: "seminar", status: "past", date: "2026-08-18", startTime: "15:00", endTime: "17:00", location: "Seminar Hall 1", building: "Science Block", organizer: "Philosophy Dept + CS Dept", organizerAvatar: "PD", organizerRole: "Faculty", coverColor: "from-gray-600 to-slate-700", capacity: 200, attendees: 185, interested: 0, views: 2340, rating: 4.9, tags: ["AI", "Ethics", "Stanford", "Lecture"], speakers: ["Prof. Michael Torres (Stanford)"], isPaid: false, isFeatured: false, rsvpStatus: "going", hasLiveStream: false, hasRecording: true },
];

const STATS: EventStats = {
  totalEvents: 16,
  thisWeekEvents: 5,
  totalAttendees: 6131,
  avgRating: 4.68,
  popularCategory: "Tech",
  upcomingLiveStreams: 5,
  weeklyAttendance: [
    { day: "Mon", count: 450 }, { day: "Tue", count: 380 }, { day: "Wed", count: 520 },
    { day: "Thu", count: 290 }, { day: "Fri", count: 680 }, { day: "Sat", count: 890 },
    { day: "Sun", count: 340 },
  ],
  categoryDistribution: [
    { category: "Tech", count: 3, color: "#06b6d4" },
    { category: "Cultural", count: 2, color: "#a855f7" },
    { category: "Sports", count: 2, color: "#10b981" },
    { category: "Social", count: 1, color: "#f59e0b" },
    { category: "Workshop", count: 2, color: "#ec4899" },
    { category: "Seminar", count: 2, color: "#6366f1" },
    { category: "Concert", count: 1, color: "#f43f5e" },
    { category: "Exhibition", count: 1, color: "#14b8a6" },
    { category: "Networking", count: 2, color: "#f97316" },
  ],
  monthlyEvents: [
    { month: "May", events: 8, attendees: 2400 },
    { month: "Jun", events: 5, attendees: 1800 },
    { month: "Jul", events: 3, attendees: 900 },
    { month: "Aug", events: 12, attendees: 4200 },
    { month: "Sep", events: 16, attendees: 6100 },
  ],
};

// ─── Utility ──────────────────────────────────────────────────────
const catConfig = (c: EventCategory) => CATEGORY_CONFIG.find(cat => cat.id === c) || CATEGORY_CONFIG[0];

const statusColor = (s: EventStatus) => ({
  upcoming: "text-cyan-400", live: "text-emerald-400", past: "text-gray-400",
}[s]);

const statusBg = (s: EventStatus) => ({
  upcoming: "bg-cyan-500/20 border-cyan-500/40", live: "bg-emerald-500/20 border-emerald-500/40 animate-pulse",
  past: "bg-gray-500/20 border-gray-500/40",
}[s]);

const rsvpColor = (r: RSVPStatus) => ({
  going: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40",
  interested: "text-amber-400 bg-amber-500/20 border-amber-500/40",
  invited: "text-blue-400 bg-blue-500/20 border-blue-500/40",
  none: "",
}[r]);

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── Reusable Components ──────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color = "text-cyan-400" }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-xl bg-white/5 ${color}`}>{icon}</div>
      <span className="text-gray-400 text-sm">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </motion.div>
);

const TabButton = ({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number;
}) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
    active ? "bg-white/10 text-white border border-white/20 shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
  }`}>
    {icon}{label}
    {count !== undefined && <span className="text-xs opacity-60">({count})</span>}
  </button>
);

// ─── Main Dashboard ───────────────────────────────────────────────
export default function EventDiscovery() {
  const [activeTab, setActiveTab] = useState<"discover" | "calendar" | "my-events" | "analytics">("discover");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [calendarMonth, setCalendarMonth] = useState(8); // August (0-indexed)
  const [calendarYear, setCalendarYear] = useState(2026);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set(["E1", "E9"]));
  const [rsvps, setRsvps] = useState<Record<string, RSVPStatus>>(
    Object.fromEntries(EVENTS.map(e => [e.id, e.rsvpStatus]))
  );

  const toggleBookmark = useCallback((id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleRsvp = useCallback((id: string) => {
    setRsvps(prev => ({ ...prev, [id]: prev[id] === "going" ? "none" : "going" }));
  }, []);

  const toggleInterested = useCallback((id: string) => {
    setRsvps(prev => ({ ...prev, [id]: prev[id] === "interested" ? "none" : "interested" }));
  }, []);

  const filteredEvents = useMemo(() => {
    let evts = [...EVENTS];
    if (statusFilter !== "all") evts = evts.filter(e => e.status === statusFilter);
    if (categoryFilter !== "all") evts = evts.filter(e => e.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      evts = evts.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)) ||
        e.location.toLowerCase().includes(q)
      );
    }
    return evts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [statusFilter, categoryFilter, searchQuery]);

  const featuredEvents = EVENTS.filter(e => e.isFeatured && e.status === "upcoming");
  const myEvents = EVENTS.filter(e => rsvps[e.id] === "going" || rsvps[e.id] === "interested");

  // ─── Calendar Grid ──────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const today = new Date();
    const days: EventCalendarDay[] = [];
    // Previous month padding
    const prevMonthDays = getDaysInMonth(calendarYear, calendarMonth - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: prevMonthDays - i, month: calendarMonth - 1, year: calendarYear, events: [], isToday: false, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = EVENTS.filter(e => e.date === dateStr);
      const isToday = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth && today.getDate() === d;
      days.push({ date: d, month: calendarMonth, year: calendarYear, events: dayEvents, isToday, isCurrentMonth: true });
    }
    return days;
  }, [calendarMonth, calendarYear]);

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ─── Tab: Discover ──────────────────────────────────────────────
  const DiscoverTab = () => (
    <div className="space-y-6">
      {/* Featured Events Carousel */}
      <div>
        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> Featured Events
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {featuredEvents.map((event, i) => {
            const cat = catConfig(event.category);
            return (
              <motion.div key={event.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedEvent(event.id)}
                className="flex-shrink-0 w-80 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 transition-all">
                <div className={`h-36 bg-gradient-to-br ${event.coverColor} p-4 flex flex-col justify-between relative`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${statusBg(event.status)} ${statusColor(event.status)}`}>
                      {event.status === "live" ? "● LIVE" : event.status.toUpperCase()}
                    </span>
                    {event.hasLiveStream && (
                      <span className="px-2 py-1 rounded-lg text-[10px] bg-red-500/80 text-white font-bold flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE STREAM
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded-lg ${cat.bg} ${cat.color}`}>{cat.icon}</span>
                      <span className="text-white/70 text-[10px] uppercase tracking-wider">{cat.label}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="text-white font-semibold text-sm mb-1 line-clamp-1">{event.title}</h4>
                  <p className="text-gray-400 text-xs line-clamp-2 mb-3">{event.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.startTime}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-400 text-[10px]">{event.attendees}/{event.capacity}</span>
                      <div className="w-16 h-1.5 bg-white/10 rounded-full ml-1">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(event.attendees / event.capacity) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3 h-3" fill="currentColor" />
                      <span className="text-[10px] font-medium">{event.rating}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm w-64 focus:outline-none focus:border-cyan-500/50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as EventStatus | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="all">All Events</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live Now</option>
            <option value="past">Past</option>
          </select>
          <div className="flex gap-1 flex-wrap">
            {CATEGORY_CONFIG.slice(0, 6).map(c => (
              <button key={c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? "all" : c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === c.id ? `${c.bg} ${c.color} border border-current/40` : "bg-white/5 text-gray-400 border border-white/10 hover:text-white"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-400"}`}>
            <Grid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-400"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
        {filteredEvents.map((event, i) => {
          const cat = catConfig(event.category);
          const rsvp = rsvps[event.id];
          return viewMode === "grid" ? (
            <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
              className={`bg-white/5 backdrop-blur-md border rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-white/20 ${
                selectedEvent === event.id ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : "border-white/10"
              }`}>
              <div className={`h-32 bg-gradient-to-br ${event.coverColor} p-4 flex flex-col justify-between relative`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${statusBg(event.status)} ${statusColor(event.status)}`}>
                    {event.status === "live" ? "● LIVE" : event.status}
                  </span>
                  {event.isPaid && (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/30 text-amber-300">₹{event.price}</span>
                  )}
                </div>
                <span className={`self-start px-2 py-1 rounded-lg text-[10px] ${cat.bg} ${cat.color} font-medium`}>{cat.label}</span>
              </div>
              <div className="p-4">
                <h4 className="text-white font-semibold text-sm mb-1 line-clamp-1">{event.title}</h4>
                <p className="text-gray-400 text-xs line-clamp-2 mb-3">{event.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.startTime}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.attendees}/{event.capacity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); toggleRsvp(event.id); }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                        rsvp === "going" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}>
                      {rsvp === "going" ? "✓ Going" : "Going?"}
                    </button>
                    <button onClick={e => { e.stopPropagation(); toggleInterested(event.id); }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                        rsvp === "interested" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}>
                      {rsvp === "interested" ? "★ Interested" : "★ Interest"}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3 h-3" fill="currentColor" />
                    <span className="text-[10px]">{event.rating}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key={event.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
              className={`bg-white/5 backdrop-blur-md border rounded-xl p-4 cursor-pointer transition-all hover:border-white/20 flex items-center gap-4 ${
                selectedEvent === event.id ? "border-cyan-500/50" : "border-white/10"
              }`}>
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${event.coverColor} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white/50">{cat.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-medium text-sm truncate">{event.title}</h4>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusBg(event.status)} ${statusColor(event.status)}`}>{event.status}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.startTime}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.attendees}/{event.capacity}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {event.isPaid && <span className="px-2 py-1 rounded-lg text-[10px] bg-amber-500/20 text-amber-400">₹{event.price}</span>}
                <div className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3" fill="currentColor" /><span className="text-[10px]">{event.rating}</span></div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Event Detail Panel */}
      <AnimatePresence>
        {selectedEvent && (() => {
          const event = EVENTS.find(e => e.id === selectedEvent);
          if (!event) return null;
          const cat = catConfig(event.category);
          const rsvp = rsvps[event.id];
          const occupancy = Math.round((event.attendees / event.capacity) * 100);
          return (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${event.coverColor} flex items-center justify-center`}>
                      <span className="text-white/40 text-xl">{cat.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{event.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusBg(event.status)} ${statusColor(event.status)}`}>{event.status}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${cat.bg} ${cat.color}`}>{cat.label}</span>
                        {event.isFeatured && <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">⭐ Featured</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-gray-300 text-sm mb-4 leading-relaxed">{event.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Date</div>
                    <div className="text-white text-sm font-medium">{event.date}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Time</div>
                    <div className="text-white text-sm font-medium">{event.startTime} — {event.endTime}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Location</div>
                    <div className="text-white text-sm font-medium">{event.location}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Capacity</div>
                    <div className="text-white text-sm font-medium">{event.attendees}/{event.capacity} ({occupancy}%)</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Price</div>
                    <div className="text-white text-sm font-medium">{event.isPaid ? `₹${event.price}` : "Free"}</div>
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="mb-4">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${occupancy > 90 ? "bg-red-500" : occupancy > 70 ? "bg-amber-500" : "bg-cyan-500"}`}
                      style={{ width: `${occupancy}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 text-right">
                    {occupancy > 90 ? "Almost full!" : occupancy > 70 ? "Filling up" : "Spots available"} — {event.capacity - event.attendees} spots left
                  </div>
                </div>

                {/* Speakers */}
                {event.speakers && event.speakers.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-400 mb-2">Speakers</div>
                    <div className="flex flex-wrap gap-2">
                      {event.speakers.map((speaker, j) => (
                        <span key={j} className="px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          🎤 {speaker}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {event.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-lg text-xs bg-white/5 text-gray-300 border border-white/10">#{tag}</span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                      {event.organizerAvatar}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{event.organizer}</div>
                      <div className="text-gray-500 text-[10px]">{event.organizerRole}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleBookmark(event.id)}
                      className={`p-2 rounded-lg border ${bookmarked.has(event.id) ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}>
                      <Bookmark className="w-4 h-4" fill={bookmarked.has(event.id) ? "currentColor" : "none"} />
                    </button>
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white">
                      <Bell className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleRsvp(event.id)}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                        rsvp === "going" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white"
                      }`}>
                      {rsvp === "going" ? "✓ Going — Cancel" : "RSVP — I'm Going!"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );

  // ─── Tab: Calendar ──────────────────────────────────────────────
  const CalendarTab = () => (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); } else setCalendarMonth(m => m - 1); }}
            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="text-white font-semibold text-lg">{MONTHS[calendarMonth]} {calendarYear}</h3>
          <button onClick={() => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); } else setCalendarMonth(m => m + 1); }}
            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs text-gray-400 font-medium py-2">{d}</div>
          ))}
          {calendarDays.map((day, i) => (
            <div key={i} className={`min-h-[80px] p-2 rounded-lg border transition-all ${
              day.isToday ? "bg-cyan-500/10 border-cyan-500/40" :
              day.isCurrentMonth ? "bg-white/5 border-white/5 hover:border-white/20" :
              "bg-white/[0.02] border-transparent"
            }`}>
              <div className={`text-xs font-medium mb-1 ${day.isToday ? "text-cyan-400" : day.isCurrentMonth ? "text-gray-300" : "text-gray-600"}`}>
                {day.date}
              </div>
              {day.events.slice(0, 2).map(event => {
                const cat = catConfig(event.category);
                return (
                  <div key={event.id} onClick={() => setSelectedEvent(event.id)}
                    className={`text-[9px] px-1.5 py-0.5 rounded mb-0.5 cursor-pointer truncate ${cat.bg} ${cat.color}`}>
                    {event.title}
                  </div>
                );
              })}
              {day.events.length > 2 && (
                <div className="text-[9px] text-gray-500">+{day.events.length - 2} more</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming this month */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-cyan-400" /> Events in {MONTHS[calendarMonth]}
        </h3>
        <div className="space-y-3">
          {EVENTS.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === calendarMonth && d.getFullYear() === calendarYear;
          }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => {
            const cat = catConfig(event.category);
            return (
              <div key={event.id} onClick={() => setSelectedEvent(event.id)}
                className="flex items-center gap-4 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <div className="text-center w-12">
                  <div className="text-lg font-bold text-white">{new Date(event.date).getDate()}</div>
                  <div className="text-[10px] text-gray-500">{MONTHS[new Date(event.date).getMonth()].slice(0, 3)}</div>
                </div>
                <div className="w-1 h-10 rounded-full" style={{ backgroundColor: cat.color.includes("cyan") ? "#06b6d4" : cat.color.includes("purple") ? "#a855f7" : cat.color.includes("emerald") ? "#10b981" : "#f59e0b" }} />
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{event.title}</div>
                  <div className="text-gray-400 text-[10px]">{event.startTime} · {event.location}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusBg(event.status)} ${statusColor(event.status)}`}>{event.status}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Tab: My Events ─────────────────────────────────────────────
  const MyEventsTab = () => {
    const going = myEvents.filter(e => rsvps[e.id] === "going");
    const interested = myEvents.filter(e => rsvps[e.id] === "interested");
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={<Check className="w-5 h-5" />} label="Going" value={going.length} sub="Events you'll attend" color="text-emerald-400" />
        <KpiCard icon={<Star className="w-5 h-5" />} label="Interested" value={interested.length} sub="Bookmarked events" color="text-amber-400" />
        <KpiCard icon={<Bookmark className="w-5 h-5" />} label="Saved" value={bookmarked.size} sub="Bookmarks" color="text-purple-400" />
      </div>

      {going.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" /> Going ({going.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {going.map(event => {
              const cat = catConfig(event.category);
              return (
                <div key={event.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${event.coverColor} flex items-center justify-center`}>
                    <span className="text-white/40">{cat.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">{event.title}</div>
                    <div className="text-gray-400 text-[10px] flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.startTime}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleRsvp(event.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] text-white font-medium">Cancel</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {interested.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" /> Interested ({interested.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interested.map(event => {
              const cat = catConfig(event.category);
              return (
                <div key={event.id} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${event.coverColor} flex items-center justify-center`}>
                    <span className="text-white/40">{cat.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">{event.title}</div>
                    <div className="text-gray-400 text-[10px] flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.startTime}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleRsvp(event.id)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-[10px] text-white font-medium">RSVP Going</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {going.length === 0 && interested.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <div className="text-white font-semibold">No events yet</div>
          <div className="text-gray-400 text-sm mt-1">Browse events and RSVP to see them here</div>
        </div>
      )}

      {/* Bookmarked */}
      {bookmarked.size > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-purple-400" /> Bookmarked
          </h3>
          <div className="flex gap-3 flex-wrap">
            {EVENTS.filter(e => bookmarked.has(e.id)).map(event => {
              const cat = catConfig(event.category);
              return (
                <div key={event.id} onClick={() => setSelectedEvent(event.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:border-white/20">
                  <span className={`p-1 rounded ${cat.bg} ${cat.color}`}>{cat.icon}</span>
                  <span className="text-white text-xs">{event.title}</span>
                  <button onClick={e => { e.stopPropagation(); toggleBookmark(event.id); }}
                    className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );};

  // ─── Tab: Analytics ─────────────────────────────────────────────
  const AnalyticsTab = () => {
    const maxWeek = Math.max(...STATS.weeklyAttendance.map(d => d.count));
    const maxMonthly = Math.max(...STATS.monthlyEvents.map(m => m.attendees));
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Calendar className="w-5 h-5" />} label="Total Events" value={STATS.totalEvents} sub={`${STATS.thisWeekEvents} this week`} color="text-cyan-400" />
        <KpiCard icon={<Users className="w-5 h-5" />} label="Total Attendees" value={STATS.totalAttendees.toLocaleString()} sub="Across all events" color="text-purple-400" />
        <KpiCard icon={<Star className="w-5 h-5" />} label="Avg Rating" value={STATS.avgRating} sub="Out of 5.0" color="text-amber-400" />
        <KpiCard icon={<Zap className="w-5 h-5" />} label="Live Streams" value={STATS.upcomingLiveStreams} sub="Upcoming streams" color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Attendance */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" /> Weekly Attendance
          </h3>
          <div className="flex items-end gap-3 h-40">
            {STATS.weeklyAttendance.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] text-gray-400">{d.count}</div>
                <div className={`w-full rounded-t-lg transition-all duration-500 ${
                  d.count === maxWeek ? "bg-cyan-500" : "bg-cyan-500/30"
                }`} style={{ height: `${(d.count / maxWeek) * 100}%` }} />
                <div className="text-[10px] text-gray-400">{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" /> By Category
          </h3>
          <div className="space-y-3">
            {STATS.categoryDistribution.sort((a, b) => b.count - a.count).map((c, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{c.category}</span>
                  <span className="text-gray-400">{c.count} events</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.count / STATS.categoryDistribution[0].count) * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber-400" /> Monthly Overview
        </h3>
        <div className="flex items-end gap-4 h-48">
          {STATS.monthlyEvents.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-1 items-end" style={{ height: "100%" }}>
                <div className="w-5 rounded-t bg-cyan-500/50" style={{ height: `${(m.events / STATS.monthlyEvents[0].events) * 100}%` }} />
                <div className="w-5 rounded-t bg-purple-500/50" style={{ height: `${(m.attendees / maxMonthly) * 100}%` }} />
              </div>
              <div className="text-[10px] text-gray-400">{m.month}</div>
              <div className="text-[9px] text-gray-500">{m.events}E / {m.attendees}P</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500/50" /> Events</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-500/50" /> Attendees</div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> 📊 Event Insights
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-cyan-400">{STATS.popularCategory}</div>
            <div className="text-xs text-gray-400 mt-1">Most Popular</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">89%</div>
            <div className="text-xs text-gray-400 mt-1">Avg Fill Rate</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">Sat</div>
            <div className="text-xs text-gray-400 mt-1">Peak Day</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">5</div>
            <div className="text-xs text-gray-400 mt-1">Live Streams</div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            "📈 September is your biggest month — 16 events, 6100+ attendees expected",
            "🎯 Tech events have the highest ratings (4.7 avg) — consider hosting more",
            "📱 5 upcoming live streams — enable notifications to not miss out",
            "🏆 Annual Day is the biggest event (3000 capacity) — RSVP early!",
          ].map((insight, i) => (
            <div key={i} className="text-sm text-gray-300 bg-white/5 rounded-xl p-3">{insight}</div>
          ))}
        </div>
      </div>
    </div>
  );};

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-cyan-600/20" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-white flex items-center gap-3">
                <Calendar className="w-8 h-8 text-purple-400" />
                Campus Events
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-gray-400 mt-2">{STATS.totalEvents} events • {STATS.totalAttendees.toLocaleString()} attendees • {STATS.upcomingLiveStreams} live streams upcoming</motion.p>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2">
            <TabButton active={activeTab === "discover"} onClick={() => setActiveTab("discover")}
              icon={<Sparkles className="w-4 h-4" />} label="Discover" count={filteredEvents.length} />
            <TabButton active={activeTab === "calendar"} onClick={() => setActiveTab("calendar")}
              icon={<CalendarDays className="w-4 h-4" />} label="Calendar" />
            <TabButton active={activeTab === "my-events"} onClick={() => setActiveTab("my-events")}
              icon={<Bookmark className="w-4 h-4" />} label="My Events" count={myEvents.length} />
            <TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}
              icon={<BarChart3 className="w-4 h-4" />} label="Analytics" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {activeTab === "discover" && <DiscoverTab />}
            {activeTab === "calendar" && <CalendarTab />}
            {activeTab === "my-events" && <MyEventsTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
