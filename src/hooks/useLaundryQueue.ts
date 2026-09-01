import { useState, useMemo, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MachineType = "washer" | "dryer";
export type MachineStatus = "available" | "in-use" | "done" | "out-of-order";
export type DormZone = "north" | "south" | "east" | "west" | "central";
export type CycleSize = "small" | "medium" | "large";
export type QueuePriority = "normal" | "priority" | "vip";
export type NotificationType =
  "cycle-done" | "machine-open" | "queue-turn" | "reminder" | "maintenance";

export interface LaundryRoom {
  id: string;
  name: string;
  dorm: string;
  zone: DormZone;
  floor: number;
  totalWashers: number;
  totalDryers: number;
  availableWashers: number;
  availableDryers: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  waitTimeEstimate: number; // minutes
  amenities: string[];
  rating: number;
  totalRatings: number;
}

export interface LaundryMachine {
  id: string;
  roomId: string;
  type: MachineType;
  number: number;
  status: MachineStatus;
  cycleSize: CycleSize;
  currentCycleEnd?: string;
  remainingMinutes?: number;
  cyclesCompleted: number;
  lastServiced: string;
  brand: string;
}

export interface LaundryQueueEntry {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  machineType: MachineType;
  priority: QueuePriority;
  cycleSize: CycleSize;
  estimatedDuration: number; // minutes
  joinedAt: string;
  position: number;
  status: "waiting" | "next" | "using-machine" | "completed" | "cancelled";
}

export interface LaundryNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  roomId: string;
  timestamp: string;
  read: boolean;
}

export interface LaundryUsageLog {
  id: string;
  userId: string;
  roomId: string;
  machineId: string;
  machineType: MachineType;
  cycleSize: CycleSize;
  date: string;
  duration: number; // minutes
  cost: number;
}

export interface LaundryStats {
  totalLoads: number;
  totalMinutes: number;
  totalCost: number;
  avgWaitTime: number;
  mostUsedRoom: string;
  mostUsedMachineType: MachineType;
  peakHour: string;
  totalSavings: number; // vs laundromat
  weeklyLoads: number;
  monthlyLoads: number;
  streakDays: number;
  favoriteRoom: string;
}

export type LaundrySortOption = "wait-time" | "distance" | "availability" | "rating";
export type LaundryViewMode = "rooms" | "machines" | "queue";

