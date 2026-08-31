import React, { useState, useMemo, useCallback } from "react";
import {
  Car, MapPin, Clock, Search, Filter, Star, AlertTriangle,
  CheckCircle2, Calendar, ChevronDown, ChevronUp, Plus, Minus,
  TrendingUp, BarChart3, Zap, Shield, Navigation, Bell, Settings,
  CreditCard, Users, Timer, Thermometer, Wifi, Battery, ParkingCircle,
  Layers, Eye, EyeOff, XCircle, Info, ArrowUpRight, Bookmark,
  RefreshCw, Download, Share2, Phone, MessageCircle, Mail,
  Sunrise, Sun, Moon, CloudRain, Snowflake, Wind, Gauge,
  CircleDot, Target, Hash, Building2, GraduationCap, Dumbbell,
  UtensilsCrossed, BookOpen, Microscope, Briefcase, Heart, Sparkles,
} from "lucide-react";

/* ─────────────── Types ─────────────── */

type ZoneType = "covered" | "surface" | "underground" | "accessible" | "ev" | "visitor";
type SpotStatus = "available" | "occupied" | "reserved" | "maintenance" | "compact";
type PermitType = "daily" | "weekly" | "monthly" | "semester" | "annual" | "visitor";
type VehicleType = "sedan" | "suv" | "compact" | "motorcycle" | "ev" | "accessible";
type WeatherType = "clear" | "rain" | "snow" | "wind";

interface ParkingZone {
  id: string;
  name: string;
  type: ZoneType;
  capacity: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  hourlyRate: number;
  dailyMax: number;
  permitDiscounts: Record<PermitType, number>;
  features: string[];
  evChargers: number;
  maxHeight: string | null;
  openHours: string;
  distanceToCampus: string;
  walkTime: string;
  lat: number;
  lng: number;
  rating: number;
  reviews: number;
  lighted: boolean;
  securityCameras: boolean;
  covered: boolean;
  handiCapAccessible: boolean;
  motorcycleSpots: boolean;
}

interface ParkingSpot {
  id: string;
  zoneId: string;
  zoneName: string;
  spotNumber: string;
  level: number;
  row: string;
  status: SpotStatus;
  vehicleTypes: VehicleType[];
  evCharger: boolean;
  handiCapAccessible: boolean;
  compactOnly: boolean;
  nearbyLandmarks: string[];
  lastUpdated: string;
  temperature: number;
  occupiedDuration: string | null;
}

interface Reservation {
  id: string;
  spotId: string;
  zoneId: string;
  zoneName: string;
  spotNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  permitType: PermitType;
  totalCost: number;
  status: "active" | "upcoming" | "completed" | "cancelled";
  entryCode: string;
}

interface Permit {
  id: string;
  type: PermitType;
  zone: string;
  vehiclePlate: string;
  startDate: string;
  endDate: string;
  price: number;
  remainingDays: number;
  autoRenew: boolean;
  status: "active" | "expired" | "suspended";
  qrCode: string;
}

interface CommuteAnalytics {
  totalTrips: number;
  avgDuration: string;
  totalSpent: number;
  favoriteZone: string;
  peakHour: string;
  carbonOffset: string;
  onTimeRate: number;
  monthlyTrend: { month: string; trips: number; cost: number }[];
  weeklyPattern: { day: string; avgArrival: string; avgDeparture: string; frequency: number }[];
  zonePreference: { zone: string; percentage: number }[];
}

interface WaitlistEntry {
  id: string;
  zoneId: string;
  zoneName: string;
  preferredTime: string;
  position: number;
  estimatedWait: string;
  status: "waiting" | "offered" | "expired";
}

/* ─────────────── Data ─────────────── */

