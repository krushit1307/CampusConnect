import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Camera,
  MapPin,
  Clock,
  Tag,
  AlertTriangle,
  CheckCircle,
  Eye,
  MessageCircle,
  Phone,
  Mail,
  Filter,
  Grid,
  List,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Star,
  Bell,
  Share2,
  Bookmark,
  Trash2,
  Edit3,
  Upload,
  Send,
  User,
  Package,
  Briefcase,
  Smartphone,
  BookOpen,
  Key,
  CreditCard,
  Headphones,
  Watch,
  Backpack,
  FileText,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  MapPinned,
  Navigation,
  Zap,
  Shield,
  Info,
  ArrowRight,
  RefreshCw,
  Home,
  Smile,
  Meh,
  Frown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type ItemStatus = "lost" | "found" | "claimed" | "expired";
type ItemCategory =
  | "electronics"
  | "clothing"
  | "bags"
  | "documents"
  | "keys"
  | "accessories"
  | "books"
  | "sports"
  | "other";
type UrgencyLevel = "low" | "medium" | "high" | "critical";
type MatchConfidence = "high" | "medium" | "low";

interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  status: ItemStatus;
  urgency: UrgencyLevel;
  location: string;
  building: string;
  dateReported: string;
  dateLost?: string;
  dateFound?: string;
  reporterName: string;
  reporterContact: string;
  reporterAvatar: string;
  imageColor: string; // placeholder for image
  tags: string[];
  views: number;
  matches: number;
  claimedBy?: string;
  claimedDate?: string;
  reward?: string;
  contactPreference: "message" | "phone" | "email";
  isAnonymous: boolean;
}

interface MatchSuggestion {
  id: string;
  lostItemId: string;
  foundItemId: string;
  confidence: MatchConfidence;
  reason: string;
  locationMatch: boolean;
  categoryMatch: boolean;
  timeMatch: boolean;
  descriptionMatch: boolean;
}

interface CampusLocation {
  id: string;
  name: string;
  building: string;
  zone: string;
  lostCount: number;
  foundCount: number;
  lastReported: string;
}

interface LostFoundStats {
  totalLost: number;
  totalFound: number;
  totalClaimed: number;
  totalExpired: number;
  matchRate: number;
  avgClaimTime: string;
  topCategory: string;
  topLocation: string;
  weeklyTrend: { day: string; lost: number; found: number }[];
  categoryBreakdown: { category: string; count: number; color: string }[];
  locationHeatmap: { location: string; items: number; zone: string }[];
  monthlyStats: { month: string; lost: number; found: number; claimed: number }[];
}

// ─── Data ──────────────────────────────────────────────────────────
const CATEGORIES: { id: ItemCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "electronics", label: "Electronics", icon: <Smartphone className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/20" },
  { id: "clothing", label: "Clothing", icon: <Tag className="w-4 h-4" />, color: "text-purple-400 bg-purple-500/20" },
  { id: "bags", label: "Bags & Luggage", icon: <Backpack className="w-4 h-4" />, color: "text-amber-400 bg-amber-500/20" },
  { id: "documents", label: "Documents", icon: <FileText className="w-4 h-4" />, color: "text-red-400 bg-red-500/20" },
  { id: "keys", label: "Keys", icon: <Key className="w-4 h-4" />, color: "text-emerald-400 bg-emerald-500/20" },
  { id: "accessories", label: "Accessories", icon: <Watch className="w-4 h-4" />, color: "text-pink-400 bg-pink-500/20" },
  { id: "books", label: "Books & Notes", icon: <BookOpen className="w-4 h-4" />, color: "text-cyan-400 bg-cyan-500/20" },
  { id: "sports", label: "Sports Gear", icon: <Briefcase className="w-4 h-4" />, color: "text-orange-400 bg-orange-500/20" },
  { id: "other", label: "Other", icon: <Package className="w-4 h-4" />, color: "text-gray-400 bg-gray-500/20" },
];

