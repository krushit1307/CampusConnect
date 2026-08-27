import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  MapPin,
  Clock,
  Search,
  Filter,
  Star,
  Bookmark,
  Bell,
  Plus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Zap,
  Battery,
  Shield,
  Eye,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Info,
  Share2,
  Navigation2,
  Compass,
  Timer,
  DollarSign,
  Map,
  Layers,
  RefreshCw,
  Settings,
  Calendar,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Lock,
  Unlock,
  Bike,
  Truck,
  Accessibility,
  Flag,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type SpotStatus = "available" | "occupied" | "reserved" | "maintenance" | "disabled";
type VehicleType = "car" | "bike" | "ev" | "accessible" | "compact" | "truck";
type ParkingZone = "A" | "B" | "C" | "D" | "E" | "F";
type TimeRange = "1hr" | "2hr" | "4hr" | "8hr" | "overnight";

interface ParkingSpot {
  id: string;
  spotNumber: string;
  zone: ParkingZone;
  status: SpotStatus;
  type: VehicleType;
  level: number;
  row: string;
  column: number;
  isCovered: boolean;
  hasCharger: boolean;
  hourlyRate: number;
  distanceToCenter: number; // meters
  lastUpdated: string;
  vehiclePlate?: string;
  reservedUntil?: string;
  occupiedSince?: string;
  rating: number;
  reviews: number;
}

interface ParkingLot {
  id: string;
  name: string;
  zone: ParkingZone;
  totalSpots: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceSpots: number;
  levels: number;
  hasEV: boolean;
  hasAccessible: boolean;
  hasSecurity: boolean;
  hasCamera: boolean;
  openHours: string;
  distance: number;
  avgRate: number;
  occupancy: number;
}

interface ParkingReservation {
  id: string;
  spotId: string;
  spotNumber: string;
  lotName: string;
  zone: ParkingZone;
  date: string;
  startTime: string;
  endTime: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  status: "active" | "upcoming" | "completed" | "cancelled";
  totalCost: number;
  isPaid: boolean;
}

interface ParkingStats {
  totalSpots: number;
  availableNow: number;
  totalLots: number;
  avgOccupancy: number;
  peakHour: string;
  totalReservations: number;
  revenue: number;
  hourlyDemand: { hour: string; demand: number }[];
  zoneOccupancy: { zone: string; available: number; total: number; color: string }[];
  weeklyTrend: { day: string; avg: number; peak: number }[];
  vehicleDistribution: { type: string; count: number; color: string }[];
}

// ─── Data ──────────────────────────────────────────────────────────
const VEHICLE_TYPES: { id: VehicleType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "car", label: "Car", icon: <Car className="w-4 h-4" />, color: "text-blue-400" },
  { id: "bike", label: "Bike", icon: <Bike className="w-4 h-4" />, color: "text-emerald-400" },
  { id: "ev", label: "EV", icon: <Battery className="w-4 h-4" />, color: "text-cyan-400" },
  { id: "accessible", label: "Accessible", icon: <Accessibility className="w-4 h-4" />, color: "text-purple-400" },
  { id: "compact", label: "Compact", icon: <Car className="w-3 h-3" />, color: "text-amber-400" },
  { id: "truck", label: "Truck/SUV", icon: <Truck className="w-4 h-4" />, color: "text-orange-400" },
];

const LOTS: ParkingLot[] = [
  { id: "L1", name: "Main Parking Garage", zone: "A", totalSpots: 450, availableSpots: 87, occupiedSpots: 312, reservedSpots: 38, maintenanceSpots: 13, levels: 5, hasEV: true, hasAccessible: true, hasSecurity: true, hasCamera: true, openHours: "24/7", distance: 50, avgRate: 30, occupancy: 81 },
  { id: "L2", name: "Engineering Lot", zone: "B", totalSpots: 200, availableSpots: 12, occupiedSpots: 178, reservedSpots: 8, maintenanceSpots: 2, levels: 2, hasEV: true, hasAccessible: true, hasSecurity: false, hasCamera: true, openHours: "6AM-11PM", distance: 120, avgRate: 20, occupancy: 94 },
  { id: "L3", name: "Library Parking", zone: "A", totalSpots: 150, availableSpots: 34, occupiedSpots: 105, reservedSpots: 8, maintenanceSpots: 3, levels: 2, hasEV: false, hasAccessible: true, hasSecurity: true, hasCamera: true, openHours: "7AM-10PM", distance: 80, avgRate: 25, occupancy: 77 },
  { id: "L4", name: "Sports Complex Lot", zone: "C", totalSpots: 300, availableSpots: 145, occupiedSpots: 135, reservedSpots: 12, maintenanceSpots: 8, levels: 1, hasEV: true, hasAccessible: true, hasSecurity: false, hasCamera: false, openHours: "5AM-11PM", distance: 250, avgRate: 15, occupancy: 52 },
  { id: "L5", name: "Hostel Parking", zone: "D", totalSpots: 100, availableSpots: 23, occupiedSpots: 72, reservedSpots: 3, maintenanceSpots: 2, levels: 1, hasEV: false, hasAccessible: false, hasSecurity: true, hasCamera: true, openHours: "24/7", distance: 350, avgRate: 10, occupancy: 75 },
  { id: "L6", name: "Visitor Parking", zone: "E", totalSpots: 80, availableSpots: 42, occupiedSpots: 32, reservedSpots: 4, maintenanceSpots: 2, levels: 1, hasEV: false, hasAccessible: true, hasSecurity: true, hasCamera: true, openHours: "8AM-8PM", distance: 150, avgRate: 40, occupancy: 47 },
];