const ZONES: ParkingZone[] = [
  {
    id: "z1", name: "North Parking Garage", type: "covered", capacity: 450,
    occupied: 387, reserved: 23, maintenance: 8, hourlyRate: 3.00, dailyMax: 18.00,
    permitDiscounts: { daily: 0, weekly: 10, monthly: 20, semester: 35, annual: 40, visitor: 0 },
    features: ["Covered", "24/7 Security", "Elevator Access", "EV Charging"],
    evChargers: 12, maxHeight: "6'6\"", openHours: "24/7",
    distanceToCampus: "0.1 mi", walkTime: "2 min", lat: 40.7128, lng: -74.006,
    rating: 4.5, reviews: 234, lighted: true, securityCameras: true, covered: true,
    handiCapAccessible: true, motorcycleSpots: true,
  },
  {
    id: "z2", name: "Engineering Surface Lot", type: "surface", capacity: 200,
    occupied: 178, reserved: 5, maintenance: 4, hourlyRate: 2.00, dailyMax: 12.00,
    permitDiscounts: { daily: 0, weekly: 5, monthly: 15, semester: 25, annual: 30, visitor: 0 },
    features: ["Surface Level", "Near Engineering Bldg", "Motorcycle Spots"],
    evChargers: 4, maxHeight: null, openHours: "6:00 AM - 11:00 PM",
    distanceToCampus: "0.05 mi", walkTime: "1 min", lat: 40.713, lng: -74.005,
    rating: 3.8, reviews: 156, lighted: true, securityCameras: true, covered: false,
    handiCapAccessible: true, motorcycleSpots: true,
  },
  {
    id: "z3", name: "Student Union Parking", type: "surface", capacity: 300,
    occupied: 265, reserved: 10, maintenance: 6, hourlyRate: 2.50, dailyMax: 15.00,
    permitDiscounts: { daily: 0, weekly: 8, monthly: 18, semester: 30, annual: 35, visitor: 0 },
    features: ["Central Campus", "Near Food Court", "Bike Racks"],
    evChargers: 6, maxHeight: null, openHours: "24/7",
    distanceToCampus: "0.0 mi", walkTime: "0 min", lat: 40.7132, lng: -74.0055,
    rating: 4.0, reviews: 312, lighted: true, securityCameras: true, covered: false,
    handiCapAccessible: true, motorcycleSpots: false,
  },
  {
    id: "z4", name: "Library Underground", type: "underground", capacity: 180,
    occupied: 152, reserved: 8, maintenance: 3, hourlyRate: 3.50, dailyMax: 20.00,
    permitDiscounts: { daily: 0, weekly: 10, monthly: 22, semester: 38, annual: 45, visitor: 0 },
    features: ["Underground", "Climate Controlled", "Direct Library Access", "Security"],
    evChargers: 8, maxHeight: "6'2\"", openHours: "24/7",
    distanceToCampus: "0.0 mi", walkTime: "0 min", lat: 40.7135, lng: -74.0065,
    rating: 4.7, reviews: 189, lighted: true, securityCameras: true, covered: true,
    handiCapAccessible: true, motorcycleSpots: false,
  },
  {
    id: "z5", name: "EV Charging Hub", type: "ev", capacity: 50,
    occupied: 42, reserved: 3, maintenance: 2, hourlyRate: 4.00, dailyMax: 22.00,
    permitDiscounts: { daily: 0, weekly: 12, monthly: 25, semester: 40, annual: 50, visitor: 0 },
    features: ["All EV Chargers", "Level 2 + DC Fast", "Solar Canopy", "App Integration"],
    evChargers: 50, maxHeight: null, openHours: "24/7",
    distanceToCampus: "0.2 mi", walkTime: "4 min", lat: 40.714, lng: -74.007,
    rating: 4.9, reviews: 98, lighted: true, securityCameras: true, covered: true,
    handiCapAccessible: true, motorcycleSpots: false,
  },
  {
    id: "z6", name: "Visitor Welcome Lot", type: "visitor", capacity: 80,
    occupied: 35, reserved: 0, maintenance: 2, hourlyRate: 5.00, dailyMax: 25.00,
    permitDiscounts: { daily: 0, weekly: 0, monthly: 0, semester: 0, annual: 0, visitor: -10 },
    features: ["Visitor Only", "Pay-Per-Use", "Kiosk Available", "Maps & Info"],
    evChargers: 2, maxHeight: null, openHours: "7:00 AM - 10:00 PM",
    distanceToCampus: "0.15 mi", walkTime: "3 min", lat: 40.7125, lng: -74.0058,
    rating: 3.5, reviews: 67, lighted: true, securityCameras: false, covered: false,
    handiCapAccessible: true, motorcycleSpots: false,
  },
  {
    id: "z7", name: "Athletics Complex Lot", type: "surface", capacity: 250,
    occupied: 198, reserved: 12, maintenance: 5, hourlyRate: 2.00, dailyMax: 10.00,
    permitDiscounts: { daily: 0, weekly: 5, monthly: 12, semester: 22, annual: 28, visitor: 0 },
    features: ["Near Gym & Fields", "Large Vehicle Friendly", "Extended Hours on Game Days"],
    evChargers: 3, maxHeight: null, openHours: "5:00 AM - 12:00 AM",
    distanceToCampus: "0.3 mi", walkTime: "6 min", lat: 40.7118, lng: -74.008,
    rating: 3.6, reviews: 145, lighted: true, securityCameras: true, covered: false,
    handiCapAccessible: true, motorcycleSpots: true,
  },
  {
    id: "z8", name: "Medical Center Deck", type: "covered", capacity: 120,
    occupied: 105, reserved: 8, maintenance: 2, hourlyRate: 3.00, dailyMax: 18.00,
    permitDiscounts: { daily: 0, weekly: 10, monthly: 20, semester: 35, annual: 40, visitor: 0 },
    features: ["Covered", "Medical Priority", "Emergency Vehicle Access", "Valet Available"],
    evChargers: 6, maxHeight: "6'8\"", openHours: "24/7",
    distanceToCampus: "0.25 mi", walkTime: "5 min", lat: 40.7142, lng: -74.0045,
    rating: 4.3, reviews: 178, lighted: true, securityCameras: true, covered: true,
    handiCapAccessible: true, motorcycleSpots: false,
  },
];

const generateSpots = (): ParkingSpot[] => {
  const spots: ParkingSpot[] = [];
  let id = 1;
  ZONES.forEach((zone) => {
    const levels = zone.type === "underground" ? 2 : zone.type === "covered" ? 3 : 1;
    for (let lvl = 1; lvl <= levels; lvl++) {
      const count = Math.min(8, Math.floor(zone.capacity / levels / 10));
      for (let r = 0; r < count; r++) {
        const row = String.fromCharCode(65 + r);
        for (let s = 1; s <= 10; s++) {
          const isEv = zone.evChargers > 0 && r === 0 && s <= Math.ceil(zone.evChargers / levels / 3);
          const isHandi = s <= 2 && zone.handiCapAccessible;
          const isCompact = zone.type === "surface" && r >= count - 2;
          const rand = Math.random();
          let status: SpotStatus = "available";
          if (rand < 0.75) status = "occupied";
          else if (rand < 0.85) status = "reserved";
          else if (rand < 0.9) status = "maintenance";
          else if (isCompact) status = "compact";
          spots.push({
            id: `s${id++}`, zoneId: zone.id, zoneName: zone.name,
            spotNumber: `${lvl}${row}${String(s).padStart(2, "0")}`,
            level: lvl, row, status, evCharger: isEv, handiCapAccessible: isHandi,
            compactOnly: isCompact, vehicleTypes: isCompact ? ["compact", "sedan"] : ["sedan", "suv", "compact"],
            nearbyLandmarks: [zone.name.split(" ")[0], zone.name.split(" ")[1] || "Campus"],
            lastUpdated: new Date(Date.now() - Math.random() * 300000).toISOString(),
            temperature: Math.floor(18 + Math.random() * 12),
            occupiedDuration: status === "occupied" ? `${Math.floor(Math.random() * 4)}h ${Math.floor(Math.random() * 60)}m` : null,
          });
        }
      }
    }
  });
  return spots;
};

