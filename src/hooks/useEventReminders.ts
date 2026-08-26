import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  EventReminder,
  ReminderFilters,
  ReminderStats,
  CreateReminderPayload,
  ReminderStatus,
  ReminderLeadTime,
  LEAD_TIME_OPTIONS,
} from "@/types/reminders";

const STORAGE_KEY = "cc-event-reminders";
const NOTIFICATIONS_KEY = "cc-reminder-notifications";

function loadReminders(): EventReminder[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveReminders(reminders: EventReminder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function loadNotifications(): { id: string; reminder_id: string; title: string; body: string; read: boolean; created_at: string }[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveNotifications(notifs: { id: string; reminder_id: string; title: string; body: string; read: boolean; created_at: string }[]): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifs));
}

export interface UseEventRemindersReturn {
  reminders: EventReminder[];
  filteredReminders: EventReminder[];
  stats: ReminderStats;
  createReminder: (payload: CreateReminderPayload) => void;
  updateReminder: (id: string, updates: Partial<EventReminder>) => void;
  deleteReminder: (id: string) => void;
  snoozeReminder: (id: string) => void;
  dismissReminder: (id: string) => void;
  togglePin: (id: string) => void;
  clearAllReminders: () => void;
  filters: ReminderFilters;
  setFilter: <K extends keyof ReminderFilters>(key: K, value: ReminderFilters[K]) => void;
  resetFilters: () => void;
  /** Countdown info for a specific reminder */
  getCountdown: (reminder: EventReminder) => CountdownInfo | null;
  /** Check and trigger any reminders that should fire now */
  checkReminders: () => void;
  unreadNotificationCount: number;
  markAllNotificationsRead: () => void;
}

export interface CountdownInfo {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isPast: boolean;
  progressPct: number;
  label: string;
}

function computeCountdown(eventDate: string, leadTimeMinutes: number): CountdownInfo {
  const now = Date.now();
  const eventTime = new Date(eventDate).getTime();
  const triggerTime = eventTime - leadTimeMinutes * 60_000;
  const diff = triggerTime - now;
  const totalToEvent = eventTime - now;
  const leadTimeSeconds = leadTimeMinutes * 60;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isPast: true, progressPct: 100, label: "Triggered!" };
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const totalSeconds = Math.floor(diff / 1000);

  const elapsed = leadTimeSeconds - totalSeconds;
  const progressPct = Math.min(100, Math.max(0, (elapsed / leadTimeSeconds) * 100));

  let label = "";
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else if (minutes > 0) label = `${minutes}m ${seconds}s`;
  else label = `${seconds}s`;

  return { days, hours, minutes, seconds, totalSeconds, isPast: false, progressPct, label };
}

function checkAndTriggerReminders(reminders: EventReminder[]): { updated: EventReminder[]; newNotifications: { id: string; reminder_id: string; title: string; body: string; read: boolean; created_at: string }[] } {
  const now = Date.now();
  const newNotifications: { id: string; reminder_id: string; title: string; body: string; read: boolean; created_at: string }[] = [];
  const leadTimeMap: Record<string, number> = {
    "15min": 15, "30min": 30, "1hour": 60, "2hours": 120, "1day": 1440, "3days": 4320, "1week": 10080,
  };

  const updated = reminders.map((r) => {
    if (r.status !== "active" && r.status !== "snoozed") return r;

    const eventTime = new Date(r.event_date).getTime();
    const triggerTime = eventTime - (leadTimeMap[r.lead_time] ?? 60) * 60_000;

    if (now >= triggerTime && now < eventTime) {
      const lastTriggered = r.last_triggered_at ? new Date(r.last_triggered_at).getTime() : 0;
      const shouldNotify = r.frequency === "once"
        ? lastTriggered === 0
        : r.frequency === "daily"
          ? now - lastTriggered > 86_400_000
          : now - lastTriggered > 604_800_000;

      if (shouldNotify) {
        newNotifications.push({
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          reminder_id: r.id,
          title: `⏰ Reminder: ${r.event_title}`,
          body: r.personal_note ?? `Starting in ${r.lead_time.replace("min", " min").replace("hour", " hour").replace("day", " day").replace("week", " week")}`,
          read: false,
          created_at: new Date().toISOString(),
        });
        return { ...r, status: "triggered" as ReminderStatus, last_triggered_at: new Date().toISOString() };
      }
    }

    const isExpired = now > eventTime;
    if (isExpired && r.status !== "expired") {
      return { ...r, status: "expired" as ReminderStatus };
    }

    return r;
  });

  return { updated, newNotifications };
}

