import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateTimePickerProps {
  /** ISO-ish value, e.g. "2026-08-01T14:00" (matches native datetime-local format) */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Custom Date/Time Picker built with plain date-fns date math — no
 * react-day-picker or other heavy calendar dependency, per #1229. Renders a
 * hand-built grid of days plus hour/minute selects, matches the project's
 * Tailwind design tokens (bg-popover, etc.), and is keyboard accessible
 * (arrow keys move focus between days, Enter/Space selects).
 */
export function DateTimePicker({ value, onChange, className }: DateTimePickerProps) {
  const selectedDate = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? new Date());
  const [open, setOpen] = useState(false);

  const [hour, minute] = useMemo(() => {
    if (!value) return ["12", "00"];
    const [, timePart] = value.split("T");
    return (timePart ?? "12:00").split(":");
  }, [value]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [viewMonth]);

  // Leading blanks so the 1st lands in the correct weekday column
  const leadingBlanks = getDay(startOfMonth(viewMonth));

  const commit = (nextDate: Date, nextHour: string, nextMinute: string) => {
    const datePart = format(nextDate, "yyyy-MM-dd");
    onChange(`${datePart}T${nextHour}:${nextMinute}`);
  };

  const handleDayClick = (day: Date) => {
    commit(day, hour, minute);
  };

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, day: Date) => {
    const dayOffsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDayClick(day);
      return;
    }

    const offset = dayOffsets[event.key];
    if (offset === undefined) return;

    event.preventDefault();
    const next = new Date(day);
    next.setDate(next.getDate() + offset);

    if (!isSameMonth(next, viewMonth)) {
      setViewMonth(next);
    }

    // Focus the corresponding button after the grid re-renders
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLButtonElement>(
        `[data-day-iso="${format(next, "yyyy-MM-dd")}"]`,
      );
      target?.focus();
    });
  };

  const handleTimeChange = (nextHour: string, nextMinute: string) => {
    commit(selectedDate ?? viewMonth, nextHour, nextMinute);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "LLL dd, y 'at' h:mm a")
          ) : (
            <span>Pick a date & time</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between px-1 pb-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            className="rounded-md p-1 hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">{format(viewMonth, "LLLL yyyy")}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="rounded-md p-1 hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="text-muted-foreground text-[0.7rem] font-medium">
              {label}
            </span>
          ))}

          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <span key={`blank-${i}`} />
          ))}

          {days.map((day) => {
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                type="button"
                data-day-iso={format(day, "yyyy-MM-dd")}
                tabIndex={isSelected || (!selectedDate && isToday) ? 0 : -1}
                onClick={() => handleDayClick(day)}
                onKeyDown={(e) => handleDayKeyDown(e, day)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <label className="text-sm font-medium">Time</label>
          <select
            aria-label="Hour"
            value={hour}
            onChange={(e) => handleTimeChange(e.target.value, minute)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span>:</span>
          <select
            aria-label="Minute"
            value={minute}
            onChange={(e) => handleTimeChange(hour, e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            {["00", "15", "30", "45"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
