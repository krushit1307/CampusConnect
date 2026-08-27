import { useState, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BellOff, Plus, Search, RefreshCw, AlertCircle, Clock,
  Filter, Trash2, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventReminders } from "@/hooks/useEventReminders";
import { useReminderStore } from "@/store/useReminderStore";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import {
  STATUS_META, FREQUENCY_OPTIONS, LEAD_TIME_OPTIONS,
  type ReminderStatus, type ReminderFrequency, type ReminderLeadTime,
} from "@/types/reminders";
import { cn } from "@/lib/utils";

export function ReminderBoard() {
  const {
    filteredReminders, stats, filters, setFilter, resetFilters,
    createReminder, deleteReminder, snoozeReminder, dismissReminder, togglePin,
    clearAllReminders, getCountdown, checkReminders,
    unreadNotificationCount, markAllNotificationsRead,
  } = useEventReminders();

  const { isFormOpen, setFormOpen } = useReminderStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Check reminders every 30 seconds
  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 30_000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);

  const count = filteredReminders.length;
  const activeFilters =
    (filters.status !== "all" ? 1 : 0) +
    (filters.frequency !== "all" ? 1 : 0) +
    (filters.search ? 1 : 0);

  // Quick-add form state
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDate, setQuickDate] = useState("");
  const [quickLeadTime, setQuickLeadTime] = useState<ReminderLeadTime>("1hour");
  const [quickFrequency, setQuickFrequency] = useState<"once" | "daily" | "weekly">("once");

  const handleQuickAdd = () => {
    if (!quickTitle.trim() || !quickDate) return;
    createReminder({
      event_id: `evt-${Date.now()}`,
      event_title: quickTitle.trim(),
      event_date: new Date(quickDate).toISOString(),
      event_location: null,
      event_club_name: null,
      user_name: "You",
      lead_time: quickLeadTime,
      frequency: quickFrequency,
      personal_note: null,
      browser_notification: false,
      email_notification: false,
    });
    setQuickTitle("");
    setQuickDate("");
    setFormOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-700 to-blue-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNHYySDExdi0yaDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Bell className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Event Reminders</h1>
                <p className="text-indigo-200 text-sm mt-0.5">Never miss a campus event again</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 mt-5 text-sm">
              {[
                { icon: <Bell className="h-4 w-4" />, value: stats.active_count, label: "active" },
                { icon: <CheckCircle2 className="h-4 w-4" />, value: stats.triggered_count, label: "triggered" },
                { icon: <Clock className="h-4 w-4" />, value: stats.upcoming_events, label: "upcoming" },
                { icon: <AlertCircle className="h-4 w-4" />, value: stats.total_reminders, label: "total" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                  {s.icon}
                  <span className="font-bold tabular-nums">{s.value}</span>
                  <span className="text-white/70">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <Button onClick={() => setFormOpen(!isFormOpen)}
                className="rounded-full gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-lg">
                <Plus className="h-4 w-4" /> {isFormOpen ? "Close" : "New Reminder"}
              </Button>
              {unreadNotificationCount > 0 && (
                <Button onClick={markAllNotificationsRead} variant="outline"
                  className="rounded-full gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold text-sm">
                  <Bell className="h-4 w-4" /> {unreadNotificationCount} unread
                </Button>
              )}
              <span className="text-sm text-indigo-200 font-mono">{count} reminder{count !== 1 ? "s" : ""}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick Add Form */}
      {isFormOpen && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl border-2 border-indigo-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Quick Add Reminder</h3>
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input placeholder="Event name" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
                className="h-10 text-sm" />
              <Input type="datetime-local" value={quickDate} onChange={(e) => setQuickDate(e.target.value)}
                className="h-10 text-sm" />
              <Select value={quickLeadTime} onValueChange={(v) => setQuickLeadTime(v as ReminderLeadTime)}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Remind me..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_TIME_OPTIONS).map(([key, opt]) => (
                    <SelectItem key={key} value={key}>⏰ {opt.label} — {opt.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quickFrequency} onValueChange={(v) => setQuickFrequency(v as any)}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Repeat..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_OPTIONS).map(([key, opt]) => (
                    <SelectItem key={key} value={key}>{opt.icon} {opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleQuickAdd} disabled={!quickTitle.trim() || !quickDate}
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 font-bold gap-2">
              <Bell className="h-4 w-4" /> Create Reminder
            </Button>
          </motion.div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search reminders..." value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-10 rounded-full text-sm pl-9" />
          </div>
          <Select value={filters.status} onValueChange={(v) => setFilter("status", v as ReminderStatus | "all")}>
            <SelectTrigger className="w-32 h-10 rounded-full text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
                    {meta.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.frequency} onValueChange={(v) => setFilter("frequency", v as ReminderFrequency | "all")}>
            <SelectTrigger className="w-32 h-10 rounded-full text-sm"><SelectValue placeholder="Frequency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequency</SelectItem>
              {Object.entries(FREQUENCY_OPTIONS).map(([key, opt]) => (
                <SelectItem key={key} value={key}>{opt.icon} {opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => setFilter("sort", v as any)}>
            <SelectTrigger className="w-36 h-10 rounded-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soonest">Soonest First</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500 text-xs gap-1">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>

        {/* Empty */}
        {!count && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">No reminders yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              Set reminders for upcoming events so you never miss out.
            </p>
            <Button onClick={() => setFormOpen(true)} className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold">
              <Plus className="h-4 w-4" /> Create Your First Reminder
            </Button>
          </div>
        )}

        {/* Reminders grid */}
        {count > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  countdown={getCountdown(reminder)}
                  onSelect={handleSelect}
                  onSnooze={snoozeReminder}
                  onDismiss={dismissReminder}
                  onTogglePin={togglePin}
                  onDelete={deleteReminder}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Bulk actions */}
        {count > 3 && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={clearAllReminders}
              className="rounded-full text-xs gap-2 text-red-500 border-red-200 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Clear All Reminders
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
