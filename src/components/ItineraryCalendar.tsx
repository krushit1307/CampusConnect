import React, { useState, useEffect, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { getWalkingTravelTimeSeconds } from "../utils/itineraryPathfinding";
import { AlertTriangle, Footprints } from "lucide-react";

// 1. Setup Date Localizer for react-big-calendar
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

export const ItineraryCalendar = () => {
  // --- STATE ---

  // Active events on the calendar
  const [events, setEvents] = useState([
    {
      id: "evt-1",
      title: "Opening Keynote",
      start: new Date(2026, 9, 15, 9, 0),
      end: new Date(2026, 9, 15, 10, 0),
      venue: "Student Center Complex",
    },
  ]);

  // Available sessions in the sidebar
  const [availableSessions] = useState([
    {
      id: "sub-1",
      title: "React Performance Tuning",
      durationMinutes: 60,
      venue: "Engineering Center",
    },
    {
      id: "sub-2",
      title: "UI/UX Design Systems",
      durationMinutes: 90,
      venue: "Media Arts Building",
    },
    {
      id: "sub-3",
      title: "Networking Lunch",
      durationMinutes: 60,
      venue: "Student Center Complex",
    },
    { id: "sub-4", title: "Campus Tour", durationMinutes: 60, venue: "North Hall" },
  ]);

  // Tracks the session currently being dragged from the sidebar
  const [draggedSession, setDraggedSession] = useState<any>(null);

  const [travelBlocks, setTravelBlocks] = useState<any[]>([]);

  // --- LOGIC ---

  // Helper to detect if a new time slot overlaps with existing events
  const findClashingEvent = (
    newStart: Date,
    newEnd: Date,
    currentEvents: any[],
    ignoreEventId: string | null = null,
  ) => {
    return currentEvents.find(
      (ev) =>
        ev.id !== ignoreEventId && // Ignore self when dragging an existing block
        newStart < ev.end &&
        newEnd > ev.start,
    );
  };

  // Handler: Moving an EXISTING block around the calendar
  const onEventDrop = ({ event, start, end }: any) => {
    if (event.isTravelBlock) return; // Do not allow dragging travel blocks

    const clashingEvent = findClashingEvent(start, end, events, event.id);

    if (clashingEvent) {
      alert(
        `Clash! Cannot move "${event.title}" over "${clashingEvent.title}". AI Resolver taking over.`,
      );
      return; // Abort move
    }

    setEvents((prev) => prev.map((ev) => (ev.id === event.id ? { ...ev, start, end } : ev)));
  };

  // Handler: Start dragging a NEW item from the sidebar
  const handleDragStart = (session: any) => {
    setDraggedSession(session);
  };

  // Handler: Tells the calendar what is hovering over it
  const dragFromOutsideItem = () => {
    return draggedSession;
  };

  // Handler: Dropping a NEW item onto the calendar
  const onDropFromOutside = ({ start }: any) => {
    if (!draggedSession) return;

    // Calculate end time using the session's duration
    const end = new Date(start.getTime() + draggedSession.durationMinutes * 60000);

    const newEvent = {
      id: `${draggedSession.id}-${Date.now()}`,
      title: draggedSession.title,
      start,
      end,
      venue: draggedSession.venue,
    };

    const clashingEvent = findClashingEvent(start, end, events);

    if (clashingEvent) {
      alert(
        `Clash detected! The AI Resolver will handle overlapping "${newEvent.title}" with "${clashingEvent.title}".`,
      );
      setDraggedSession(null);
      return; // Abort drop
    }

    setEvents((prev) => [...prev, newEvent]);
    setDraggedSession(null);
  };

  // Generate travel blocks on the fly
  useEffect(() => {
    let active = true;
    async function calculateTravel() {
      const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
      const blocks = [];

      for (let i = 0; i < sortedEvents.length - 1; i++) {
        const curr = sortedEvents[i];
        const next = sortedEvents[i + 1];

        // Only add travel blocks if events are on the same day
        if (curr.start.toDateString() === next.start.toDateString()) {
          const travelSec = await getWalkingTravelTimeSeconds(curr.venue, next.venue);

          if (travelSec && travelSec > 0) {
            const gapSec = (next.start.getTime() - curr.end.getTime()) / 1000;
            const isLate = travelSec > gapSec;

            blocks.push({
              id: `travel-${curr.id}-${next.id}`,
              title: `Walk to ${next.venue}`,
              start: curr.end,
              end: new Date(curr.end.getTime() + travelSec * 1000),
              isTravelBlock: true,
              isLate,
              travelSec,
              gapSec,
              lateMin: Math.ceil((travelSec - gapSec) / 60),
            });
          }
        }
      }

      if (active) {
        setTravelBlocks(blocks);
      }
    }

    calculateTravel();
    return () => {
      active = false;
    };
  }, [events]);

  const combinedEvents = useMemo(() => {
    return [...events, ...travelBlocks];
  }, [events, travelBlocks]);

  const eventPropGetter = (event: any) => {
    if (event.isTravelBlock) {
      if (event.isLate) {
        return {
          style: {
            backgroundColor: "#ef4444",
            borderColor: "#b91c1c",
            color: "white",
            borderStyle: "dashed",
          },
        };
      }
      return {
        style: {
          backgroundColor: "#10b981",
          borderColor: "#047857",
          color: "white",
          borderStyle: "dashed",
        },
      };
    }
    return {
      style: {
        backgroundColor: "#3b82f6",
        borderColor: "#1d4ed8",
      },
    };
  };

  const EventComponent = ({ event }: any) => {
    if (event.isTravelBlock) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-full">
          <Footprints className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-bold">{Math.round(event.travelSec / 60)} min walk</span>
          {event.isLate && (
            <span className="text-[9px] font-black flex items-center justify-center gap-1 mt-1 bg-red-900/40 px-1 rounded">
              <AlertTriangle className="w-3 h-3" /> Late {event.lateMin}m
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="p-1">
        <strong className="block text-sm truncate">{event.title}</strong>
        <span className="text-xs opacity-90 truncate block">{event.venue}</span>
      </div>
    );
  };

  // --- RENDER ---
  return (
    <div className="flex h-[80vh] gap-4 p-4 bg-gray-50">
      {/* SIDEBAR: Available Sessions */}
      <div className="w-1/4 bg-white p-4 rounded-lg shadow border border-gray-200 overflow-y-auto">
        <h2 className="font-bold text-lg mb-4 text-gray-800">Available Sessions</h2>
        <div className="flex flex-col gap-3">
          {availableSessions.map((session) => (
            <div
              key={session.id}
              draggable="true"
              onDragStart={() => handleDragStart(session)}
              className="p-3 bg-blue-50 border border-blue-200 rounded cursor-grab active:cursor-grabbing hover:bg-blue-100 transition-colors"
            >
              <h3 className="font-semibold text-blue-900">{session.title}</h3>
              <p className="text-xs text-blue-800 font-medium mt-1">{session.venue}</p>
              <p className="text-sm text-blue-700 mt-1">{session.durationMinutes} mins</p>
            </div>
          ))}
        </div>
      </div>

      {/* CALENDAR */}
      <div className="flex-1 bg-white p-4 rounded-lg shadow border border-gray-200 overflow-hidden">
        <DnDCalendar
          localizer={localizer}
          events={combinedEvents}
          onEventDrop={onEventDrop}
          dragFromOutsideItem={dragFromOutsideItem}
          onDropFromOutside={onDropFromOutside}
          resizable={false}
          defaultView="day"
          views={["day", "week"]}
          min={new Date(2026, 9, 15, 8, 0)} // Timeline starts at 8 AM
          max={new Date(2026, 9, 15, 18, 0)} // Timeline ends at 6 PM
          step={30}
          timeslots={2}
          eventPropGetter={eventPropGetter}
          components={{
            event: EventComponent,
          }}
        />
      </div>
    </div>
  );
};
