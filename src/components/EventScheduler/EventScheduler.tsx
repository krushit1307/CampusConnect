import React, { useState, useCallback, useMemo } from "react";
import format from "date-fns/format";
import addHours from "date-fns/addHours";
import differenceInHours from "date-fns/differenceInHours";
import isSameDay from "date-fns/isSameDay";
import startOfWeek from "date-fns/startOfWeek";
import addDays from "date-fns/addDays";
import { cn } from "../../lib/utils";
import { Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
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

interface PendingMove {
  eventId: string;
  eventTitle: string;
  oldStart: Date;
  oldEnd: Date;
  newStart: Date;
  newEnd: Date;
}

export const EventScheduler: React.FC<EventSchedulerProps> = ({
  initialEvents,
  onSave,
  onError,
}) => {
  const [events, setEvents] = useState<ScheduledEvent[]>(initialEvents);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

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

      const evt = events.find((item) => item.id === draggedEventId);
      if (!evt) {
        setDraggedEventId(null);
        return;
      }

      const duration = differenceInHours(evt.endTime, evt.startTime);
      const newStart = new Date(day);
      newStart.setHours(hour, 0, 0, 0);
      const newEnd = addHours(newStart, duration);

      // Past date validation
      if (newStart < new Date()) {
        onError?.("Cannot schedule events in the past");
        setDraggedEventId(null);
        return;
      }

      // Stage for confirmation modal
      setPendingMove({
        eventId: evt.id,
        eventTitle: evt.title,
        oldStart: evt.startTime,
        oldEnd: evt.endTime,
        newStart,
        newEnd,
      });

      setDraggedEventId(null);
    },
    [draggedEventId, events, onError],
  );

  const confirmMove = useCallback(() => {
    if (!pendingMove) return;

    setEvents((prev) => {
      const updated = prev.map((evt) => {
        if (evt.id === pendingMove.eventId) {
          return {
            ...evt,
            startTime: pendingMove.newStart,
            endTime: pendingMove.newEnd,
          };
        }
        return evt;
      });

      setTimeout(() => onSave(updated), 0);
      return updated;
    });

    setPendingMove(null);
  }, [pendingMove, onSave]);

  const cancelMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  const navigateWeek = (direction: number) => {
    setCurrentDate((prev) => addDays(prev, direction * 7));
  };

  return (
    <div
      className="border rounded-lg overflow-hidden bg-background shadow-sm relative"
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

      {/* Reschedule Confirmation Modal */}
      {pendingMove && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-testid="reschedule-modal"
        >
          <div className="bg-background rounded-lg p-6 max-w-md w-full shadow-lg border">
            <div className="flex items-center gap-2 mb-4 text-amber-500">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-lg font-semibold text-foreground">Confirm Event Reschedule</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to reschedule <strong>{pendingMove.eventTitle}</strong>?
            </p>
            <div className="bg-muted p-3 rounded-md text-xs space-y-2 mb-6">
              <div>
                <span className="font-medium text-muted-foreground">Previous: </span>
                <span>
                  {format(pendingMove.oldStart, "MMM d, HH:mm")} -{" "}
                  {format(pendingMove.oldEnd, "HH:mm")}
                </span>
              </div>
              <div>
                <span className="font-medium text-primary">New Time: </span>
                <span className="font-semibold text-foreground">
                  {format(pendingMove.newStart, "MMM d, HH:mm")} -{" "}
                  {format(pendingMove.newEnd, "HH:mm")}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelMove}
                data-testid="cancel-reschedule"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={confirmMove} data-testid="confirm-reschedule">
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