const SPOTS: ParkingSpot[] = [
  // Zone A — Main Garage
  { id: "S1", spotNumber: "A-1-01", zone: "A", status: "available", type: "car", level: 1, row: "A", column: 1, isCovered: true, hasCharger: false, hourlyRate: 30, distanceToCenter: 50, lastUpdated: "2 min ago", rating: 4.5, reviews: 12 },
  { id: "S2", spotNumber: "A-1-02", zone: "A", status: "occupied", type: "car", level: 1, row: "A", column: 2, isCovered: true, hasCharger: false, hourlyRate: 30, distanceToCenter: 50, lastUpdated: "1 min ago", vehiclePlate: "DL-01-AB-1234", occupiedSince: "08:30", rating: 4.5, reviews: 12 },
  { id: "S3", spotNumber: "A-1-03", zone: "A", status: "available", type: "ev", level: 1, row: "A", column: 3, isCovered: true, hasCharger: true, hourlyRate: 35, distanceToCenter: 55, lastUpdated: "3 min ago", rating: 4.8, reviews: 8 },
  { id: "S4", spotNumber: "A-1-04", zone: "A", status: "reserved", type: "car", level: 1, row: "A", column: 4, isCovered: true, hasCharger: false, hourlyRate: 30, distanceToCenter: 55, lastUpdated: "5 min ago", reservedUntil: "12:00", rating: 4.3, reviews: 6 },
  { id: "S5", spotNumber: "A-1-05", zone: "A", status: "maintenance", type: "car", level: 1, row: "A", column: 5, isCovered: true, hasCharger: false, hourlyRate: 30, distanceToCenter: 60, lastUpdated: "1 hr ago", rating: 4.0, reviews: 4 },
  { id: "S6", spotNumber: "A-1-06", zone: "A", status: "available", type: "accessible", level: 1, row: "A", column: 6, isCovered: true, hasCharger: false, hourlyRate: 25, distanceToCenter: 45, lastUpdated: "1 min ago", rating: 4.7, reviews: 10 },
  { id: "S7", spotNumber: "A-1-07", zone: "A", status: "occupied", type: "ev", level: 1, row: "A", column: 7, isCovered: true, hasCharger: true, hourlyRate: 35, distanceToCenter: 60, lastUpdated: "2 min ago", vehiclePlate: "MH-12-CD-5678", occupiedSince: "09:15", rating: 4.9, reviews: 15 },
  { id: "S8", spotNumber: "A-2-01", zone: "A", status: "available", type: "car", level: 2, row: "B", column: 1, isCovered: true, hasCharger: false, hourlyRate: 28, distanceToCenter: 70, lastUpdated: "4 min ago", rating: 4.2, reviews: 9 },
  { id: "S9", spotNumber: "A-2-02", zone: "A", status: "occupied", type: "compact", level: 2, row: "B", column: 2, isCovered: true, hasCharger: false, hourlyRate: 25, distanceToCenter: 70, lastUpdated: "1 min ago", vehiclePlate: "KA-05-EF-9012", occupiedSince: "07:45", rating: 4.1, reviews: 5 },
  { id: "S10", spotNumber: "A-2-03", zone: "A", status: "available", type: "car", level: 2, row: "B", column: 3, isCovered: true, hasCharger: false, hourlyRate: 28, distanceToCenter: 75, lastUpdated: "2 min ago", rating: 4.4, reviews: 7 },
  // Zone B — Engineering
  { id: "S11", spotNumber: "B-1-01", zone: "B", status: "occupied", type: "car", level: 1, row: "C", column: 1, isCovered: false, hasCharger: false, hourlyRate: 20, distanceToCenter: 120, lastUpdated: "3 min ago", vehiclePlate: "TN-07-GH-3456", occupiedSince: "08:00", rating: 3.8, reviews: 14 },
  { id: "S12", spotNumber: "B-1-02", zone: "B", status: "occupied", type: "car", level: 1, row: "C", column: 2, isCovered: false, hasCharger: false, hourlyRate: 20, distanceToCenter: 125, lastUpdated: "1 min ago", vehiclePlate: "GJ-01-IJ-7890", occupiedSince: "08:20", rating: 3.9, reviews: 11 },
  { id: "S13", spotNumber: "B-1-03", zone: "B", status: "available", type: "bike", level: 1, row: "C", column: 3, isCovered: false, hasCharger: false, hourlyRate: 10, distanceToCenter: 115, lastUpdated: "2 min ago", rating: 4.0, reviews: 8 },
  { id: "S14", spotNumber: "B-1-04", zone: "B", status: "occupied", type: "ev", level: 1, row: "C", column: 4, isCovered: false, hasCharger: true, hourlyRate: 25, distanceToCenter: 130, lastUpdated: "1 min ago", vehiclePlate: "DL-04-KL-2345", occupiedSince: "09:00", rating: 4.6, reviews: 6 },
  // Zone C — Sports
  { id: "S15", spotNumber: "C-1-01", zone: "C", status: "available", type: "car", level: 1, row: "D", column: 1, isCovered: false, hasCharger: false, hourlyRate: 15, distanceToCenter: 250, lastUpdated: "5 min ago", rating: 3.5, reviews: 18 },
  { id: "S16", spotNumber: "C-1-02", zone: "C", status: "available", type: "car", level: 1, row: "D", column: 2, isCovered: false, hasCharger: false, hourlyRate: 15, distanceToCenter: 255, lastUpdated: "3 min ago", rating: 3.6, reviews: 16 },
  { id: "S17", spotNumber: "C-1-03", zone: "C", status: "available", type: "truck", level: 1, row: "D", column: 3, isCovered: false, hasCharger: false, hourlyRate: 20, distanceToCenter: 260, lastUpdated: "2 min ago", rating: 3.4, reviews: 10 },
  { id: "S18", spotNumber: "C-1-04", zone: "C", status: "occupied", type: "car", level: 1, row: "D", column: 4, isCovered: false, hasCharger: false, hourlyRate: 15, distanceToCenter: 245, lastUpdated: "1 min ago", vehiclePlate: "UP-16-MN-6789", occupiedSince: "07:30", rating: 3.7, reviews: 13 },
];

