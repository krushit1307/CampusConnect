import { useState, useMemo } from "react";
import {
  Car, MapPin, Clock, TrendingUp, Search, Filter, CheckCircle,
  AlertTriangle, Navigation, Zap, BarChart3, Users, DollarSign,
  Calendar, ChevronRight, Star, Wifi, WifiOff, Eye, Layers,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────
type SpotStatus = "available" | "occupied" | "reserved" | "maintenance";
type ZoneType = "general" | "premium" | "accessible" | "ev-charging" | "visitor" | "faculty";
type VehicleType = "compact" | "sedan" | "suv" | "motorcycle" | "ev";
type PermitType = "student" | "faculty" | "staff" | "visitor";

interface ParkingSpot {
  id: string;
  zoneId: string;
  number: string;
  status: SpotStatus;
  type: ZoneType;
  vehicleCompat: VehicleType[];
  lat: number;
  lng: number;
  level: number;
  sensorActive: boolean;
  lastUpdated: string;
  occupancyMinutes: number;
}

interface ParkingZone {
  id: string;
  name: string;
  type: ZoneType;
  totalSpots: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  hourlyRate: number;
  permitRequired: PermitType[];
  openHours: string;
  evPorts: number;
  evAvailable: number;
  color: string;
  icon: string;
}

interface ParkingReservation {
  id: string;
  spotId: string;
  zoneId: string;
  spotNumber: string;
  zoneName: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  startTime: string;
  endTime: string;
  duration: number;
  cost: number;
  status: "active" | "upcoming" | "completed" | "cancelled";
}

interface ParkingAnalytics {
  totalSpaces: number;
  currentOccupancy: number;
  peakHour: string;
  avgDuration: string;
  dailyRevenue: number;
  monthlyRevenue: number;
  utilizationRate: number;
  evUsage: number;
  accessibilityUsage: number;
  topZones: { name: string; usage: number }[];
  hourlyTrend: { hour: string; occupancy: number }[];
  weeklyTrend: { day: string; occupancy: number }[];
}

interface ParkingIncident {
  id: string;
  type: "expired" | "unauthorized" | "blocking" | "damage" | "safety";
  spotId: string;
  zoneName: string;
  reportedAt: string;
  status: "open" | "investigating" | "resolved";
  description: string;
}

// ─── Data ───────────────────────────────────────────────────────────────────────
const ZONE_COLORS: Record<ZoneType, string> = {
  general: "#3b82f6",
  premium: "#a855f7",
  accessible: "#22c55e",
  "ev-charging": "#10b981",
  visitor: "#f59e0b",
  faculty: "#ef4444",
};

const ZONE_ICONS: Record<ZoneType, string> = {
  general: "🅿️",
  premium: "⭐",
  accessible: "♿",
  "ev-charging": "⚡",
  visitor: "🚗",
  faculty: "🏫",
};

const STATUS_COLORS: Record<SpotStatus, string> = {
  available: "#22c55e",
  occupied: "#ef4444",
  reserved: "#f59e0b",
  maintenance: "#6b7280",
};

const VEHICLE_ICONS: Record<VehicleType, string> = {
  compact: "🚗",
  sedan: "🚙",
  suv: "🚐",
  motorcycle: "🏍️",
  ev: "🔋",
};

const zones: ParkingZone[] = [
  { id: "z1", name: "North Lot", type: "general", totalSpots: 120, available: 34, occupied: 78, reserved: 5, maintenance: 3, hourlyRate: 2, permitRequired: ["student", "faculty", "staff"], openHours: "24/7", evPorts: 0, evAvailable: 0, color: "#3b82f6", icon: "🅿️" },
  { id: "z2", name: "South Garage", type: "general", totalSpots: 200, available: 67, occupied: 118, reserved: 10, maintenance: 5, hourlyRate: 3, permitRequired: ["student", "faculty", "staff"], openHours: "6AM-12AM", evPorts: 8, evAvailable: 3, color: "#3b82f6", icon: "🅿️" },
  { id: "z3", name: "Premium Deck", type: "premium", totalSpots: 80, available: 22, occupied: 52, reserved: 5, maintenance: 1, hourlyRate: 5, permitRequired: ["faculty", "staff"], openHours: "24/7", evPorts: 0, evAvailable: 0, color: "#a855f7", icon: "⭐" },
  { id: "z4", name: "Accessible Lot", type: "accessible", totalSpots: 30, available: 12, occupied: 15, reserved: 2, maintenance: 1, hourlyRate: 0, permitRequired: ["student", "faculty", "staff", "visitor"], openHours: "24/7", evPorts: 0, evAvailable: 0, color: "#22c55e", icon: "♿" },
  { id: "z5", name: "EV Charging Hub", type: "ev-charging", totalSpots: 24, available: 8, occupied: 14, reserved: 2, maintenance: 0, hourlyRate: 4, permitRequired: ["student", "faculty", "staff"], openHours: "24/7", evPorts: 24, evAvailable: 8, color: "#10b981", icon: "⚡" },
  { id: "z6", name: "Visitor Lot", type: "visitor", totalSpots: 40, available: 18, occupied: 19, reserved: 2, maintenance: 1, hourlyRate: 6, permitRequired: ["visitor"], openHours: "7AM-9PM", evPorts: 0, evAvailable: 0, color: "#f59e0b", icon: "🚗" },
  { id: "z7", name: "Faculty Tower", type: "faculty", totalSpots: 60, available: 15, occupied: 40, reserved: 4, maintenance: 1, hourlyRate: 0, permitRequired: ["faculty"], openHours: "24/7", evPorts: 4, evAvailable: 1, color: "#ef4444", icon: "🏫" },
  { id: "z8", name: "West Overflow", type: "general", totalSpots: 150, available: 89, occupied: 55, reserved: 3, maintenance: 3, hourlyRate: 1, permitRequired: ["student"], openHours: "7AM-11PM", evPorts: 0, evAvailable: 0, color: "#3b82f6", icon: "🅿️" },
];

const generateSpots = (zone: ParkingZone): ParkingSpot[] => {
  const spots: ParkingSpot[] = [];
  for (let i = 1; i <= Math.min(zone.totalSpots, 12); i++) {
    const statuses: SpotStatus[] = [];
    for (let a = 0; a < zone.available && a < 3; a++) statuses.push("available");
    for (let b = 0; b < zone.occupied && b < 5; b++) statuses.push("occupied");
    for (let c = 0; c < zone.reserved && c < 2; c++) statuses.push("reserved");
    for (let d = 0; d < zone.maintenance && d < 1; d++) statuses.push("maintenance");
    const status = statuses[i - 1] || "available";
    spots.push({
      id: `${zone.id}-${i}`,
      zoneId: zone.id,
      number: `${zone.name.charAt(0)}${String(i).padStart(3, "0")}`,
      status,
      type: zone.type,
      vehicleCompat: zone.type === "ev-charging" ? ["ev", "sedan", "suv"] : ["compact", "sedan", "suv"],
      lat: 34.0522 + Math.random() * 0.01,
      lng: -118.2437 + Math.random() * 0.01,
      level: zone.type === "general" && zone.name.includes("Garage") ? Math.ceil(i / 4) : 1,
      sensorActive: Math.random() > 0.1,
      lastUpdated: `${Math.floor(Math.random() * 5) + 1}m ago`,
      occupancyMinutes: status === "occupied" ? Math.floor(Math.random() * 180) + 15 : 0,
    });
  }
  return spots;
};

const allSpots = zones.flatMap((z) => generateSpots(z));

const reservations: ParkingReservation[] = [
  { id: "r1", spotId: "z1-3", zoneId: "z1", spotNumber: "N003", zoneName: "North Lot", vehiclePlate: "ABC-1234", vehicleType: "sedan", startTime: "8:00 AM", endTime: "12:00 PM", duration: 4, cost: 8, status: "active" },
  { id: "r2", spotId: "z5-2", zoneId: "z5", spotNumber: "E002", zoneName: "EV Charging Hub", vehiclePlate: "EV-5678", vehicleType: "ev", startTime: "9:00 AM", endTime: "5:00 PM", duration: 8, cost: 32, status: "active" },
  { id: "r3", spotId: "z3-7", zoneId: "z3", spotNumber: "P007", zoneName: "Premium Deck", vehiclePlate: "PRM-9012", vehicleType: "suv", startTime: "2:00 PM", endTime: "6:00 PM", duration: 4, cost: 20, status: "upcoming" },
  { id: "r4", spotId: "z7-5", zoneId: "z7", spotNumber: "F005", zoneName: "Faculty Tower", vehiclePlate: "FAC-3456", vehicleType: "sedan", startTime: "7:30 AM", endTime: "5:30 PM", duration: 10, cost: 0, status: "active" },
  { id: "r5", spotId: "z2-12", zoneId: "z2", spotNumber: "S012", zoneName: "South Garage", vehiclePlate: "STD-7890", vehicleType: "compact", startTime: "10:00 AM", endTime: "2:00 PM", duration: 4, cost: 12, status: "completed" },
];

const analytics: ParkingAnalytics = {
  totalSpaces: 704,
  currentOccupancy: 391,
  peakHour: "10:00 AM - 11:00 AM",
  avgDuration: "3.2 hrs",
  dailyRevenue: 2847,
  monthlyRevenue: 78420,
  utilizationRate: 55.5,
  evUsage: 26,
  accessibilityUsage: 12,
  topZones: [
    { name: "South Garage", usage: 78 },
    { name: "North Lot", usage: 72 },
    { name: "Faculty Tower", usage: 69 },
    { name: "EV Charging Hub", usage: 62 },
    { name: "Visitor Lot", usage: 55 },
  ],
  hourlyTrend: [
    { hour: "6AM", occupancy: 15 }, { hour: "7AM", occupancy: 28 }, { hour: "8AM", occupancy: 52 },
    { hour: "9AM", occupancy: 71 }, { hour: "10AM", occupancy: 85 }, { hour: "11AM", occupancy: 82 },
    { hour: "12PM", occupancy: 74 }, { hour: "1PM", occupancy: 78 }, { hour: "2PM", occupancy: 68 },
    { hour: "3PM", occupancy: 62 }, { hour: "4PM", occupancy: 55 }, { hour: "5PM", occupancy: 42 },
    { hour: "6PM", occupancy: 30 }, { hour: "7PM", occupancy: 22 }, { hour: "8PM", occupancy: 15 },
  ],
  weeklyTrend: [
    { day: "Mon", occupancy: 72 }, { day: "Tue", occupancy: 78 }, { day: "Wed", occupancy: 80 },
    { day: "Thu", occupancy: 75 }, { day: "Fri", occupancy: 65 }, { day: "Sat", occupancy: 35 },
    { day: "Sun", occupancy: 20 },
  ],
};

const incidents: ParkingIncident[] = [
  { id: "i1", type: "expired", spotId: "z1-5", zoneName: "North Lot", reportedAt: "10 min ago", status: "open", description: "Meter expired — 15 min overstay" },
  { id: "i2", type: "blocking", spotId: "z4-3", zoneName: "Accessible Lot", reportedAt: "25 min ago", status: "investigating", description: "Vehicle blocking accessible ramp" },
  { id: "i3", type: "unauthorized", spotId: "z7-2", zoneName: "Faculty Tower", reportedAt: "1 hr ago", status: "open", description: "Student vehicle in faculty-only zone" },
  { id: "i4", type: "damage", spotId: "z2-15", zoneName: "South Garage", reportedAt: "2 hrs ago", status: "resolved", description: "Minor fender bender in B2 level" },
  { id: "i5", type: "safety", spotId: "z3-1", zoneName: "Premium Deck", reportedAt: "3 hrs ago", status: "resolved", description: "Oil spill near entrance — cleaned" },
];

// ─── SVG Mini Charts ────────────────────────────────────────────────────────────
const OccupancyRing = ({ value, size = 60, color }: { value: number; size?: number; color: string }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="inline-block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size * 0.22} fontWeight="bold">{value}%</text>
    </svg>
  );
};

