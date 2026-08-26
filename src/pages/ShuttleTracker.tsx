import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bus,
  MapPin,
  Clock,
  Users,
  Navigation,
  AlertTriangle,
  CheckCircle,
  Route,
  Calendar,
  BarChart3,
  Bell,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Star,
  Wifi,
  Battery,
  Thermometer,
  Gauge,
  Timer,
  ArrowRight,
  RefreshCw,
  Bookmark,
  Share2,
  X,
  Info,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  Layers,
  Compass,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type ShuttleStatus = "on-time" | "delayed" | "arriving" | "departed" | "offline";
type ShuttleType = "express" | "regular" | "loop" | "night";
type DayType = "weekday" | "saturday" | "sunday";

interface ShuttleStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
  amenities: string[];
  shelter: boolean;
  accessible: boolean;
  estimatedArrival: number; // minutes
  passengerCount: number;
  capacity: number;
}

interface ShuttleRoute {
  id: string;
  name: string;
  type: ShuttleType;
  color: string;
  stops: string[];
  frequency: number; // minutes
  firstBus: string;
  lastBus: string;
  status: ShuttleStatus;
  delay: number; // minutes
  currentStop: number;
  passengerCount: number;
  capacity: number;
  speed: number; // km/h
  nextArrivals: number[];
  active: boolean;
  daySchedule: DayType;
}

interface ShuttleVehicle {
  id: string;
  routeId: string;
  plateNumber: string;
  model: string;
  year: number;
  batteryLevel: number;
  fuelLevel: number;
  speed: number;
  temperature: number;
  signalStrength: number;
  lat: number;
  lng: number;
  heading: number;
  nextStop: string;
  eta: number;
  passengers: number;
  capacity: number;
  lastMaintenance: string;
  nextMaintenance: string;
  driverName: string;
  rating: number;
}

interface ServiceAlert {
  id: string;
  type: "delay" | "cancellation" | "reroute" | "maintenance" | "info";
  severity: "low" | "medium" | "high" | "critical";
  routeId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  affectedStops: string[];
}

interface UsageStats {
  totalRidersToday: number;
  peakHour: string;
  avgWaitTime: number;
  onTimePerformance: number;
  totalTrips: number;
  avgOccupancy: number;
  totalDistance: number;
  co2Saved: number;
  weeklyTrend: { day: string; riders: number }[];
  hourlyDistribution: { hour: string; riders: number }[];
  routePopularity: { route: string; riders: number; color: string }[];
  stopUsage: { stop: string; boardings: number; alightings: number }[];
}

// ─── Data ──────────────────────────────────────────────────────────
const ROUTES: ShuttleRoute[] = [
  {
    id: "R1", name: "Red Line Express", type: "express", color: "#ef4444",
    stops: ["Main Gate", "Library", "Engineering Block", "Student Center", "Sports Complex"],
    frequency: 10, firstBus: "07:00", lastBus: "22:00", status: "on-time", delay: 0,
    currentStop: 2, passengerCount: 32, capacity: 50, speed: 25, nextArrivals: [2, 12, 22, 32],
    active: true, daySchedule: "weekday",
  },
  {
    id: "R2", name: "Blue Line Loop", type: "loop", color: "#3b82f6",
    stops: ["Hostel Block A", "Cafeteria", "Admin Building", "Computer Lab", "Hostel Block B", "Parking"],
    frequency: 8, firstBus: "06:30", lastBus: "23:00", status: "delayed", delay: 5,
    currentStop: 4, passengerCount: 45, capacity: 50, speed: 18, nextArrivals: [5, 13, 21, 29],
    active: true, daySchedule: "weekday",
  },
  {
    id: "R3", name: "Green Line Regular", type: "regular", color: "#22c55e",
    stops: ["North Gate", "Science Block", "Research Center", "Auditorium", "South Gate"],
    frequency: 15, firstBus: "08:00", lastBus: "20:00", status: "arriving", delay: 0,
    currentStop: 1, passengerCount: 18, capacity: 45, speed: 30, nextArrivals: [1, 16, 31, 46],
    active: true, daySchedule: "weekday",
  },
  {
    id: "R4", name: "Yellow Night Shuttle", type: "night", color: "#eab308",
    stops: ["Library", "Student Center", "Hostel Block A", "Hostel Block B", "Main Gate"],
    frequency: 20, firstBus: "21:00", lastBus: "02:00", status: "on-time", delay: 0,
    currentStop: 0, passengerCount: 8, capacity: 40, speed: 20, nextArrivals: [8, 28, 48, 68],
    active: true, daySchedule: "weekday",
  },
  {
    id: "R5", name: "Purple Express", type: "express", color: "#a855f7",
    stops: ["Main Gate", "CS Department", "AI Lab", "Innovation Hub", "Sports Complex"],
    frequency: 12, firstBus: "07:30", lastBus: "21:30", status: "on-time", delay: 0,
    currentStop: 3, passengerCount: 38, capacity: 50, speed: 28, nextArrivals: [4, 16, 28, 40],
    active: true, daySchedule: "weekday",
  },
  {
    id: "R6", name: "Orange Weekend Special", type: "regular", color: "#f97316",
    stops: ["Main Gate", "Shopping Center", "Mall Road", "City Park", "Main Gate"],
    frequency: 30, firstBus: "09:00", lastBus: "19:00", status: "on-time", delay: 0,
    currentStop: 2, passengerCount: 12, capacity: 45, speed: 22, nextArrivals: [10, 40, 70, 100],
    active: true, daySchedule: "saturday",
  },
];