const RESERVATIONS: ParkingReservation[] = [
  { id: "R1", spotId: "S1", spotNumber: "A-1-01", lotName: "Main Parking Garage", zone: "A", date: "2026-08-26", startTime: "10:00", endTime: "14:00", vehicleType: "car", vehiclePlate: "DL-01-AB-1234", status: "upcoming", totalCost: 120, isPaid: true },
  { id: "R2", spotId: "S3", spotNumber: "A-1-03", lotName: "Main Parking Garage", zone: "A", date: "2026-08-25", startTime: "09:00", endTime: "17:00", vehicleType: "ev", vehiclePlate: "MH-12-CD-5678", status: "completed", totalCost: 280, isPaid: true },
  { id: "R3", spotId: "S15", spotNumber: "C-1-01", lotName: "Sports Complex Lot", zone: "C", date: "2026-08-27", startTime: "08:00", endTime: "12:00", vehicleType: "car", vehiclePlate: "DL-01-AB-1234", status: "upcoming", totalCost: 60, isPaid: false },
];

const STATS: ParkingStats = {
  totalSpots: 1280,
  availableNow: 343,
  totalLots: 6,
  avgOccupancy: 74,
  peakHour: "9:00 - 10:00 AM",
  totalReservations: 1247,
  revenue: 38400,
  hourlyDemand: [
    { hour: "6AM", demand: 15 }, { hour: "7AM", demand: 35 }, { hour: "8AM", demand: 68 },
    { hour: "9AM", demand: 92 }, { hour: "10AM", demand: 88 }, { hour: "11AM", demand: 78 },
    { hour: "12PM", demand: 85 }, { hour: "1PM", demand: 82 }, { hour: "2PM", demand: 75 },
    { hour: "3PM", demand: 70 }, { hour: "4PM", demand: 72 }, { hour: "5PM", demand: 80 },
    { hour: "6PM", demand: 55 }, { hour: "7PM", demand: 38 }, { hour: "8PM", demand: 22 },
    { hour: "9PM", demand: 12 },
  ],
  zoneOccupancy: [
    { zone: "Zone A", available: 121, total: 600, color: "#3b82f6" },
    { zone: "Zone B", available: 12, total: 200, color: "#ef4444" },
    { zone: "Zone C", available: 145, total: 300, color: "#10b981" },
    { zone: "Zone D", available: 23, total: 100, color: "#f59e0b" },
    { zone: "Zone E", available: 42, total: 80, color: "#8b5cf6" },
  ],
  weeklyTrend: [
    { day: "Mon", avg: 78, peak: 95 }, { day: "Tue", avg: 82, peak: 97 },
    { day: "Wed", avg: 80, peak: 94 }, { day: "Thu", avg: 76, peak: 92 },
    { day: "Fri", avg: 85, peak: 98 }, { day: "Sat", avg: 55, peak: 72 },
    { day: "Sun", avg: 30, peak: 45 },
  ],
  vehicleDistribution: [
    { type: "Car", count: 780, color: "#3b82f6" },
    { type: "Bike", count: 210, color: "#10b981" },
    { type: "EV", count: 145, color: "#06b6d4" },
    { type: "Compact", count: 85, color: "#f59e0b" },
    { type: "SUV/Truck", count: 45, color: "#f97316" },
    { type: "Accessible", count: 15, color: "#8b5cf6" },
  ],
};

