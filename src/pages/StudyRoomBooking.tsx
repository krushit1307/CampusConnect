import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  Wifi,
  Monitor,
  Coffee,
  Plug,
  Zap,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Filter,
  Grid3X3,
  List,
  Bell,
  ArrowUpRight,
  Timer,
  BookOpen,
  Headphones,
  Mic,
  Camera,
  Thermometer,
  Lock,
  Unlock,
  AlertCircle,
  Sparkles,
  BarChart3,
  TrendingUp,
  CalendarDays,
  CalendarCheck,
  User,
  UserPlus,
  MessageCircle,
  Phone,
  Share2,
  Heart,
  Bookmark,
  BookmarkCheck,
  CircleDot,
  LayoutGrid,
  Layers,
  Building2,
  School,
  Library,
  GraduationCap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface StudyRoom {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  amenities: string[];
  status: "available" | "occupied" | "reserved" | "maintenance";
  rating: number;
  reviews: number;
  image: string;
  hourlyRate: string;
  nextAvailable: string;
  currentOccupant?: string;
  bookingEnd?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
  heldBy?: string;
}

interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  building: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  attendees: number;
}

interface Building {
  id: string;
  name: string;
  shortName: string;
  rooms: number;
  available: number;
  icon: React.ReactNode;
  color: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const BUILDINGS: Building[] = [
  { id: "lib", name: "Main Library", shortName: "Library", rooms: 24, available: 8, icon: <Library className="w-5 h-5" />, color: "bg-blue-500" },
  { id: "eng", name: "Engineering Block", shortName: "Engineering", rooms: 16, available: 5, icon: <Building2 className="w-5 h-5" />, color: "bg-green-500" },
  { id: "stu", name: "Student Center", shortName: "Student Ctr", rooms: 12, available: 3, icon: <Users className="w-5 h-5" />, color: "bg-purple-500" },
  { id: "sci", name: "Science Complex", shortName: "Science", rooms: 10, available: 4, icon: <GraduationCap className="w-5 h-5" />, color: "bg-orange-500" },
  { id: "bus", name: "Business School", shortName: "Business", rooms: 8, available: 2, icon: <School className="w-5 h-5" />, color: "bg-teal-500" },
];

const STUDY_ROOMS: StudyRoom[] = [
  { id: "1", name: "Silent Study Hall A", building: "Main Library", floor: 2, capacity: 8, amenities: ["WiFi", "Power Outlets", "Whiteboard"], status: "available", rating: 4.8, reviews: 124, image: "📚", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "2", name: "Group Discussion Room 1", building: "Main Library", floor: 3, capacity: 6, amenities: ["WiFi", "Monitor", "Whiteboard", "Video Conf"], status: "occupied", rating: 4.6, reviews: 89, image: "💬", hourlyRate: "Free", nextAvailable: "2:30 PM", currentOccupant: "Priya S.", bookingEnd: "2:30 PM" },
  { id: "3", name: "Tech Lab 201", building: "Engineering Block", floor: 2, capacity: 10, amenities: ["WiFi", "Monitors", "Power Outlets", "Printer"], status: "available", rating: 4.9, reviews: 156, image: "💻", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "4", name: "Podcast Studio", building: "Student Center", floor: 1, capacity: 4, amenities: ["WiFi", "Microphone", "Headphones", "Soundproofing"], status: "reserved", rating: 4.7, reviews: 67, image: "🎙️", hourlyRate: "Free", nextAvailable: "4:00 PM", currentOccupant: "Rohan M.", bookingEnd: "4:00 PM" },
  { id: "5", name: "Quiet Nook B3", building: "Main Library", floor: 1, capacity: 2, amenities: ["WiFi", "Power Outlets"], status: "available", rating: 4.5, reviews: 203, image: "📖", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "6", name: "Collaboration Hub", building: "Engineering Block", floor: 1, capacity: 12, amenities: ["WiFi", "Large Monitor", "Whiteboard", "Video Conf", "Coffee Machine"], status: "available", rating: 4.8, reviews: 98, image: "🤝", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "7", name: "Video Editing Suite", building: "Student Center", floor: 2, capacity: 3, amenities: ["WiFi", "High-end PC", "Monitor", "Headphones"], status: "maintenance", rating: 4.4, reviews: 45, image: "🎬", hourlyRate: "Free", nextAvailable: "Tomorrow", currentOccupant: undefined, bookingEnd: undefined },
  { id: "8", name: "Chemistry Study Lab", building: "Science Complex", floor: 3, capacity: 6, amenities: ["WiFi", "Lab Equipment", "Whiteboard"], status: "available", rating: 4.6, reviews: 78, image: "🧪", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "9", name: "Meditation Room", building: "Student Center", floor: 1, capacity: 8, amenities: ["WiFi", "Yoga Mats", "Aromatherapy", "Dim Lighting"], status: "available", rating: 4.9, reviews: 134, image: "🧘", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "10", name: "Case Study Room 101", building: "Business School", floor: 1, capacity: 8, amenities: ["WiFi", "Monitor", "Whiteboard", "Phone Conf"], status: "occupied", rating: 4.7, reviews: 92, image: "📊", hourlyRate: "Free", nextAvailable: "3:00 PM", currentOccupant: "Ananya D.", bookingEnd: "3:00 PM" },
  { id: "11", name: "3D Printing Lab", building: "Engineering Block", floor: 3, capacity: 4, amenities: ["WiFi", "3D Printers", "CAD Software"], status: "available", rating: 4.8, reviews: 56, image: "🖨️", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
  { id: "12", name: "Music Practice Room", building: "Student Center", floor: 2, capacity: 2, amenities: ["WiFi", "Instruments", "Soundproofing"], status: "available", rating: 4.5, reviews: 67, image: "🎵", hourlyRate: "Free", nextAvailable: "Now", currentOccupant: undefined, bookingEnd: undefined },
];

const TIME_SLOTS: TimeSlot[] = [
  { time: "8:00 AM", available: true },
  { time: "9:00 AM", available: true },
  { time: "10:00 AM", available: false, booked: true },
  { time: "11:00 AM", available: false, booked: true },
  { time: "12:00 PM", available: true },
  { time: "1:00 PM", available: true },
  { time: "2:00 PM", available: false, heldBy: "Priya S." },
  { time: "3:00 PM", available: true },
  { time: "4:00 PM", available: false, booked: true },
  { time: "5:00 PM", available: true },
  { time: "6:00 PM", available: true },
  { time: "7:00 PM", available: true },
  { time: "8:00 PM", available: true },
  { time: "9:00 PM", available: true },
];

const MY_BOOKINGS: Booking[] = [
  { id: "1", roomId: "3", roomName: "Tech Lab 201", building: "Engineering Block", date: "Today", startTime: "10:00 AM", endTime: "12:00 PM", status: "upcoming", attendees: 3 },
  { id: "2", roomId: "6", roomName: "Collaboration Hub", building: "Engineering Block", date: "Today", startTime: "2:00 PM", endTime: "4:00 PM", status: "upcoming", attendees: 5 },
  { id: "3", roomId: "1", roomName: "Silent Study Hall A", building: "Main Library", date: "Tomorrow", startTime: "9:00 AM", endTime: "11:00 AM", status: "upcoming", attendees: 1 },
  { id: "4", roomId: "9", roomName: "Meditation Room", building: "Student Center", date: "Yesterday", startTime: "5:00 PM", endTime: "6:00 PM", status: "completed", attendees: 2 },
];

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi className="w-4 h-4" />,
  "Power Outlets": <Plug className="w-4 h-4" />,
  Whiteboard: <Layers className="w-4 h-4" />,
  Monitor: <Monitor className="w-4 h-4" />,
  "Video Conf": <Camera className="w-4 h-4" />,
  Printer: <BookOpen className="w-4 h-4" />,
  Microphone: <Mic className="w-4 h-4" />,
  Headphones: <Headphones className="w-4 h-4" />,
  Soundproofing: <Lock className="w-4 h-4" />,
  "Coffee Machine": <Coffee className="w-4 h-4" />,
  "High-end PC": <Zap className="w-4 h-4" />,
  "Lab Equipment": <Flask className="w-4 h-4" />,
  "Yoga Mats": <Heart className="w-4 h-4" />,
  Aromatherapy: <Sparkles className="w-4 h-4" />,
  "Dim Lighting": <Thermometer className="w-4 h-4" />,
  "3D Printers": <CircleDot className="w-4 h-4" />,
  "CAD Software": <Monitor className="w-4 h-4" />,
  Instruments: <Star className="w-4 h-4" />,
  "Phone Conf": <Phone className="w-4 h-4" />,
  "Large Monitor": <Monitor className="w-4 h-4" />,
};

// Needed because Flask isn't imported
function Flask({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6m-5 0v6.5L4 17.5A1 1 0 005 19h14a1 1 0 001-1.5L14 9.5V3" /></svg>;
}

// ── Utility Components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    available: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
    occupied: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
    reserved: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
    maintenance: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-400", dot: "bg-gray-500" },
    upcoming: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
    active: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
    completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-400", dot: "bg-gray-500" },
    cancelled: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  };
  const c = config[status] || config.available;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function StudyRoomBooking() {
  const [activeTab, setActiveTab] = useState<"browse" | "my-bookings" | "analytics">("browse");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [selectedCapacity, setSelectedCapacity] = useState<string>("all");
  const [selectedAmenity, setSelectedAmenity] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("Today");
  const [selectedRoom, setSelectedRoom] = useState<StudyRoom | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingAttendees, setBookingAttendees] = useState(1);
  const [bookmarkedRooms, setBookmarkedRooms] = useState<Set<string>>(new Set(["1", "6", "9"]));