const ITEMS: LostFoundItem[] = [
  { id: "I1", title: "MacBook Pro 14\" — Space Gray", description: "Lost my MacBook Pro 14\" near the library. Has a small sticker on the lid (NASA logo). Contains important thesis files. Please contact ASAP.", category: "electronics", status: "lost", urgency: "critical", location: "Library 2nd Floor", building: "Central Library", dateReported: "2026-08-24", dateLost: "2026-08-24", reporterName: "Priya Sharma", reporterContact: "priya@campus.edu", reporterAvatar: "PS", imageColor: "from-slate-600 to-slate-800", tags: ["MacBook", "Apple", "Sticker", "Thesis"], views: 234, matches: 2, reward: "₹2000 reward", contactPreference: "message", isAnonymous: false },
  { id: "I2", title: "Blue Samsung Galaxy S24", description: "Found a blue Samsung Galaxy S24 near the cafeteria entrance. Phone is locked. Last seen around 12:30 PM.", category: "electronics", status: "found", urgency: "medium", location: "Cafeteria Entrance", building: "Student Center", dateReported: "2026-08-25", dateFound: "2026-08-25", reporterName: "Rahul Verma", reporterContact: "rahul@campus.edu", reporterAvatar: "RV", imageColor: "from-blue-600 to-blue-800", tags: ["Samsung", "Phone", "Blue", "Locked"], views: 156, matches: 3, contactPreference: "phone", isAnonymous: false },
  { id: "I3", title: "Black Leather Wallet", description: "Lost black leather wallet somewhere between Engineering Block and Parking. Has student ID and debit card inside. Very urgent!", category: "accessories", status: "lost", urgency: "critical", location: "Engineering Block", building: "Engineering", dateReported: "2026-08-25", dateLost: "2026-08-25", reporterName: "Anonymous", reporterContact: "anon@campus.edu", reporterAvatar: "AN", imageColor: "from-amber-700 to-amber-900", tags: ["Wallet", "Leather", "ID Card", "Debit Card"], views: 312, matches: 1, reward: "₹500 reward", contactPreference: "message", isAnonymous: true },
  { id: "I4", title: "Red Umbrella — Xiaomi", description: "Found a red Xiaomi umbrella at the bus stop near North Gate. It's a compact folding umbrella with a broken zipper on the sleeve.", category: "other", status: "found", urgency: "low", location: "North Gate Bus Stop", building: "Main Campus", dateReported: "2026-08-24", dateFound: "2026-08-24", reporterName: "Campus Security", reporterContact: "security@campus.edu", reporterAvatar: "CS", imageColor: "from-red-500 to-red-700", tags: ["Umbrella", "Red", "Xiaomi", "Folding"], views: 89, matches: 0, contactPreference: "email", isAnonymous: false },
  { id: "I5", title: "Black Jansport Backpack", description: "Lost my black Jansport backpack in the Computer Lab. Contains textbooks, laptop charger, and a water bottle. Has a keychain on the zipper.", category: "bags", status: "lost", urgency: "high", location: "Computer Lab B", building: "CS Department", dateReported: "2026-08-25", dateLost: "2026-08-25", reporterName: "Amit Singh", reporterContact: "amit@campus.edu", reporterAvatar: "AS", imageColor: "from-gray-600 to-gray-800", tags: ["Backpack", "Jansport", "Laptop Charger", "Textbooks"], views: 178, matches: 1, contactPreference: "message", isAnonymous: false },
  { id: "I6", title: "Gold Chain with Pendant", description: "Found a gold chain with a small OM pendant near the Auditorium entrance. Quite valuable — please claim with ID proof.", category: "accessories", status: "found", urgency: "high", location: "Auditorium Entrance", building: "Main Campus", dateReported: "2026-08-25", dateFound: "2026-08-25", reporterName: "Dr. Meera Iyer", reporterContact: "meera@campus.edu", reporterAvatar: "MI", imageColor: "from-yellow-500 to-yellow-700", tags: ["Gold", "Chain", "Pendant", "OM", "Jewelry"], views: 445, matches: 0, contactPreference: "message", isAnonymous: false },
  { id: "I7", title: "Wireless AirPods Pro (USB-C)", description: "Lost my AirPods Pro in white case near the Science Block. Case has a small scratch on the back. Please find!", category: "electronics", status: "lost", urgency: "medium", location: "Science Block Lobby", building: "Science", dateReported: "2026-08-24", dateLost: "2026-08-24", reporterName: "Neha Gupta", reporterContact: "neha@campus.edu", reporterAvatar: "NG", imageColor: "from-white to-gray-200", tags: ["AirPods", "Apple", "White", "Wireless"], views: 198, matches: 1, reward: "₹1000 reward", contactPreference: "phone", isAnonymous: false },
  { id: "I8", title: "Student ID Card — Dept. of CS", description: "Found student ID card for CS department near the parking lot. Name starts with 'A'. Turned in to campus security office.", category: "documents", status: "found", urgency: "low", location: "Parking Lot B", building: "Main Campus", dateReported: "2026-08-23", dateFound: "2026-08-23", reporterName: "Parking Attendant", reporterContact: "parking@campus.edu", reporterAvatar: "PA", imageColor: "from-indigo-500 to-indigo-700", tags: ["ID Card", "Student", "CS Department"], views: 67, matches: 0, contactPreference: "email", isAnonymous: false },
  { id: "I9", title: "Nike Running Shoes (Size 10)", description: "Lost my black Nike running shoes from the Sports Complex locker room. Size 10 US, white sole, slightly worn.", category: "sports", status: "lost", urgency: "low", location: "Sports Complex Locker", building: "Sports Complex", dateReported: "2026-08-22", dateLost: "2026-08-22", reporterName: "Karan Patel", reporterContact: "karan@campus.edu", reporterAvatar: "KP", imageColor: "from-gray-700 to-black", tags: ["Nike", "Shoes", "Running", "Black", "Size 10"], views: 134, matches: 0, contactPreference: "message", isAnonymous: false },
  { id: "I10", title: "Water Bottle — Hydro Flask 32oz", description: "Found a teal Hydro Flask 32oz water bottle in the cafeteria. Has several stickers on it including a mountain logo.", category: "other", status: "found", urgency: "low", location: "Cafeteria Table 12", building: "Student Center", dateReported: "2026-08-25", dateFound: "2026-08-25", reporterName: "Cafeteria Staff", reporterContact: "cafeteria@campus.edu", reporterAvatar: "CF", imageColor: "from-teal-500 to-teal-700", tags: ["Hydro Flask", "Water Bottle", "Teal", "Stickers"], views: 56, matches: 0, contactPreference: "email", isAnonymous: false },
  { id: "I11", title: "Blue Denim Jacket", description: "Lost my blue denim jacket in the Auditorium after the seminar. Has patches on the back pocket.", category: "clothing", status: "lost", urgency: "low", location: "Auditorium", building: "Main Campus", dateReported: "2026-08-23", dateLost: "2026-08-23", reporterName: "Sanjay Kumar", reporterContact: "sanjay@campus.edu", reporterAvatar: "SK", imageColor: "from-blue-400 to-blue-600", tags: ["Jacket", "Denim", "Blue", "Patches"], views: 92, matches: 0, contactPreference: "phone", isAnonymous: false },
  { id: "I12", title: "Calculus Textbook — Stewart 8th Ed", description: "Found a Stewart Calculus textbook at the library return desk. Has highlighter marks in chapters 1-5 and someone's name inside the cover.", category: "books", status: "found", urgency: "low", location: "Library Return Desk", building: "Central Library", dateReported: "2026-08-24", dateFound: "2026-08-24", reporterName: "Librarian", reporterContact: "library@campus.edu", reporterAvatar: "LB", imageColor: "from-emerald-600 to-emerald-800", tags: ["Textbook", "Calculus", "Stewart", "Highlighted"], views: 45, matches: 0, contactPreference: "email", isAnonymous: false },
  { id: "I13", title: "Set of 3 Keys — Honda Fob", description: "Lost my keys near the Admin Building. Includes a Honda car key fob, house key, and a small teddy bear keychain.", category: "keys", status: "lost", urgency: "high", location: "Admin Building Entrance", building: "Admin", dateReported: "2026-08-25", dateLost: "2026-08-25", reporterName: "Prof. Sharma", reporterContact: "sharma@campus.edu", reporterAvatar: "PS", imageColor: "from-gray-500 to-gray-700", tags: ["Keys", "Honda", "Fob", "Keychain", "Teddy Bear"], views: 167, matches: 1, reward: "₹300 reward", contactPreference: "phone", isAnonymous: false },
  { id: "I14", title: "Reading Glasses — Blue Frame", description: "Found blue-framed reading glasses in the Computer Lab. High prescription, quite thick lenses.", category: "accessories", status: "found", urgency: "medium", location: "Computer Lab A", building: "CS Department", dateReported: "2026-08-25", dateFound: "2026-08-25", reporterName: "Lab Assistant", reporterContact: "lab@campus.edu", reporterAvatar: "LA", imageColor: "from-blue-400 to-indigo-600", tags: ["Glasses", "Reading", "Blue", "Prescription"], views: 78, matches: 0, contactPreference: "message", isAnonymous: false },
  { id: "I15", title: "Grey North Face Jacket", description: "Claimed! Owner verified at Security Office.", category: "clothing", status: "claimed", urgency: "low", location: "Sports Complex", building: "Sports Complex", dateReported: "2026-08-20", dateFound: "2026-08-20", reporterName: "Security Desk", reporterContact: "security@campus.edu", reporterAvatar: "SD", imageColor: "from-gray-500 to-gray-700", tags: ["Jacket", "North Face", "Grey"], views: 88, matches: 1, claimedBy: "Vikram Reddy", claimedDate: "2026-08-21", contactPreference: "message", isAnonymous: false },
  { id: "I16", title: "Bluetooth Speaker — JBL Flip 6", description: "Found a red JBL Flip 6 speaker in the hostel common room. Still has battery.", category: "electronics", status: "found", urgency: "medium", location: "Hostel Block A Common Room", building: "Hostel A", dateReported: "2026-08-25", dateFound: "2026-08-25", reporterName: "Warden", reporterContact: "warden@campus.edu", reporterAvatar: "WD", imageColor: "from-red-500 to-red-700", tags: ["Speaker", "JBL", "Bluetooth", "Red"], views: 112, matches: 1, contactPreference: "email", isAnonymous: false },
];