const SPOTS = generateSpots();

const RESERVATIONS: Reservation[] = [
  { id: "r1", spotId: "s12", zoneId: "z1", zoneName: "North Parking Garage", spotNumber: "1A05", date: "2026-08-30", startTime: "08:00", endTime: "14:00", vehiclePlate: "ABC-1234", vehicleType: "sedan", permitType: "monthly", totalCost: 0, status: "active", entryCode: "NPG-4821" },
  { id: "r2", spotId: "s501", zoneId: "z3", zoneName: "Student Union Parking", spotNumber: "1C12", date: "2026-08-31", startTime: "09:00", endTime: "12:00", vehiclePlate: "ABC-1234", vehicleType: "sedan", permitType: "monthly", totalCost: 0, status: "upcoming", entryCode: "SUP-9037" },
  { id: "r3", spotId: "s300", zoneId: "z4", zoneName: "Library Underground", spotNumber: "2B07", date: "2026-08-29", startTime: "10:00", endTime: "16:00", vehiclePlate: "ABC-1234", vehicleType: "sedan", permitType: "monthly", totalCost: 0, status: "completed", entryCode: "LIB-2156" },
  { id: "r4", spotId: "s800", zoneId: "z5", zoneName: "EV Charging Hub", spotNumber: "1A03", date: "2026-08-30", startTime: "12:00", endTime: "16:00", vehiclePlate: "EV-5678", vehicleType: "ev", permitType: "daily", totalCost: 16.00, status: "active", entryCode: "EVH-7743" },
];

const PERMITS: Permit[] = [
  { id: "p1", type: "semester", zone: "North Parking Garage", vehiclePlate: "ABC-1234", startDate: "2026-08-15", endDate: "2026-12-20", price: 420, remainingDays: 112, autoRenew: true, status: "active", qrCode: "PERMIT-NPG-2026-FALL" },
  { id: "p2", type: "monthly", zone: "EV Charging Hub", vehiclePlate: "EV-5678", startDate: "2026-08-01", endDate: "2026-08-31", price: 65, remainingDays: 1, autoRenew: false, status: "active", qrCode: "PERMIT-EVH-AUG2026" },
];

const COMMUTE_ANALYTICS: CommuteAnalytics = {
  totalTrips: 247, avgDuration: "28 min", totalSpent: 1842.50, favoriteZone: "North Parking Garage",
  peakHour: "8:30 AM", carbonOffset: "12.4 kg CO₂", onTimeRate: 94,
  monthlyTrend: [
    { month: "Mar", trips: 22, cost: 156 }, { month: "Apr", trips: 18, cost: 132 },
    { month: "May", trips: 15, cost: 98 }, { month: "Jun", trips: 8, cost: 52 },
    { month: "Jul", trips: 5, cost: 30 }, { month: "Aug", trips: 28, cost: 210 },
  ],
  weeklyPattern: [
    { day: "Mon", avgArrival: "8:15 AM", avgDeparture: "5:30 PM", frequency: 5 },
    { day: "Tue", avgArrival: "8:20 AM", avgDeparture: "4:45 PM", frequency: 5 },
    { day: "Wed", avgArrival: "8:10 AM", avgDeparture: "5:15 PM", frequency: 5 },
    { day: "Thu", avgArrival: "8:25 AM", avgDeparture: "5:00 PM", frequency: 4 },
    { day: "Fri", avgArrival: "8:30 AM", avgDeparture: "3:00 PM", frequency: 4 },
    { day: "Sat", avgArrival: "10:00 AM", avgDeparture: "2:00 PM", frequency: 2 },
    { day: "Sun", avgArrival: "-", avgDeparture: "-", frequency: 0 },
  ],
  zonePreference: [
    { zone: "North Garage", percentage: 45 }, { zone: "Student Union", percentage: 25 },
    { zone: "Library Under.", percentage: 15 }, { zone: "EV Hub", percentage: 10 },
    { zone: "Other", percentage: 5 },
  ],
};

const WAITLIST: WaitlistEntry[] = [
  { id: "w1", zoneId: "z1", zoneName: "North Parking Garage", preferredTime: "8:00-10:00 AM", position: 3, estimatedWait: "2-3 days", status: "waiting" },
  { id: "w2", zoneId: "z5", zoneName: "EV Charging Hub", preferredTime: "12:00-2:00 PM", position: 1, estimatedWait: "1 day", status: "waiting" },
];

const ZONE_COLORS: Record<ZoneType, string> = {
  covered: "#3B82F6", surface: "#10B981", underground: "#8B5CF6",
  accessible: "#F59E0B", ev: "#06B6D4", visitor: "#EF4444",
};

const ZONE_ICONS: Record<ZoneType, React.ReactNode> = {
  covered: <Building2 size={16} />, surface: <Sun size={16} />,
  underground: <Layers size={16} />, accessible: <Shield size={16} />,
  ev: <Zap size={16} />, visitor: <Users size={16} />,
};

const WEATHER: WeatherType = "clear";
const WEATHER_ICONS: Record<WeatherType, React.ReactNode> = {
  clear: <Sun size={16} />, rain: <CloudRain size={16} />, snow: <Snowflake size={16} />, wind: <Wind size={16} />,
};