  const dates = ["Today", "Tomorrow", "Wed, Aug 28", "Thu, Aug 29", "Fri, Aug 30"];

  const filteredRooms = useMemo(() => {
    return STUDY_ROOMS.filter((room) => {
      const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) || room.building.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBuilding = selectedBuilding === "all" || room.building === BUILDINGS.find((b) => b.id === selectedBuilding)?.name;
      const matchesCapacity = selectedCapacity === "all" || (selectedCapacity === "1-2" && room.capacity <= 2) || (selectedCapacity === "3-6" && room.capacity >= 3 && room.capacity <= 6) || (selectedCapacity === "7+" && room.capacity >= 7);
      const matchesAmenity = selectedAmenity === "all" || room.amenities.some((a) => a.toLowerCase().includes(selectedAmenity.toLowerCase()));
      return matchesSearch && matchesBuilding && matchesCapacity && matchesAmenity;
    });
  }, [searchQuery, selectedBuilding, selectedCapacity, selectedAmenity]);

  const toggleBookmark = (id: string) => {
    setBookmarkedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTimeSlot = (time: string) => {
    setSelectedTimeSlots((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]));
  };

  const tabs = [
    { id: "browse" as const, label: "Browse Rooms", icon: <LayoutGrid className="w-4 h-4" /> },
    { id: "my-bookings" as const, label: "My Bookings", icon: <CalendarCheck className="w-4 h-4" /> },
    { id: "analytics" as const, label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Study Room Booking</h1>
                <p className="text-xs text-gray-500">Find & book your perfect study space</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                + Quick Book
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Rooms", value: "70", icon: <Building2 className="w-5 h-5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Available Now", value: "22", icon: <Unlock className="w-5 h-5" />, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
            { label: "Your Bookings", value: "3", icon: <CalendarCheck className="w-5 h-5" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
            { label: "Hours This Week", value: "12h", icon: <Timer className="w-5 h-5" />, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-4 rounded-xl ${stat.bg} border border-gray-100 dark:border-gray-800`}
            >
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
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

        <AnimatePresence mode="wait">
          {/* ── Browse Tab ─────────────────────────────────────────── */}
          {activeTab === "browse" && (
            <motion.div key="browse" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Building Filter */}
              <div className="flex gap-3 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedBuilding("all")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    selectedBuilding === "all" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  All Buildings
                </button>
                {BUILDINGS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBuilding(b.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      selectedBuilding === b.id ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {b.icon}
                    {b.shortName}
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${selectedBuilding === b.id ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                      {b.available}/{b.rooms}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search rooms by name or building..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={selectedCapacity}
                  onChange={(e) => setSelectedCapacity(e.target.value)}
                  className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Any Capacity</option>
                  <option value="1-2">1-2 People</option>
                  <option value="3-6">3-6 People</option>
                  <option value="7+">7+ People</option>
                </select>
                <select
                  value={selectedAmenity}
                  onChange={(e) => setSelectedAmenity(e.target.value)}
                  className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Any Amenity</option>
                  <option value="monitor">Monitor</option>
                  <option value="whiteboard">Whiteboard</option>
                  <option value="video">Video Conf</option>
                  <option value="soundproof">Soundproofing</option>
                  <option value="coffee">Coffee Machine</option>
                </select>
                <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <button onClick={() => setViewMode("grid")} className={`p-3 ${viewMode === "grid" ? "bg-blue-50 text-blue-500" : "text-gray-400"}`}>
                    <Grid3X3 className="w-5 h-5" />
                  </button>
                  <button onClick={() => setViewMode("list")} className={`p-3 ${viewMode === "list" ? "bg-blue-50 text-blue-500" : "text-gray-400"}`}>
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Date Selector */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      selectedDate === d ? "bg-blue-500 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {/* Results Count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <span className="font-bold text-gray-900 dark:text-white">{filteredRooms.length}</span> rooms found
                </p>
              </div>

              {/* Room Grid */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRooms.map((room) => (
                    <motion.div
                      key={room.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                      onClick={() => {
                        setSelectedRoom(room);
                        setShowBookingModal(true);
                      }}
                    >
                      {/* Room Header */}
                      <div className="relative p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <div className="text-3xl">{room.image}</div>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleBookmark(room.id); }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              {bookmarkedRooms.has(room.id) ? (
                                <BookmarkCheck className="w-4 h-4 text-blue-500 fill-blue-500" />
                              ) : (
                                <Bookmark className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            <StatusBadge status={room.status} />
                          </div>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mt-2 group-hover:text-blue-500 transition-colors">
                          {room.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{room.building} · Floor {room.floor}</span>
                        </div>
                      </div>

                      {/* Amenities */}
                      <div className="px-4 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {room.amenities.slice(0, 4).map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                              {AMENITY_ICONS[a] || <Zap className="w-3 h-3" />}
                              {a}
                            </span>
                          ))}
                          {room.amenities.length > 4 && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-500">
                              +{room.amenities.length - 4}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 text-gray-500">
                            <Users className="w-3.5 h-3.5" />
                            {room.capacity}
                          </span>
                          <span className="flex items-center gap-1 text-gray-500">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                            {room.rating}
                          </span>
                          <span className="text-gray-400">({room.reviews})</span>
                        </div>
                        <div className="text-right">
                          {room.status === "available" ? (
                            <span className="text-sm font-bold text-green-500">Available Now</span>
                          ) : (
                            <span className="text-sm text-gray-500">Next: {room.nextAvailable}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-3">
                  {filteredRooms.map((room) => (
                    <motion.div
                      key={room.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-all cursor-pointer flex items-center gap-4"
                      onClick={() => { setSelectedRoom(room); setShowBookingModal(true); }}
                    >
                      <div className="text-3xl flex-shrink-0">{room.image}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">{room.name}</h3>
                          <StatusBadge status={room.status} />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{room.building}</span>
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{room.capacity} seats</span>
                          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />{room.rating}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {room.status === "available" ? (
                          <span className="text-sm font-bold text-green-500">Available Now</span>
                        ) : (
                          <span className="text-sm text-gray-500">Next: {room.nextAvailable}</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── My Bookings Tab ────────────────────────────────────── */}
          {activeTab === "my-bookings" && (
            <motion.div key="bookings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Bookings</h2>
                <div className="flex gap-2">
                  {["upcoming", "active", "completed", "cancelled"].map((s) => (
                    <button key={s} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 capitalize">
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {MY_BOOKINGS.map((booking) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{booking.roomName}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {booking.building}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {[
                        { label: "Date", value: booking.date, icon: <Calendar className="w-4 h-4" /> },
                        { label: "Start", value: booking.startTime, icon: <Clock className="w-4 h-4" /> },
                        { label: "End", value: booking.endTime, icon: <Timer className="w-4 h-4" /> },
                        { label: "Attendees", value: `${booking.attendees} people`, icon: <Users className="w-4 h-4" /> },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          {item.icon}
                          <div>
                            <p className="text-xs text-gray-400">{item.label}</p>
                            <p className="font-medium text-gray-700 dark:text-gray-300">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {booking.status === "upcoming" && (
                      <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Get Directions
                        </button>
                        <button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button className="px-4 py-2 bg-red-50 text-red-500 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                          Cancel
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Analytics Tab ──────────────────────────────────────── */}
          {activeTab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Booking Analytics</h2>

              {/* Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Total Hours Booked", value: "48h", change: "+12%", icon: <Timer className="w-6 h-6" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
                  { label: "Rooms Visited", value: "8", change: "+2", icon: <Building2 className="w-6 h-6" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
                  { label: "Avg Session", value: "2.4h", change: "+0.3h", icon: <Clock className="w-6 h-6" />, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
                ].map((stat, i) => (
                  <div key={i} className={`p-6 rounded-2xl ${stat.bg} border border-gray-100 dark:border-gray-800`}>
                    <div className={`${stat.color} mb-3`}>{stat.icon}</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                    <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{stat.change} vs last month</p>
                  </div>
                ))}
              </div>

              {/* Weekly Usage Chart */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Weekly Usage Pattern</h3>
                <div className="flex items-end gap-3 h-48">
                  {[3.5, 4.2, 2.8, 5.0, 4.5, 1.2, 0.5].map((hours, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(hours / 6) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="w-full bg-gradient-to-t from-blue-500 to-purple-400 rounded-t-lg"
                      />
                      <span className="text-xs font-medium text-gray-500">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                      <span className="text-xs text-gray-400">{hours}h</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Favorite Rooms */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Most Visited Rooms</h3>
                <div className="space-y-3">
                  {[
                    { name: "Tech Lab 201", building: "Engineering", visits: 12, hours: 24, emoji: "💻" },
                    { name: "Silent Study Hall A", building: "Library", visits: 8, hours: 18, emoji: "📚" },
                    { name: "Collaboration Hub", building: "Engineering", visits: 6, hours: 14, emoji: "🤝" },
                    { name: "Meditation Room", building: "Student Ctr", visits: 5, hours: 6, emoji: "🧘" },
                  ].map((room, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <span className="text-2xl">{room.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{room.name}</p>
                        <p className="text-xs text-gray-500">{room.building}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">{room.visits} visits</p>
                        <p className="text-xs text-gray-500">{room.hours}h total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak Hours */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Peak Booking Hours</h3>
                <div className="grid grid-cols-6 gap-2">
                  {["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM"].map((hour, i) => {
                    const demand = [20, 45, 85, 90, 55, 60, 80, 75, 65, 50, 35, 25][i];
                    const hue = Math.max(0, (1 - demand / 100) * 120);
                    return (
                      <div key={i} className="text-center">
                        <div
                          className="w-full aspect-square rounded-lg mb-1 flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: `hsl(${hue}, 65%, 50%)` }}
                        >
                          {demand}%
                        </div>
                        <span className="text-xs text-gray-500">{hour}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(120, 65%, 50%)" }} /><span className="text-xs text-gray-500">Low</span></div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(60, 65%, 50%)" }} /><span className="text-xs text-gray-500">Medium</span></div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(0, 65%, 50%)" }} /><span className="text-xs text-gray-500">High</span></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Booking Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showBookingModal && selectedRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBookingModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedRoom.image}</span>
                    <div>
                      <h2 className="font-bold text-gray-900 dark:text-white text-lg">{selectedRoom.name}</h2>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedRoom.building} · Floor {selectedRoom.floor}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowBookingModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Room Details */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <StatusBadge status={selectedRoom.status} />
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    {selectedRoom.capacity} seats
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    {selectedRoom.rating} ({selectedRoom.reviews} reviews)
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoom.amenities.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                        {AMENITY_ICONS[a] || <Zap className="w-4 h-4" />}
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Date</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {dates.map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                          selectedDate === d ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Time Slots</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => toggleTimeSlot(slot.time)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          !slot.available
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed line-through"
                            : selectedTimeSlots.includes(slot.time)
                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Attendees */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attendees</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setBookingAttendees(Math.max(1, bookingAttendees - 1))}
                      className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      -
                    </button>
                    <span className="text-lg font-bold text-gray-900 dark:text-white w-8 text-center">{bookingAttendees}</span>
                    <button
                      onClick={() => setBookingAttendees(Math.min(selectedRoom.capacity, bookingAttendees + 1))}
                      className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-500">/ {selectedRoom.capacity} max</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  disabled={selectedTimeSlots.length === 0 || selectedRoom.status !== "available"}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CalendarCheck className="w-5 h-5" />
                  {selectedTimeSlots.length > 0
                    ? `Book for ${selectedTimeSlots.length} slot${selectedTimeSlots.length > 1 ? "s" : ""}`
                    : "Select time slots to book"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
