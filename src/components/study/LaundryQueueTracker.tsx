import React, { useState } from "react";
import {
  Droplets,
  Clock,
  Bell,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  Star,
  MapPin,
  Calendar,
  Zap,
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  BarChart3,
  Award,
  Layers,
  CircleDot,
  AlertTriangle,
  Sparkles,
  Send,
  Timer,
  Thermometer,
  Circle,
} from "lucide-react";
import {
  useLaundryQueue,
  ZONES,
  MACHINE_STATUS_MAP,
  CYCLE_SIZE_MAP,
  PRIORITY_MAP,
} from "@/hooks/useLaundryQueue";
import type {
  LaundryRoom,
  LaundryMachine,
  DormZone,
  MachineType,
  MachineStatus,
  CycleSize,
  QueuePriority,
  LaundrySortOption,
  LaundryViewMode,
} from "@/hooks/useLaundryQueue";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  unit,
  color,
  bgColor,
  borderColor,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progress?: number;
}) {
  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-2xl p-4 transition-all hover:scale-[1.02] duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
        <span className="text-[10px] font-mono text-slate-500">{unit}</span>
      </div>
      {progress !== undefined && (
        <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onSelect }: { room: LaundryRoom; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const zone = ZONES[room.zone];
  const totalMachines = room.totalWashers + room.totalDryers;
  const availableTotal = room.availableWashers + room.availableDryers;
  const pctAvailable = totalMachines > 0 ? Math.round((availableTotal / totalMachines) * 100) : 0;

  return (
    <div
      className={`rounded-2xl border transition-all cursor-pointer ${
        room.isOpen
          ? "bg-slate-900/60 border-slate-800/60 hover:border-slate-700"
          : "bg-slate-900/30 border-slate-800/30 opacity-70"
      }`}
      onClick={() => onSelect(room.id)}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${zone.bg} ${zone.color} ${zone.border}`}
            >
              {zone.icon} {zone.label}
            </span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${room.isOpen ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
            >
              {room.isOpen ? "Open" : "Closed"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-400">{room.rating}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-100 mb-1">{room.name}</h3>
        <p className="text-[11px] text-slate-500 mb-3 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {room.dorm} • Floor {room.floor}
        </p>

        {/* Machine Availability */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-slate-500">Washers</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono text-blue-400">
                {room.availableWashers}
              </span>
              <span className="text-[10px] font-mono text-slate-500">/ {room.totalWashers}</span>
            </div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-slate-500">Dryers</span>
              <Thermometer className="w-3 h-3 text-orange-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono text-orange-400">
                {room.availableDryers}
              </span>
              <span className="text-[10px] font-mono text-slate-500">/ {room.totalDryers}</span>
            </div>
          </div>
        </div>

        {/* Overall Availability Bar */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-slate-500">Overall Availability</span>
            <span className="text-[10px] font-mono text-slate-400">
              {availableTotal}/{totalMachines}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pctAvailable >= 50
                  ? "bg-emerald-500"
                  : pctAvailable >= 20
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${pctAvailable}%` }}
            />
          </div>
        </div>

        {/* Wait Time + Hours */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" /> ~{room.waitTimeEstimate} min wait
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {room.openTime}–{room.closeTime}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {room.amenities.slice(0, 3).map((a) => (
              <span
                key={a}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500 capitalize"
              >
                {a.replace("-", " ")}
              </span>
            ))}
            {room.amenities.length > 3 && (
              <span className="text-[8px] font-mono text-slate-600">
                +{room.amenities.length - 3}
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less" : "Details"}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800/40 pt-4 space-y-3">
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
              All Amenities
            </span>
            <div className="flex flex-wrap gap-1.5">
              {room.amenities.map((a) => (
                <span
                  key={a}
                  className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 capitalize"
                >
                  {a.replace("-", " ")}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400" /> {room.rating} ({room.totalRatings}{" "}
              ratings)
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {room.totalWashers + room.totalDryers} machines
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MachineGrid({ machines, roomName }: { machines: LaundryMachine[]; roomName: string }) {
  const washers = machines.filter((m) => m.type === "washer");
  const dryers = machines.filter((m) => m.type === "dryer");

  const renderMachineRow = (
    label: string,
    icon: React.ReactNode,
    machineList: LaundryMachine[],
  ) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          ({machineList.filter((m) => m.status === "available").length} available)
        </span>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {machineList.map((machine) => {
          const statusInfo = MACHINE_STATUS_MAP[machine.status];
          return (
            <div
              key={machine.id}
              className={`rounded-xl border p-2.5 text-center transition-all hover:scale-[1.03] ${statusInfo.bg} ${statusInfo.color.replace("text-", "border-")}/30`}
            >
              <div className="text-lg mb-1">{statusInfo.icon}</div>
              <span className="text-[10px] font-mono font-bold block">#{machine.number}</span>
              <span className="text-[8px] font-mono block capitalize">{machine.cycleSize}</span>
              {machine.remainingMinutes !== undefined && machine.remainingMinutes > 0 && (
                <span className="text-[8px] font-mono block mt-0.5 text-amber-400">
                  {machine.remainingMinutes}m left
                </span>
              )}
              <span className={`text-[8px] font-mono block mt-0.5 ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderMachineRow("Washers", <Droplets className="w-4 h-4 text-blue-400" />, washers)}
      {renderMachineRow("Dryers", <Thermometer className="w-4 h-4 text-orange-400" />, dryers)}
    </div>
  );
}

function RoomDetailModal({
  room,
  machines,
  queue,
  onClose,
  onJoinQueue,
  onRate,
}: {
  room: LaundryRoom;
  machines: LaundryMachine[];
  queue: {
    id: string;
    roomId: string;
    machineType: MachineType;
    userName: string;
    position: number;
    status: string;
    cycleSize: CycleSize;
  }[];
  onClose: () => void;
  onJoinQueue: (
    roomId: string,
    machineType: MachineType,
    cycleSize: CycleSize,
    priority: QueuePriority,
  ) => void;
  onRate: (roomId: string, rating: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"machines" | "queue" | "info">("machines");
  const [joinMachineType, setJoinMachineType] = useState<MachineType>("washer");
  const [joinCycleSize, setJoinCycleSize] = useState<CycleSize>("medium");
  const [joinPriority, setJoinPriority] = useState<QueuePriority>("normal");
  const [userRating, setUserRating] = useState(0);

  const zone = ZONES[room.zone];
  const roomQueue = queue.filter((q) => q.roomId === room.id && q.status !== "cancelled");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${zone.bg} ${zone.color} ${zone.border}`}
                >
                  {zone.icon} {zone.label}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${room.isOpen ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
                >
                  {room.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1">{room.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-3 h-3" /> {room.dorm} • Floor {room.floor}
              <span className="text-slate-500">•</span>
              <Clock className="w-3 h-3" /> {room.openTime}–{room.closeTime}
              <span className="text-slate-500">•</span>
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {room.rating}
            </div>

            {/* Rate */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">Rate:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => {
                    setUserRating(star);
                    onRate(room.id, star);
                  }}
                >
                  <Star
                    className={`w-4 h-4 transition ${star <= userRating ? "text-amber-400 fill-amber-400" : "text-slate-600 hover:text-slate-400"}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800">
          {[
            {
              key: "machines" as const,
              label: "Machines",
              icon: <Droplets className="w-3.5 h-3.5" />,
            },
            { key: "queue" as const, label: "Queue", icon: <Users className="w-3.5 h-3.5" /> },
            { key: "info" as const, label: "Info", icon: <MapPin className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition ${
                activeTab === key
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {activeTab === "machines" && <MachineGrid machines={machines} roomName={room.name} />}
          {activeTab === "queue" && (
            <div className="space-y-2">
              {roomQueue.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No one in queue right now.</p>
                </div>
              ) : (
                roomQueue.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-4 py-3 border border-slate-800/40"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                      {entry.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-200">{entry.userName}</span>
                      <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                        {entry.machineType === "washer" ? "🫧" : "🔥"}{" "}
                        {CYCLE_SIZE_MAP[entry.cycleSize].label} Cycle •{" "}
                        {CYCLE_SIZE_MAP[entry.cycleSize].duration} min
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${PRIORITY_MAP[entry.priority].color} bg-slate-800`}
                    >
                      {PRIORITY_MAP[entry.priority].icon} {PRIORITY_MAP[entry.priority].label}
                    </span>
                    <span
                      className={`text-[9px] font-mono ${entry.status === "using-machine" ? "text-amber-400" : entry.status === "next" ? "text-cyan-400" : "text-slate-500"}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
          {activeTab === "info" && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                  Amenities
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {room.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 capitalize"
                    >
                      {a.replace("-", " ")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/40">
                  <span className="text-[10px] font-mono text-slate-500 block mb-1">Pricing</span>
                  <div className="space-y-1">
                    {Object.entries(CYCLE_SIZE_MAP).map(([key, info]) => (
                      <div key={key} className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{info.label}</span>
                        <span className="text-slate-300">
                          ${info.cost.toFixed(2)} • {info.duration} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/40">
                  <span className="text-[10px] font-mono text-slate-500 block mb-1">
                    Statistics
                  </span>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Rating</span>
                      <span className="text-slate-300">
                        {room.rating} ⭐ ({room.totalRatings})
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Total Machines</span>
                      <span className="text-slate-300">{room.totalWashers + room.totalDryers}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Avg Wait</span>
                      <span className="text-slate-300">{room.waitTimeEstimate} min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Join Queue */}
        {room.isOpen && (
          <div className="p-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={joinMachineType}
                onChange={(e) => setJoinMachineType(e.target.value as MachineType)}
                className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="washer">🫧 Washer</option>
                <option value="dryer">🔥 Dryer</option>
              </select>
              <select
                value={joinCycleSize}
                onChange={(e) => setJoinCycleSize(e.target.value as CycleSize)}
                className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {Object.entries(CYCLE_SIZE_MAP).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label} ({info.duration}m / ${info.cost.toFixed(2)})
                  </option>
                ))}
              </select>
              <select
                value={joinPriority}
                onChange={(e) => setJoinPriority(e.target.value as QueuePriority)}
                className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {Object.entries(PRIORITY_MAP).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onJoinQueue(room.id, joinMachineType, joinCycleSize, joinPriority)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-500/20"
              >
                Join Queue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PeakHoursChart({ data }: { data: { hour: string; load: number }[] }) {
  const maxLoad = Math.max(...data.map((d) => d.load), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={`w-full rounded-t transition-all ${
              d.load >= 70 ? "bg-red-500" : d.load >= 40 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ height: `${(d.load / maxLoad) * 100}%`, minHeight: "4px" }}
          />
          {i % 3 === 0 && (
            <span className="text-[7px] font-mono text-slate-600 truncate w-full text-center">
              {d.hour}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LaundryQueueTracker() {
  const {
    rooms,
    machines,
    queue,
    notifications,
    usageLogs,
    stats,
    selectedRoomId,
    setSelectedRoomId,
    zoneFilter,
    setZoneFilter,
    machineTypeFilter,
    setMachineTypeFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    joinQueue,
    leaveQueue,
    markNotificationRead,
    clearNotifications,
    rateRoom,
    getRoomMachines,
    getPeakHours,
    getRecommendations,
  } = useLaundryQueue();

  const [activeTab, setActiveTab] = useState<"rooms" | "my-queue" | "history" | "analytics">(
    "rooms",
  );
  const [showNotifications, setShowNotifications] = useState(false);

  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : null;
  const selectedRoomMachines = selectedRoomId ? getRoomMachines(selectedRoomId) : [];
  const myQueue = queue.filter((q) => q.userId === "u-self");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const recommended = getRecommendations();
  const peakHours = getPeakHours();

  const filteredRooms = rooms
    .filter((r) => zoneFilter === "all" || r.zone === zoneFilter)
    .filter((r) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.dorm.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return a.zone.localeCompare(b.zone);
        case "availability":
          return b.availableWashers + b.availableDryers - (a.availableWashers + a.availableDryers);
        case "rating":
          return b.rating - a.rating;
        case "wait-time":
        default:
          return a.waitTimeEstimate - b.waitTimeEstimate;
      }
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-900/50 via-cyan-900/40 to-slate-900 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5" /> Laundry Tracker
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
              Campus Laundry Queue
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Never wait for laundry again. Check machine availability, join queues, get notified
              when cycles finish, and track your laundry history.
            </p>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-3 bg-slate-800/80 border border-slate-700 rounded-xl hover:bg-slate-700 transition"
            >
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-14 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Notifications</span>
                  <button
                    onClick={clearNotifications}
                    className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`p-3 border-b border-slate-800/50 cursor-pointer transition ${
                        n.read ? "opacity-50" : "bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm shrink-0">
                          {n.type === "cycle-done"
                            ? "🔔"
                            : n.type === "machine-open"
                              ? "✅"
                              : n.type === "queue-turn"
                                ? "⏭️"
                                : n.type === "reminder"
                                  ? "⏰"
                                  : "🔧"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[11px] font-bold text-slate-200">{n.title}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{n.message}</p>
                          <span className="text-[8px] font-mono text-slate-600 mt-1 block">
                            {new Date(n.timestamp).toLocaleString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {[
              { key: "rooms" as const, label: "Find Rooms", icon: <MapPin className="w-4 h-4" /> },
              { key: "my-queue" as const, label: "My Queue", icon: <Timer className="w-4 h-4" /> },
              { key: "history" as const, label: "History", icon: <Calendar className="w-4 h-4" /> },
              {
                key: "analytics" as const,
                label: "Analytics",
                icon: <BarChart3 className="w-4 h-4" />,
              },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                  activeTab === key
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={<Droplets className="w-5 h-5" />}
            label="Total Machines"
            value={rooms.reduce((s, r) => s + r.totalWashers + r.totalDryers, 0).toString()}
            unit="across campus"
            color="text-blue-400"
            bgColor="bg-blue-500/10"
            borderColor="border-blue-500/30"
          />
          <KPICard
            icon={<Zap className="w-5 h-5" />}
            label="Available Now"
            value={rooms.reduce((s, r) => s + r.availableWashers + r.availableDryers, 0).toString()}
            unit="machines"
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
            progress={
              (rooms.reduce((s, r) => s + r.availableWashers + r.availableDryers, 0) /
                Math.max(
                  rooms.reduce((s, r) => s + r.totalWashers + r.totalDryers, 0),
                  1,
                )) *
              100
            }
          />
          <KPICard
            icon={<Timer className="w-5 h-5" />}
            label="Avg Wait"
            value={stats.avgWaitTime.toString()}
            unit="min"
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
          />
          <KPICard
            icon={<Award className="w-5 h-5" />}
            label="Loads Done"
            value={stats.totalLoads.toString()}
            unit="this month"
            color="text-purple-400"
            bgColor="bg-purple-500/10"
            borderColor="border-purple-500/30"
          />
        </div>

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            {/* Search + Filters */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rooms or dorms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setZoneFilter("all")}
                  className={`px-3 py-2 rounded-xl text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                    zoneFilter === "all"
                      ? "bg-slate-700 border-slate-600 text-slate-200"
                      : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  All Zones
                </button>
                {(Object.entries(ZONES) as [DormZone, (typeof ZONES)[DormZone]][]).map(
                  ([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setZoneFilter(key)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                        zoneFilter === key
                          ? `${info.bg} ${info.color} ${info.border}`
                          : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {info.icon} {info.label}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Sort + View */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Sort:</span>
                {(["wait-time", "availability", "rating", "distance"] as LaundrySortOption[]).map(
                  (opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition ${
                        sortBy === opt
                          ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {opt === "wait-time"
                        ? "⏱️ Wait"
                        : opt === "availability"
                          ? "📊 Available"
                          : opt === "rating"
                            ? "⭐ Rating"
                            : "📍 Zone"}
                    </button>
                  ),
                )}
              </div>
              <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-800">
                <button
                  onClick={() => setViewMode("rooms")}
                  className={`p-1 rounded ${viewMode === "rooms" ? "bg-slate-700 text-white" : "text-slate-500"}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("machines")}
                  className={`p-1 rounded ${viewMode === "machines" ? "bg-slate-700 text-white" : "text-slate-500"}`}
                >
                  <CircleDot className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Recommended */}
            {recommended.length > 0 && !searchQuery && zoneFilter === "all" && (
              <div className="bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-mono font-bold text-emerald-300 uppercase tracking-wider">
                    Best Available Now
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {recommended.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className="flex items-center gap-3 bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 hover:border-emerald-500/30 transition text-left"
                    >
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${ZONES[room.zone].bg} border ${ZONES[room.zone].border}`}
                      >
                        {ZONES[room.zone].icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{room.name}</h4>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 mt-0.5">
                          <span className="text-emerald-400">
                            {room.availableWashers + room.availableDryers} available
                          </span>
                          <span>{room.waitTimeEstimate}m wait</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Room Cards */}
            <div
              className={`grid gap-4 ${viewMode === "rooms" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
            >
              {filteredRooms.map((room) => (
                <RoomCard key={room.id} room={room} onSelect={setSelectedRoomId} />
              ))}
            </div>

            {filteredRooms.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <Droplets className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">No laundry rooms found</h3>
                <p className="text-slate-600 text-sm mt-1">Try adjusting your zone filter</p>
              </div>
            )}
          </div>
        )}

        {/* My Queue Tab */}
        {activeTab === "my-queue" && (
          <div className="space-y-5">
            {myQueue.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <Timer className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">No active queue entries</h3>
                <p className="text-slate-600 text-sm mt-1">Find a room and join the queue!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myQueue.map((entry) => {
                  const room = rooms.find((r) => r.id === entry.roomId);
                  const statusColor =
                    entry.status === "using-machine"
                      ? "text-amber-400"
                      : entry.status === "next"
                        ? "text-cyan-400"
                        : "text-slate-400";
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 bg-slate-900/60 rounded-2xl px-5 py-4 border border-slate-800/60"
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl">
                        {entry.machineType === "washer" ? "🫧" : "🔥"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-200">
                          {room?.name || "Unknown Room"}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
                          <span>{CYCLE_SIZE_MAP[entry.cycleSize].label} Cycle</span>
                          <span>{CYCLE_SIZE_MAP[entry.cycleSize].duration} min</span>
                          <span>Position #{entry.position}</span>
                          <span className={statusColor}>• {entry.status}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => leaveQueue(entry.id)}
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-500/20 transition"
                      >
                        Leave
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upcoming completions */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Cycle Completions Nearby
                </h3>
              </div>
              <div className="space-y-2">
                {machines
                  .filter(
                    (m) => m.status === "in-use" && m.remainingMinutes && m.remainingMinutes <= 15,
                  )
                  .slice(0, 5)
                  .map((m) => {
                    const room = rooms.find((r) => r.id === m.roomId);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-3 py-2.5 border border-slate-800/40"
                      >
                        <span className="text-lg">{m.type === "washer" ? "🫧" : "🔥"}</span>
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-200">
                            {room?.name} #{m.number}
                          </span>
                          <span className="text-[9px] font-mono text-cyan-400 ml-2">
                            {m.remainingMinutes}m left
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 capitalize">
                          {m.cycleSize}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-5">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl font-black font-mono text-blue-400 block">
                  {stats.totalLoads}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Total Loads</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl font-black font-mono text-emerald-400 block">
                  ${stats.totalCost.toFixed(2)}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Total Spent</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl font-black font-mono text-amber-400 block">
                  ${stats.totalSavings.toFixed(2)}
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  Saved vs Laundromat
                </span>
              </div>
            </div>

            {/* Log List */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Usage History
                </h3>
              </div>
              <div className="space-y-2">
                {usageLogs.map((log) => {
                  const room = rooms.find((r) => r.id === log.roomId);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-4 py-3 border border-slate-800/40"
                    >
                      <span className="text-lg">{log.machineType === "washer" ? "🫧" : "🔥"}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">
                          {room?.name || "Unknown"}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
                          <span>{log.date}</span>
                          <span className="text-cyan-400">{log.duration} min</span>
                          <span className="text-amber-400">${log.cost.toFixed(2)}</span>
                          <span className="capitalize">{log.cycleSize}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                icon={<Target className="w-5 h-5" />}
                label="Peak Hour"
                value={stats.peakHour}
                unit=""
                color="text-rose-400"
                bgColor="bg-rose-500/10"
                borderColor="border-rose-500/30"
              />
              <KPICard
                icon={<Star className="w-5 h-5" />}
                label="Favorite Room"
                value={
                  stats.favoriteRoom.length > 15
                    ? stats.favoriteRoom.substring(0, 15) + "…"
                    : stats.favoriteRoom
                }
                unit=""
                color="text-amber-400"
                bgColor="bg-amber-500/10"
                borderColor="border-amber-500/30"
              />
              <KPICard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Streak"
                value={stats.streakDays.toString()}
                unit="weeks"
                color="text-emerald-400"
                bgColor="bg-emerald-500/10"
                borderColor="border-emerald-500/30"
              />
              <KPICard
                icon={<Droplets className="w-5 h-5" />}
                label="Preferred"
                value={stats.mostUsedMachineType === "washer" ? "Washers" : "Dryers"}
                unit=""
                color="text-blue-400"
                bgColor="bg-blue-500/10"
                borderColor="border-blue-500/30"
              />
            </div>

            {/* Peak Hours */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Peak Hours (Campus-Wide)
                </h3>
              </div>
              <PeakHoursChart data={peakHours} />
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                  <span className="w-2 h-2 rounded bg-emerald-500" /> Low
                </span>
                <span className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                  <span className="w-2 h-2 rounded bg-amber-500" /> Medium
                </span>
                <span className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                  <span className="w-2 h-2 rounded bg-red-500" /> High
                </span>
              </div>
            </div>

            {/* Room Comparison */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Room Availability Overview
                </h3>
              </div>
              <div className="space-y-3">
                {rooms.map((room) => {
                  const total = room.totalWashers + room.totalDryers;
                  const available = room.availableWashers + room.availableDryers;
                  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
                  return (
                    <div key={room.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span>{ZONES[room.zone].icon}</span> {room.name}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {available}/{total}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 50 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Room Detail Modal */}
      {selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          machines={selectedRoomMachines}
          queue={queue}
          onClose={() => setSelectedRoomId(null)}
          onJoinQueue={joinQueue}
          onRate={rateRoom}
        />
      )}
    </div>
  );
}