/* ─────────────── Utility Helpers ─────────────── */

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
const statusColor = (s: SpotStatus) =>
  s === "available" ? "text-green-400" : s === "reserved" ? "text-yellow-400" : s === "maintenance" ? "text-red-400" : s === "compact" ? "text-blue-400" : "text-gray-500";
const statusBg = (s: SpotStatus) =>
  s === "available" ? "bg-green-500/20" : s === "reserved" ? "bg-yellow-500/20" : s === "maintenance" ? "bg-red-500/20" : s === "compact" ? "bg-blue-500/20" : "bg-gray-500/20";

/* ─────────────── Sub-Components ─────────────── */

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; trend?: string }> = ({ icon, label, value, sub, color = "text-white", trend }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-2 mb-2">
      <span className={`${color}`}>{icon}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    {trend && <div className="text-xs text-green-400 mt-1 flex items-center gap-1"><TrendingUp size={10} />{trend}</div>}
  </div>
);

const ZoneCard: React.FC<{
  zone: ParkingZone; selected: boolean; onSelect: () => void; viewMode: "grid" | "list";
}> = ({ zone, selected, onSelect, viewMode }) => {
  const available = zone.capacity - zone.occupied - zone.reserved - zone.maintenance;
  const availPct = pct(available, zone.capacity);
  const barColor = availPct > 20 ? "bg-green-500" : availPct > 10 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl p-4 border transition-all ${
        selected ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
      } ${viewMode === "list" ? "flex items-center gap-4" : ""}`}
    >
      <div className={viewMode === "list" ? "flex-1" : ""}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span style={{ color: ZONE_COLORS[zone.type] }}>{ZONE_ICONS[zone.type]}</span>
            <span className="font-semibold text-white text-sm">{zone.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-gray-400">{zone.rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1"><MapPin size={10} />{zone.distanceToCampus}</span>
          <span className="flex items-center gap-1"><Clock size={10} />{zone.walkTime}</span>
          <span className="flex items-center gap-1"><ParkingCircle size={10} />{zone.hourlyRate > 0 ? `$${zone.hourlyRate}/hr` : "Free"}</span>
        </div>
      </div>
      <div className={viewMode === "list" ? "w-48" : ""}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">{available} spots available</span>
          <span className="text-gray-500">{availPct}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${100 - availPct}%` }} />
        </div>
      </div>
      {viewMode === "grid" && (
        <div className="flex flex-wrap gap-1 mt-3">
          {zone.features.slice(0, 3).map((f) => (
            <span key={f} className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400">{f}</span>
          ))}
          {zone.features.length > 3 && <span className="text-[10px] text-gray-500">+{zone.features.length - 3}</span>}
        </div>
      )}
    </div>
  );
};

const SpotGrid: React.FC<{
  spots: ParkingSpot[]; onReserve: (spot: ParkingSpot) => void;
}> = ({ spots, onReserve }) => {
  const [hoveredSpot, setHoveredSpot] = useState<string | null>(null);
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Layers size={16} className="text-cyan-400" />Spot Map</h3>
      <div className="grid grid-cols-10 gap-1">
        {spots.slice(0, 80).map((spot) => {
          const bg = spot.status === "available" ? "bg-green-500 hover:bg-green-400" :
            spot.status === "reserved" ? "bg-yellow-500 hover:bg-yellow-400" :
            spot.status === "maintenance" ? "bg-red-500 hover:bg-red-400" :
            spot.status === "compact" ? "bg-blue-500 hover:bg-blue-400" :
            "bg-gray-600 hover:bg-gray-500";
          const border = spot.evCharger ? "ring-1 ring-cyan-400" : spot.handiCapAccessible ? "ring-1 ring-yellow-400" : "";
          return (
            <div
              key={spot.id}
              onMouseEnter={() => setHoveredSpot(spot.id)}
              onMouseLeave={() => setHoveredSpot(null)}
              onClick={() => spot.status === "available" && onReserve(spot)}
              className={`w-full aspect-square rounded-sm ${bg} ${border} cursor-pointer transition-all relative flex items-center justify-center`}
              title={`${spot.spotNumber} — ${spot.status}${spot.evCharger ? " (EV)" : ""}`}
            >
              {spot.evCharger && <Zap size={8} className="text-cyan-200" />}
              {spot.handiCapAccessible && !spot.evCharger && <Shield size={8} className="text-yellow-200" />}
            </div>
          );
        })}
      </div>
      {hoveredSpot && (() => {
        const spot = spots.find((s) => s.id === hoveredSpot);
        if (!spot) return null;
        return (
          <div className="mt-3 bg-white/5 rounded-lg p-3 text-xs text-gray-300 flex flex-wrap gap-4">
            <span><strong>Spot:</strong> {spot.spotNumber}</span>
            <span><strong>Level:</strong> {spot.level}</span>
            <span className={statusColor(spot.status)}><strong>Status:</strong> {spot.status}</span>
            {spot.evCharger && <span className="text-cyan-400">⚡ EV Charger</span>}
            {spot.handiCapAccessible && <span className="text-yellow-400">♿ Accessible</span>}
            {spot.temperature && <span className="flex items-center gap-1"><Thermometer size={10} />{spot.temperature}°C</span>}
            {spot.occupiedDuration && <span className="text-gray-500">Occupied for {spot.occupiedDuration}</span>}
          </div>
        );
      })()}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" />Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-600" />Occupied</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500" />Reserved</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" />Maintenance</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />Compact</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-400" />EV</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400" />Accessible</span>
      </div>
    </div>
  );
};

