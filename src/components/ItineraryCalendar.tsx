import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// 1. Setup Date Localizer for react-big-calendar
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

export const ItineraryCalendar = () => {
  // --- STATE ---
  
  // Active events on the calendar
  const [events, setEvents] = useState([
    {
      id: 'evt-1',
      title: 'Opening Keynote',
      start: new Date(2026, 9, 15, 9, 0),
      end: new Date(2026, 9, 15, 10, 0),
    },
  ]);

  // Available sessions in the sidebar
  const [availableSessions] = useState([
    { id: 'sub-1', title: 'React Performance Tuning', durationMinutes: 60 },
    { id: 'sub-2', title: 'UI/UX Design Systems', durationMinutes: 90 },
    { id: 'sub-3', title: 'Networking Lunch', durationMinutes: 60 },
  ]);

  // Tracks the session currently being dragged from the sidebar
  const [draggedSession, setDraggedSession] = useState(null);

  // --- LOGIC ---

  // Helper to detect if a new time slot overlaps with existing events
  const findClashingEvent = (newStart, newEnd, currentEvents, ignoreEventId = null) => {
    return currentEvents.find(
      (ev) => 
        ev.id !== ignoreEventId && // Ignore self when dragging an existing block
        newStart < ev.end && 
        newEnd > ev.start
    );
  };

  // Handler: Moving an EXISTING block around the calendar
  const onEventDrop = ({ event, start, end }) => {
    const clashingEvent = findClashingEvent(start, end, events, event.id);

    if (clashingEvent) {
      alert(`Clash! Cannot move "${event.title}" over "${clashingEvent.title}". AI Resolver taking over.`);
      return; // Abort move
    }

    setEvents((prev) =>
      prev.map((ev) => (ev.id === event.id ? { ...ev, start, end } : ev))
    );
  };

  // Handler: Start dragging a NEW item from the sidebar
  const handleDragStart = (session) => {
    setDraggedSession(session);
  };

  // Handler: Tells the calendar what is hovering over it
  const dragFromOutsideItem = () => {
    return draggedSession;
  };

  // Handler: Dropping a NEW item onto the calendar
  const onDropFromOutside = ({ start }) => {
    if (!draggedSession) return;

    // Calculate end time using the session's duration
    const end = new Date(start.getTime() + draggedSession.durationMinutes * 60000);
    
    const newEvent = {
      id: `${draggedSession.id}-${Date.now()}`,
      title: draggedSession.title,
      start,
      end,
    };

    const clashingEvent = findClashingEvent(start, end, events);

    if (clashingEvent) {
      alert(`Clash detected! The AI Resolver will handle overlapping "${newEvent.title}" with "${clashingEvent.title}".`);
      setDraggedSession(null);
      return; // Abort drop
    }

    setEvents((prev) => [...prev, newEvent]);
    setDraggedSession(null);
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
              <p className="text-sm text-blue-700">{session.durationMinutes} mins</p>
            </div>
          ))}
        </div>
      </div>

      {/* CALENDAR */}
      <div className="flex-1 bg-white p-4 rounded-lg shadow border border-gray-200 overflow-hidden">
        <DnDCalendar
          localizer={localizer}
          events={events}
          onEventDrop={onEventDrop}
          dragFromOutsideItem={dragFromOutsideItem}
          onDropFromOutside={onDropFromOutside}
          resizable={false} 
          defaultView="day"
          views={['day', 'week']}
          min={new Date(2026, 0, 1, 8, 0)} // Timeline starts at 8 AM
          max={new Date(2026, 0, 1, 18, 0)} // Timeline ends at 6 PM
          step={30}
          timeslots={2}
        />
      </div>
    </div>
  );
};