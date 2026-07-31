// src/components/EventScheduler/EventScheduler.tsx
import React, { useState, useCallback, useMemo } from "react";
import { format, addHours, differenceInHours, isSameDay, startOfWeek, addDays } from "date-fns";
import { cn } from "../../lib/utils";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

export interface ScheduledEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  color: string;
}

export interface EventSchedulerProps {
  initialEvents: ScheduledEvent[];
  onSave: (events: ScheduledEvent[]) => void;
  onError?: (error: string) => void;
}

/**
 * Complex Event Scheduler component.
 * Handles date math, timezone rendering, and drag-and-drop logic.
 * Highly prone to breakage during refactors, hence the need for Cypress CT.
 */
export const EventScheduler: React.FC<EventSchedulerProps> = ({
  initialEvents,
  onSave,
  onError,
}) => {
  const [events, setEvents] = useState<ScheduledEvent[]>(initialEvents);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const handleDragStart = useCallback((e: React.DragEvent, eventId: string) => {
    setDraggedEventId(eventId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, day: Date, hour: number) => {
      e.preventDefault();
      if (!draggedEventId) return;

      setEvents((prev) => {
        const updated = prev.map((evt) => {
          if (evt.id === draggedEventId) {
            const duration = differenceInHours(evt.endTime, evt.startTime);
            const newStart = new Date(day);
            newStart.setHours(hour, 0, 0, 0);
            const newEnd = addHours(newStart, duration);

            // Edge case: prevent scheduling outside of valid bounds (e.g. past events)
            if (newStart < new Date() && !evt.startTime) {
              onError?.("Cannot schedule events in the past");
              return evt;
            }

            return { ...evt, startTime: newStart, endTime: newEnd };
          }
          return evt;
        });

        // Fire callback for parent component state sync
        setTimeout(() => onSave(updated), 0);
        return updated;
      });

      setDraggedEventId(null);
    },
    [draggedEventId, onSave, onError],
  );

  const navigateWeek = (direction: number) => {
    setCurrentDate((prev) => addDays(prev, direction * 7));
  };

  return (
    <div
      className="border rounded-lg overflow-hidden bg-background shadow-sm"
      data-testid="event-scheduler"
    >
      <header className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Weekly Schedule
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium min-w-[150px] text-center">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-8 border-b bg-muted/10">
        <div className="p-2 text-xs font-medium text-muted-foreground border-r">Time</div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="p-2 text-xs font-medium text-center border-r last:border-r-0"
          >
            <div>{format(day, "EEE")}</div>
            <div className={cn("text-lg", isSameDay(day, new Date()) && "text-primary font-bold")}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-8 max-h-[600px] overflow-y-auto relative">
        <div className="col-span-1 border-r">
          {hours.map((h) => (
            <div
              key={h}
              className="h-16 border-b p-2 text-xs text-muted-foreground flex items-start"
            >
              <Clock className="w-3 h-3 mr-1 mt-0.5" />
              {format(new Date().setHours(h, 0), "HH:mm")}
            </div>
          ))}
        </div>

        {weekDays.map((day) => (
          <div key={day.toISOString()} className="relative border-r last:border-r-0">
            {hours.map((h) => (
              <div
                key={h}
                className="h-16 border-b hover:bg-accent/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day, h)}
                data-testid={`time-slot-${format(day, "yyyy-MM-dd")}-${h}`}
              />
            ))}

            {events
              .filter((evt) => isSameDay(evt.startTime, day))
              .map((evt) => {
                const startHour = evt.startTime.getHours();
                const duration = differenceInHours(evt.endTime, evt.startTime);
                const top = startHour * 64; // 64px per hour (h-16)
                const height = Math.max(duration * 64, 32);

                return (
                  <div
                    key={evt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, evt.id)}
                    className={cn(
                      "absolute left-1 right-1 rounded-md p-2 text-xs text-white shadow-md cursor-grab active:cursor-grabbing overflow-hidden border border-white/20",
                      draggedEventId === evt.id && "opacity-50 scale-95",
                    )}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      backgroundColor: evt.color,
                    }}
                    data-testid={`event-block-${evt.id}`}
                  >
                    <div className="font-bold truncate">{evt.title}</div>
                    <div className="opacity-80">
                      {format(evt.startTime, "HH:mm")} - {format(evt.endTime, "HH:mm")}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
};