const STOPS: ShuttleStop[] = [
  { id: "S1", name: "Main Gate", lat: 0, lng: 0, zone: "Zone A", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 3, passengerCount: 15, capacity: 30 },
  { id: "S2", name: "Library", lat: 0, lng: 0, zone: "Zone A", amenities: ["WiFi", "Seating", "Vending"], shelter: true, accessible: true, estimatedArrival: 7, passengerCount: 22, capacity: 30 },
  { id: "S3", name: "Engineering Block", lat: 0, lng: 0, zone: "Zone B", amenities: ["WiFi"], shelter: false, accessible: true, estimatedArrival: 12, passengerCount: 28, capacity: 30 },
  { id: "S4", name: "Student Center", lat: 0, lng: 0, zone: "Zone B", amenities: ["WiFi", "Seating", "Food Court"], shelter: true, accessible: true, estimatedArrival: 5, passengerCount: 35, capacity: 40 },
  { id: "S5", name: "Sports Complex", lat: 0, lng: 0, zone: "Zone C", amenities: ["Water Fountain"], shelter: false, accessible: false, estimatedArrival: 18, passengerCount: 8, capacity: 20 },
  { id: "S6", name: "Hostel Block A", lat: 0, lng: 0, zone: "Zone D", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 2, passengerCount: 40, capacity: 40 },
  { id: "S7", name: "Cafeteria", lat: 0, lng: 0, zone: "Zone B", amenities: ["Seating", "Food"], shelter: true, accessible: true, estimatedArrival: 9, passengerCount: 18, capacity: 30 },
  { id: "S8", name: "Admin Building", lat: 0, lng: 0, zone: "Zone A", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 14, passengerCount: 12, capacity: 25 },
  { id: "S9", name: "Computer Lab", lat: 0, lng: 0, zone: "Zone B", amenities: ["WiFi"], shelter: false, accessible: true, estimatedArrival: 10, passengerCount: 20, capacity: 30 },
  { id: "S10", name: "Hostel Block B", lat: 0, lng: 0, zone: "Zone D", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 4, passengerCount: 35, capacity: 40 },
  { id: "S11", name: "Parking", lat: 0, lng: 0, zone: "Zone E", amenities: ["Lighting"], shelter: false, accessible: true, estimatedArrival: 6, passengerCount: 5, capacity: 20 },
  { id: "S12", name: "North Gate", lat: 0, lng: 0, zone: "Zone A", amenities: ["WiFi"], shelter: true, accessible: true, estimatedArrival: 15, passengerCount: 10, capacity: 25 },
  { id: "S13", name: "Science Block", lat: 0, lng: 0, zone: "Zone B", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 8, passengerCount: 16, capacity: 25 },
  { id: "S14", name: "Research Center", lat: 0, lng: 0, zone: "Zone C", amenities: ["WiFi"], shelter: false, accessible: true, estimatedArrival: 11, passengerCount: 14, capacity: 25 },
  { id: "S15", name: "Auditorium", lat: 0, lng: 0, zone: "Zone C", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 6, passengerCount: 25, capacity: 40 },
  { id: "S16", name: "South Gate", lat: 0, lng: 0, zone: "Zone A", amenities: ["WiFi"], shelter: true, accessible: true, estimatedArrival: 20, passengerCount: 8, capacity: 25 },
  { id: "S17", name: "CS Department", lat: 0, lng: 0, zone: "Zone B", amenities: ["WiFi", "Seating"], shelter: true, accessible: true, estimatedArrival: 4, passengerCount: 19, capacity: 25 },
  { id: "S18", name: "AI Lab", lat: 0, lng: 0, zone: "Zone C", amenities: ["WiFi"], shelter: false, accessible: true, estimatedArrival: 7, passengerCount: 11, capacity: 20 },
  { id: "S19", name: "Innovation Hub", lat: 0, lng: 0, zone: "Zone C", amenities: ["WiFi", "Seating", "Charging"], shelter: true, accessible: true, estimatedArrival: 10, passengerCount: 22, capacity: 30 },
  { id: "S20", name: "Shopping Center", lat: 0, lng: 0, zone: "Zone E", amenities: ["WiFi", "Seating", "Food"], shelter: true, accessible: true, estimatedArrival: 8, passengerCount: 7, capacity: 20 },
  { id: "S21", name: "Mall Road", lat: 0, lng: 0, zone: "Zone E", amenities: ["Seating"], shelter: false, accessible: true, estimatedArrival: 13, passengerCount: 5, capacity: 20 },
  { id: "S22", name: "City Park", lat: 0, lng: 0, zone: "Zone E", amenities: ["Seating", "Water Fountain"], shelter: true, accessible: true, estimatedArrival: 18, passengerCount: 3, capacity: 15 },
];