export interface UseLaundryQueueReturn {
  rooms: LaundryRoom[];
  machines: LaundryMachine[];
  queue: LaundryQueueEntry[];
  notifications: LaundryNotification[];
  usageLogs: LaundryUsageLog[];
  stats: LaundryStats;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  zoneFilter: DormZone | "all";
  setZoneFilter: (z: DormZone | "all") => void;
  machineTypeFilter: MachineType | "all";
  setMachineTypeFilter: (t: MachineType | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: LaundrySortOption;
  setSortBy: (s: LaundrySortOption) => void;
  viewMode: LaundryViewMode;
  setViewMode: (v: LaundryViewMode) => void;
  joinQueue: (
    roomId: string,
    machineType: MachineType,
    cycleSize: CycleSize,
    priority: QueuePriority,
  ) => void;
  leaveQueue: (entryId: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  rateRoom: (roomId: string, rating: number) => void;
  getRoomMachines: (roomId: string) => LaundryMachine[];
  getQueuePosition: (entryId: string) => number;
  getAvailableMachines: (roomId: string, type: MachineType) => LaundryMachine[];
  getUpcomingAvailable: (
    roomId: string,
    type: MachineType,
  ) => { machine: LaundryMachine; availableAt: string }[];
  getPeakHours: () => { hour: string; load: number }[];
  getRecommendations: () => LaundryRoom[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZONES: Record<
  DormZone,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  north: {
    label: "North Campus",
    icon: "🏠",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  south: {
    label: "South Campus",
    icon: "🏡",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  east: {
    label: "East Campus",
    icon: "🏘️",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  west: {
    label: "West Campus",
    icon: "⛩️",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  central: {
    label: "Central Campus",
    icon: "🏛️",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
};

const MACHINE_STATUS_MAP: Record<
  MachineStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  available: { label: "Available", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: "✅" },
  "in-use": { label: "In Use", color: "text-amber-400", bg: "bg-amber-500/10", icon: "⏳" },
  done: { label: "Cycle Done", color: "text-cyan-400", bg: "bg-cyan-500/10", icon: "🔔" },
  "out-of-order": { label: "Out of Order", color: "text-red-400", bg: "bg-red-500/10", icon: "🔧" },
};

const CYCLE_SIZE_MAP: Record<CycleSize, { label: string; duration: number; cost: number }> = {
  small: { label: "Small", duration: 30, cost: 1.5 },
  medium: { label: "Medium", duration: 45, cost: 2.0 },
  large: { label: "Large", duration: 60, cost: 2.5 },
};

const PRIORITY_MAP: Record<QueuePriority, { label: string; color: string; icon: string }> = {
  normal: { label: "Normal", color: "text-slate-400", icon: "👤" },
  priority: { label: "Priority", color: "text-amber-400", icon: "⭐" },
  vip: { label: "VIP", color: "text-purple-400", icon: "👑" },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_ROOMS: LaundryRoom[] = [
  {
    id: "lr-1",
    name: "Foster Hall Laundry",
    dorm: "Foster Hall",
    zone: "north",
    floor: 1,
    totalWashers: 6,
    totalDryers: 6,
    availableWashers: 2,
    availableDryers: 4,
    isOpen: true,
    openTime: "06:00",
    closeTime: "23:00",
    waitTimeEstimate: 15,
    amenities: ["card-pay", "status-screens", "folding-table", "seating"],
    rating: 4.5,
    totalRatings: 48,
  },
  {
    id: "lr-2",
    name: "Thompson Center Laundry",
    dorm: "Thompson Center",
    zone: "south",
    floor: 1,
    totalWashers: 8,
    totalDryers: 8,
    availableWashers: 5,
    availableDryers: 3,
    isOpen: true,
    openTime: "06:00",
    closeTime: "24:00",
    waitTimeEstimate: 8,
    amenities: ["card-pay", "status-screens", "folding-table", "seating", "vending"],
    rating: 4.8,
    totalRatings: 72,
  },
  {
    id: "lr-3",
    name: "Morrison Basement Laundry",
    dorm: "Morrison Hall",
    zone: "east",
    floor: -1,
    totalWashers: 4,
    totalDryers: 4,
    availableWashers: 0,
    availableDryers: 1,
    isOpen: true,
    openTime: "07:00",
    closeTime: "22:00",
    waitTimeEstimate: 35,
    amenities: ["coin-op", "folding-table"],
    rating: 3.2,
    totalRatings: 22,
  },
  {
    id: "lr-4",
    name: "Riverside Commons Laundry",
    dorm: "Riverside Commons",
    zone: "west",
    floor: 1,
    totalWashers: 10,
    totalDryers: 10,
    availableWashers: 7,
    availableDryers: 8,
    isOpen: true,
    openTime: "05:00",
    closeTime: "23:30",
    waitTimeEstimate: 5,
    amenities: ["card-pay", "status-screens", "folding-table", "seating", "wifi", "vending"],
    rating: 4.9,
    totalRatings: 95,
  },
  {
    id: "lr-5",
    name: "Central Hub Laundry",
    dorm: "Student Union",
    zone: "central",
    floor: 0,
    totalWashers: 12,
    totalDryers: 12,
    availableWashers: 4,
    availableDryers: 6,
    isOpen: true,
    openTime: "24/7",
    closeTime: "24/7",
    waitTimeEstimate: 12,
    amenities: ["card-pay", "status-screens", "folding-table", "seating", "wifi", "coffee"],
    rating: 4.7,
    totalRatings: 110,
  },
  {
    id: "lr-6",
    name: "Elm Street Laundry",
    dorm: "Elm Street Dorms",
    zone: "north",
    floor: 1,
    totalWashers: 5,
    totalDryers: 5,
    availableWashers: 3,
    availableDryers: 2,
    isOpen: false,
    openTime: "08:00",
    closeTime: "21:00",
    waitTimeEstimate: 20,
    amenities: ["coin-op", "folding-table"],
    rating: 3.8,
    totalRatings: 31,
  },
  {
    id: "lr-7",
    name: "Westview Tower Laundry",
    dorm: "Westview Tower",
    zone: "west",
    floor: 1,
    totalWashers: 6,
    totalDryers: 6,
    availableWashers: 1,
    availableDryers: 0,
    isOpen: true,
    openTime: "06:00",
    closeTime: "23:00",
    waitTimeEstimate: 45,
    amenities: ["card-pay", "status-screens", "seating"],
    rating: 4.1,
    totalRatings: 55,
  },
  {
    id: "lr-8",
    name: "Southpoint Laundry",
    dorm: "Southpoint Apartments",
    zone: "south",
    floor: 0,
    totalWashers: 4,
    totalDryers: 4,
    availableWashers: 4,
    availableDryers: 3,
    isOpen: true,
    openTime: "06:00",
    closeTime: "22:00",
    waitTimeEstimate: 0,
    amenities: ["card-pay", "folding-table", "seating"],
    rating: 4.3,
    totalRatings: 38,
  },
];

const MOCK_MACHINES: LaundryMachine[] = [
  // Room 1 - Foster Hall
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `m-1w-${i}`,
    roomId: "lr-1",
    type: "washer" as MachineType,
    number: i + 1,
    status:
      i < 2
        ? ("available" as MachineStatus)
        : i < 4
          ? ("in-use" as MachineStatus)
          : i === 4
            ? ("done" as MachineStatus)
            : ("out-of-order" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd:
      i >= 2 && i < 4 ? new Date(Date.now() + (30 - i * 5) * 60000).toISOString() : undefined,
    remainingMinutes: i >= 2 && i < 4 ? 30 - i * 5 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 500) + 50,
    lastServiced: "2026-07-15",
    brand: "Maytag",
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `m-1d-${i}`,
    roomId: "lr-1",
    type: "dryer" as MachineType,
    number: i + 1,
    status: i < 4 ? ("available" as MachineStatus) : ("in-use" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd: i >= 4 ? new Date(Date.now() + 20 * 60000).toISOString() : undefined,
    remainingMinutes: i >= 4 ? 20 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 400) + 30,
    lastServiced: "2026-08-01",
    brand: "Speed Queen",
  })),
  // Room 2 - Thompson Center
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `m-2w-${i}`,
    roomId: "lr-2",
    type: "washer" as MachineType,
    number: i + 1,
    status: i < 5 ? ("available" as MachineStatus) : ("in-use" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd:
      i >= 5 ? new Date(Date.now() + (45 - (i - 5) * 10) * 60000).toISOString() : undefined,
    remainingMinutes: i >= 5 ? 45 - (i - 5) * 10 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 600) + 100,
    lastServiced: "2026-08-10",
    brand: "LG Commercial",
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `m-2d-${i}`,
    roomId: "lr-2",
    type: "dryer" as MachineType,
    number: i + 1,
    status: i < 3 ? ("in-use" as MachineStatus) : ("available" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd: i < 3 ? new Date(Date.now() + (15 + i * 5) * 60000).toISOString() : undefined,
    remainingMinutes: i < 3 ? 15 + i * 5 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 500) + 80,
    lastServiced: "2026-08-05",
    brand: "LG Commercial",
  })),
  // Room 3 - Morrison
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `m-3w-${i}`,
    roomId: "lr-3",
    type: "washer" as MachineType,
    number: i + 1,
    status: "in-use" as MachineStatus,
    cycleSize: (["medium", "large"] as CycleSize[])[i % 2],
    currentCycleEnd: new Date(Date.now() + (20 + i * 15) * 60000).toISOString(),
    remainingMinutes: 20 + i * 15,
    cyclesCompleted: Math.floor(Math.random() * 800) + 200,
    lastServiced: "2026-06-20",
    brand: "Whirlpool",
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `m-3d-${i}`,
    roomId: "lr-3",
    type: "dryer" as MachineType,
    number: i + 1,
    status:
      i === 0
        ? ("available" as MachineStatus)
        : i === 1
          ? ("out-of-order" as MachineStatus)
          : ("in-use" as MachineStatus),
    cycleSize: "medium" as CycleSize,
    currentCycleEnd: i >= 2 ? new Date(Date.now() + 30 * 60000).toISOString() : undefined,
    remainingMinutes: i >= 2 ? 30 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 700) + 150,
    lastServiced: "2026-07-01",
    brand: "Whirlpool",
  })),
  // Room 4 - Riverside
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `m-4w-${i}`,
    roomId: "lr-4",
    type: "washer" as MachineType,
    number: i + 1,
    status: i < 7 ? ("available" as MachineStatus) : ("in-use" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd:
      i >= 7 ? new Date(Date.now() + (15 + (i - 7) * 10) * 60000).toISOString() : undefined,
    remainingMinutes: i >= 7 ? 15 + (i - 7) * 10 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 400) + 60,
    lastServiced: "2026-08-15",
    brand: "Bosch",
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `m-4d-${i}`,
    roomId: "lr-4",
    type: "dryer" as MachineType,
    number: i + 1,
    status: i < 8 ? ("available" as MachineStatus) : ("in-use" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd: i >= 8 ? new Date(Date.now() + 25 * 60000).toISOString() : undefined,
    remainingMinutes: i >= 8 ? 25 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 350) + 40,
    lastServiced: "2026-08-12",
    brand: "Bosch",
  })),
  // Room 5 - Central Hub
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `m-5w-${i}`,
    roomId: "lr-5",
    type: "washer" as MachineType,
    number: i + 1,
    status:
      i < 4
        ? ("in-use" as MachineStatus)
        : i < 8
          ? ("available" as MachineStatus)
          : i === 8
            ? ("done" as MachineStatus)
            : ("available" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd: i < 4 ? new Date(Date.now() + (10 + i * 8) * 60000).toISOString() : undefined,
    remainingMinutes: i < 4 ? 10 + i * 8 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 900) + 150,
    lastServiced: "2026-08-20",
    brand: "Miele",
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `m-5d-${i}`,
    roomId: "lr-5",
    type: "dryer" as MachineType,
    number: i + 1,
    status: i < 6 ? ("available" as MachineStatus) : ("in-use" as MachineStatus),
    cycleSize: (["small", "medium", "large"] as CycleSize[])[i % 3],
    currentCycleEnd:
      i >= 6 ? new Date(Date.now() + (20 + (i - 6) * 5) * 60000).toISOString() : undefined,
    remainingMinutes: i >= 6 ? 20 + (i - 6) * 5 : undefined,
    cyclesCompleted: Math.floor(Math.random() * 800) + 100,
    lastServiced: "2026-08-18",
    brand: "Miele",
  })),
];