const ReservationCard: React.FC<{ reservation: Reservation }> = ({ reservation }) => {
  const statusStyles: Record<string, string> = {
    active: "border-green-400/30 bg-green-500/5",
    upcoming: "border-blue-400/30 bg-blue-500/5",
    completed: "border-gray-400/30 bg-gray-500/5",
    cancelled: "border-red-400/30 bg-red-500/5",
  };
  return (
    <div className={`rounded-xl p-4 border ${statusStyles[reservation.status]} transition-all hover:scale-[1.01]`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Car size={16} className="text-cyan-400" />
          <span className="font-semibold text-white text-sm">{reservation.zoneName}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          reservation.status === "active" ? "bg-green-500/20 text-green-400" :
          reservation.status === "upcoming" ? "bg-blue-500/20 text-blue-400" :
          "bg-gray-500/20 text-gray-400"
        }`}>{reservation.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-gray-400">
        <div>
          <span className="text-gray-500 block">Spot</span>
          <span className="text-white font-mono">{reservation.spotNumber}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Time</span>
          <span className="text-white">{reservation.startTime} - {reservation.endTime}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Vehicle</span>
          <span className="text-white font-mono">{reservation.vehiclePlate}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Date</span>
          <span className="text-white">{reservation.date}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Entry Code</span>
          <span className="text-cyan-400 font-mono font-bold">{reservation.entryCode}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Cost</span>
          <span className="text-white">{reservation.totalCost > 0 ? formatCurrency(reservation.totalCost) : "Covered by permit"}</span>
        </div>
      </div>
    </div>
  );
};

const PermitCard: React.FC<{ permit: Permit }> = ({ permit }) => (
  <div className={`rounded-xl p-4 border transition-all ${
    permit.status === "active" ? "border-green-400/30 bg-green-500/5" : "border-gray-400/30 bg-gray-500/5"
  }`}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-cyan-400" />
        <span className="font-semibold text-white text-sm capitalize">{permit.type} Permit</span>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        permit.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
      }`}>{permit.status}</span>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 mb-3">
      <div><span className="text-gray-500 block">Zone</span><span className="text-white">{permit.zone}</span></div>
      <div><span className="text-gray-500 block">Vehicle</span><span className="text-white font-mono">{permit.vehiclePlate}</span></div>
      <div><span className="text-gray-500 block">Valid Until</span><span className="text-white">{permit.endDate}</span></div>
      <div><span className="text-gray-500 block">Remaining</span><span className="text-cyan-400 font-bold">{permit.remainingDays} days</span></div>
    </div>
    <div className="flex items-center justify-between">
      <div className="text-xs text-gray-500">{permit.qrCode}</div>
      <div className="flex gap-2">
        <button className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-300 hover:bg-white/20 transition">{permit.autoRenew ? "Auto-Renew: ON" : "Enable Auto-Renew"}</button>
        <button className="text-[10px] bg-white/10 px-2 py-1 rounded text-gray-300 hover:bg-white/20 transition"><Share2 size={10} /></button>
      </div>
    </div>
  </div>
);

const WaitlistEntry: React.FC<{ entry: WaitlistEntry }> = ({ entry }) => (
  <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
        #{entry.position}
      </div>
      <div>
        <div className="text-white text-sm font-medium">{entry.zoneName}</div>
        <div className="text-gray-500 text-xs">Preferred: {entry.preferredTime}</div>
      </div>
    </div>
    <div className="text-right">
      <div className="text-yellow-400 text-xs font-medium">~{entry.estimatedWait}</div>
      <div className="text-gray-500 text-[10px]">{entry.status}</div>
    </div>
  </div>
);