const VEHICLES: ShuttleVehicle[] = [
  { id: "V1", routeId: "R1", plateNumber: "CAMP-001", model: "Tata Starbus EV", year: 2024, batteryLevel: 78, fuelLevel: 0, speed: 25, temperature: 24, signalStrength: 95, lat: 28.6139, lng: 77.2090, heading: 45, nextStop: "Engineering Block", eta: 4, passengers: 32, capacity: 50, lastMaintenance: "2026-08-15", nextMaintenance: "2026-09-15", driverName: "Rajesh Kumar", rating: 4.8 },
  { id: "V2", routeId: "R2", plateNumber: "CAMP-002", model: "Eicher Skyline EV", year: 2023, batteryLevel: 45, fuelLevel: 0, speed: 18, temperature: 26, signalStrength: 88, lat: 28.6142, lng: 77.2105, heading: 120, nextStop: "Hostel Block B", eta: 5, passengers: 45, capacity: 50, lastMaintenance: "2026-07-20", nextMaintenance: "2026-08-20", driverName: "Amit Sharma", rating: 4.5 },
  { id: "V3", routeId: "R3", plateNumber: "CAMP-003", model: "Olectra BYD eBuzz", year: 2024, batteryLevel: 92, fuelLevel: 0, speed: 30, temperature: 23, signalStrength: 98, lat: 28.6155, lng: 77.2078, heading: 270, nextStop: "Science Block", eta: 1, passengers: 18, capacity: 45, lastMaintenance: "2026-08-01", nextMaintenance: "2026-09-01", driverName: "Priya Singh", rating: 4.9 },
  { id: "V4", routeId: "R4", plateNumber: "CAMP-004", model: "Tata Starbus EV", year: 2023, batteryLevel: 60, fuelLevel: 0, speed: 20, temperature: 22, signalStrength: 90, lat: 28.6128, lng: 77.2112, heading: 315, nextStop: "Library", eta: 8, passengers: 8, capacity: 40, lastMaintenance: "2026-08-10", nextMaintenance: "2026-09-10", driverName: "Mohan Lal", rating: 4.7 },
  { id: "V5", routeId: "R5", plateNumber: "CAMP-005", model: "Ashok Leyland Viking EV", year: 2025, batteryLevel: 85, fuelLevel: 0, speed: 28, temperature: 25, signalStrength: 97, lat: 28.6165, lng: 77.2095, heading: 90, nextStop: "Innovation Hub", eta: 3, passengers: 38, capacity: 50, lastMaintenance: "2026-08-20", nextMaintenance: "2026-09-20", driverName: "Vikram Patel", rating: 4.6 },
  { id: "V6", routeId: "R6", plateNumber: "CAMP-006", model: "JBM Solaris EV", year: 2024, batteryLevel: 55, fuelLevel: 0, speed: 22, temperature: 27, signalStrength: 85, lat: 28.6115, lng: 77.2080, heading: 180, nextStop: "Mall Road", eta: 6, passengers: 12, capacity: 45, lastMaintenance: "2026-08-05", nextMaintenance: "2026-09-05", driverName: "Sanjay Gupta", rating: 4.4 },
];

const ALERTS: ServiceAlert[] = [
  { id: "A1", type: "delay", severity: "medium", routeId: "R2", title: "Blue Line — 5 min delay", description: "Traffic congestion near Cafeteria causing delays on Blue Line Loop.", startTime: "08:30", endTime: "09:15", affectedStops: ["Cafeteria", "Admin Building", "Computer Lab"] },
  { id: "A2", type: "maintenance", severity: "low", routeId: "R4", title: "Yellow Night — Reduced service tonight", description: "One vehicle undergoing maintenance. Service every 30 min instead of 20 min.", startTime: "21:00", endTime: "02:00", affectedStops: ["Library", "Student Center"] },
  { id: "A3", type: "info", severity: "low", routeId: "R6", title: "Orange Weekend — Extended hours", description: "Service extended to 21:00 for campus festival this Saturday.", startTime: "09:00", endTime: "21:00", affectedStops: ["Shopping Center", "Mall Road", "City Park"] },
];