// ─── Utility ──────────────────────────────────────────────────────
const statusColor = (s: SpotStatus) => ({
  available: "text-emerald-400", occupied: "text-red-400", reserved: "text-amber-400",
  maintenance: "text-gray-400", disabled: "text-gray-600",
}[s]);

const statusBg = (s: SpotStatus) => ({
  available: "bg-emerald-500/20 border-emerald-500/40", occupied: "bg-red-500/20 border-red-500/40",
  reserved: "bg-amber-500/20 border-amber-500/40", maintenance: "bg-gray-500/20 border-gray-500/40",
  disabled: "bg-gray-800/20 border-gray-700/40",
}[s]);

const zoneColor = (z: ParkingZone) => ({
  A: "#3b82f6", B: "#ef4444", C: "#10b981", D: "#f59e0b", E: "#8b5cf6", F: "#f97316",
}[z]);

const vehicleInfo = (v: VehicleType) => VEHICLE_TYPES.find(t => t.id === v) || VEHICLE_TYPES[0];

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
export default function ParkingFinder() {
  const [activeTab, setActiveTab] = useState<"spots" | "lots" | "reservations" | "analytics">("spots");
  const [selectedZone, setSelectedZone] = useState<ParkingZone | "all">("all");
  const [selectedType, setSelectedType] = useState<VehicleType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<SpotStatus | "all">("available");
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [showReserveModal, setShowReserveModal] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<TimeRange>("2hr");
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filteredSpots = useMemo(() => {
    let spots = [...SPOTS];
    if (selectedZone !== "all") spots = spots.filter(s => s.zone === selectedZone);
    if (selectedType !== "all") spots = spots.filter(s => s.type === selectedType);
    if (statusFilter !== "all") spots = spots.filter(s => s.status === statusFilter);
    return spots.sort((a, b) => a.distanceToCenter - b.distanceToCenter);
  }, [selectedZone, selectedType, statusFilter]);

  const availableCount = SPOTS.filter(s => s.status === "available").length;
  const occupiedCount = SPOTS.filter(s => s.status === "occupied").length;
  const reservedCount = SPOTS.filter(s => s.status === "reserved").length;

  // ─── Tab: Spots ─────────────────────────────────────────────────
  const SpotsTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={selectedZone} onChange={e => setSelectedZone(e.target.value as ParkingZone | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="all">All Zones</option>
            {(["A", "B", "C", "D", "E"] as ParkingZone[]).map(z => (
              <option key={z} value={z}>Zone {z}</option>
            ))}
          </select>
          <select value={selectedType} onChange={e => setSelectedType(e.target.value as VehicleType | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="all">All Types</option>
            {VEHICLE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as SpotStatus | "all")}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="available">🟢 Available</option>
            <option value="all">All Status</option>
            <option value="occupied">🔴 Occupied</option>
            <option value="reserved">🟡 Reserved</option>
            <option value="maintenance">⬜ Maintenance</option>
          </select>
        </div>
        <span className="text-gray-400 text-sm">{filteredSpots.length} spots found</span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Car className="w-5 h-5" />} label="Available Now" value={availableCount} sub="Across all zones" color="text-emerald-400" />
        <KpiCard icon={<Lock className="w-5 h-5" />} label="Occupied" value={occupiedCount} sub={`${Math.round((occupiedCount / SPOTS.length) * 100)}% capacity`} color="text-red-400" />
        <KpiCard icon={<Timer className="w-5 h-5" />} label="Reserved" value={reservedCount} sub="Pre-booked" color="text-amber-400" />
        <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Avg Rate" value="₹25/hr" sub="Across all lots" color="text-purple-400" />
      </div>

      {/* Spot Map View */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Map className="w-5 h-5 text-cyan-400" /> Parking Grid — Level 1
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {SPOTS.map((spot, i) => {
            const vInfo = vehicleInfo(spot.type);
            return (
              <motion.div key={spot.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelectedSpot(selectedSpot === spot.id ? null : spot.id)}
                className={`relative p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedSpot === spot.id ? "ring-2 ring-cyan-500 border-cyan-500/50" :
                  spot.status === "available" ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20" :
                  spot.status === "occupied" ? "bg-red-500/10 border-red-500/30" :
                  spot.status === "reserved" ? "bg-amber-500/10 border-amber-500/30" :
                  "bg-gray-500/10 border-gray-500/30"
                }`}>
                <div className="text-center">
                  <div className={`text-[10px] font-bold ${
                    spot.status === "available" ? "text-emerald-400" :
                    spot.status === "occupied" ? "text-red-400" :
                    spot.status === "reserved" ? "text-amber-400" : "text-gray-400"
                  }`}>{spot.spotNumber}</div>
                  <div className="text-[8px] text-gray-500 mt-0.5">{vInfo.label}</div>
                  {spot.hasCharger && <div className="text-[8px] text-cyan-400">⚡</div>}
                  {spot.status === "occupied" && <div className="text-[7px] text-gray-500">{spot.vehiclePlate?.slice(-4)}</div>}
                  {spot.status === "reserved" && <div className="text-[7px] text-amber-400">{spot.reservedUntil}</div>}
                </div>
                {spot.status === "available" && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </motion.div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40" /> Available</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/40" /> Occupied</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/40" /> Reserved</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-500/30 border border-gray-500/40" /> Maintenance</div>
          <div className="flex items-center gap-1"><span className="text-cyan-400">⚡</span> EV Charger</div>
        </div>
      </div>

      {/* Spot List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSpots.map((spot, i) => {
          const vInfo = vehicleInfo(spot.type);
          return (
            <motion.div key={spot.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedSpot(selectedSpot === spot.id ? null : spot.id)}
              className={`bg-white/5 backdrop-blur-md border rounded-2xl p-4 cursor-pointer transition-all hover:border-white/20 ${
                selectedSpot === spot.id ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : "border-white/10"
              }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: `${zoneColor(spot.zone)}20` }}>
                    <span style={{ color: zoneColor(spot.zone) }}>{vInfo.icon}</span>
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{spot.spotNumber}</div>
                    <div className="text-gray-500 text-[10px]">Zone {spot.zone} · Level {spot.level} · Row {spot.row}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusBg(spot.status)} ${statusColor(spot.status)}`}>
                  {spot.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-white text-xs font-medium">₹{spot.hourlyRate}</div>
                  <div className="text-[9px] text-gray-500">/hour</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-white text-xs font-medium">{spot.distanceToCenter}m</div>
                  <div className="text-[9px] text-gray-500">distance</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-0.5 text-amber-400">
                    <Star className="w-3 h-3" fill="currentColor" />
                    <span className="text-xs font-medium">{spot.rating}</span>
                  </div>
                  <div className="text-[9px] text-gray-500">{spot.reviews} reviews</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {spot.isCovered && <span className="px-2 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-400">Covered</span>}
                  {spot.hasCharger && <span className="px-2 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-400">⚡ EV</span>}
                  {spot.type === "accessible" && <span className="px-2 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400">♿</span>}
                </div>
                <div className="text-[10px] text-gray-500">{spot.lastUpdated}</div>
              </div>
              {spot.status === "occupied" && spot.vehiclePlate && (
                <div className="mt-2 p-2 bg-red-500/5 rounded-lg text-[10px] text-gray-400">
                  Vehicle: <span className="text-white">{spot.vehiclePlate}</span> · Since {spot.occupiedSince}
                </div>
              )}
              {spot.status === "available" && (
                <button onClick={e => { e.stopPropagation(); setShowReserveModal(spot.id); }}
                  className="w-full mt-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-xs font-medium transition-all">
                  Reserve Spot
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // ─── Tab: Lots ──────────────────────────────────────────────────
  const LotsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {LOTS.map((lot, i) => (
          <motion.div key={lot.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => setSelectedLot(selectedLot === lot.id ? null : lot.id)}
            className={`bg-white/5 backdrop-blur-md border rounded-2xl p-5 cursor-pointer transition-all hover:border-white/20 ${
              selectedLot === lot.id ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : "border-white/10"
            }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-12 rounded-full" style={{ backgroundColor: zoneColor(lot.zone) }} />
                <div>
                  <div className="text-white font-semibold">{lot.name}</div>
                  <div className="text-gray-400 text-xs">Zone {lot.zone} · {lot.levels} level{lot.levels > 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-lg">{lot.availableSpots}</div>
                <div className="text-gray-500 text-[10px]">spots free</div>
              </div>
            </div>

            {/* Occupancy Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Occupancy</span>
                <span className={lot.occupancy > 90 ? "text-red-400" : lot.occupancy > 75 ? "text-amber-400" : "text-emerald-400"}>
                  {lot.occupancy}%
                </span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${lot.occupancy}%`,
                  backgroundColor: lot.occupancy > 90 ? "#ef4444" : lot.occupancy > 75 ? "#f59e0b" : "#10b981",
                }} />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                <div className="text-emerald-400 text-sm font-bold">{lot.availableSpots}</div>
                <div className="text-[9px] text-gray-500">Free</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-2 text-center">
                <div className="text-red-400 text-sm font-bold">{lot.occupiedSpots}</div>
                <div className="text-[9px] text-gray-500">Taken</div>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-2 text-center">
                <div className="text-amber-400 text-sm font-bold">{lot.reservedSpots}</div>
                <div className="text-[9px] text-gray-500">Held</div>
              </div>
              <div className="bg-gray-500/10 rounded-lg p-2 text-center">
                <div className="text-gray-400 text-sm font-bold">{lot.maintenanceSpots}</div>
                <div className="text-[9px] text-gray-500">Down</div>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1 mb-3">
              {lot.hasEV && <span className="px-2 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-400">⚡ EV Charging</span>}
              {lot.hasAccessible && <span className="px-2 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400">♿ Accessible</span>}
              {lot.hasSecurity && <span className="px-2 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-400">🛡️ Security</span>}
              {lot.hasCamera && <span className="px-2 py-0.5 rounded text-[9px] bg-gray-500/20 text-gray-400">📷 CCTV</span>}
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lot.openHours}</span>
              <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {lot.distance}m</span>
              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ₹{lot.avgRate}/hr</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Zone Overview */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" /> Zone Availability Overview
        </h3>
        <div className="space-y-3">
          {STATS.zoneOccupancy.map(zone => {
            const pct = Math.round(((zone.total - zone.available) / zone.total) * 100);
            return (
              <div key={zone.zone} className="flex items-center gap-4">
                <div className="w-20 text-sm text-gray-300">{zone.zone}</div>
                <div className="w-10 text-right text-xs text-emerald-400 font-medium">{zone.available}</div>
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: zone.color }} />
                  </div>
                </div>
                <div className="w-10 text-right text-xs text-gray-400">{zone.total}</div>
                <span className={`w-12 text-right text-[10px] font-medium ${pct > 80 ? "text-red-400" : pct > 60 ? "text-amber-400" : "text-emerald-400"}`}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Tab: Reservations ──────────────────────────────────────────
  const ReservationsTab = () => {
    const active = RESERVATIONS.filter(r => r.status === "active");
    const upcoming = RESERVATIONS.filter(r => r.status === "upcoming");
    const completed = RESERVATIONS.filter(r => r.status === "completed");
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<CheckCircle className="w-5 h-5" />} label="Active" value={active.length} sub="Currently parked" color="text-emerald-400" />
        <KpiCard icon={<Clock className="w-5 h-5" />} label="Upcoming" value={upcoming.length} sub="Pre-booked today" color="text-cyan-400" />
        <KpiCard icon={<Calendar className="w-5 h-5" />} label="Completed" value={completed.length} sub="This week" color="text-purple-400" />
        <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Total Spent" value={`₹${RESERVATIONS.reduce((s, r) => s + r.totalCost, 0)}`} sub="This week" color="text-amber-400" />
      </div>

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" /> Upcoming
          </h3>
          <div className="space-y-3">
            {upcoming.map(res => {
              const vInfo = vehicleInfo(res.vehicleType);
              return (
                <div key={res.id} className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${zoneColor(res.zone)}20` }}>
                    <span style={{ color: zoneColor(res.zone) }}>{vInfo.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">{res.spotNumber} — {res.lotName}</div>
                    <div className="text-gray-400 text-[10px] flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{res.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{res.startTime} — {res.endTime}</span>
                      <span>{res.vehiclePlate}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">₹{res.totalCost}</div>
                    <span className={`px-2 py-0.5 rounded text-[9px] ${res.isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                      {res.isPaid ? "Paid" : "Pay at exit"}
                    </span>
                  </div>
                  <button className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-500/30 transition-all">
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-purple-400" /> Completed
          </h3>
          <div className="space-y-3">
            {completed.map(res => (
              <div key={res.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium text-sm">{res.spotNumber} — {res.lotName}</div>
                  <div className="text-gray-400 text-[10px] mt-1">
                    {res.date} · {res.startTime} — {res.endTime} · ₹{res.totalCost}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400">Completed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Reserve */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" /> ⚡ Quick Reserve
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LOTS.filter(l => l.availableSpots > 0).slice(0, 4).map(lot => (
            <button key={lot.id} className="p-3 bg-white/5 rounded-xl text-left hover:bg-white/10 transition-all border border-white/10 hover:border-white/20">
              <div className="text-white text-xs font-medium">{lot.name}</div>
              <div className="text-emerald-400 text-lg font-bold mt-1">{lot.availableSpots}</div>
              <div className="text-[10px] text-gray-500">spots available · ₹{lot.avgRate}/hr</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );};

  // ─── Tab: Analytics ─────────────────────────────────────────────
  const AnalyticsTab = () => {
    const maxDemand = Math.max(...STATS.hourlyDemand.map(h => h.demand));
    const maxWeekly = Math.max(...STATS.weeklyTrend.map(d => d.peak));
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Car className="w-5 h-5" />} label="Total Spots" value={STATS.totalSpots.toLocaleString()} sub={`${STATS.totalLots} lots`} color="text-cyan-400" />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="Avg Occupancy" value={`${STATS.avgOccupancy}%`} sub={`Peak: ${STATS.peakHour}`} color="text-purple-400" />
        <KpiCard icon={<Calendar className="w-5 h-5" />} label="Reservations" value={STATS.totalReservations.toLocaleString()} sub="This month" color="text-emerald-400" />
        <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Revenue" value={`₹${(STATS.revenue / 1000).toFixed(1)}K`} sub="This month" color="text-amber-400" />
      </div>

      {/* Hourly Demand */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" /> Hourly Demand Pattern
        </h3>
        <div className="flex items-end gap-1 h-48">
          {STATS.hourlyDemand.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[8px] text-gray-400">{h.demand}%</div>
              <div className={`w-full rounded-t-md transition-all duration-500 ${
                h.demand > 85 ? "bg-red-500" : h.demand > 70 ? "bg-amber-500" : "bg-emerald-500/50"
              }`} style={{ height: `${(h.demand / maxDemand) * 100}%` }} />
              <div className="text-[8px] text-gray-500 -rotate-45 origin-left">{h.hour}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> High Demand (&gt;85%)</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500" /> Medium (70-85%)</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/50" /> Low (&lt;70%)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> Weekly Trend (Avg vs Peak)
          </h3>
          <div className="flex items-end gap-3 h-40">
            {STATS.weeklyTrend.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex gap-0.5 items-end" style={{ height: "100%" }}>
                  <div className="w-4 rounded-t bg-cyan-500/50" style={{ height: `${(d.avg / maxWeekly) * 100}%` }} />
                  <div className="w-4 rounded-t bg-cyan-500" style={{ height: `${(d.peak / maxWeekly) * 100}%` }} />
                </div>
                <div className="text-[10px] text-gray-400">{d.day}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500/50" /> Average</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500" /> Peak</div>
          </div>
        </div>

        {/* Vehicle Distribution */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Car className="w-5 h-5 text-purple-400" /> Vehicle Distribution
          </h3>
          <div className="space-y-3">
            {STATS.vehicleDistribution.sort((a, b) => b.count - a.count).map((v, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{v.type}</span>
                  <span className="text-gray-400">{v.count} vehicles</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(v.count / STATS.vehicleDistribution[0].count) * 100}%`,
                    backgroundColor: v.color,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> 📊 Parking Insights
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-cyan-400">{STATS.peakHour}</div>
            <div className="text-xs text-gray-400 mt-1">Peak Demand</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-red-400">Zone B</div>
            <div className="text-xs text-gray-400 mt-1">Most Congested</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">Zone C</div>
            <div className="text-xs text-gray-400 mt-1">Most Available</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">₹38.4K</div>
            <div className="text-xs text-gray-400 mt-1">Monthly Revenue</div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            "⏰ Arrive before 8:30 AM to guarantee a spot in Zone A — 92% full by 9 AM",
            "⚡ EV spots in Zone A have the highest occupancy — 98% full during peak hours",
            "💰 Sports Complex (Zone C) has the best availability at 52% — consider for long stays",
            "📱 Real-time updates every 2 minutes — last updated " + now.toLocaleTimeString(),
          ].map((insight, i) => (
            <div key={i} className="text-sm text-gray-300 bg-white/5 rounded-xl p-3">{insight}</div>
          ))}
        </div>
      </div>
    </div>
  );};

  // ─── Reserve Modal ──────────────────────────────────────────────
  const ReserveModal = () => {
    if (!showReserveModal) return null;
    const spot = SPOTS.find(s => s.id === showReserveModal);
    if (!spot) return null;
    const lot = LOTS.find(l => l.zone === spot.zone);
    const timeOptions: { value: TimeRange; label: string; cost: number }[] = [
      { value: "1hr", label: "1 Hour", cost: spot.hourlyRate },
      { value: "2hr", label: "2 Hours", cost: spot.hourlyRate * 2 },
      { value: "4hr", label: "4 Hours", cost: spot.hourlyRate * 4 },
      { value: "8hr", label: "8 Hours (Full Day)", cost: spot.hourlyRate * 8 * 0.8 },
    ];
    const selectedTime = timeOptions.find(t => t.value === reserveTime)!;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShowReserveModal(null)}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          onClick={e => e.stopPropagation()}
          className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-bold text-lg">Reserve Spot</h3>
            <button onClick={() => setShowReserveModal(null)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${zoneColor(spot.zone)}20` }}>
                <Car className="w-5 h-5" style={{ color: zoneColor(spot.zone) }} />
              </div>
              <div>
                <div className="text-white font-semibold">{spot.spotNumber}</div>
                <div className="text-gray-400 text-xs">{lot?.name} · Zone {spot.zone} · Level {spot.level}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white text-xs">₹{spot.hourlyRate}/hr</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white text-xs">{spot.distanceToCenter}m away</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-white text-xs">⭐ {spot.rating}</div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-300 text-sm font-medium mb-2 block">Duration</label>
            <div className="grid grid-cols-2 gap-2">
              {timeOptions.map(opt => (
                <button key={opt.value} onClick={() => setReserveTime(opt.value)}
                  className={`p-3 rounded-xl text-sm font-medium text-left transition-all border ${
                    reserveTime === opt.value ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "bg-white/5 border-white/10 text-gray-400"
                  }`}>
                  <div>{opt.label}</div>
                  <div className="text-[10px] opacity-70">₹{opt.cost}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 p-3 bg-white/5 rounded-xl flex items-center justify-between">
            <span className="text-gray-300 text-sm">Total Cost</span>
            <span className="text-white text-xl font-bold">₹{selectedTime.cost}</span>
          </div>

          <button className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2">
            <Check className="w-5 h-5" /> Confirm Reservation — ₹{selectedTime.cost}
          </button>
        </motion.div>
      </motion.div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-emerald-600/20" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-white flex items-center gap-3">
                <Car className="w-8 h-8 text-blue-400" />
                Campus Parking
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-gray-400 mt-2">{STATS.availableNow} spots available now across {STATS.totalLots} lots • {STATS.avgOccupancy}% avg occupancy</motion.p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Live</span>
              </div>
              <span className="text-gray-400 text-sm">{now.toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2">
            <TabButton active={activeTab === "spots"} onClick={() => setActiveTab("spots")}
              icon={<MapPin className="w-4 h-4" />} label="Spots" count={SPOTS.length} />
            <TabButton active={activeTab === "lots"} onClick={() => setActiveTab("lots")}
              icon={<Map className="w-4 h-4" />} label="Lots" count={LOTS.length} />
            <TabButton active={activeTab === "reservations"} onClick={() => setActiveTab("reservations")}
              icon={<Calendar className="w-4 h-4" />} label="Reservations" count={RESERVATIONS.length} />
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
            {activeTab === "spots" && <SpotsTab />}
            {activeTab === "lots" && <LotsTab />}
            {activeTab === "reservations" && <ReservationsTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reserve Modal */}
      <AnimatePresence>
        <ReserveModal />
      </AnimatePresence>
    </div>
  );
}

function Sparkles(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}