const AnalyticsBar: React.FC<{ label: string; value: number; max: number; color: string; suffix?: string }> = ({ label, value, max, color, suffix = "%" }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-400 w-20 text-right">{label}</span>
    <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct(value, max)}%` }} />
    </div>
    <span className="text-xs text-gray-300 w-12">{value}{suffix}</span>
  </div>
);

/* ─────────────── Main Component ─────────────── */

export default function ParkingSpotFinder() {
  const [activeTab, setActiveTab] = useState<"zones" | "spots" | "reservations" | "permits" | "analytics" | "waitlist">("zones");
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ZoneType | "all">("all");
  const [filterAvailability, setFilterAvailability] = useState<"all" | "available" | "ev" | "accessible">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"availability" | "distance" | "price" | "rating">("availability");
  const [showReserveModal, setShowReserveModal] = useState<ParkingSpot | null>(null);
  const [reserveTime, setReserveTime] = useState({ start: "08:00", end: "14:00" });
  const [reserveDate, setReserveDate] = useState("2026-08-30");
  const [reserveVehicle, setReserveVehicle] = useState("ABC-1234");
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const filteredZones = useMemo(() => {
    let result = [...ZONES];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((z) => z.name.toLowerCase().includes(q) || z.type.includes(q) || z.features.some((f) => f.toLowerCase().includes(q)));
    }
    if (filterType !== "all") result = result.filter((z) => z.type === filterType);
    if (filterAvailability === "ev") result = result.filter((z) => z.evChargers > 0);
    if (filterAvailability === "accessible") result = result.filter((z) => z.handiCapAccessible);
    if (filterAvailability === "available") result = result.filter((z) => z.capacity - z.occupied - z.reserved - z.maintenance > 0);
    if (sortBy === "availability") result.sort((a, b) => (b.capacity - b.occupied - b.reserved - b.maintenance) - (a.capacity - a.occupied - a.reserved - a.maintenance));
    else if (sortBy === "distance") result.sort((a, b) => parseFloat(a.distanceToCampus) - parseFloat(b.distanceToCampus));
    else if (sortBy === "price") result.sort((a, b) => a.hourlyRate - b.hourlyRate);
    else if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [searchQuery, filterType, filterAvailability, sortBy]);

  const zoneSpots = useMemo(() => {
    if (!selectedZone) return [];
    return SPOTS.filter((s) => s.zoneId === selectedZone.id && selectedLevels.includes(s.level));
  }, [selectedZone, selectedLevels]);

  const totalStats = useMemo(() => {
    const totalCapacity = ZONES.reduce((s, z) => s + z.capacity, 0);
    const totalOccupied = ZONES.reduce((s, z) => s + z.occupied, 0);
    const totalAvailable = totalCapacity - totalOccupied - ZONES.reduce((s, z) => s + z.reserved + z.maintenance, 0);
    return { totalCapacity, totalOccupied, totalAvailable, totalEV: ZONES.reduce((s, z) => s + z.evChargers, 0) };
  }, []);

  const handleReserve = useCallback((spot: ParkingSpot) => {
    setShowReserveModal(spot);
  }, []);

  const confirmReservation = useCallback(() => {
    if (!showReserveModal || !selectedZone) return;
    alert(`✅ Reservation confirmed!\n\nSpot: ${showReserveModal.spotNumber}\nZone: ${selectedZone.name}\nDate: ${reserveDate}\nTime: ${reserveTime.start} - ${reserveTime.end}\nVehicle: ${reserveVehicle}\n\nEntry code will be sent to your phone.`);
    setShowReserveModal(null);
  }, [showReserveModal, selectedZone, reserveDate, reserveTime, reserveVehicle]);

  const tabs = [
    { id: "zones" as const, label: "Zones", icon: <MapPin size={14} /> },
    { id: "spots" as const, label: "Spot Map", icon: <Layers size={14} /> },
    { id: "reservations" as const, label: "Reservations", icon: <Calendar size={14} /> },
    { id: "permits" as const, label: "Permits", icon: <CreditCard size={14} /> },
    { id: "analytics" as const, label: "Analytics", icon: <BarChart3 size={14} /> },
    { id: "waitlist" as const, label: "Waitlist", icon: <Clock size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <ParkingCircle size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Campus Parking</h1>
              <p className="text-gray-400 text-sm">Real-time availability · Reservations · Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`p-2 rounded-lg border transition-all ${notificationsEnabled ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-400" : "border-white/10 bg-white/5 text-gray-400"}`}
            >
              <Bell size={16} />
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg border transition-all ${autoRefresh ? "border-green-400/30 bg-green-500/10 text-green-400" : "border-white/10 bg-white/5 text-gray-400"}`}
            >
              <RefreshCw size={16} className={autoRefresh ? "animate-spin" : ""} />
            </button>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              {WEATHER_ICONS[WEATHER]}
              <span>22°C Clear</span>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard icon={<ParkingCircle size={18} />} label="Total Spots" value={totalStats.totalCapacity} sub="across 8 zones" color="text-cyan-400" />
          <KpiCard icon={<CheckCircle2 size={18} />} label="Available" value={totalStats.totalAvailable} sub={`${pct(totalStats.totalAvailable, totalStats.totalCapacity)}% open`} color="text-green-400" trend={`${Math.floor(Math.random() * 5) + 1}% from yesterday`} />
          <KpiCard icon={<Zap size={18} />} label="EV Chargers" value={totalStats.totalEV} sub="across 6 zones" color="text-yellow-400" />
          <KpiCard icon={<Clock size={18} />} label="Avg. Walk" value="3 min" sub="to nearest building" color="text-blue-400" />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-400/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}{tab.label}
              {tab.id === "reservations" && <span className="bg-cyan-500/20 text-cyan-400 text-[10px] px-1.5 rounded-full">{RESERVATIONS.filter((r) => r.status === "active" || r.status === "upcoming").length}</span>}
              {tab.id === "waitlist" && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 rounded-full">{WAITLIST.length}</span>}
            </button>
          ))}
        </div>

        {/* Zones Tab */}
        {activeTab === "zones" && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input
                  type="text" placeholder="Search zones, features..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white text-sm outline-none flex-1"
                />
                {searchQuery && <button onClick={() => setSearchQuery("")}><XCircle size={14} className="text-gray-400" /></button>}
              </div>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Types</option>
                <option value="covered">Covered</option><option value="surface">Surface</option>
                <option value="underground">Underground</option><option value="ev">EV</option>
                <option value="visitor">Visitor</option>
              </select>
              <select value={filterAvailability} onChange={(e) => setFilterAvailability(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All</option><option value="available">Has Spots</option>
                <option value="ev">EV Charging</option><option value="accessible">Accessible</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="availability">Sort: Availability</option><option value="distance">Sort: Distance</option>
                <option value="price">Sort: Price</option><option value="rating">Sort: Rating</option>
              </select>
              <div className="flex bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                <button onClick={() => setViewMode("grid")} className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-400"}`}><Grid size={14} /></button>
                <button onClick={() => setViewMode("list")} className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-400"}`}><ListIcon size={14} /></button>
              </div>
            </div>
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2"}>
              {filteredZones.map((zone) => (
                <ZoneCard key={zone.id} zone={zone} selected={selectedZone?.id === zone.id} onSelect={() => { setSelectedZone(zone); setActiveTab("spots"); }} viewMode={viewMode} />
              ))}
            </div>
            {filteredZones.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <MapPin size={48} className="mx-auto mb-3 opacity-50" />
                <p>No zones match your filters</p>
              </div>
            )}
          </div>
        )}

        {/* Spots Tab */}
        {activeTab === "spots" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              {selectedZone ? (
                <SpotGrid spots={zoneSpots} onReserve={handleReserve} />
              ) : (
                <div className="bg-white/5 backdrop-blur rounded-xl p-12 border border-white/10 text-center">
                  <ParkingCircle size={48} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">Select a zone from the Zones tab to view its spot map</p>
                  <button onClick={() => setActiveTab("zones")} className="mt-3 text-cyan-400 text-sm hover:underline">Browse Zones →</button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {selectedZone ? (
                <>
                  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                    <h3 className="text-white font-bold mb-3">{selectedZone.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Type</span><span className="text-white capitalize flex items-center gap-1">{ZONE_ICONS[selectedZone.type]}{selectedZone.type}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Capacity</span><span className="text-white">{selectedZone.capacity}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Available</span><span className="text-green-400">{selectedZone.capacity - selectedZone.occupied - selectedZone.reserved - selectedZone.maintenance}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Rate</span><span className="text-white">${selectedZone.hourlyRate}/hr (max ${selectedZone.dailyMax}/day)</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Walk Time</span><span className="text-white">{selectedZone.walkTime}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Hours</span><span className="text-white">{selectedZone.openHours}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Max Height</span><span className="text-white">{selectedZone.maxHeight || "No limit"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">EV Chargers</span><span className="text-cyan-400">{selectedZone.evChargers}</span></div>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                    <h4 className="text-white text-sm font-bold mb-2">Level Filter</h4>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3].filter((l) => selectedZone.type === "underground" ? l <= 2 : true).map((level) => (
                        <button
                          key={level}
                          onClick={() => setSelectedLevels((prev) => prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level])}
                          className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                            selectedLevels.includes(level) ? "border-cyan-400 bg-cyan-500/20 text-cyan-400" : "border-white/10 text-gray-400"
                          }`}
                        >Level {level}</button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
                    <h4 className="text-white text-sm font-bold mb-2">Features</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedZone.features.map((f) => (
                        <span key={f} className="text-[10px] bg-white/10 px-2 py-1 rounded-full text-gray-300">{f}</span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white/5 backdrop-blur rounded-xl p-8 border border-white/10 text-center text-gray-500">
                  <Info size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a zone to see details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reservations Tab */}
        {activeTab === "reservations" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">My Reservations</h2>
              <button className="flex items-center gap-2 bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition border border-cyan-400/30">
                <Plus size={14} />New Reservation
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESERVATIONS.map((r) => <ReservationCard key={r.id} reservation={r} />)}
            </div>
          </div>
        )}

        {/* Permits Tab */}
        {activeTab === "permits" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">My Permits</h2>
              <button className="flex items-center gap-2 bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition border border-cyan-400/30">
                <Plus size={14} />Get Permit
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {PERMITS.map((p) => <PermitCard key={p.id} permit={p} />)}
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-4">Permit Pricing</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="text-left py-2">Zone</th>
                      <th className="text-right py-2">Daily</th>
                      <th className="text-right py-2">Weekly</th>
                      <th className="text-right py-2">Monthly</th>
                      <th className="text-right py-2">Semester</th>
                      <th className="text-right py-2">Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ZONES.map((zone) => (
                      <tr key={zone.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-2 text-white flex items-center gap-1">
                          <span style={{ color: ZONE_COLORS[zone.type] }}>{ZONE_ICONS[zone.type]}</span>
                          {zone.name}
                        </td>
                        <td className="text-right text-gray-300">${zone.dailyMax}</td>
                        <td className="text-right text-gray-300">{zone.permitDiscounts.weekly > 0 ? `${zone.permitDiscounts.weekly}% off` : "-"}</td>
                        <td className="text-right text-gray-300">{zone.permitDiscounts.monthly > 0 ? `${zone.permitDiscounts.monthly}% off` : "-"}</td>
                        <td className="text-right text-gray-300">{zone.permitDiscounts.semester > 0 ? `${zone.permitDiscounts.semester}% off` : "-"}</td>
                        <td className="text-right text-cyan-400 font-bold">{zone.permitDiscounts.annual > 0 ? `${zone.permitDiscounts.annual}% off` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Car size={18} />} label="Total Trips" value={COMMUTE_ANALYTICS.totalTrips} sub="this semester" color="text-cyan-400" />
              <KpiCard icon={<Clock size={18} />} label="Avg Duration" value={COMMUTE_ANALYTICS.avgDuration} sub="commute time" color="text-blue-400" />
              <KpiCard icon={<CreditCard size={18} />} label="Total Spent" value={formatCurrency(COMMUTE_ANALYTICS.totalSpent)} sub="this semester" color="text-yellow-400" />
              <KpiCard icon={<Target size={18} />} label="On-Time Rate" value={`${COMMUTE_ANALYTICS.onTimeRate}%`} sub="parked before 8:30" color="text-green-400" trend="+2% vs last month" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly Trend */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-cyan-400" />Monthly Trend</h3>
                <div className="flex items-end gap-2 h-40">
                  {COMMUTE_ANALYTICS.monthlyTrend.map((m) => {
                    const maxTrips = Math.max(...COMMUTE_ANALYTICS.monthlyTrend.map((x) => x.trips));
                    const h = pct(m.trips, maxTrips);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-400">{m.trips}</span>
                        <div className="w-full bg-cyan-500/30 rounded-t" style={{ height: `${h}%` }}>
                          <div className="w-full bg-cyan-400 rounded-t" style={{ height: "100%" }} />
                        </div>
                        <span className="text-[10px] text-gray-500">{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zone Preference */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><PieIcon size={16} className="text-purple-400" />Zone Preference</h3>
                <div className="space-y-3">
                  {COMMUTE_ANALYTICS.zonePreference.map((zp, i) => {
                    const colors = ["bg-cyan-400", "bg-blue-400", "bg-purple-400", "bg-green-400", "bg-gray-400"];
                    return (
                      <div key={zp.zone} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-24">{zp.zone}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-3">
                          <div className={`${colors[i]} h-full rounded-full`} style={{ width: `${zp.percentage}%` }} />
                        </div>
                        <span className="text-xs text-gray-300 w-8 text-right">{zp.percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Pattern */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Calendar size={16} className="text-yellow-400" />Weekly Pattern</h3>
                <div className="space-y-2">
                  {COMMUTE_ANALYTICS.weeklyPattern.map((wp) => (
                    <div key={wp.day} className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400 w-8 font-medium">{wp.day}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-gray-500 w-16">{wp.avgArrival}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-2 relative">
                          <div className="bg-cyan-400/50 h-full rounded-full" style={{ width: `${pct(wp.frequency, 5)}%` }} />
                        </div>
                        <span className="text-gray-500 w-16 text-right">{wp.avgDeparture}</span>
                      </div>
                      <span className="text-gray-500 w-8 text-right">{wp.frequency}x</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Sparkles size={16} className="text-pink-400" />Smart Insights</h3>
                <div className="space-y-3">
                  {[
                    { icon: <Zap size={14} />, text: "Arrive before 8:15 AM for 40% more spot options", type: "tip" },
                    { icon: <TrendingUp size={14} />, text: "North Garage fills up fastest — try Student Union on Mon/Wed", type: "insight" },
                    { icon: <CreditCard size={14} />, text: "Switching to a semester permit saves you $126/year", type: "savings" },
                    { icon: <Leaf size={14} />, text: `You've offset ${COMMUTE_ANALYTICS.carbonOffset} through carpooling credits`, type: "eco" },
                    { icon: <AlertTriangle size={14} />, text: "EV permit expires tomorrow — enable auto-renew?", type: "alert" },
                    { icon: <Star size={14} />, text: "Library Underground has the best availability after 2 PM", type: "tip" },
                  ].map((insight, i) => {
                    const typeColors: Record<string, string> = { tip: "border-cyan-400/30 bg-cyan-500/5 text-cyan-400", insight: "border-blue-400/30 bg-blue-500/5 text-blue-400", savings: "border-green-400/30 bg-green-500/5 text-green-400", eco: "border-emerald-400/30 bg-emerald-500/5 text-emerald-400", alert: "border-yellow-400/30 bg-yellow-500/5 text-yellow-400" };
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${typeColors[insight.type]}`}>
                        <span className="mt-0.5">{insight.icon}</span>
                        <span className="text-xs text-gray-300">{insight.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Waitlist Tab */}
        {activeTab === "waitlist" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Parking Waitlist</h2>
              <button className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition border border-yellow-400/30">
                <Plus size={14} />Join Waitlist
              </button>
            </div>
            {WAITLIST.length > 0 ? (
              <div className="space-y-3">
                {WAITLIST.map((w) => <WaitlistEntry key={w.id} entry={w} />)}
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur rounded-xl p-12 border border-white/10 text-center">
                <Clock size={48} className="mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 mb-2">No waitlist entries</p>
                <p className="text-gray-500 text-sm">Join a waitlist when your preferred zone is full</p>
              </div>
            )}
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-3">How Waitlists Work</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green-400 mt-0.5 shrink-0" />When a spot opens in your preferred zone and time, you'll receive an offer notification</div>
                <div className="flex items-start gap-2"><Timer size={14} className="text-yellow-400 mt-0.5 shrink-0" />You have 30 minutes to accept or decline the offer before it moves to the next person</div>
                <div className="flex items-start gap-2"><Bell size={14} className="text-cyan-400 mt-0.5 shrink-0" />Enable push notifications to never miss an offer</div>
                <div className="flex items-start gap-2"><Info size={14} className="text-blue-400 mt-0.5 shrink-0" />You can be on up to 3 waitlists simultaneously</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reserve Modal */}
      {showReserveModal && selectedZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowReserveModal(null)}>
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><Car size={18} className="text-cyan-400" />Reserve Spot</h3>
              <button onClick={() => setShowReserveModal(null)}><XCircle size={20} className="text-gray-400 hover:text-white transition" /></button>
            </div>
            <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
              <div className="text-sm text-gray-400">Spot</div>
              <div className="text-white font-mono font-bold text-lg">{showReserveModal.spotNumber}</div>
              <div className="text-xs text-gray-500 mt-1">{selectedZone.name} · Level {showReserveModal.level}</div>
              <div className="flex gap-2 mt-2">
                {showReserveModal.evCharger && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">⚡ EV Charger</span>}
                {showReserveModal.handiCapAccessible && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">♿ Accessible</span>}
                {showReserveModal.temperature && <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full"><Thermometer size={8} className="inline" /> {showReserveModal.temperature}°C</span>}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date</label>
                <input type="date" value={reserveDate} onChange={(e) => setReserveDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                  <input type="time" value={reserveTime.start} onChange={(e) => setReserveTime((p) => ({ ...p, start: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">End Time</label>
                  <input type="time" value={reserveTime.end} onChange={(e) => setReserveTime((p) => ({ ...p, end: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Vehicle Plate</label>
                <input type="text" value={reserveVehicle} onChange={(e) => setReserveVehicle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-cyan-400" />
              </div>
              <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-400">Estimated Cost</span>
                <span className="text-white font-bold">
                  {PERMITS.find((p) => p.status === "active")?.type ? "Covered by permit" : formatCurrency(selectedZone.hourlyRate * 6)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowReserveModal(null)} className="flex-1 bg-white/5 text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition border border-white/10">Cancel</button>
              <button onClick={confirmReservation} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition">Confirm Reservation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Simple icon wrappers for unused Lucide icons */
function Grid({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>; }
function ListIcon({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>; }
function PieIcon({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>; }
function Leaf({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 20 .5 20 .5s-1 4.5-3.5 8.5C14 15 12 17 11 20Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>; }