const LOCATIONS: CampusLocation[] = [
  { id: "L1", name: "Central Library", building: "Library", zone: "Zone A", lostCount: 45, foundCount: 38, lastReported: "2026-08-25" },
  { id: "L2", name: "Student Center", building: "Student Center", zone: "Zone B", lostCount: 32, foundCount: 28, lastReported: "2026-08-25" },
  { id: "L3", name: "CS Department", building: "CS Dept", zone: "Zone B", lostCount: 28, foundCount: 22, lastReported: "2026-08-25" },
  { id: "L4", name: "Engineering Block", building: "Engineering", zone: "Zone B", lostCount: 24, foundCount: 18, lastReported: "2026-08-25" },
  { id: "L5", name: "Sports Complex", building: "Sports", zone: "Zone C", lostCount: 22, foundCount: 16, lastReported: "2026-08-24" },
  { id: "L6", name: "Auditorium", building: "Auditorium", zone: "Zone C", lostCount: 18, foundCount: 15, lastReported: "2026-08-25" },
  { id: "L7", name: "Science Block", building: "Science", zone: "Zone C", lostCount: 15, foundCount: 12, lastReported: "2026-08-24" },
  { id: "L8", name: "Admin Building", building: "Admin", zone: "Zone A", lostCount: 12, foundCount: 10, lastReported: "2026-08-25" },
  { id: "L9", name: "Hostel Block A", building: "Hostel A", zone: "Zone D", lostCount: 20, foundCount: 18, lastReported: "2026-08-25" },
  { id: "L10", name: "Parking Lot", building: "Parking", zone: "Zone E", lostCount: 8, foundCount: 6, lastReported: "2026-08-23" },
];