const MOCK_QUEUE: LaundryQueueEntry[] = [
  {
    id: "q-1",
    userId: "u-self",
    userName: "You",
    roomId: "lr-1",
    machineType: "washer",
    priority: "normal",
    cycleSize: "medium",
    estimatedDuration: 45,
    joinedAt: "2026-08-28T14:30:00Z",
    position: 2,
    status: "waiting",
  },
  {
    id: "q-2",
    userId: "u-1",
    userName: "Sarah K.",
    roomId: "lr-1",
    machineType: "washer",
    priority: "normal",
    cycleSize: "small",
    estimatedDuration: 30,
    joinedAt: "2026-08-28T14:15:00Z",
    position: 1,
    status: "next",
  },
  {
    id: "q-3",
    userId: "u-2",
    userName: "Mike R.",
    roomId: "lr-2",
    machineType: "washer",
    priority: "priority",
    cycleSize: "large",
    estimatedDuration: 60,
    joinedAt: "2026-08-28T14:00:00Z",
    position: 1,
    status: "using-machine",
  },
  {
    id: "q-4",
    userId: "u-3",
    userName: "Jen L.",
    roomId: "lr-2",
    machineType: "washer",
    priority: "normal",
    cycleSize: "medium",
    estimatedDuration: 45,
    joinedAt: "2026-08-28T14:20:00Z",
    position: 2,
    status: "waiting",
  },
  {
    id: "q-5",
    userId: "u-4",
    userName: "Tom B.",
    roomId: "lr-5",
    machineType: "dryer",
    priority: "normal",
    cycleSize: "large",
    estimatedDuration: 60,
    joinedAt: "2026-08-28T13:50:00Z",
    position: 1,
    status: "waiting",
  },
  {
    id: "q-6",
    userId: "u-5",
    userName: "Priya S.",
    roomId: "lr-5",
    machineType: "washer",
    priority: "vip",
    cycleSize: "small",
    estimatedDuration: 30,
    joinedAt: "2026-08-28T14:35:00Z",
    position: 1,
    status: "waiting",
  },
  {
    id: "q-7",
    userId: "u-6",
    userName: "Alex C.",
    roomId: "lr-4",
    machineType: "washer",
    priority: "normal",
    cycleSize: "medium",
    estimatedDuration: 45,
    joinedAt: "2026-08-28T14:25:00Z",
    position: 1,
    status: "waiting",
  },
];

