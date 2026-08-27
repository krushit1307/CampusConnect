import React, { useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import getDay from "date-fns/getDay";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import enUS from "date-fns/locale/en-US";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import Clock from "lucide-react/dist/esm/icons/clock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Move from "lucide-react/dist/esm/icons/move";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Filter from "lucide-react/dist/esm/icons/filter";
import Search from "lucide-react/dist/esm/icons/search";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Info from "lucide-react/dist/esm/icons/info";
import { toast } from "sonner";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import {
  calculateRescheduledTimestamps,
  formatTimeRange,
  preserveTimeAndMutateDate,
} from "@/lib/eventRescheduleUtils";
import { patchRescheduleEvent } from "@/services/adminEventRescheduleApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Wrap react-big-calendar with Drag and Drop addon HOC
const DnDCalendar = withDragAndDrop<AdminCalendarEvent, object>(Calendar);

export interface AdminEventRecord {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  category?: string | null;
  club_name?: string | null;
}

export interface AdminCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: AdminEventRecord;
}

interface AdminCalendarProps {
  events: AdminEventRecord[];
  onEventRescheduled?: (eventId: string, newStart: string, newEnd: string) => void;
  readOnly?: boolean;
  clubName?: string;
}

export const AdminCalendar: React.FC<AdminCalendarProps> = ({
  events: initialEvents,
  onEventRescheduled,
  readOnly = false,
  clubName = "CampusConnect",
}) => {
  const [currentView, setCurrentView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AdminEventRecord | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);

  // Local state holding events for instant optimistic UI updates
  const [localEvents, setLocalEvents] = useState<AdminEventRecord[]>(initialEvents);

  // Synchronize if initialEvents prop updates
  React.useEffect(() => {
    setLocalEvents(initialEvents);
  }, [initialEvents]);

  // Format records into BigCalendar format
  const calendarEvents: AdminCalendarEvent[] = useMemo(() => {
    return localEvents
      .filter((ev) => {
        const matchesSearch = ev.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCat =
          selectedCategory === "all" ||
          (ev.category && ev.category.toLowerCase() === selectedCategory.toLowerCase());
        return matchesSearch && matchesCat;
      })
      .map((ev) => {
        const start = new Date(ev.start_date);
        const end = ev.end_date
          ? new Date(ev.end_date)
          : new Date(start.getTime() + 60 * 60 * 1000);

        return {
          id: ev.id,
          title: ev.title,
          start,
          end,
          allDay: false,
          resource: ev,
        };
      });
  }, [localEvents, searchQuery, selectedCategory]);

  /**
   * Drag-and-Drop Event Reschedule Handler
   * Preserves exact original hours/minutes and updates Year/Month/Day
   */
  const handleEventDrop = useCallback(
    async (args: EventInteractionArgs<AdminCalendarEvent>) => {
      if (readOnly) return;

      const { event, start: droppedStart } = args;
      const targetEvent = event.resource;
      const originalStartIso = targetEvent.start_date;
      const originalEndIso =
        targetEvent.end_date ||
        new Date(new Date(originalStartIso).getTime() + 3600000).toISOString();

      const dropDate = typeof droppedStart === "string" ? new Date(droppedStart) : droppedStart;

      // Calculate time-preserved updated dates
      const { newStart, newEnd, startIso, endIso, formattedLabel } = calculateRescheduledTimestamps(
        originalStartIso,
        originalEndIso,
        dropDate,
      );

      // 1. Optimistically update local React state for immediate UI feedback
      setLocalEvents((prev) =>
        prev.map((e) =>
          e.id === targetEvent.id ? { ...e, start_date: startIso, end_date: endIso } : e,
        ),
      );

      setIsRescheduling(true);

      try {
        // 2. Dispatch API PATCH request
        await patchRescheduleEvent({
          eventId: targetEvent.id,
          newStartIso: startIso,
          newEndIso: endIso,
        });

        if (onEventRescheduled) {
          onEventRescheduled(targetEvent.id, startIso, endIso);
        }

        // 3. Show Success Toast with Undo Button
        toast.success(`Rescheduled '${targetEvent.title}'`, {
          description: `Moved to ${formattedLabel}`,
          action: {
            label: "Undo",
            onClick: async () => {
              // Rollback local state
              setLocalEvents((prev) =>
                prev.map((e) =>
                  e.id === targetEvent.id
                    ? { ...e, start_date: originalStartIso, end_date: originalEndIso }
                    : e,
                ),
              );

              // Dispatch rollback API request
              await patchRescheduleEvent({
                eventId: targetEvent.id,
                newStartIso: originalStartIso,
                newEndIso: originalEndIso,
              });

              toast.info("Reschedule undone.");
            },
          },
        });
      } catch (err: any) {
        // Rollback optimistic state on error
        setLocalEvents((prev) =>
          prev.map((e) =>
            e.id === targetEvent.id
              ? { ...e, start_date: originalStartIso, end_date: originalEndIso }
              : e,
          ),
        );

        toast.error(`Failed to reschedule event: ${err?.message || "Server error"}`);
      } finally {
        setIsRescheduling(false);
      }
    },
    [readOnly, onEventRescheduled],
  );

  return (
    <div className="bg-white rounded-xl border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-mono space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-black pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            <span>{clubName} Event Schedule</span>
          </div>
          <h2 className="text-2xl font-extrabold uppercase mt-0.5">
            Interactive Drag-and-Drop Calendar
          </h2>
        </div>

        {/* View Switcher & Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex border-2 border-black rounded-lg overflow-hidden bg-slate-100">
            {(["month", "week", "day"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`px-3 py-1.5 text-xs font-bold uppercase transition ${
                  currentView === view ? "bg-black text-white" : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-2 border-black rounded-lg bg-white p-1">
            <button
              onClick={() => {
                const next = new Date(currentDate);
                if (currentView === "month") next.setMonth(next.getMonth() - 1);
                else next.setDate(next.getDate() - 7);
                setCurrentDate(next);
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 py-0.5 text-xs font-bold uppercase hover:bg-gray-100 rounded"
            >
              Today
            </button>
            <button
              onClick={() => {
                const next = new Date(currentDate);
                if (currentView === "month") next.setMonth(next.getMonth() + 1);
                else next.setDate(next.getDate() + 7);
                setCurrentDate(next);
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-black rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
            <Filter className="w-3.5 h-3.5" /> Category:
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-1.5 bg-white border border-black text-xs font-bold rounded-md"
          >
            <option value="all">All Categories</option>
            <option value="academic">Academic</option>
            <option value="social">Social</option>
            <option value="sports">Sports</option>
            <option value="workshop">Workshop</option>
          </select>
        </div>

        <div className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-200 flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5" /> Drag event blocks to reschedule date
        </div>
      </div>

      {/* Big Calendar Element with Drag and Drop */}
      <div className="h-[600px] w-full border-2 border-black rounded-lg overflow-hidden p-2 bg-white">
        <DnDCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={(d) => setCurrentDate(d)}
          view={currentView}
          onView={(v) => setCurrentView(v)}
          draggableAccessor={() => !readOnly}
          onEventDrop={handleEventDrop}
          resizable={false}
          selectable={true}
          onSelectEvent={(calEvent) => setSelectedEvent(calEvent.resource)}
          eventPropGetter={() => ({
            className:
              "bg-indigo-600 text-white font-mono text-xs font-bold rounded-md px-2 py-1 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-indigo-700 transition cursor-grab active:cursor-grabbing",
          })}
          style={{ height: "100%" }}
        />
      </div>

      {/* Selected Event Details Modal */}
      <Dialog open={selectedEvent !== null} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="bg-white border-2 border-black rounded-xl p-6 font-mono max-w-md shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          {selectedEvent && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold uppercase text-black">
                  {selectedEvent.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-2 text-xs text-gray-700 border-t border-b py-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>
                    {formatTimeRange(
                      new Date(selectedEvent.start_date),
                      selectedEvent.end_date
                        ? new Date(selectedEvent.end_date)
                        : new Date(new Date(selectedEvent.start_date).getTime() + 3600000),
                    )}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
              </div>

              {selectedEvent.description && (
                <p className="text-xs text-gray-600 leading-relaxed">{selectedEvent.description}</p>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  To reschedule, drag this event box directly to another day in the calendar grid.
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