const STATS: LostFoundStats = {
  totalLost: 89,
  totalFound: 72,
  totalClaimed: 54,
  totalExpired: 12,
  matchRate: 73.2,
  avgClaimTime: "1.8 days",
  topCategory: "Electronics",
  topLocation: "Central Library",
  weeklyTrend: [
    { day: "Mon", lost: 14, found: 11 },
    { day: "Tue", lost: 12, found: 9 },
    { day: "Wed", lost: 16, found: 13 },
    { day: "Thu", lost: 11, found: 10 },
    { day: "Fri", lost: 18, found: 15 },
    { day: "Sat", lost: 8, found: 6 },
    { day: "Sun", lost: 5, found: 4 },
  ],
  categoryBreakdown: [
    { category: "Electronics", count: 35, color: "#3b82f6" },
    { category: "Accessories", count: 22, color: "#ec4899" },
    { category: "Bags", count: 18, color: "#f59e0b" },
    { category: "Keys", count: 15, color: "#10b981" },
    { category: "Documents", count: 12, color: "#ef4444" },
    { category: "Clothing", count: 10, color: "#8b5cf6" },
    { category: "Books", count: 8, color: "#06b6d4" },
    { category: "Sports", count: 6, color: "#f97316" },
    { category: "Other", count: 9, color: "#6b7280" },
  ],
  locationHeatmap: [
    { location: "Central Library", items: 83, zone: "Zone A" },
    { location: "Student Center", items: 60, zone: "Zone B" },
    { location: "CS Department", items: 50, zone: "Zone B" },
    { location: "Engineering Block", items: 42, zone: "Zone B" },
    { location: "Sports Complex", items: 38, zone: "Zone C" },
    { location: "Auditorium", items: 33, zone: "Zone C" },
    { location: "Science Block", items: 27, zone: "Zone C" },
    { location: "Hostel Block A", items: 38, zone: "Zone D" },
    { location: "Admin Building", items: 22, zone: "Zone A" },
    { location: "Parking Lot", items: 14, zone: "Zone E" },
  ],
  monthlyStats: [
    { month: "Apr", lost: 72, found: 58, claimed: 42 },
    { month: "May", lost: 68, found: 55, claimed: 40 },
    { month: "Jun", lost: 45, found: 35, claimed: 25 },
    { month: "Jul", lost: 38, found: 30, claimed: 22 },
    { month: "Aug", lost: 89, found: 72, claimed: 54 },
  ],
};

const MATCH_SUGGESTIONS: MatchSuggestion[] = [
  { id: "M1", lostItemId: "I1", foundItemId: "I16", confidence: "low", reason: "Both electronics found in hostel/library area", locationMatch: false, categoryMatch: true, timeMatch: false, descriptionMatch: false },
  { id: "M2", lostItemId: "I7", foundItemId: "I2", confidence: "medium", reason: "Both are wireless earbuds/phones found in campus buildings", locationMatch: false, categoryMatch: true, timeMatch: true, descriptionMatch: false },
  { id: "M3", lostItemId: "I13", foundItemId: "I8", confidence: "high", reason: "Keys found near Admin Building, ID found at parking — same area", locationMatch: true, categoryMatch: false, timeMatch: true, descriptionMatch: false },
];

// ─── Utility ──────────────────────────────────────────────────────
const statusColor = (s: ItemStatus) => ({
  lost: "text-red-400", found: "text-emerald-400", claimed: "text-blue-400", expired: "text-gray-400",
}[s]);

const statusBg = (s: ItemStatus) => ({
  lost: "bg-red-500/20 border-red-500/40", found: "bg-emerald-500/20 border-emerald-500/40",
  claimed: "bg-blue-500/20 border-blue-500/40", expired: "bg-gray-500/20 border-gray-500/40",
}[s]);

const urgencyColor = (u: UrgencyLevel) => ({
  low: "text-gray-400 bg-gray-500/10", medium: "text-amber-400 bg-amber-500/10",
  high: "text-orange-400 bg-orange-500/10", critical: "text-red-400 bg-red-500/10",
}[u]);

const categoryInfo = (c: ItemCategory) => CATEGORIES.find(cat => cat.id === c) || CATEGORIES[CATEGORIES.length - 1];