const MOCK_NOTIFICATIONS: LaundryNotification[] = [
  {
    id: "n-1",
    type: "cycle-done",
    title: "Washer #3 Done!",
    message: "Your cycle at Foster Hall is complete. Pick up within 10 min.",
    roomId: "lr-1",
    timestamp: "2026-08-28T14:25:00Z",
    read: false,
  },
  {
    id: "n-2",
    type: "machine-open",
    title: "Machine Available",
    message: "A washer just opened at Thompson Center. Estimated wait: 5 min.",
    roomId: "lr-2",
    timestamp: "2026-08-28T14:20:00Z",
    read: false,
  },
  {
    id: "n-3",
    type: "queue-turn",
    title: "You're Next!",
    message: "It's almost your turn at Foster Hall. Head over now!",
    roomId: "lr-1",
    timestamp: "2026-08-28T14:18:00Z",
    read: true,
  },
  {
    id: "n-4",
    type: "reminder",
    title: "Laundry Reminder",
    message: "You haven't done laundry in 5 days. Foster Hall has low wait times right now.",
    roomId: "lr-1",
    timestamp: "2026-08-28T12:00:00Z",
    read: true,
  },
  {
    id: "n-5",
    type: "maintenance",
    title: "Maintenance Notice",
    message: "Dryer #2 at Morrison is out of order. Expected repair: 2 days.",
    roomId: "lr-3",
    timestamp: "2026-08-27T09:00:00Z",
    read: false,
  },
];