const TrendLine = ({ data, width = 200, height = 60, color = "#3b82f6" }: { data: number[]; width?: number; height?: number; color?: string }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4)}`).join(" ");
  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#grad-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
};

const BarChart = ({ data, width = 240, height = 80, color = "#3b82f6" }: { data: { label: string; value: number }[]; width?: number; height?: number; color?: string }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = (width - 20) / data.length;
  return (
    <svg width={width} height={height + 16} className="inline-block">
      {data.map((d, i) => (
        <g key={i}>
          <rect x={10 + i * barW + 2} y={height - (d.value / max) * (height - 8)} width={barW - 4}
            height={(d.value / max) * (height - 8)} rx={2} fill={color} opacity={0.8} />
          <text x={10 + i * barW + barW / 2} y={height + 14} textAnchor="middle" fill="#94a3b8" fontSize={8}>
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Cards ──────────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color = "#3b82f6" }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col gap-1 hover:border-white/20 transition-all">
    <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider">
      <span style={{ color }}>{icon}</span>{label}
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {sub && <div className="text-xs text-gray-500">{sub}</div>}
  </div>
);

const ZoneCard = ({ zone, onClick }: { zone: ParkingZone; onClick: () => void }) => {
  const pct = Math.round(((zone.occupied + zone.reserved) / zone.totalSpots) * 100);
  const availPct = zone.available;
  return (
    <button onClick={onClick} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 text-left hover:border-white/30 transition-all w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{zone.icon}</span>
          <div>
            <div className="text-white font-semibold text-sm">{zone.name}</div>
            <div className="text-gray-500 text-xs capitalize">{zone.type.replace("-", " ")}</div>
          </div>
        </div>
        <OccupancyRing value={pct} size={48} color={pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#22c55e"} />
      </div>
      <div className="grid grid-cols-4 gap-1 mb-2">
        {[
          { l: "Open", v: zone.available, c: "#22c55e" },
          { l: "Used", v: zone.occupied, c: "#ef4444" },
          { l: "Held", v: zone.reserved, c: "#f59e0b" },
          { l: "Maint", v: zone.maintenance, c: "#6b7280" },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-xs" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[10px] text-gray-600">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
        <div className="h-full rounded-full" style={{ width: `${(zone.occupied / zone.totalSpots) * 100}%`, background: "#ef4444" }} />
        <div className="h-full rounded-full" style={{ width: `${(zone.reserved / zone.totalSpots) * 100}%`, background: "#f59e0b" }} />
        <div className="h-full rounded-full" style={{ width: `${(zone.maintenance / zone.totalSpots) * 100}%`, background: "#6b7280" }} />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>{zone.hourlyRate > 0 ? `$${zone.hourlyRate}/hr` : "Free"}</span>
        <span>{zone.openHours}</span>
        {zone.evPorts > 0 && <span>⚡ {zone.evAvailable}/{zone.evPorts}</span>}
      </div>
    </button>
  );
};

const SpotCard = ({ spot }: { spot: ParkingSpot }) => (
  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-3 flex items-center gap-3 hover:border-white/20 transition-all">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: STATUS_COLORS[spot.status] + "22" }}>
      <div className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[spot.status] }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-white font-semibold text-sm">{spot.number}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: STATUS_COLORS[spot.status] + "22", color: STATUS_COLORS[spot.status] }}>{spot.status}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        {spot.level > 1 && `Level ${spot.level} · `}Updated {spot.lastUpdated}
        {spot.occupancyMinutes > 0 && ` · ${spot.occupancyMinutes}m`}
      </div>
    </div>
    <div className="flex gap-1">
      {spot.vehicleCompat.map((v) => <span key={v} className="text-xs">{VEHICLE_ICONS[v]}</span>)}
    </div>
    <div className="flex items-center gap-1">
      {spot.sensorActive
        ? <Wifi size={12} className="text-green-400" />
        : <WifiOff size={12} className="text-gray-600" />}
    </div>
  </div>
);

const ReservationCard = ({ res }: { res: ParkingReservation }) => {
  const statusColors: Record<string, string> = { active: "#22c55e", upcoming: "#3b82f6", completed: "#6b7280", cancelled: "#ef4444" };
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{VEHICLE_ICONS[res.vehicleType]}</span>
          <div>
            <div className="text-white font-semibold text-sm">{res.spotNumber} · {res.zoneName}</div>
            <div className="text-gray-500 text-xs">{res.vehiclePlate}</div>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full capitalize font-medium" style={{ background: statusColors[res.status] + "22", color: statusColors[res.status] }}>{res.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><span className="text-gray-600">Start</span><div className="text-gray-300">{res.startTime}</div></div>
        <div><span className="text-gray-600">End</span><div className="text-gray-300">{res.endTime}</div></div>
        <div><span className="text-gray-600">Cost</span><div className="text-white font-semibold">{res.cost > 0 ? `$${res.cost.toFixed(2)}` : "Free"}</div></div>
      </div>
    </div>
  );
};

const IncidentCard = ({ incident }: { incident: ParkingIncident }) => {
  const typeColors: Record<string, string> = { expired: "#f59e0b", unauthorized: "#ef4444", blocking: "#ef4444", damage: "#a855f7", safety: "#3b82f6" };
  const statusColors: Record<string, string> = { open: "#ef4444", investigating: "#f59e0b", resolved: "#22c55e" };
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-3 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} style={{ color: typeColors[incident.type] }} />
          <span className="text-white text-sm font-medium capitalize">{incident.type}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: statusColors[incident.status] + "22", color: statusColors[incident.status] }}>{incident.status}</span>
      </div>
      <div className="text-xs text-gray-400 mb-1">{incident.description}</div>
      <div className="flex items-center justify-between text-[10px] text-gray-600">
        <span>{incident.zoneName} · {incident.spotId}</span>
        <span>{incident.reportedAt}</span>
      </div>
    </div>
  );
};

// ─── Campus Map (SVG) ──────────────────────────────────────────────────────────
const CampusParkingMap = ({ zones, selectedZone, onSelectZone }: { zones: ParkingZone[]; selectedZone: string | null; onSelectZone: (id: string) => void }) => {
  const zonePositions: Record<string, { x: number; y: number; w: number; h: number }> = {
    z1: { x: 40, y: 30, w: 100, h: 60 },
    z2: { x: 160, y: 30, w: 120, h: 80 },
    z3: { x: 300, y: 30, w: 90, h: 50 },
    z4: { x: 40, y: 110, w: 70, h: 50 },
    z5: { x: 130, y: 130, w: 80, h: 50 },
    z6: { x: 230, y: 130, w: 80, h: 50 },
    z7: { x: 330, y: 100, w: 80, h: 60 },
    z8: { x: 40, y: 180, w: 130, h: 50 },
  };
  return (
    <svg viewBox="0 0 440 260" className="w-full max-w-lg">
      <rect x="0" y="0" width="440" height="260" rx="12" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
      {/* Roads */}
      <line x1="0" y1="105" x2="440" y2="105" stroke="#1e293b" strokeWidth="2" strokeDasharray="4,4" />
      <line x1="220" y1="0" x2="220" y2="260" stroke="#1e293b" strokeWidth="2" strokeDasharray="4,4" />
      <text x="220" y="15" textAnchor="middle" fill="#475569" fontSize="8">N ↑</text>
      {/* Buildings */}
      <rect x="170" y="110" width="40" height="20" rx="3" fill="#1e293b" />
      <text x="190" y="124" textAnchor="middle" fill="#475569" fontSize="6">Building A</text>
      {/* Zones */}
      {zones.map((zone) => {
        const pos = zonePositions[zone.id];
        if (!pos) return null;
        const pct = Math.round(((zone.occupied + zone.reserved) / zone.totalSpots) * 100);
        const fillColor = selectedZone === zone.id ? zone.color + "44" : zone.color + "22";
        const strokeColor = selectedZone === zone.id ? zone.color : zone.color + "66";
        return (
          <g key={zone.id} onClick={() => onSelectZone(zone.id)} className="cursor-pointer">
            <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx={6} fill={fillColor} stroke={strokeColor} strokeWidth={selectedZone === zone.id ? 2 : 1} />
            <text x={pos.x + pos.w / 2} y={pos.y + 16} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{zone.icon} {zone.name}</text>
            <text x={pos.x + pos.w / 2} y={pos.y + 28} textAnchor="middle" fill="#94a3b8" fontSize="7">{zone.available}/{zone.totalSpots} open</text>
            {/* Mini bar */}
            <rect x={pos.x + 8} y={pos.y + pos.h - 12} width={pos.w - 16} height={4} rx={2} fill="#1e293b" />
            <rect x={pos.x + 8} y={pos.y + pos.h - 12} width={(pos.w - 16) * (pct / 100)} height={4} rx={2} fill={pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#22c55e"} />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function CampusParkingSpotFinder() {
  const [activeTab, setActiveTab] = useState<"map" | "zones" | "spots" | "reservations" | "analytics" | "incidents">("map");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SpotStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ZoneType | "all">("all");

  const tabs = [
    { key: "map" as const, label: "Campus Map", icon: <MapPin size={14} /> },
    { key: "zones" as const, label: "Zones", icon: <Layers size={14} /> },
    { key: "spots" as const, label: "Spots", icon: <Car size={14} /> },
    { key: "reservations" as const, label: "Reservations", icon: <Calendar size={14} /> },
    { key: "analytics" as const, label: "Analytics", icon: <BarChart3 size={14} /> },
    { key: "incidents" as const, label: "Incidents", icon: <AlertTriangle size={14} /> },
  ];

  const filteredSpots = useMemo(() => {
    let spots = allSpots;
    if (selectedZone) spots = spots.filter((s) => s.zoneId === selectedZone);
    if (statusFilter !== "all") spots = spots.filter((s) => s.status === statusFilter);
    if (typeFilter !== "all") spots = spots.filter((s) => s.type === typeFilter);
    if (searchQuery) spots = spots.filter((s) => s.number.toLowerCase().includes(searchQuery.toLowerCase()));
    return spots;
  }, [selectedZone, statusFilter, typeFilter, searchQuery]);

  const selectedZoneData = zones.find((z) => z.id === selectedZone);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Car size={22} className="text-blue-400" />
          </div>
          Campus Parking Finder
        </h1>
        <p className="text-gray-500 text-sm mt-1">Real-time availability · Reservations · Analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={<Car size={16} />} label="Total Spaces" value={analytics.totalSpaces} sub="Across 8 zones" color="#3b82f6" />
        <StatCard icon={<CheckCircle size={16} />} label="Available" value={zones.reduce((a, z) => a + z.available, 0)} sub="Right now" color="#22c55e" />
        <StatCard icon={<TrendingUp size={16} />} label="Utilization" value={`${analytics.utilizationRate}%`} sub={analytics.peakHour} color="#a855f7" />
        <StatCard icon={<Clock size={16} />} label="Avg Duration" value={analytics.avgDuration} sub="Per visit" color="#f59e0b" />
        <StatCard icon={<DollarSign size={16} />} label="Daily Revenue" value={`$${analytics.dailyRevenue.toLocaleString()}`} sub={`$${analytics.monthlyRevenue.toLocaleString()}/mo`} color="#10b981" />
        <StatCard icon={<Zap size={16} />} label="EV Stations" value={`${analytics.evUsage}%`} sub="Of EV spots used" color="#22c55e" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === t.key ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Campus Parking Overview</h3>
            <CampusParkingMap zones={zones} selectedZone={selectedZone} onSelectZone={setSelectedZone} />
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />{status}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-sm">
              {selectedZoneData ? `${selectedZoneData.icon} ${selectedZoneData.name}` : "Select a Zone"}
            </h3>
            {selectedZoneData ? (
              <>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <OccupancyRing value={Math.round(((selectedZoneData.occupied + selectedZoneData.reserved) / selectedZoneData.totalSpots) * 100)} size={80} color={selectedZoneData.color} />
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-gray-400"><span>Total Spots</span><span className="text-white font-semibold">{selectedZoneData.totalSpots}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Available</span><span className="text-green-400 font-semibold">{selectedZoneData.available}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Hourly Rate</span><span className="text-white">{selectedZoneData.hourlyRate > 0 ? `$${selectedZoneData.hourlyRate}` : "Free"}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Hours</span><span className="text-white">{selectedZoneData.openHours}</span></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allSpots.filter((s) => s.zoneId === selectedZone).map((spot) => (
                    <SpotCard key={spot.id} spot={spot} />
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 text-center text-gray-500 text-sm">
                Click a zone on the map to see details
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "zones" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {zones.map((zone) => (
            <ZoneCard key={zone.id} zone={zone} onClick={() => { setSelectedZone(zone.id); setActiveTab("spots"); }} />
          ))}
        </div>
      )}

      {activeTab === "spots" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                placeholder="Search spot number..." />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              <option value="all">All Types</option>
              {Object.keys(ZONE_COLORS).map((t) => <option key={t} value={t}>{t.replace("-", " ")}</option>)}
            </select>
            {selectedZone && (
              <button onClick={() => setSelectedZone(null)} className="text-xs text-blue-400 hover:text-blue-300">Clear zone</button>
            )}
          </div>
          <div className="text-xs text-gray-500">{filteredSpots.length} spots found</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSpots.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
          </div>
        </div>
      )}

      {activeTab === "reservations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{reservations.length} reservations</div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-all">
              <Car size={12} />New Reservation
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reservations.map((res) => <ReservationCard key={res.id} res={res} />)}
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Hourly Occupancy Trend</h3>
            <BarChart data={analytics.hourlyTrend.map((h) => ({ label: h.hour, value: h.occupancy }))} width={400} height={120} color="#3b82f6" />
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Weekly Pattern</h3>
            <BarChart data={analytics.weeklyTrend.map((w) => ({ label: w.day, value: w.occupancy }))} width={300} height={120} color="#a855f7" />
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Zone Usage Ranking</h3>
            <div className="space-y-2">
              {analytics.topZones.map((z, i) => (
                <div key={z.name} className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                  <span className="text-white text-xs flex-1">{z.name}</span>
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${z.usage}%` }} />
                  </div>
                  <span className="text-gray-400 text-xs w-8 text-right">{z.usage}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Revenue Insights</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Daily Revenue", value: `$${analytics.dailyRevenue.toLocaleString()}`, color: "#22c55e" },
                { label: "Monthly Revenue", value: `$${analytics.monthlyRevenue.toLocaleString()}`, color: "#3b82f6" },
                { label: "EV Usage", value: `${analytics.evUsage}%`, color: "#10b981" },
                { label: "Accessible Usage", value: `${analytics.accessibilityUsage}%`, color: "#a855f7" },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{incidents.filter((i) => i.status !== "resolved").length} active incidents</div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all">
              <AlertTriangle size={12} />Report Incident
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incidents.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
          </div>
        </div>
      )}
    </div>
  );
}