const confidenceColor = (c: MatchConfidence) => ({
  high: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40",
  medium: "text-amber-400 bg-amber-500/20 border-amber-500/40",
  low: "text-gray-400 bg-gray-500/20 border-gray-500/40",
}[c]);

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
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
    active ? "bg-white/10 text-white border border-white/20 shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
  }`}>
    {icon}{label}
    {count !== undefined && <span className="text-xs opacity-60">({count})</span>}
  </button>
);

// ─── Main Dashboard ───────────────────────────────────────────────
export default function LostAndFoundTracker() {
  const [activeTab, setActiveTab] = useState<"browse" | "report" | "matches" | "locations" | "analytics">("browse");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "urgent">("recent");
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([
    { sender: "system", text: "Chat started. Be polite and verify item details before sharing personal info.", time: "Now" },
  ]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filteredItems = useMemo(() => {
    let items = [...ITEMS];
    if (statusFilter !== "all") items = items.filter(i => i.status === statusFilter);
    if (categoryFilter !== "all") items = items.filter(i => i.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        i.location.toLowerCase().includes(q)
      );
    }
    if (sortBy === "popular") items.sort((a, b) => b.views - a.views);
    else if (sortBy === "urgent") {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    } else items.sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
    return items;
  }, [statusFilter, categoryFilter, searchQuery, sortBy]);

  const lostItems = ITEMS.filter(i => i.status === "lost");
  const foundItems = ITEMS.filter(i => i.status === "found");

  // ─── Tab: Browse ────────────────────────────────────────────────
  const BrowseTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items, tags, locations..."
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm w-72 focus:outline-none focus:border-cyan-500/50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ItemStatus | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="all">All Status</option>
            <option value="lost">🔴 Lost</option>
            <option value="found">🟢 Found</option>
            <option value="claimed">🔵 Claimed</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as ItemCategory | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as "recent" | "popular" | "urgent")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="recent">Most Recent</option>
            <option value="popular">Most Viewed</option>
            <option value="urgent">Most Urgent</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
            <Grid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-sm font-medium transition-all">
            <Plus className="w-4 h-4" /> Report Item
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Search className="w-5 h-5" />} label="Active Lost" value={lostItems.length} sub="Awaiting recovery" color="text-red-400" />
        <KpiCard icon={<Package className="w-5 h-5" />} label="Found Items" value={foundItems.length} sub="Awaiting claims" color="text-emerald-400" />
        <KpiCard icon={<CheckCircle className="w-5 h-5" />} label="Matched Today" value={MATCH_SUGGESTIONS.length} sub={`${STATS.matchRate}% match rate`} color="text-cyan-400" />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="Views Today" value={ITEMS.reduce((s, i) => s + i.views, 0)} sub="Community engaged" color="text-purple-400" />
      </div>

      {/* Items */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item, i) => {
            const cat = categoryInfo(item.category);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                className={`bg-white/5 backdrop-blur-md border rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-white/20 ${
                  selectedItem === item.id ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : "border-white/10"
                }`}>
                {/* Image Placeholder */}
                <div className={`h-36 bg-gradient-to-br ${item.imageColor} flex items-center justify-center relative`}>
                  <div className="text-white/30">{cat.icon && <div className="scale-3">{cat.icon}</div>}</div>
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${statusBg(item.status)} ${statusColor(item.status)}`}>
                    {item.status}
                  </div>
                  <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-medium ${urgencyColor(item.urgency)}`}>
                    {item.urgency === "critical" ? "🔴" : item.urgency === "high" ? "🟠" : item.urgency === "medium" ? "🟡" : "⚪"} {item.urgency}
                  </div>
                  {item.reward && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-500/30 text-amber-300 border border-amber-500/40">
                      🎁 {item.reward}
                    </div>
                  )}
                  <button onClick={e => { e.stopPropagation(); toggleBookmark(item.id); }}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/30 hover:bg-black/50 transition-all">
                    <Bookmark className={`w-4 h-4 ${bookmarked.has(item.id) ? "text-amber-400 fill-amber-400" : "text-white/60"}`} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`p-1 rounded-lg ${cat.color}`}>{cat.icon}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{cat.label}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1 line-clamp-1">{item.title}</h3>
                  <p className="text-gray-400 text-xs line-clamp-2 mb-3">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <MapPin className="w-3 h-3" /> {item.location}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {item.views}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.dateReported}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-lg text-[9px] bg-white/5 text-gray-400">#{tag}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, i) => {
            const cat = categoryInfo(item.category);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                className={`bg-white/5 backdrop-blur-md border rounded-xl p-4 cursor-pointer transition-all hover:border-white/20 flex items-center gap-4 ${
                  selectedItem === item.id ? "border-cyan-500/50" : "border-white/10"
                }`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.imageColor} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white/40">{cat.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusBg(item.status)} ${statusColor(item.status)}`}>{item.status}</span>
                    <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.dateReported}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.views}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-[10px] ${urgencyColor(item.urgency)}`}>{item.urgency}</span>
                  {item.reward && <span className="px-2 py-1 rounded-lg text-[10px] bg-amber-500/20 text-amber-400">🎁</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Item Detail Panel */}
      <AnimatePresence>
        {selectedItem && (() => {
          const item = ITEMS.find(i => i.id === selectedItem);
          if (!item) return null;
          const cat = categoryInfo(item.category);
          return (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.imageColor} flex items-center justify-center`}>
                      <span className="text-white/40 text-xl">{cat.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusBg(item.status)} ${statusColor(item.status)}`}>{item.status}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${urgencyColor(item.urgency)}`}>{item.urgency} priority</span>
                        <span className="text-[10px] text-gray-500">Reported {item.dateReported}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-gray-300 text-sm mb-4 leading-relaxed">{item.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Location</div>
                    <div className="text-white text-sm font-medium flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Building</div>
                    <div className="text-white text-sm font-medium">{item.building}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">Views</div>
                    <div className="text-white text-sm font-medium">{item.views}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-gray-400 mb-1">AI Matches</div>
                    <div className="text-white text-sm font-medium">{item.matches}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {item.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-lg text-xs bg-white/5 text-gray-300 border border-white/10">#{tag}</span>
                  ))}
                </div>

                {item.reward && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300 text-sm font-medium">{item.reward}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                      {item.reporterAvatar}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{item.isAnonymous ? "Anonymous Reporter" : item.reporterName}</div>
                      <div className="text-gray-500 text-[10px]">{item.contactPreference} contact preferred</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleBookmark(item.id)}
                      className={`p-2 rounded-lg border transition-all ${bookmarked.has(item.id) ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}>
                      <Bookmark className="w-4 h-4" fill={bookmarked.has(item.id) ? "currentColor" : "none"} />
                    </button>
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowContactModal(item.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-sm font-medium transition-all">
                      <MessageCircle className="w-4 h-4" /> Contact
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

  // ─── Tab: Report ────────────────────────────────────────────────
  const ReportTab = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold text-lg mb-2 flex items-center gap-2">
          <Plus className="w-5 h-5 text-cyan-400" /> Report a Lost or Found Item
        </h3>
        <p className="text-gray-400 text-sm mb-6">Fill in the details below to help reunite items with their owners.</p>

        <div className="space-y-5">
          {/* Type Selection */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">I'm reporting a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/50 text-red-400 font-medium flex items-center gap-3">
                <Search className="w-5 h-5" /> Lost Item
              </button>
              <button className="p-4 rounded-xl bg-white/5 border-2 border-white/10 text-gray-400 font-medium flex items-center gap-3 hover:border-emerald-500/30 hover:text-emerald-400 transition-all">
                <Package className="w-5 h-5" /> Found Item
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">Item Title</label>
            <input placeholder="e.g., Black MacBook Pro 14 inch"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 placeholder-gray-500" />
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">Description</label>
            <textarea rows={4} placeholder="Describe the item in detail — color, brand, distinguishing features..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 placeholder-gray-500 resize-none" />
          </div>

          {/* Category */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.id} className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border ${
                  c.id === "electronics" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                }`}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Location</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
                <option>Select location...</option>
                {LOCATIONS.map(l => <option key={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Date {statusFilter === "lost" ? "Lost" : "Found"}</label>
              <input type="date" defaultValue="2026-08-26"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none" />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">Urgency</label>
            <div className="grid grid-cols-4 gap-2">
              {(["low", "medium", "high", "critical"] as UrgencyLevel[]).map(u => (
                <button key={u} className={`p-3 rounded-xl text-sm font-medium capitalize transition-all border ${
                  u === "high" ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                }`}>
                  {u === "critical" ? "🔴" : u === "high" ? "🟠" : u === "medium" ? "🟡" : "⚪"} {u}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Upload */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">Photo (optional)</label>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-cyan-500/30 transition-all cursor-pointer">
              <Camera className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <div className="text-gray-400 text-sm">Click to upload or drag & drop</div>
              <div className="text-gray-500 text-[10px] mt-1">JPG, PNG up to 5MB</div>
            </div>
          </div>

          {/* Reward */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 block">Reward (optional)</label>
            <input placeholder="e.g., ₹500 reward for safe return"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 placeholder-gray-500" />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Contact Preference</label>
              <div className="flex gap-2">
                {[{ icon: <MessageCircle className="w-4 h-4" />, label: "Message", active: true },
                  { icon: <Phone className="w-4 h-4" />, label: "Phone", active: false },
                  { icon: <Mail className="w-4 h-4" />, label: "Email", active: false }
                ].map(c => (
                  <button key={c.label} className={`flex-1 p-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition-all ${
                    c.active ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "bg-white/5 border-white/10 text-gray-400"
                  }`}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Your Name</label>
              <input placeholder="Your name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 placeholder-gray-500" />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded bg-white/5 border-white/20 text-cyan-500" />
            <span className="text-gray-400 text-sm">Report anonymously</span>
          </label>

          <button className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Submit Report
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Tab: AI Matches ───────────────────────────────────────────
  const MatchesTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" /> AI-Powered Match Engine
        </h3>
        <p className="text-gray-400 text-sm">Our AI analyzes location, time, category, and description similarity to suggest potential matches between lost and found items.</p>
        <div className="flex items-center gap-4 mt-3">
          <div className="text-center">
            <div className="text-xl font-bold text-cyan-400">{STATS.matchRate}%</div>
            <div className="text-[10px] text-gray-400">Match Rate</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-400">{STATS.totalClaimed}</div>
            <div className="text-[10px] text-gray-400">Items Claimed</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-400">{STATS.avgClaimTime}</div>
            <div className="text-[10px] text-gray-400">Avg Claim Time</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {MATCH_SUGGESTIONS.map((match, i) => {
          const lostItem = ITEMS.find(it => it.id === match.lostItemId);
          const foundItem = ITEMS.find(it => it.id === match.foundItemId);
          if (!lostItem || !foundItem) return null;
          return (
            <motion.div key={match.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${confidenceColor(match.confidence)}`}>
                  {match.confidence.toUpperCase()} CONFIDENCE
                </span>
                <span className="text-gray-500 text-xs">{match.reason}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                {/* Lost Item */}
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">LOST</span>
                    <span className="text-gray-400 text-[10px]">{lostItem.dateLost}</span>
                  </div>
                  <h4 className="text-white font-medium text-sm">{lostItem.title}</h4>
                  <div className="text-gray-400 text-[10px] mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {lostItem.location}
                  </div>
                  <div className="text-gray-500 text-[10px] mt-1">{lostItem.reporterName}</div>
                </div>

                {/* Match Arrow + Indicators */}
                <div className="flex flex-col items-center gap-2">
                  <ArrowRight className="w-6 h-6 text-cyan-400" />
                  <div className="space-y-1">
                    <div className={`flex items-center gap-1 text-[10px] ${match.locationMatch ? "text-emerald-400" : "text-gray-500"}`}>
                      {match.locationMatch ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />} Location
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${match.categoryMatch ? "text-emerald-400" : "text-gray-500"}`}>
                      {match.categoryMatch ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />} Category
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${match.timeMatch ? "text-emerald-400" : "text-gray-500"}`}>
                      {match.timeMatch ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />} Time
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${match.descriptionMatch ? "text-emerald-400" : "text-gray-500"}`}>
                      {match.descriptionMatch ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />} Description
                    </div>
                  </div>
                </div>

                {/* Found Item */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">FOUND</span>
                    <span className="text-gray-400 text-[10px]">{foundItem.dateFound}</span>
                  </div>
                  <h4 className="text-white font-medium text-sm">{foundItem.title}</h4>
                  <div className="text-gray-400 text-[10px] mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {foundItem.location}
                  </div>
                  <div className="text-gray-500 text-[10px] mt-1">{foundItem.reporterName}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm hover:text-white transition-all">
                  Dismiss
                </button>
                <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-sm font-medium transition-all">
                  Notify Both Parties
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // ─── Tab: Locations ─────────────────────────────────────────────
  const LocationsTab = () => {
    const maxItems = Math.max(...STATS.locationHeatmap.map(l => l.items));
    return (
    <div className="space-y-6">
      {/* Campus Map */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 min-h-[320px] relative overflow-hidden">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <MapPinned className="w-5 h-5 text-cyan-400" /> Campus Lost & Found Heatmap
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {LOCATIONS.map(loc => {
            const intensity = loc.lostCount + loc.foundCount;
            const opacity = 0.2 + (intensity / 90) * 0.8;
            return (
              <motion.div key={loc.id} whileHover={{ scale: 1.05 }}
                className={`p-3 rounded-xl border border-white/10 text-center cursor-pointer transition-all`}
                style={{ backgroundColor: `rgba(239, 68, 68, ${opacity * 0.2})` }}>
                <MapPin className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <div className="text-white text-[11px] font-medium">{loc.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{loc.zone}</div>
                <div className="flex justify-center gap-2 mt-1 text-[10px]">
                  <span className="text-red-400">{loc.lostCount} lost</span>
                  <span className="text-emerald-400">{loc.foundCount} found</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Location Rankings */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" /> Location Activity Rankings
        </h3>
        <div className="space-y-3">
          {STATS.locationHeatmap.sort((a, b) => b.items - a.items).map((loc, i) => (
            <div key={loc.location} className="flex items-center gap-4">
              <div className="w-6 text-gray-500 text-sm font-bold text-right">{i + 1}</div>
              <div className="w-36 text-sm text-gray-300 truncate">{loc.location}</div>
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500/60 to-red-500/30 rounded-full transition-all duration-1000"
                    style={{ width: `${(loc.items / maxItems) * 100}%` }} />
                </div>
              </div>
              <div className="w-12 text-right text-sm text-white font-medium">{loc.items}</div>
              <span className="px-2 py-0.5 rounded text-[9px] bg-white/5 text-gray-400">{loc.zone}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {LOCATIONS.map(loc => (
          <div key={loc.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-cyan-500/20"><MapPin className="w-5 h-5 text-cyan-400" /></div>
              <div>
                <div className="text-white font-medium text-sm">{loc.name}</div>
                <div className="text-gray-500 text-[10px]">{loc.zone} · Last reported {loc.lastReported}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-500/10 rounded-xl p-3 text-center">
                <div className="text-red-400 font-bold text-lg">{loc.lostCount}</div>
                <div className="text-[10px] text-gray-400">Lost Items</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <div className="text-emerald-400 font-bold text-lg">{loc.foundCount}</div>
                <div className="text-[10px] text-gray-400">Found Items</div>
              </div>
            </div>
            <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(loc.foundCount / Math.max(loc.lostCount, 1)) * 100}%` }} />
            </div>
            <div className="text-[10px] text-gray-500 mt-1 text-right">
              {Math.round((loc.foundCount / Math.max(loc.lostCount, 1)) * 100)}% recovery rate
            </div>
          </div>
        ))}
      </div>
    </div>
  );};

  // ─── Tab: Analytics ─────────────────────────────────────────────
  const AnalyticsTab = () => {
    const maxLost = Math.max(...STATS.weeklyTrend.map(d => d.lost));
    const maxMonthly = Math.max(...STATS.monthlyStats.map(m => m.lost));
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Search className="w-5 h-5" />} label="Total Lost (Month)" value={STATS.totalLost} sub={`${Math.round(STATS.totalLost / 5)}/day avg`} color="text-red-400" />
        <KpiCard icon={<Package className="w-5 h-5" />} label="Total Found" value={STATS.totalFound} sub={`${STATS.matchRate}% match rate`} color="text-emerald-400" />
        <KpiCard icon={<CheckCircle className="w-5 h-5" />} label="Claimed" value={STATS.totalClaimed} sub={`${STATS.avgClaimTime} avg claim time`} color="text-cyan-400" />
        <KpiCard icon={<Users className="w-5 h-5" />} label="Community" value={`${ITEMS.reduce((s, i) => s + i.views, 0).toLocaleString()}`} sub="Total views" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" /> Weekly Trend
          </h3>
          <div className="flex items-end gap-3 h-40">
            {STATS.weeklyTrend.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex gap-0.5 items-end" style={{ height: "100%" }}>
                  <div className="w-3 rounded-t bg-red-500/60" style={{ height: `${(d.lost / maxLost) * 100}%` }} />
                  <div className="w-3 rounded-t bg-emerald-500/60" style={{ height: `${(d.found / maxLost) * 100}%` }} />
                </div>
                <div className="text-[10px] text-gray-400">{d.day}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/60" /> Lost</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/60" /> Found</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-400" /> By Category
          </h3>
          <div className="space-y-3">
            {STATS.categoryBreakdown.sort((a, b) => b.count - a.count).map((c, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{c.category}</span>
                  <span className="text-gray-400">{c.count} items</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{
                    width: `${(c.count / STATS.categoryBreakdown[0].count) * 100}%`,
                    backgroundColor: c.color,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" /> Monthly Overview
        </h3>
        <div className="flex items-end gap-4 h-48">
          {STATS.monthlyStats.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-1 items-end" style={{ height: "100%" }}>
                <div className="w-4 rounded-t bg-red-500/50" style={{ height: `${(m.lost / maxMonthly) * 100}%` }} />
                <div className="w-4 rounded-t bg-emerald-500/50" style={{ height: `${(m.found / maxMonthly) * 100}%` }} />
                <div className="w-4 rounded-t bg-cyan-500/50" style={{ height: `${(m.claimed / maxMonthly) * 100}%` }} />
              </div>
              <div className="text-[10px] text-gray-400">{m.month}</div>
              <div className="text-[9px] text-gray-500">L:{m.lost} F:{m.found} C:{m.claimed}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/50" /> Lost</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/50" /> Found</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500/50" /> Claimed</div>
        </div>
      </div>

      {/* Recovery Insights */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" /> 📋 Recovery Insights
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{STATS.matchRate}%</div>
            <div className="text-xs text-gray-400 mt-1">AI Match Rate</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-cyan-400">{STATS.avgClaimTime}</div>
            <div className="text-xs text-gray-400 mt-1">Avg Recovery Time</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">{STATS.topCategory}</div>
            <div className="text-xs text-gray-400 mt-1">Most Lost Category</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{STATS.topLocation}</div>
            <div className="text-xs text-gray-400 mt-1">Hotspot Location</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            "💡 Electronics account for 35% of all lost items — consider using AirTags or similar trackers",
            "⏰ Peak lost hours are 12-2 PM and 5-6 PM — be extra careful during lunch and class changes",
            "📍 Central Library is the #1 hotspot — 83 items reported this semester",
            "🎯 Items with photos get claimed 3x faster — always attach a photo when reporting",
          ].map((insight, i) => (
            <div key={i} className="text-sm text-gray-300 bg-white/5 rounded-xl p-3">{insight}</div>
          ))}
        </div>
      </div>
    </div>
  );};

  // ─── Contact Modal ──────────────────────────────────────────────
  const ContactModal = () => {
    if (!showContactModal) return null;
    const item = ITEMS.find(i => i.id === showContactModal);
    if (!item) return null;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => { setShowContactModal(null); setChatMessages([{ sender: "system", text: "Chat started. Be polite and verify item details before sharing personal info.", time: "Now" }]); }}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          onClick={e => e.stopPropagation()}
          className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h3 className="text-white font-semibold">Contact Reporter</h3>
              <div className="text-gray-400 text-xs">Re: {item.title}</div>
            </div>
            <button onClick={() => setShowContactModal(null)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "You" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.sender === "You" ? "bg-cyan-600 text-white" :
                  msg.sender === "system" ? "bg-white/5 text-gray-400 text-xs text-center w-full" :
                  "bg-white/10 text-white"
                }`}>
                  {msg.text}
                  <div className="text-[9px] opacity-50 mt-1">{msg.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && chatMessage.trim()) {
                  setChatMessages(prev => [...prev, { sender: "You", text: chatMessage, time: new Date().toLocaleTimeString() }]);
                  setChatMessage("");
                  setTimeout(() => setChatMessages(prev => [...prev, { sender: item.reporterName, text: "Thanks for reaching out! I'll verify the item details and get back to you.", time: new Date().toLocaleTimeString() }]), 1500);
                }}}
                placeholder="Type your message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 placeholder-gray-500" />
              <button onClick={() => {
                if (chatMessage.trim()) {
                  setChatMessages(prev => [...prev, { sender: "You", text: chatMessage, time: new Date().toLocaleTimeString() }]);
                  setChatMessage("");
                }
              }} className="p-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white transition-all">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-cyan-600/20 to-blue-600/20" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-white flex items-center gap-3">
                <Search className="w-8 h-8 text-emerald-400" />
                Campus Lost & Found
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-gray-400 mt-2">AI-powered item matching • {STATS.matchRate}% recovery rate • {STATS.totalClaimed} items returned this month</motion.p>
            </div>
            <button onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-semibold transition-all">
              <Plus className="w-5 h-5" /> Report Item
            </button>
          </div>
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2">
            <TabButton active={activeTab === "browse"} onClick={() => setActiveTab("browse")}
              icon={<Search className="w-4 h-4" />} label="Browse" count={ITEMS.length} />
            <TabButton active={activeTab === "report"} onClick={() => setActiveTab("report")}
              icon={<Plus className="w-4 h-4" />} label="Report" />
            <TabButton active={activeTab === "matches"} onClick={() => setActiveTab("matches")}
              icon={<Zap className="w-4 h-4" />} label="AI Matches" count={MATCH_SUGGESTIONS.length} />
            <TabButton active={activeTab === "locations"} onClick={() => setActiveTab("locations")}
              icon={<MapPinned className="w-4 h-4" />} label="Locations" />
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
            {activeTab === "browse" && <BrowseTab />}
            {activeTab === "report" && <ReportTab />}
            {activeTab === "matches" && <MatchesTab />}
            {activeTab === "locations" && <LocationsTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowReportModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-2xl my-8">
              <ReportTab />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        <ContactModal />
      </AnimatePresence>
    </div>
  );
}