function computeStats(reminders: EventReminder[]): ReminderStats {
  const active = reminders.filter((r) => r.status === "active").length;
  const triggered = reminders.filter((r) => r.status === "triggered").length;
  const upcoming = reminders.filter((r) => new Date(r.event_date).getTime() > Date.now()).length;

  const eventCounts: Record<string, number> = {};
  reminders.forEach((r) => {
    eventCounts[r.event_title] = (eventCounts[r.event_title] ?? 0) + 1;
  });
  const mostReminded = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const leadTimeMap: Record<string, number> = {
    "15min": 15, "30min": 30, "1hour": 60, "2hours": 120, "1day": 1440, "3days": 4320, "1week": 10080,
  };
  const avgMinutes = reminders.length > 0
    ? reminders.reduce((sum, r) => sum + (leadTimeMap[r.lead_time] ?? 60), 0) / reminders.length
    : 60;
  const avgLabel = avgMinutes < 60 ? `${Math.round(avgMinutes)}min` : avgMinutes < 1440 ? `${Math.round(avgMinutes / 60)}h` : `${Math.round(avgMinutes / 1440)}d`;

  return {
    total_reminders: reminders.length,
    active_count: active,
    triggered_count: triggered,
    upcoming_events: upcoming,
    most_reminded_event: mostReminded,
    average_lead_time: avgLabel,
  };
}

const DEFAULT_FILTERS: ReminderFilters = { status: "all", frequency: "all", search: "", sort: "soonest" };

export function useEventReminders(): UseEventRemindersReturn {
  const [reminders, setReminders] = useState<EventReminder[]>(loadReminders);
  const [notifications, setNotifications] = useState(loadNotifications);
  const [filters, setFiltersState] = useState<ReminderFilters>(DEFAULT_FILTERS);

  useEffect(() => { saveReminders(reminders); }, [reminders]);
  useEffect(() => { saveNotifications(notifications); }, [notifications]);

  const setFilter = useCallback(<K extends keyof ReminderFilters>(key: K, value: ReminderFilters[K]) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  const filteredReminders = useMemo(() => {
    let result = [...reminders];

    if (filters.status !== "all") result = result.filter((r) => r.status === filters.status);
    if (filters.frequency !== "all") result = result.filter((r) => r.frequency === filters.frequency);
    if (filters.search.trim()) {
      const t = filters.search.toLowerCase();
      result = result.filter((r) =>
        r.event_title.toLowerCase().includes(t) ||
        (r.event_club_name?.toLowerCase().includes(t) ?? false) ||
        (r.personal_note?.toLowerCase().includes(t) ?? false)
      );
    }

    const leadTimeMap: Record<string, number> = {
      "15min": 15, "30min": 30, "1hour": 60, "2hours": 120, "1day": 1440, "3days": 4320, "1week": 10080,
    };

    if (filters.sort === "soonest") {
      result.sort((a, b) => {
        const aTime = new Date(a.event_date).getTime() - (leadTimeMap[a.lead_time] ?? 60) * 60_000;
        const bTime = new Date(b.event_date).getTime() - (leadTimeMap[b.lead_time] ?? 60) * 60_000;
        return aTime - bTime;
      });
    } else if (filters.sort === "newest") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    // Pinned items first
    result.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

    return result;
  }, [reminders, filters]);

  const stats = useMemo(() => computeStats(reminders), [reminders]);

  const createReminder = useCallback((payload: CreateReminderPayload) => {
    const newReminder: EventReminder = {
      ...payload,
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "active",
      last_triggered_at: null,
      dismissed_at: null,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setReminders((prev) => [newReminder, ...prev]);
  }, []);

  const updateReminder = useCallback((id: string, updates: Partial<EventReminder>) => {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r));
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setNotifications((prev) => prev.filter((n) => n.reminder_id !== id));
  }, []);

  const snoozeReminder = useCallback((id: string) => {
    updateReminder(id, { status: "snoozed", last_triggered_at: new Date().toISOString() });
  }, [updateReminder]);

  const dismissReminder = useCallback((id: string) => {
    updateReminder(id, { status: "dismissed", dismissed_at: new Date().toISOString() });
  }, [updateReminder]);

  const togglePin = useCallback((id: string) => {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, is_pinned: !r.is_pinned } : r));
  }, []);

  const clearAllReminders = useCallback(() => {
    setReminders([]);
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NOTIFICATIONS_KEY);
  }, []);

  const getCountdown = useCallback((reminder: EventReminder): CountdownInfo | null => {
    const leadTimeMap: Record<string, number> = {
      "15min": 15, "30min": 30, "1hour": 60, "2hours": 120, "1day": 1440, "3days": 4320, "1week": 10080,
    };
    const minutes = leadTimeMap[reminder.lead_time] ?? 60;
    return computeCountdown(reminder.event_date, minutes);
  }, []);

  const checkReminders = useCallback(() => {
    const { updated, newNotifications } = checkAndTriggerReminders(reminders);
    const hasChanges = updated.some((r, i) => r !== reminders[i]);
    if (hasChanges) setReminders(updated);
    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
    }
  }, [reminders]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return {
    reminders, filteredReminders, stats,
    createReminder, updateReminder, deleteReminder, snoozeReminder, dismissReminder, togglePin,
    clearAllReminders, filters, setFilter, resetFilters,
    getCountdown, checkReminders,
    unreadNotificationCount, markAllNotificationsRead,
  };
}