const MOCK_USAGE_LOGS: LaundryUsageLog[] = [
  {
    id: "ul-1",
    userId: "u-self",
    roomId: "lr-1",
    machineId: "m-1w-2",
    machineType: "washer",
    cycleSize: "medium",
    date: "2026-08-25",
    duration: 42,
    cost: 2.0,
  },
  {
    id: "ul-2",
    userId: "u-self",
    roomId: "lr-5",
    machineId: "m-5w-5",
    machineType: "washer",
    cycleSize: "large",
    date: "2026-08-21",
    duration: 58,
    cost: 2.5,
  },
  {
    id: "ul-3",
    userId: "u-self",
    roomId: "lr-1",
    machineId: "m-1w-1",
    machineType: "washer",
    cycleSize: "small",
    date: "2026-08-18",
    duration: 28,
    cost: 1.5,
  },
  {
    id: "ul-4",
    userId: "u-self",
    roomId: "lr-2",
    machineId: "m-2w-3",
    machineType: "washer",
    cycleSize: "medium",
    date: "2026-08-14",
    duration: 44,
    cost: 2.0,
  },
  {
    id: "ul-5",
    userId: "u-self",
    roomId: "lr-5",
    machineId: "m-5d-8",
    machineType: "dryer",
    cycleSize: "large",
    date: "2026-08-14",
    duration: 55,
    cost: 2.5,
  },
  {
    id: "ul-6",
    userId: "u-self",
    roomId: "lr-4",
    machineId: "m-4w-2",
    machineType: "washer",
    cycleSize: "medium",
    date: "2026-08-10",
    duration: 43,
    cost: 2.0,
  },
  {
    id: "ul-7",
    userId: "u-self",
    roomId: "lr-1",
    machineId: "m-1w-3",
    machineType: "washer",
    cycleSize: "large",
    date: "2026-08-07",
    duration: 62,
    cost: 2.5,
  },
  {
    id: "ul-8",
    userId: "u-self",
    roomId: "lr-5",
    machineId: "m-5w-1",
    machineType: "washer",
    cycleSize: "medium",
    date: "2026-08-03",
    duration: 41,
    cost: 2.0,
  },
  {
    id: "ul-9",
    userId: "u-self",
    roomId: "lr-2",
    machineId: "m-2d-5",
    machineType: "dryer",
    cycleSize: "medium",
    date: "2026-08-03",
    duration: 38,
    cost: 2.0,
  },
  {
    id: "ul-10",
    userId: "u-self",
    roomId: "lr-1",
    machineId: "m-1w-0",
    machineType: "washer",
    cycleSize: "small",
    date: "2026-07-30",
    duration: 29,
    cost: 1.5,
  },
  {
    id: "ul-11",
    userId: "u-self",
    roomId: "lr-5",
    machineId: "m-5w-6",
    machineType: "washer",
    cycleSize: "large",
    date: "2026-07-26",
    duration: 59,
    cost: 2.5,
  },
  {
    id: "ul-12",
    userId: "u-self",
    roomId: "lr-1",
    machineId: "m-1w-4",
    machineType: "washer",
    cycleSize: "medium",
    date: "2026-07-22",
    duration: 46,
    cost: 2.0,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStreak(logs: LaundryUsageLog[]): number {
  const dates = new Set(logs.map((l) => l.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    // check within 7-day window (weekly laundry)
    const nearby = [0, 1, 2, 3, 4, 5, 6].some((offset) => {
      const check = new Date(d);
      check.setDate(check.getDate() - offset);
      return dates.has(check.toISOString().split("T")[0]);
    });
    if (nearby) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLaundryQueue(): UseLaundryQueueReturn {
  const [rooms, setRooms] = useState<LaundryRoom[]>(MOCK_ROOMS);
  const [machines] = useState<LaundryMachine[]>(MOCK_MACHINES);
  const [queue, setQueue] = useState<LaundryQueueEntry[]>(MOCK_QUEUE);
  const [notifications, setNotifications] = useState<LaundryNotification[]>(MOCK_NOTIFICATIONS);
  const [usageLogs] = useState<LaundryUsageLog[]>(MOCK_USAGE_LOGS);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState<DormZone | "all">("all");
  const [machineTypeFilter, setMachineTypeFilter] = useState<MachineType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<LaundrySortOption>("wait-time");
  const [viewMode, setViewMode] = useState<LaundryViewMode>("rooms");

  const joinQueue = useCallback(
    (roomId: string, machineType: MachineType, cycleSize: CycleSize, priority: QueuePriority) => {
      const roomQueue = queue.filter(
        (q) => q.roomId === roomId && q.machineType === machineType && q.status !== "cancelled",
      );
      const position = roomQueue.length + 1;
      const entry: LaundryQueueEntry = {
        id: `q-${Date.now()}`,
        userId: "u-self",
        userName: "You",
        roomId,
        machineType,
        priority,
        cycleSize,
        estimatedDuration: CYCLE_SIZE_MAP[cycleSize].duration,
        joinedAt: new Date().toISOString(),
        position,
        status: "waiting",
      };
      setQueue((prev) => [...prev, entry]);
    },
    [queue],
  );

  const leaveQueue = useCallback((entryId: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== entryId));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const rateRoom = useCallback((roomId: string, rating: number) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const newTotal = r.totalRatings + 1;
        const newAvg = (r.rating * r.totalRatings + rating) / newTotal;
        return { ...r, rating: Math.round(newAvg * 10) / 10, totalRatings: newTotal };
      }),
    );
  }, []);

  const getRoomMachines = useCallback(
    (roomId: string) => machines.filter((m) => m.roomId === roomId),
    [machines],
  );

  const getAvailableMachines = useCallback(
    (roomId: string, type: MachineType) =>
      machines.filter((m) => m.roomId === roomId && m.type === type && m.status === "available"),
    [machines],
  );

  const getUpcomingAvailable = useCallback(
    (roomId: string, type: MachineType) => {
      return machines
        .filter(
          (m) =>
            m.roomId === roomId &&
            m.type === type &&
            m.status !== "available" &&
            m.status !== "out-of-order" &&
            m.currentCycleEnd,
        )
        .map((m) => ({ machine: m, availableAt: m.currentCycleEnd! }))
        .sort((a, b) => new Date(a.availableAt).getTime() - new Date(b.availableAt).getTime());
    },
    [machines],
  );

  const getQueuePosition = useCallback(
    (entryId: string) => {
      const entry = queue.find((q) => q.id === entryId);
      if (!entry) return -1;
      return queue.filter(
        (q) =>
          q.roomId === entry.roomId &&
          q.machineType === entry.machineType &&
          q.joinedAt <= entry.joinedAt &&
          q.status !== "cancelled",
      ).length;
    },
    [queue],
  );

  const stats = useMemo<LaundryStats>(() => {
    const totalLoads = usageLogs.length;
    const totalMinutes = usageLogs.reduce((s, l) => s + l.duration, 0);
    const totalCost = usageLogs.reduce((s, l) => s + l.cost, 0);

    const roomCounts: Record<string, number> = {};
    usageLogs.forEach((l) => {
      roomCounts[l.roomId] = (roomCounts[l.roomId] || 0) + 1;
    });
    const mostUsedRoomId = Object.entries(roomCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "";
    const mostUsedRoom = rooms.find((r) => r.id === mostUsedRoomId)?.name || "N/A";

    const washerLoads = usageLogs.filter((l) => l.machineType === "washer").length;
    const dryerLoads = usageLogs.filter((l) => l.machineType === "dryer").length;

    return {
      totalLoads,
      totalMinutes,
      totalCost,
      avgWaitTime: totalLoads > 0 ? Math.round((totalMinutes / totalLoads) * 0.3) : 0,
      mostUsedRoom,
      mostUsedMachineType: washerLoads >= dryerLoads ? "washer" : "dryer",
      peakHour: "10:00 AM",
      totalSavings: totalCost * 0.6, // vs laundromat markup
      weeklyLoads: Math.min(totalLoads, 3),
      monthlyLoads: totalLoads,
      streakDays: computeStreak(usageLogs),
      favoriteRoom: mostUsedRoom,
    };
  }, [usageLogs, rooms]);

  const getPeakHours = useCallback(() => {
    const hours = [
      "6 AM",
      "7 AM",
      "8 AM",
      "9 AM",
      "10 AM",
      "11 AM",
      "12 PM",
      "1 PM",
      "2 PM",
      "3 PM",
      "4 PM",
      "5 PM",
      "6 PM",
      "7 PM",
      "8 PM",
      "9 PM",
      "10 PM",
      "11 PM",
    ];
    return hours.map((h, i) => {
      let load: number;
      if (i < 3) load = 10 + i * 5;
      else if (i < 6) load = 30 + (i - 3) * 20;
      else if (i < 9) load = 85 - (i - 6) * 10;
      else if (i < 12) load = 55 + (i - 9) * 5;
      else if (i < 15) load = 70 - (i - 12) * 15;
      else load = 25 - (i - 15) * 5;
      return { hour: h, load: Math.max(load, 5) };
    });
  }, []);

  const getRecommendations = useCallback(() => {
    return [...rooms]
      .filter((r) => r.isOpen)
      .sort((a, b) => {
        const aScore =
          (a.availableWashers + a.availableDryers) * 10 - a.waitTimeEstimate + a.rating * 5;
        const bScore =
          (b.availableWashers + b.availableDryers) * 10 - b.waitTimeEstimate + b.rating * 5;
        return bScore - aScore;
      })
      .slice(0, 3);
  }, [rooms]);

  return {
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
    getQueuePosition,
    getAvailableMachines,
    getUpcomingAvailable,
    getPeakHours,
    getRecommendations,
  };
}

export { ZONES, MACHINE_STATUS_MAP, CYCLE_SIZE_MAP, PRIORITY_MAP };
