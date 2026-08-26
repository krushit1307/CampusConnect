import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bell, BellOff, Clock, MapPin, Pin, PinOff, Calendar,
  CheckCircle2, AlertCircle, Hourglass, Trash2, BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  STATUS_META, LEAD_TIME_OPTIONS, FREQUENCY_OPTIONS,
  type EventReminder, type CountdownInfo,
} from "@/types/reminders";

interface ReminderCardProps {
  reminder: EventReminder;
  countdown: CountdownInfo | null;
  onSelect: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReminderCard({
  reminder, countdown, onSelect, onSnooze, onDismiss, onTogglePin, onDelete,
}: ReminderCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const statusMeta = STATUS_META[reminder.status];
  const leadMeta = LEAD_TIME_OPTIONS[reminder.lead_time];
  const freqMeta = FREQUENCY_OPTIONS[reminder.frequency];

  const eventDate = useMemo(() => {
    const d = new Date(reminder.event_date);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }, [reminder.event_date]);

  const eventTimeRemaining = useMemo(() => {
    const diff = new Date(reminder.event_date).getTime() - Date.now();
    if (diff < 0) return "Past";
    const days = Math.floor(diff / 86_400_000);
    if (days > 0) return `In ${days}d`;
    const hours = Math.floor(diff / 3_600_000);
    return `In ${hours}h`;
  }, [reminder.event_date]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(reminder.id)}
      className={cn(
        "rounded-xl border-2 bg-white p-5 cursor-pointer transition-all duration-200",
        isHovered ? "border-indigo-300 shadow-lg" : "border-gray-200 shadow-sm",
        reminder.is_pinned && "border-amber-300 bg-amber-50/30",
        reminder.status === "expired" && "opacity-60",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(reminder.id); }}
    >
      {/* Header: Status + Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-[10px] font-bold", statusMeta.bgClass)}>
            <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", statusMeta.dotClass)} />
            {statusMeta.label}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {freqMeta.icon} {freqMeta.label}
          </Badge>
          {reminder.is_pinned && (
            <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
              📌 Pinned
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => onTogglePin(reminder.id)}
            className="h-7 w-7 p-0">
            {reminder.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(reminder.id)}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Event title */}
      <h3 className="text-base font-bold text-gray-900 line-clamp-1 mb-1">{reminder.event_title}</h3>

      {/* Club + Location */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        {reminder.event_club_name && <span className="font-medium">{reminder.event_club_name}</span>}
        {reminder.event_location && (
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{reminder.event_location}</span>
        )}
      </div>

      {/* Personal note */}
      {reminder.personal_note && (
        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 mb-3 line-clamp-2">
          {reminder.personal_note}
        </p>
      )}

      {/* Countdown bar */}
      {countdown && reminder.status !== "expired" && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mb-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />Reminder in
            </span>
            <span className={cn("font-bold", countdown.isPast ? "text-amber-600" : "text-indigo-600")}>
              {countdown.label}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${countdown.progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                countdown.isPast ? "bg-amber-500" : "bg-indigo-500"
              )}
            />
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {eventDate}
          </span>
          <span className={cn("font-semibold", eventTimeRemaining === "Past" ? "text-red-500" : "text-emerald-600")}>
            {eventTimeRemaining}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">
            ⏰ {leadMeta.label}
          </span>
        </div>
      </div>

      {/* Quick actions for triggered reminders */}
      {reminder.status === "triggered" && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => onSnooze(reminder.id)}
            className="rounded-full text-xs gap-1 h-7">
            <BellRing className="h-3 w-3" /> Snooze
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDismiss(reminder.id)}
            className="rounded-full text-xs gap-1 h-7 text-emerald-600 border-emerald-300 hover:bg-emerald-50">
            <CheckCircle2 className="h-3 w-3" /> Dismiss
          </Button>
        </div>
      )}
    </motion.article>
  );
}