const USAGE_STATS: UsageStats = {
  totalRidersToday: 2847,
  peakHour: "08:00 - 09:00",
  avgWaitTime: 6.2,
  onTimePerformance: 91.5,
  totalTrips: 156,
  avgOccupancy: 58.3,
  totalDistance: 482,
  co2Saved: 312,
  weeklyTrend: [
    { day: "Mon", riders: 3200 },
    { day: "Tue", riders: 2950 },
    { day: "Wed", riders: 3100 },
    { day: "Thu", riders: 2800 },
    { day: "Fri", riders: 3400 },
    { day: "Sat", riders: 1800 },
    { day: "Sun", riders: 1200 },
  ],
  hourlyDistribution: [
    { hour: "6AM", riders: 120 }, { hour: "7AM", riders: 380 }, { hour: "8AM", riders: 620 },
    { hour: "9AM", riders: 540 }, { hour: "10AM", riders: 280 }, { hour: "11AM", riders: 220 },
    { hour: "12PM", riders: 350 }, { hour: "1PM", riders: 290 }, { hour: "2PM", riders: 180 },
    { hour: "3PM", riders: 160 }, { hour: "4PM", riders: 240 }, { hour: "5PM", riders: 380 },
    { hour: "6PM", riders: 420 }, { hour: "7PM", riders: 280 }, { hour: "8PM", riders: 180 },
    { hour: "9PM", riders: 140 },
  ],
  routePopularity: [
    { route: "Red Line", riders: 680, color: "#ef4444" },
    { route: "Blue Loop", riders: 820, color: "#3b82f6" },
    { route: "Green Line", riders: 520, color: "#22c55e" },
    { route: "Yellow Night", riders: 280, color: "#eab308" },
    { route: "Purple Exp", riders: 390, color: "#a855f7" },
    { route: "Orange Week", riders: 157, color: "#f97316" },
  ],
  stopUsage: [
    { stop: "Student Center", boardings: 180, alightings: 165 },
    { stop: "Main Gate", boardings: 220, alightings: 140 },
    { stop: "Library", boardings: 150, alightings: 175 },
    { stop: "Hostel A", boardings: 195, alightings: 110 },
    { stop: "Engineering", boardings: 130, alightings: 155 },
  ],
};

// ─── Utility ──────────────────────────────────────────────────────
const statusColor = (s: ShuttleStatus) => ({
  "on-time": "text-emerald-400", delayed: "text-amber-400", arriving: "text-blue-400",
  departed: "text-gray-400", offline: "text-red-400",
}[s]);

const statusBg = (s: ShuttleStatus) => ({
  "on-time": "bg-emerald-500/20 border-emerald-500/40", delayed: "bg-amber-500/20 border-amber-500/40",
  arriving: "bg-blue-500/20 border-blue-500/40", departed: "bg-gray-500/20 border-gray-500/40",
  offline: "bg-red-500/20 border-red-500/40",
}[s]);

const severityColor = (s: string) => ({
  low: "text-blue-400 bg-blue-500/20 border-blue-500/40",
  medium: "text-amber-400 bg-amber-500/20 border-amber-500/40",
  high: "text-orange-400 bg-orange-500/20 border-orange-500/40",
  critical: "text-red-400 bg-red-500/20 border-red-500/40",
}[s] || "text-gray-400 bg-gray-500/20 border-gray-500/40");

