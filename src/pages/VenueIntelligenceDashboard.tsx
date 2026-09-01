import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  Users,
  Calendar,
  Clock,
  Search,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  XCircle,
  BarChart3,
  Zap,
  DollarSign,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  Filter,
  Sparkles,
  Layers,
  Target,
  Activity,
  Bookmark,
  ExternalLink,
  RefreshCw,
  CalendarDays,
  Settings,
  Shield,
  MessageSquare,
  Thermometer,
  Heart,
  CircleDot,
  TrendingUp as TrendUpIcon,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Timer,
} from "lucide-react";
import {
  useVenueAnalytics,
  type VenueType,
  type Venue,
  type VenueConflict,
  type DayOfWeek,
} from "../hooks/useVenueAnalytics";

// ─── Venue Type Config ────────────────────────────────────────────────

const VENUE_TYPE_CONFIG: Record<
  VenueType,
  { label: string; icon: string; color: string; bg: string }
> = {
  auditorium: { label: "Auditorium", icon: "🎭", color: "text-cyan-400", bg: "bg-cyan-500/20" },
  lecture_hall: {
    label: "Lecture Hall",
    icon: "📚",
    color: "text-purple-400",
    bg: "bg-purple-500/20",
  },
  conference_room: {
    label: "Conference Room",
    icon: "🤝",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
  },
  outdoor_ground: {
    label: "Outdoor Ground",
    icon: "🌳",
    color: "text-amber-400",
    bg: "bg-amber-500/20",
  },
  lab: { label: "Lab", icon: "🔬", color: "text-pink-400", bg: "bg-pink-500/20" },
  sports_facility: {
    label: "Sports Facility",
    icon: "🏟️",
    color: "text-red-400",
    bg: "bg-red-500/20",
  },
  student_center: {
    label: "Student Center",
    icon: "🎓",
    color: "text-indigo-400",
    bg: "bg-indigo-500/20",
  },
  cafeteria: { label: "Cafeteria", icon: "☕", color: "text-teal-400", bg: "bg-teal-500/20" },
};

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  available: { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/40" },
  booked: { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/40" },
  maintenance: { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/40" },
  reserved: { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/40" },
};

const SEVERITY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  high: { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/40" },
  medium: { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/40" },
  low: { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/40" },
};

// ─── Reusable Components ──────────────────────────────────────────────

const KpiCard = ({
  icon,
  label,
  value,
  sub,
  trend,
  trendValue,
  color = "text-cyan-400",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  color?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-white/5 ${color}`}>{icon}</div>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 text-[10px] font-medium ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-gray-400"}`}
        >
          {trend === "up" && <TrendingUp className="w-3 h-3" />}
          {trend === "down" && <TrendingDown className="w-3 h-3" />}
          {trend === "stable" && <Minus className="w-3 h-3" />}
          {trendValue}
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </motion.div>
);

const TabButton = ({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
      active
        ? "bg-white/10 text-white border border-white/20 shadow-lg"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }`}
  >
    {icon}
    {label}
    {count !== undefined && <span className="text-xs opacity-60">({count})</span>}
  </button>
);

const HeatmapCell = ({ value }: { value: number }) => {
  const intensity = value / 100;
  const bg =
    intensity > 0.8
      ? "bg-cyan-500"
      : intensity > 0.6
        ? "bg-cyan-600/80"
        : intensity > 0.4
          ? "bg-cyan-700/60"
          : intensity > 0.2
            ? "bg-cyan-800/40"
            : "bg-white/5";
  return (
    <div
      className={`w-full h-5 rounded-sm ${bg} transition-colors hover:ring-1 hover:ring-white/30`}
      title={`${value}% utilization`}
    />
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────

export default function VenueIntelligenceDashboard() {
  const {
    venues,
    utilization,
    conflicts,
    upcomingBookings,
    summary,
    recommendations,
    heatmapData,
    selectedVenueType,
    setSelectedVenueType,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    selectedVenue,
    setSelectedVenue,
    conflictFilter,
    setConflictFilter,
    venueTypes,
  } = useVenueAnalytics();

  const [activeTab, setActiveTab] = useState<
    "overview" | "venues" | "heatmap" | "conflicts" | "bookings" | "recommendations"
  >("overview");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);

  const daysOfWeek: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Group heatmap by day for rendering
  const heatmapByDay = useMemo(() => {
    const grouped: Record<DayOfWeek, number[]> = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: [],
    };
    heatmapData.forEach((d) => {
      grouped[d.day].push(d.value);
    });
    return grouped;
  }, [heatmapData]);

  // ─── Tab: Overview ──────────────────────────────────────────────
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Building2 className="w-5 h-5" />}
          label="Total Venues"
          value={summary.totalVenues}
          sub={`${summary.activeVenues} active`}
          color="text-cyan-400"
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          label="Bookings (Month)"
          value={summary.totalBookingsThisMonth}
          sub="Across all venues"
          trend="up"
          trendValue="+15%"
          color="text-purple-400"
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Avg Utilization"
          value={`${summary.avgUtilizationRate}%`}
          sub="Room-hour usage"
          trend="up"
          trendValue={`+${summary.monthlyTrend}%`}
          color="text-emerald-400"
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Revenue"
          value={`₹${summary.totalRevenue.toLocaleString()}`}
          sub="This month"
          trend="up"
          trendValue="+8%"
          color="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Star className="w-5 h-5" />}
          label="Satisfaction"
          value={summary.avgSatisfaction}
          sub="Avg rating (out of 5)"
          color="text-amber-400"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Conflicts"
          value={summary.pendingConflicts}
          sub="Pending resolution"
          color="text-red-400"
        />
        <KpiCard
          icon={<Wrench className="w-5 h-5" />}
          label="Maintenance"
          value={summary.upcomingMaintenance}
          sub="Venues under repair"
          color="text-amber-400"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Weekly Trend"
          value={`+${summary.weeklyTrend}%`}
          sub="Booking growth"
          trend="up"
          trendValue="vs last week"
          color="text-emerald-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilization by Venue Type */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" /> Utilization by Venue Type
          </h3>
          <div className="space-y-3">
            {summary.utilizationByType.map((item) => {
              const config = VENUE_TYPE_CONFIG[item.type];
              return (
                <div key={item.type} className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{config.icon}</span>
                  <span className="text-gray-300 text-sm w-32 truncate">{config.label}</span>
                  <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${item.avg}%` }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium w-12 text-right">
                    {item.avg}%
                  </span>
                  <span className="text-gray-500 text-[10px] w-16 text-right">
                    ({item.count} venue{item.count !== 1 ? "s" : ""})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bookings by Day */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-400" /> Bookings by Day of Week
          </h3>
          <div className="space-y-2">
            {summary.bookingsByDay.map((item) => {
              const maxCount = Math.max(...summary.bookingsByDay.map((b) => b.count), 1);
              const width = (item.count / maxCount) * 100;
              return (
                <div key={item.day} className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-8">{item.day}</span>
                  <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium w-8 text-right">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Venues */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> Top Performing Venues
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {summary.topVenues.map((venue, i) => (
            <div
              key={venue.name}
              className="bg-white/5 rounded-xl p-4 text-center hover:bg-white/10 transition-all"
            >
              <div className="text-2xl font-bold text-white mb-1">#{i + 1}</div>
              <div className="text-sm text-gray-300 font-medium mb-2 truncate">{venue.name}</div>
              <div className="text-3xl font-bold text-cyan-400 mb-1">{venue.utilization}%</div>
              <div className="text-[10px] text-gray-500">utilization</div>
              {venue.revenue > 0 && (
                <div className="text-xs text-amber-400 mt-2">₹{venue.revenue.toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Heatmap Preview */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-cyan-400" /> Weekly Usage Heatmap
          </h3>
          <button
            onClick={() => setActiveTab("heatmap")}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            View Full <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-1 items-start">
          {daysOfWeek.map((day) => (
            <div key={day} className="contents">
              <span className="text-[10px] text-gray-500 w-6 text-right pr-2 pt-0.5">{day}</span>
              <div className="flex gap-0.5">
                {heatmapByDay[day].slice(8, 20).map((val, i) => (
                  <HeatmapCell key={`${day}-${i}`} value={val} />
                ))}
              </div>
            </div>
          ))}
          <div />
          <div className="flex justify-between px-1 mt-1">
            {Array.from({ length: 12 }, (_, i) => i + 8).map((h) => (
              <span key={h} className="text-[8px] text-gray-600">
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Tab: Venues ────────────────────────────────────────────────
  const VenuesTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search venues..."
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm w-64 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {venueTypes.slice(0, 6).map((vt) => {
              const config = VENUE_TYPE_CONFIG[vt.type];
              return (
                <button
                  key={vt.type}
                  onClick={() =>
                    setSelectedVenueType(selectedVenueType === vt.type ? "all" : vt.type)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedVenueType === vt.type
                      ? `${config.bg} ${config.color} border border-current/40`
                      : "bg-white/5 text-gray-400 border border-white/10 hover:text-white"
                  }`}
                >
                  {config.icon} {config.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-400"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-400"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Venue Cards */}
      <div
        className={
          viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"
        }
      >
        {venues.map((venue, i) => {
          const config = VENUE_TYPE_CONFIG[venue.type];
          const statusStyle = STATUS_COLORS[venue.status];
          const utilData = utilization.find((u) => u.venueId === venue.id);

          return viewMode === "grid" ? (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedVenue(selectedVenue === venue.id ? null : venue.id)}
              className={`bg-white/5 backdrop-blur-md border rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-white/20 ${
                selectedVenue === venue.id
                  ? "border-cyan-500/50 ring-1 ring-cyan-500/30"
                  : "border-white/10"
              }`}
            >
              {/* Header */}
              <div
                className={`h-28 bg-gradient-to-br ${config.color === "text-cyan-400" ? "from-cyan-600 to-blue-700" : config.color === "text-purple-400" ? "from-purple-600 to-indigo-700" : config.color === "text-emerald-400" ? "from-emerald-600 to-teal-700" : config.color === "text-amber-400" ? "from-amber-600 to-orange-700" : config.color === "text-pink-400" ? "from-pink-600 to-rose-700" : config.color === "text-red-400" ? "from-red-600 to-red-800" : config.color === "text-indigo-400" ? "from-indigo-600 to-violet-700" : "from-teal-600 to-cyan-700"} p-4 flex flex-col justify-between relative`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}
                  >
                    {venue.status}
                  </span>
                  <span className="text-2xl">{config.icon}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <h4 className="text-white font-semibold text-sm mb-1">{venue.name}</h4>
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
                  <MapPin className="w-3 h-3" />
                  {venue.building}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500">Capacity</div>
                    <div className="text-white text-sm font-medium">{venue.capacity}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500">Rating</div>
                    <div className="text-amber-400 text-sm font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" fill="currentColor" />
                      {venue.rating}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500">Bookings</div>
                    <div className="text-white text-sm font-medium">{venue.totalBookings}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-gray-500">Utilization</div>
                    <div className="text-cyan-400 text-sm font-medium">
                      {utilData ? `${utilData.avgUtilization}%` : "—"}
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {venue.amenities.slice(0, 4).map((a) => (
                    <span
                      key={a}
                      className="px-2 py-0.5 rounded text-[9px] bg-white/5 text-gray-400 border border-white/10"
                    >
                      {a.replace(/_/g, " ")}
                    </span>
                  ))}
                  {venue.amenities.length > 4 && (
                    <span className="px-2 py-0.5 rounded text-[9px] bg-white/5 text-gray-500">
                      +{venue.amenities.length - 4}
                    </span>
                  )}
                </div>

                {/* Utilization Bar */}
                {utilData && (
                  <div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          utilData.avgUtilization > 85
                            ? "bg-red-500"
                            : utilData.avgUtilization > 65
                              ? "bg-amber-500"
                              : "bg-cyan-500"
                        }`}
                        style={{ width: `${utilData.avgUtilization}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-500">
                        {utilData.avgUtilization > 85
                          ? "High demand — consider overflow"
                          : utilData.avgUtilization > 65
                            ? "Moderate usage"
                            : "Available capacity"}
                      </span>
                      {utilData.trend === "up" && (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      )}
                      {utilData.trend === "down" && (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      {utilData.trend === "stable" && <Minus className="w-3 h-3 text-gray-400" />}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* List view */
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedVenue(selectedVenue === venue.id ? null : venue.id)}
              className={`bg-white/5 backdrop-blur-md border rounded-xl p-4 cursor-pointer transition-all hover:border-white/20 flex items-center gap-4 ${
                selectedVenue === venue.id ? "border-cyan-500/50" : "border-white/10"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-xl ${VENUE_TYPE_CONFIG[venue.type].bg} flex items-center justify-center flex-shrink-0 text-xl`}
              >
                {VENUE_TYPE_CONFIG[venue.type].icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-medium text-sm truncate">{venue.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}
                  >
                    {venue.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {venue.building}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {venue.capacity}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    {venue.rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {venue.totalBookings} bookings
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {venue.hourlyRate > 0 ? (
                  <span className="px-2 py-1 rounded-lg text-[10px] bg-amber-500/20 text-amber-400">
                    ₹{venue.hourlyRate}/hr
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg text-[10px] bg-emerald-500/20 text-emerald-400">
                    Free
                  </span>
                )}
                <div className="w-16 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{
                      width: `${utilization.find((u) => u.venueId === venue.id)?.avgUtilization ?? 0}%`,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Venue Detail Panel */}
      <AnimatePresence>
        {selectedVenue &&
          (() => {
            const venue = venues.find((v) => v.id === selectedVenue);
            if (!venue) return null;
            const config = VENUE_TYPE_CONFIG[venue.type];
            const utilData = utilization.find((u) => u.venueId === venue.id);
            const venueBookings = upcomingBookings.filter((b) => b.venueId === venue.id);
            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl">
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">{venue.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_COLORS[venue.status].bg} ${STATUS_COLORS[venue.status].border} ${STATUS_COLORS[venue.status].text}`}
                          >
                            {venue.status}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${config.bg} ${config.color}`}
                          >
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedVenue(null)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 mb-1">Capacity</div>
                      <div className="text-white text-sm font-medium">{venue.capacity} seats</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 mb-1">Rating</div>
                      <div className="text-amber-400 text-sm font-medium flex items-center gap-1">
                        <Star className="w-3 h-3" fill="currentColor" /> {venue.rating}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 mb-1">Total Bookings</div>
                      <div className="text-white text-sm font-medium">{venue.totalBookings}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 mb-1">Total Hours</div>
                      <div className="text-white text-sm font-medium">{venue.totalHours}h</div>
                    </div>
                  </div>

                  {utilData && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-400 mb-2">Monthly Trend</div>
                      <div className="flex items-end gap-1 h-16">
                        {utilData.monthlyData.map((m, idx) => {
                          const maxH = Math.max(...utilData.monthlyData.map((d) => d.hours));
                          const height = maxH > 0 ? (m.hours / maxH) * 100 : 0;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t"
                                style={{ height: `${height}%` }}
                              />
                              <span className="text-[8px] text-gray-500">
                                {m.month.slice(0, 3)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Amenities */}
                  <div className="mb-4">
                    <div className="text-xs text-gray-400 mb-2">Amenities</div>
                    <div className="flex flex-wrap gap-2">
                      {venue.amenities.map((a) => (
                        <span
                          key={a}
                          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-gray-300 border border-white/10"
                        >
                          {a.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming Bookings */}
                  {venueBookings.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Upcoming Bookings</div>
                      <div className="space-y-2">
                        {venueBookings.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center gap-3 p-2 bg-white/5 rounded-lg"
                          >
                            <CalendarDays className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-white text-sm font-medium">{b.eventName}</div>
                              <div className="text-gray-500 text-[10px]">
                                {b.clubName} · {b.date} · {b.startTime}–{b.endTime}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-medium ${
                                b.status === "confirmed"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>
    </div>
  );

  // ─── Tab: Heatmap ───────────────────────────────────────────────
  const HeatmapTab = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-cyan-400" /> Campus Venue Usage Heatmap
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Shows venue utilization across all hours and days. Darker cells indicate higher usage.
          </p>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Hour labels */}
              <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-0.5 mb-1">
                <div />
                {hours.map((h) => (
                  <div key={h} className="text-center text-[8px] text-gray-500">
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {daysOfWeek.map((day) => (
                <div key={day} className="grid grid-cols-[60px_repeat(24,1fr)] gap-0.5 mb-0.5">
                  <span className="text-[10px] text-gray-400 flex items-center justify-end pr-2">
                    {day}
                  </span>
                  {heatmapByDay[day].map((val, i) => (
                    <HeatmapCell key={`${day}-${i}`} value={val} />
                  ))}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-[10px] text-gray-500">Low</span>
                {[5, 20, 40, 60, 80, 100].map((v) => (
                  <div
                    key={v}
                    className={`w-4 h-4 rounded-sm ${
                      v > 80
                        ? "bg-cyan-500"
                        : v > 60
                          ? "bg-cyan-600/80"
                          : v > 40
                            ? "bg-cyan-700/60"
                            : v > 20
                              ? "bg-cyan-800/40"
                              : "bg-white/5"
                    }`}
                  />
                ))}
                <span className="text-[10px] text-gray-500">High</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Usage Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-amber-400 text-sm font-medium mb-1">🔥 Peak Hours</div>
              <div className="text-white text-lg font-bold">10:00 — 14:00</div>
              <div className="text-gray-400 text-xs mt-1">
                Consistently highest utilization across all venues
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-cyan-400 text-sm font-medium mb-1">📅 Busiest Day</div>
              <div className="text-white text-lg font-bold">Wednesday</div>
              <div className="text-gray-400 text-xs mt-1">
                Most events and highest average attendance
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-emerald-400 text-sm font-medium mb-1">📉 Quiet Period</div>
              <div className="text-white text-lg font-bold">20:00 — 06:00</div>
              <div className="text-gray-400 text-xs mt-1">
                Low usage; consider extended-hour programming
              </div>
            </div>
          </div>
        </div>

        {/* Capacity vs Demand */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" /> Capacity vs Demand
          </h3>
          <div className="space-y-3">
            {utilization
              .slice()
              .sort((a, b) => b.avgUtilization - a.avgUtilization)
              .map((u) => (
                <div key={u.venueId} className="flex items-center gap-4">
                  <span className="text-gray-300 text-sm w-40 truncate">{u.venueName}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full ${
                          u.avgUtilization > 85
                            ? "bg-gradient-to-r from-red-500 to-red-400"
                            : u.avgUtilization > 65
                              ? "bg-gradient-to-r from-amber-500 to-amber-400"
                              : "bg-gradient-to-r from-cyan-500 to-cyan-400"
                        }`}
                        style={{ width: `${u.avgUtilization}%` }}
                      />
                    </div>
                    <span className="text-white text-sm font-medium w-12 text-right">
                      {u.avgUtilization}%
                    </span>
                  </div>
                  {u.avgUtilization > 85 && (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Tab: Conflicts ─────────────────────────────────────────────
  const ConflictsTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm">Severity:</span>
        {(["all", "high", "medium", "low"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setConflictFilter(level)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              conflictFilter === level
                ? level === "high"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : level === "medium"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : level === "low"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-white/10 text-white border border-white/20"
                : "bg-white/5 text-gray-400 border border-white/10 hover:text-white"
            }`}
          >
            {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Conflict Cards */}
      <div className="space-y-4">
        {conflicts.map((conflict, i) => {
          const sevStyle = SEVERITY_COLORS[conflict.severity];
          const isExpanded = expandedConflict === conflict.id;
          return (
            <motion.div
              key={conflict.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
            >
              <div
                onClick={() => setExpandedConflict(isExpanded ? null : conflict.id)}
                className="p-4 cursor-pointer hover:bg-white/5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      className={`w-5 h-5 ${conflict.severity === "high" ? "text-red-400" : conflict.severity === "medium" ? "text-amber-400" : "text-emerald-400"}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{conflict.event1}</span>
                        <span className="text-gray-500">↔</span>
                        <span className="text-white font-medium text-sm">{conflict.event2}</span>
                      </div>
                      <div className="text-gray-400 text-[10px] mt-0.5">
                        {conflict.venueName} · {conflict.date} · {conflict.overlapStart}–
                        {conflict.overlapEnd}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sevStyle.bg} ${sevStyle.border} ${sevStyle.text}`}
                    >
                      {conflict.severity}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-white/5 rounded-lg p-3">
                          <div className="text-[10px] text-gray-400 mb-1">Overlap Window</div>
                          <div className="text-white text-sm font-medium">
                            {conflict.overlapStart} — {conflict.overlapEnd}
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3">
                          <div className="text-[10px] text-gray-400 mb-1">Venue</div>
                          <div className="text-white text-sm font-medium">{conflict.venueName}</div>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 mb-3">
                        <div className="text-[10px] text-gray-400 mb-1">Suggested Resolution</div>
                        <div className="text-gray-300 text-sm">{conflict.suggestedResolution}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Accept Suggestion
                        </button>
                        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-xs font-medium">
                          Manual Resolve
                        </button>
                        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-xs font-medium">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {conflicts.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <div className="text-white font-semibold">No conflicts found</div>
            <div className="text-gray-400 text-sm mt-1">
              All venues are booked without overlapping events
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Tab: Bookings ──────────────────────────────────────────────
  const BookingsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Confirmed"
          value={upcomingBookings.filter((b) => b.status === "confirmed").length}
          color="text-emerald-400"
        />
        <KpiCard
          icon={<Timer className="w-5 h-5" />}
          label="Pending"
          value={upcomingBookings.filter((b) => b.status === "pending").length}
          color="text-amber-400"
        />
        <KpiCard
          icon={<CalendarDays className="w-5 h-5" />}
          label="Total"
          value={upcomingBookings.length}
          sub="Upcoming bookings"
          color="text-cyan-400"
        />
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-cyan-400" /> Upcoming Venue Bookings
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {upcomingBookings
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((booking, i) => {
              const venue = venues.find((v) => v.id === booking.venueId);
              const config = venue ? VENUE_TYPE_CONFIG[venue.type] : null;
              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-xl flex-shrink-0">
                      {config?.icon ?? "📍"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{booking.eventName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-medium ${
                            booking.status === "confirmed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {venue?.name ?? "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {booking.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {booking.startTime} — {booking.endTime}
                        </span>
                        {booking.attendeeCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {booking.attendeeCount} attendees
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-gray-400 text-[10px]">{booking.clubName}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </div>
    </div>
  );

  // ─── Tab: Recommendations ───────────────────────────────────────
  const RecommendationsTab = () => (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> Smart Venue Recommendations
        </h3>
        <p className="text-gray-400 text-sm mb-6">
          Based on your event requirements, utilization trends, and venue ratings.
        </p>

        <div className="space-y-4">
          {recommendations.map((rec, i) => (
            <motion.div
              key={rec.venueId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 rounded-xl p-5 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-white">#{i + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm">{rec.venueName}</span>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                      <Target className="w-3 h-3" />
                      {rec.matchScore}% match
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {rec.reasons.map((reason, j) => (
                      <span
                        key={j}
                        className="px-2 py-0.5 rounded text-[9px] bg-white/5 text-gray-300 border border-white/10 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> {reason}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {rec.estimatedCost === 0 ? "Free" : `₹${rec.estimatedCost}/hr`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Up to {rec.estimatedCapacity}
                    </span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0">
                  Book <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Optimization Tips */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> Venue Optimization Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">Over-utilized Venues</span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Computer Lab A (92%) and Innovation Hub (88%) are running near capacity. Consider
              scheduling workshops during off-peak hours (before 9 AM or after 5 PM) or adding
              overflow sessions in Conference Room 201.
            </p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">
                Under-utilized Opportunity
              </span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Central Lawn (55% utilization) has significant unused capacity. Consider hosting
              outdoor movie nights, fitness sessions, or weekend study groups to increase
              engagement.
            </p>
          </div>
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">Revenue Optimization</span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Seminar Hall A generates ₹9,300/month. Consider tiered pricing for premium time slots
              (10 AM–2 PM) and discounts for off-peak bookings to maximize both revenue and
              utilization.
            </p>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 text-sm font-medium">Maintenance Schedule</span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Computer Lab A is currently under maintenance. Schedule regular maintenance during
              semester breaks (Jul) when utilization drops to 50% to minimize disruption.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Building2 className="w-8 h-8 text-cyan-400" />
                Venue Intelligence Dashboard
              </h1>
              <p className="text-gray-400 mt-2">
                Real-time venue analytics, utilization insights, and smart booking recommendations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
              <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={<BarChart3 className="w-4 h-4" />}
            label="Overview"
          />
          <TabButton
            active={activeTab === "venues"}
            onClick={() => setActiveTab("venues")}
            icon={<Building2 className="w-4 h-4" />}
            label="Venues"
            count={venues.length}
          />
          <TabButton
            active={activeTab === "heatmap"}
            onClick={() => setActiveTab("heatmap")}
            icon={<Thermometer className="w-4 h-4" />}
            label="Heatmap"
          />
          <TabButton
            active={activeTab === "conflicts"}
            onClick={() => setActiveTab("conflicts")}
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Conflicts"
            count={conflicts.length}
          />
          <TabButton
            active={activeTab === "bookings"}
            onClick={() => setActiveTab("bookings")}
            icon={<CalendarDays className="w-4 h-4" />}
            label="Bookings"
            count={upcomingBookings.length}
          />
          <TabButton
            active={activeTab === "recommendations"}
            onClick={() => setActiveTab("recommendations")}
            icon={<Sparkles className="w-4 h-4" />}
            label="Recommendations"
          />
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "venues" && <VenuesTab />}
        {activeTab === "heatmap" && <HeatmapTab />}
        {activeTab === "conflicts" && <ConflictsTab />}
        {activeTab === "bookings" && <BookingsTab />}
        {activeTab === "recommendations" && <RecommendationsTab />}
      </div>
    </div>
  );
}