const typeIcon = (t: ShuttleType) => ({
  express: <Zap className="w-4 h-4" />, regular: <Bus className="w-4 h-4" />,
  loop: <Route className="w-4 h-4" />, night: <Clock className="w-4 h-4" />,
}[t]);

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
export default function ShuttleTracker() {
  const [activeTab, setActiveTab] = useState<"live" | "routes" | "schedule" | "alerts" | "analytics">("live");
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ShuttleType | "all">("all");
  const [now, setNow] = useState(new Date());
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [followedRoutes, setFollowedRoutes] = useState<Set<string>>(new Set(["R1", "R2"]));
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFollow = useCallback((routeId: string) => {
    setFollowedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId); else next.add(routeId);
      return next;
    });
  }, []);

  const filteredRoutes = useMemo(() => {
    return ROUTES.filter(r => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.stops.some(s => s.toLowerCase().includes(q));
      }
      return true;
    });
  }, [filterType, searchQuery]);

  const filteredVehicles = useMemo(() => {
    if (!selectedRoute) return VEHICLES;
    return VEHICLES.filter(v => v.routeId === selectedRoute);
  }, [selectedRoute]);

  const activeAlerts = ALERTS.filter(a => a.severity === "high" || a.severity === "critical");
  const totalPassengers = VEHICLES.reduce((sum, v) => sum + v.passengers, 0);
  const avgOccupancy = Math.round(VEHICLES.reduce((sum, v) => sum + (v.passengers / v.capacity) * 100, 0) / VEHICLES.length);

  // ─── Tab: Live Map ──────────────────────────────────────────────
  const LiveMapTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search routes or stops..."
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm w-64 focus:outline-none focus:border-cyan-500/50" />
          <select value={filterType} onChange={e => setFilterType(e.target.value as ShuttleType | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50">
            <option value="all">All Types</option>
            <option value="express">⚡ Express</option>
            <option value="regular">🚌 Regular</option>
            <option value="loop">🔄 Loop</option>
            <option value="night">🌙 Night</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMap(!showMap)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${showMap ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "bg-white/5 text-gray-400 border border-white/10"}`}>
            <Layers className="w-4 h-4" />{showMap ? "Map On" : "Map Off"}
          </button>
          <span className="text-xs text-gray-500">{now.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Bus className="w-5 h-5" />} label="Active Buses" value={VEHICLES.length} sub={`Across ${ROUTES.length} routes`} color="text-cyan-400" />
        <KpiCard icon={<Users className="w-5 h-5" />} label="Total Passengers" value={totalPassengers} sub={`Avg ${avgOccupancy}% occupancy`} color="text-purple-400" />
        <KpiCard icon={<Clock className="w-5 h-5" />} label="Avg Wait Time" value={`${USAGE_STATS.avgWaitTime} min`} sub={`${USAGE_STATS.onTimePerformance}% on-time`} color="text-emerald-400" />
        <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label="Active Alerts" value={ALERTS.length} sub={`${activeAlerts.length} high severity`} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Placeholder / Route List */}
        <div className="lg:col-span-2">
          {showMap ? (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 min-h-[420px] relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <svg viewBox="0 0 800 400" className="w-full h-full">
                  {/* Grid */}
                  {Array.from({ length: 20 }).map((_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * 20} x2={800} y2={i * 20} stroke="white" strokeWidth={0.5} />
                  ))}
                  {Array.from({ length: 40 }).map((_, i) => (
                    <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={400} stroke="white" strokeWidth={0.5} />
                  ))}
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2 relative z-10">
                <MapPin className="w-5 h-5 text-cyan-400" /> Live Shuttle Map
              </h3>
              <div className="relative z-10 grid grid-cols-3 gap-4">
                {STOPS.slice(0, 9).map((stop, i) => {
                  const isPopular = stop.passengerCount > 20;
                  return (
                    <motion.div key={stop.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedStop(selectedStop === stop.id ? null : stop.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedStop === stop.id
                          ? "bg-cyan-500/20 border-cyan-500/50"
                          : "bg-white/5 border-white/10 hover:border-white/30"
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${isPopular ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                        <span className="text-white text-xs font-medium truncate">{stop.name}</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{stop.zone} · {stop.passengerCount} waiting</div>
                      <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(stop.passengerCount / stop.capacity) * 100}%` }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-4 relative z-10">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> High demand
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" /> Normal
                </div>
                {selectedStop && (
                  <div className="ml-auto text-[10px] text-cyan-400">
                    {STOPS.find(s => s.id === selectedStop)?.name} selected
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Route List View</h3>
              <div className="space-y-3">
                {filteredRoutes.map(route => (
                  <motion.div key={route.id} layout
                    onClick={() => setSelectedRoute(selectedRoute === route.id ? null : route.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedRoute === route.id ? "bg-white/10 border-white/30" : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-8 rounded-full" style={{ backgroundColor: route.color }} />
                        <div>
                          <div className="text-white font-medium text-sm">{route.name}</div>
                          <div className="text-gray-400 text-xs">{route.stops.length} stops · Every {route.frequency} min</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-medium ${statusBg(route.status)} ${statusColor(route.status)} border`}>
                          {route.status === "on-time" ? "✓ On Time" : route.status === "delayed" ? `⏱ +${route.delay}m` : "/bus arriving"}
                        </span>
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-white text-xs">{route.passengerCount}/{route.capacity}</span>
                      </div>
                    </div>
                    {selectedRoute === route.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        {route.stops.map((stop, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-xs">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              idx < route.currentStop ? "bg-emerald-500/30 text-emerald-400" :
                              idx === route.currentStop ? "bg-cyan-500/30 text-cyan-400 ring-2 ring-cyan-400" :
                              "bg-white/10 text-gray-400"
                            }`}>{idx + 1}</div>
                            <span className={idx === route.currentStop ? "text-cyan-400 font-medium" : "text-gray-300"}>{stop}</span>
                            {idx === route.currentStop && <span className="ml-auto text-cyan-400 text-[10px]">← Current</span>}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Vehicle Details & Next Arrivals */}
        <div className="space-y-4">
          {/* Next Arrivals at Selected Stop */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
              <Timer className="w-4 h-4 text-cyan-400" />
              {selectedStop ? `Arrivals at ${STOPS.find(s => s.id === selectedStop)?.name}` : "Next Arrivals"}
            </h3>
            <div className="space-y-2">
              {(selectedStop ? ROUTES.filter(r => r.stops.includes(STOPS.find(s => s.id === selectedStop)?.name || "")) : ROUTES).slice(0, 5).map(route => (
                <div key={route.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 rounded-full" style={{ backgroundColor: route.color }} />
                    <div>
                      <div className="text-white text-xs font-medium">{route.name}</div>
                      <div className="text-gray-500 text-[10px]">{route.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${route.nextArrivals[0] <= 2 ? "text-emerald-400" : route.nextArrivals[0] <= 5 ? "text-amber-400" : "text-gray-300"}`}>
                      {route.nextArrivals[0]} min
                    </div>
                    <div className="text-[10px] text-gray-500">then {route.nextArrivals[1]}m</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle Health */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" /> Fleet Status
            </h3>
            <div className="space-y-3">
              {VEHICLES.map(v => {
                const route = ROUTES.find(r => r.id === v.routeId);
                return (
                  <div key={v.id} onClick={() => setSelectedVehicle(selectedVehicle === v.id ? null : v.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      selectedVehicle === v.id ? "bg-purple-500/20 border-purple-500/40" : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-white text-xs font-medium">{v.plateNumber}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{v.eta}m to {v.nextStop}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <Battery className="w-3 h-3" />
                        <span className={v.batteryLevel < 30 ? "text-red-400" : "text-emerald-400"}>{v.batteryLevel}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        <span>{v.temperature}°C</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        <span>{v.signalStrength}%</span>
                      </div>
                    </div>
                    {selectedVehicle === v.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        className="mt-3 pt-3 border-t border-white/10 text-[11px] space-y-1">
                        <div className="text-gray-400">Route: <span className="text-white">{route?.name}</span></div>
                        <div className="text-gray-400">Driver: <span className="text-white">{v.driverName}</span> ⭐{v.rating}</div>
                        <div className="text-gray-400">Model: <span className="text-white">{v.model} ({v.year})</span></div>
                        <div className="text-gray-400">Load: <span className="text-white">{v.passengers}/{v.capacity} ({Math.round((v.passengers / v.capacity) * 100)}%)</span></div>
                        <div className="text-gray-400">Speed: <span className="text-white">{v.speed} km/h</span></div>
                        <div className="text-gray-400">Next Service: <span className="text-white">{v.nextMaintenance}</span></div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Tab: Routes ────────────────────────────────────────────────
  const RoutesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value as ShuttleType | "all")}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50">
          <option value="all">All Routes</option>
          <option value="express">⚡ Express</option>
          <option value="regular">🚌 Regular</option>
          <option value="loop">🔄 Loop</option>
          <option value="night">🌙 Night</option>
        </select>
        <span className="text-gray-400 text-sm">{filteredRoutes.length} routes</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoutes.map(route => {
          const occupancy = Math.round((route.passengerCount / route.capacity) * 100);
          const vehicle = VEHICLES.find(v => v.routeId === route.id);
          return (
            <motion.div key={route.id} layout
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-12 rounded-full" style={{ backgroundColor: route.color }} />
                  <div>
                    <div className="text-white font-semibold flex items-center gap-2">
                      {route.name}
                      {typeIcon(route.type)}
                    </div>
                    <div className="text-gray-400 text-xs mt-0.5">
                      {route.type.charAt(0).toUpperCase() + route.type.slice(1)} · Every {route.frequency} min
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFollow(route.id)}
                    className={`p-2 rounded-lg transition-all ${followedRoutes.has(route.id) ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-gray-400 hover:text-white"}`}>
                    <Bookmark className="w-4 h-4" fill={followedRoutes.has(route.id) ? "currentColor" : "none"} />
                  </button>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-medium ${statusBg(route.status)} ${statusColor(route.status)} border`}>
                    {route.status === "on-time" ? "✓ On Time" : route.status === "delayed" ? `⏱ +${route.delay}m` : "◯ Arriving"}
                  </span>
                </div>
              </div>

              {/* Occupancy Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Occupancy</span>
                  <span className={occupancy > 80 ? "text-red-400" : occupancy > 60 ? "text-amber-400" : "text-emerald-400"}>
                    {route.passengerCount}/{route.capacity} ({occupancy}%)
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{
                    width: `${occupancy}%`,
                    backgroundColor: occupancy > 80 ? "#ef4444" : occupancy > 60 ? "#f59e0b" : "#10b981",
                  }} />
                </div>
              </div>

              {/* Next Arrivals */}
              <div className="flex gap-2 mb-4">
                {route.nextArrivals.map((eta, i) => (
                  <div key={i} className={`flex-1 text-center p-2 rounded-lg ${i === 0 ? "bg-cyan-500/20 border border-cyan-500/40" : "bg-white/5"}`}>
                    <div className={`text-sm font-bold ${i === 0 ? "text-cyan-400" : "text-gray-300"}`}>{eta}m</div>
                    <div className="text-[10px] text-gray-500">Bus {i + 1}</div>
                  </div>
                ))}
              </div>

              {/* Stops */}
              <div className="space-y-1">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Route className="w-3 h-3" /> Route ({route.stops.length} stops)
                </div>
                <div className="flex flex-wrap gap-1">
                  {route.stops.map((stop, idx) => (
                    <span key={idx} className={`text-[10px] px-2 py-1 rounded-lg ${
                      idx < route.currentStop ? "bg-emerald-500/20 text-emerald-400 line-through" :
                      idx === route.currentStop ? "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50" :
                      "bg-white/5 text-gray-400"
                    }`}>
                      {idx === route.currentStop ? "◉ " : ""}{stop}
                    </span>
                  ))}
                </div>
              </div>

              {/* Operating Hours */}
              <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {route.firstBus} — {route.lastBus}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {route.passengerCount} aboard</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // ─── Tab: Schedule ──────────────────────────────────────────────
  const ScheduleTab = () => {
    const hours = Array.from({ length: 18 }, (_, i) => 6 + i); // 6AM to 11PM
    return (
      <div className="space-y-6">
        {/* Schedule Grid */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" /> Weekly Schedule
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-white/10">
                <th className="text-left py-2 px-3 font-medium">Route</th>
                {hours.map(h => (
                  <th key={h} className="text-center py-2 px-1 font-medium">{h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROUTES.map(route => (
                <tr key={route.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-6 rounded-full" style={{ backgroundColor: route.color }} />
                      <span className="text-white font-medium">{route.name}</span>
                    </div>
                  </td>
                  {hours.map(h => {
                    const start = parseInt(route.firstBus.split(":")[0]);
                    const end = parseInt(route.lastBus.split(":")[0]);
                    const active = h >= start && h < end;
                    const isPeak = (h >= 8 && h <= 9) || (h >= 17 && h <= 18);
                    return (
                      <td key={h} className="text-center py-3 px-1">
                        {active ? (
                          <div className={`w-full h-6 rounded-sm ${isPeak ? "bg-cyan-500/60" : "bg-cyan-500/20"}`} title={isPeak ? "Peak" : "Active"} />
                        ) : (
                          <div className="w-full h-6 rounded-sm bg-white/5" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-cyan-500/20" /> Regular</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-cyan-500/60" /> Peak Hours</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-white/5" /> No Service</div>
          </div>
        </div>

        {/* Stop Schedule */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" /> Stop Schedules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STOPS.slice(0, 9).map(stop => (
              <div key={stop.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-medium text-sm">{stop.name}</div>
                    <div className="text-gray-500 text-[10px]">{stop.zone}</div>
                  </div>
                  <div className="flex gap-1">
                    {stop.shelter && <div className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-400">Shelter</div>}
                    {stop.accessible && <div className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400">♿</div>}
                  </div>
                </div>
                <div className="space-y-1">
                  {ROUTES.filter(r => r.stops.includes(stop.name)).map(route => {
                    const stopIdx = route.stops.indexOf(stop.name);
                    const arrTime = stopIdx * 3 + 7;
                    return (
                      <div key={route.id} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: route.color }} />
                          <span className="text-gray-300">{route.name}</span>
                        </div>
                        <span className="text-gray-400">~{arrTime} min</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">{stop.passengerCount} waiting</span>
                  <span className="text-gray-500">Cap: {stop.capacity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Tab: Alerts ────────────────────────────────────────────────
  const AlertsTab = () => (
    <div className="space-y-4">
      {ALERTS.map((alert, i) => {
        const route = ROUTES.find(r => r.id === alert.routeId);
        return (
          <motion.div key={alert.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-white/5 backdrop-blur-md border rounded-2xl p-5 ${severityColor(alert.severity).split(" ").slice(1).join(" ")}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${severityColor(alert.severity).split(" ").slice(0, 1).join(" ")}`}>
                  {alert.type === "delay" ? <Clock className="w-5 h-5" /> :
                   alert.type === "maintenance" ? <Wrench className="w-5 h-5" /> :
                   alert.type === "cancellation" ? <X className="w-5 h-5" /> :
                   <Info className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-white font-semibold">{alert.title}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{alert.description}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${severityColor(alert.severity)}`}>
                {alert.severity.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-4 rounded-full" style={{ backgroundColor: route?.color }} />
                  {route?.name}
                </span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alert.startTime} — {alert.endTime}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {alert.affectedStops.map((stop, j) => (
                  <span key={j} className="px-2 py-0.5 rounded-lg text-[9px] bg-white/5 text-gray-400">{stop}</span>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* No alerts message for empty */}
      {ALERTS.length === 0 && (
        <div className="text-center py-20">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <div className="text-white font-semibold">All Clear!</div>
          <div className="text-gray-400 text-sm mt-1">No active service alerts</div>
        </div>
      )}

      {/* Report Issue */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" /> Report an Issue
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Delay", "Breakdown", "Cleanliness", "Safety"].map(issue => (
            <button key={issue} className="p-3 bg-white/5 rounded-xl text-gray-300 text-sm hover:bg-white/10 hover:text-white transition-all border border-white/10 hover:border-white/20">
              {issue === "Delay" ? <Clock className="w-5 h-5 mx-auto mb-2 text-amber-400" /> :
               issue === "Breakdown" ? <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-red-400" /> :
               issue === "Cleanliness" ? <CheckCircle className="w-5 h-5 mx-auto mb-2 text-blue-400" /> :
               <Info className="w-5 h-5 mx-auto mb-2 text-purple-400" />}
              {issue}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Tab: Analytics ─────────────────────────────────────────────
  const AnalyticsTab = () => {
    const maxRiders = Math.max(...USAGE_STATS.hourlyDistribution.map(h => h.riders));
    const maxWeekly = Math.max(...USAGE_STATS.weeklyTrend.map(d => d.riders));

    return (
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={<Users className="w-5 h-5" />} label="Total Riders Today" value={USAGE_STATS.totalRidersToday.toLocaleString()} sub={`${USAGE_STATS.totalTrips} trips completed`} color="text-cyan-400" />
          <KpiCard icon={<Clock className="w-5 h-5" />} label="Avg Wait Time" value={`${USAGE_STATS.avgWaitTime} min`} sub={`Peak: ${USAGE_STATS.peakHour}`} color="text-emerald-400" />
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="On-Time Performance" value={`${USAGE_STATS.onTimePerformance}%`} sub={`${USAGE_STATS.avgOccupancy}% avg occupancy`} color="text-purple-400" />
          <KpiCard icon={<Zap className="w-5 h-5" />} label="CO₂ Saved" value={`${USAGE_STATS.co2Saved} kg`} sub={`${USAGE_STATS.totalDistance} km driven`} color="text-amber-400" />
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" /> Hourly Ridership
          </h3>
          <div className="flex items-end gap-1 h-48">
            {USAGE_STATS.hourlyDistribution.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] text-gray-400">{h.riders}</div>
                <div className={`w-full rounded-t-md transition-all duration-500 ${
                  i >= 7 && i <= 8 ? "bg-cyan-500" : i >= 12 && i <= 13 ? "bg-amber-500" : "bg-cyan-500/30"
                }`} style={{ height: `${(h.riders / maxRiders) * 100}%` }} />
                <div className="text-[9px] text-gray-500 -rotate-45 origin-left">{h.hour}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500" /> Morning Peak</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500" /> Lunch Peak</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500/30" /> Off-Peak</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weekly Trend */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Weekly Trend
            </h3>
            <div className="flex items-end gap-3 h-40">
              {USAGE_STATS.weeklyTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-gray-400">{d.riders.toLocaleString()}</div>
                  <div className={`w-full rounded-t-lg transition-all duration-500 ${
                    d.riders > maxWeekly * 0.8 ? "bg-emerald-500" : d.riders > maxWeekly * 0.5 ? "bg-emerald-500/50" : "bg-emerald-500/20"
                  }`} style={{ height: `${(d.riders / maxWeekly) * 100}%` }} />
                  <div className="text-[10px] text-gray-400">{d.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Route Popularity */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Route className="w-5 h-5 text-purple-400" /> Route Popularity
            </h3>
            <div className="space-y-3">
              {USAGE_STATS.routePopularity.sort((a, b) => b.riders - a.riders).map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{r.route}</span>
                    <span className="text-gray-400">{r.riders} riders</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{
                      width: `${(r.riders / USAGE_STATS.routePopularity[0].riders) * 100}%`,
                      backgroundColor: r.color,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stop Usage */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" /> Top Stops — Boardings vs Alightings
          </h3>
          <div className="space-y-4">
            {USAGE_STATS.stopUsage.map((stop, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-28 text-xs text-gray-300 text-right truncate">{stop.stop}</div>
                <div className="flex-1 flex gap-1">
                  <div className="flex-1 flex justify-end">
                    <div className="h-6 bg-cyan-500/40 rounded-l-full flex items-center justify-end pr-2 transition-all duration-1000"
                      style={{ width: `${(stop.boardings / 220) * 100}%` }}>
                      <span className="text-[10px] text-cyan-300">{stop.boardings}</span>
                    </div>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="flex-1">
                    <div className="h-6 bg-purple-500/40 rounded-r-full flex items-center pl-2 transition-all duration-1000"
                      style={{ width: `${(stop.alightings / 220) * 100}%` }}>
                      <span className="text-[10px] text-purple-300">{stop.alightings}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500/40" /> Boardings</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-500/40" /> Alightings</div>
          </div>
        </div>

        {/* Environmental Impact */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" /> 🌱 Environmental Impact
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{USAGE_STATS.co2Saved} kg</div>
              <div className="text-xs text-gray-400 mt-1">CO₂ Saved Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{USAGE_STATS.totalDistance} km</div>
              <div className="text-xs text-gray-400 mt-1">Fleet Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{Math.round(USAGE_STATS.co2Saved * 365).toLocaleString()} kg</div>
              <div className="text-xs text-gray-400 mt-1">Annual CO₂ Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{Math.round(USAGE_STATS.totalRidersToday * 0.72)}</div>
              <div className="text-xs text-gray-400 mt-1">Cars Off Road Today</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-gray-900">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-white flex items-center gap-3">
                <Bus className="w-8 h-8 text-cyan-400" />
                Campus Shuttle Tracker
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-gray-400 mt-2">Real-time shuttle tracking, schedules, and campus transit analytics</motion.p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Live Tracking</span>
              </div>
              <span className="text-gray-400 text-sm">{now.toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2">
            <TabButton active={activeTab === "live"} onClick={() => setActiveTab("live")}
              icon={<MapPin className="w-4 h-4" />} label="Live Map" />
            <TabButton active={activeTab === "routes"} onClick={() => setActiveTab("routes")}
              icon={<Route className="w-4 h-4" />} label="Routes" count={ROUTES.length} />
            <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}
              icon={<Calendar className="w-4 h-4" />} label="Schedule" />
            <TabButton active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")}
              icon={<Bell className="w-4 h-4" />} label="Alerts" count={ALERTS.length} />
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
            {activeTab === "live" && <LiveMapTab />}
            {activeTab === "routes" && <RoutesTab />}
            {activeTab === "schedule" && <ScheduleTab />}
            {activeTab === "alerts" && <AlertsTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Need Wrench icon
function Wrench(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
