import React, { useMemo, useState, useRef, useCallback } from "react";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import { Button } from "@/components/ui/button";
import { useEventSchedule } from "@/hooks/useEventSchedule";
import type { ScheduleSession } from "@/types/schedule";

interface ScheduleBuilderProps {
  eventId: string;
}

// Grid is drawn in 15-minute rows across a configurable day window.
const SLOT_MINUTES = 15;
const ROW_HEIGHT_PX = 18; // px per 15-minute slot
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 23;
const TRACK_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];

function toMinutesFromDayStart(iso: string, dayDate: string) {
  const d = new Date(iso);
  const start = new Date(`${dayDate}T00:00:00`);
  return Math.round((d.getTime() - start.getTime()) / 60000);
}

function minutesToIso(dayDate: string, minutes: number) {
  const start = new Date(`${dayDate}T00:00:00`);
  return new Date(start.getTime() + minutes * 60000).toISOString();
}

export function ScheduleBuilder({ eventId }: ScheduleBuilderProps) {
  const currentUserId = undefined; // organizers don't need favorites in the builder itself
  const {
    tracks,
    sessions,
    createTrack,
    deleteTrack,
    createSession,
    updateSession,
    deleteSession,
  } = useEventSchedule(eventId, currentUserId);

  const [activeDay, setActiveDay] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [newTrackName, setNewTrackName] = useState("");
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    sessionId: string;
    mode: "move" | "resize-end";
    startMinutes: number;
    endMinutes: number;
    pointerStartY: number;
  } | null>(null);

  const daysWithSessions = useMemo(() => {
    const dates = new Set(sessions.map((s) => s.start_time.slice(0, 10)));
    dates.add(activeDay);
    return Array.from(dates).sort();
  }, [sessions, activeDay]);

  const totalSlots = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;
  const gridHeight = totalSlots * ROW_HEIGHT_PX;
  const dayStartMinutes = DAY_START_HOUR * 60;

  const sessionsForDay = sessions.filter((s) => s.start_time.slice(0, 10) === activeDay);

  const handleAddTrack = () => {
    if (!newTrackName.trim()) return;
    createTrack({
      name: newTrackName.trim(),
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      sort_order: tracks.length,
    });
    setNewTrackName("");
  };

  const handleAddSession = (trackId: string) => {
    const startMinutes = dayStartMinutes + Math.floor(totalSlots / 2) * SLOT_MINUTES;
    createSession({
      track_id: trackId,
      title: "New session",
      description: null,
      speaker: null,
      location: null,
      start_time: minutesToIso(activeDay, startMinutes),
      end_time: minutesToIso(activeDay, startMinutes + 30),
    });
  };

  const minutesFromPointer = useCallback((clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return dayStartMinutes;
    const relativeY = clientY - rect.top;
    const slot = Math.round(relativeY / ROW_HEIGHT_PX);
    return dayStartMinutes + Math.max(0, Math.min(totalSlots, slot)) * SLOT_MINUTES;
  }, [dayStartMinutes, totalSlots]);

  const onPointerDown = (
    e: React.PointerEvent,
    session: ScheduleSession,
    mode: "move" | "resize-end",
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      sessionId: session.id,
      mode,
      startMinutes: toMinutesFromDayStart(session.start_time, activeDay),
      endMinutes: toMinutesFromDayStart(session.end_time, activeDay),
      pointerStartY: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const deltaSlots = Math.round((e.clientY - drag.current.pointerStartY) / ROW_HEIGHT_PX);
    const deltaMinutes = deltaSlots * SLOT_MINUTES;
    const el = document.getElementById(`session-block-${drag.current.sessionId}`);
    if (!el) return;

    if (drag.current.mode === "move") {
      const newStart = Math.max(0, drag.current.startMinutes + deltaMinutes);
      const duration = drag.current.endMinutes - drag.current.startMinutes;
      el.style.top = `${((newStart - dayStartMinutes) / SLOT_MINUTES) * ROW_HEIGHT_PX}px`;
      el.dataset.pendingStart = String(newStart);
      el.dataset.pendingEnd = String(newStart + duration);
    } else {
      const newEnd = Math.max(
        drag.current.startMinutes + SLOT_MINUTES,
        drag.current.endMinutes + deltaMinutes,
      );
      el.style.height = `${((newEnd - drag.current.startMinutes) / SLOT_MINUTES) * ROW_HEIGHT_PX}px`;
      el.dataset.pendingEnd = String(newEnd);
    }
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    const el = document.getElementById(`session-block-${drag.current.sessionId}`);
    const pendingStart = el?.dataset.pendingStart
      ? Number(el.dataset.pendingStart)
      : drag.current.startMinutes;
    const pendingEnd = el?.dataset.pendingEnd
      ? Number(el.dataset.pendingEnd)
      : drag.current.endMinutes;

    updateSession({
      id: drag.current.sessionId,
      start_time: minutesToIso(activeDay, pendingStart),
      end_time: minutesToIso(activeDay, pendingEnd),
    });
    drag.current = null;
  };

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {daysWithSessions.map((date, i) => (
          <button
            key={date}
            onClick={() => setActiveDay(date)}
            className={`neu-border px-3 py-1.5 font-mono text-xs font-bold uppercase ${
              date === activeDay ? "bg-black text-white" : "bg-white"
            }`}
          >
            Day {i + 1} · {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </button>
        ))}
        <button
          onClick={() => {
            const next = new Date(activeDay + "T00:00:00");
            next.setDate(next.getDate() + 1);
            setActiveDay(next.toISOString().slice(0, 10));
          }}
          className="neu-border flex items-center gap-1 px-3 py-1.5 font-mono text-xs font-bold uppercase text-gray-600"
        >
          <Plus size={14} /> Add day
        </button>
      </div>

      {/* Track management */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newTrackName}
          onChange={(e) => setNewTrackName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTrack()}
          placeholder="Track name, e.g. Main Stage"
          className="neu-border px-3 py-1.5 font-mono text-xs"
        />
        <Button size="sm" onClick={handleAddTrack}>
          <Plus size={14} className="mr-1" /> Add track
        </Button>
      </div>

      {tracks.length === 0 ? (
        <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-500">
          Add at least one track to start placing sessions on the grid.
        </div>
      ) : (
        <div className="neu-border overflow-x-auto bg-white">
          <div
            className="grid"
            style={{ gridTemplateColumns: `60px repeat(${tracks.length}, minmax(220px, 1fr))` }}
          >
            {/* Header row */}
            <div className="border-b border-black" />
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between border-b border-l border-black px-3 py-2"
                style={{ borderTop: `4px solid ${track.color}` }}
              >
                <span className="font-mono text-xs font-bold uppercase">{track.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddSession(track.id)}
                    title="Add session"
                    className="text-gray-500 hover:text-black"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => deleteTrack(track.id)}
                    title="Delete track"
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Time grid */}
            <div className="relative" style={{ height: gridHeight }}>
              {Array.from({ length: totalSlots / (60 / SLOT_MINUTES) }, (_, hourIdx) => (
                <div
                  key={hourIdx}
                  className="absolute right-1 -translate-y-1/2 font-mono text-[10px] text-gray-400"
                  style={{ top: hourIdx * (60 / SLOT_MINUTES) * ROW_HEIGHT_PX }}
                >
                  {DAY_START_HOUR + hourIdx}:00
                </div>
              ))}
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                ref={gridRef}
                className="relative border-l border-black"
                style={{ height: gridHeight }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* Hour gridlines */}
                {Array.from({ length: totalSlots / (60 / SLOT_MINUTES) }, (_, hourIdx) => (
                  <div
                    key={hourIdx}
                    className="absolute left-0 right-0 border-t border-gray-200"
                    style={{ top: hourIdx * (60 / SLOT_MINUTES) * ROW_HEIGHT_PX }}
                  />
                ))}

                {sessionsForDay
                  .filter((s) => s.track_id === track.id)
                  .map((session) => {
                    const startMin = toMinutesFromDayStart(session.start_time, activeDay);
                    const endMin = toMinutesFromDayStart(session.end_time, activeDay);
                    const top = ((startMin - dayStartMinutes) / SLOT_MINUTES) * ROW_HEIGHT_PX;
                    const height = ((endMin - startMin) / SLOT_MINUTES) * ROW_HEIGHT_PX;
                    return (
                      <div
                        key={session.id}
                        id={`session-block-${session.id}`}
                        className="absolute left-1 right-1 cursor-grab overflow-hidden rounded border-2 border-black p-1.5 text-white shadow-[2px_2px_0_#000] active:cursor-grabbing"
                        style={{ top, height, backgroundColor: track.color, minHeight: 20 }}
                        onPointerDown={(e) => onPointerDown(e, session, "move")}
                        onDoubleClick={() => setEditingSession(session)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[11px] font-bold leading-tight">
                            {session.title}
                          </span>
                          <GripVertical size={12} className="mt-0.5 shrink-0 opacity-70" />
                        </div>
                        {/* Resize handle */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-black/20"
                          onPointerDown={(e) => onPointerDown(e, session, "resize-end")}
                        />
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}

      {editingSession && (
        <SessionEditDialog
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={(updates) => {
            updateSession({ id: editingSession.id, ...updates });
            setEditingSession(null);
          }}
          onDelete={() => {
            deleteSession(editingSession.id);
            setEditingSession(null);
          }}
        />
      )}
    </div>
  );
}

function SessionEditDialog({
  session,
  onClose,
  onSave,
  onDelete,
}: {
  session: ScheduleSession;
  onClose: () => void;
  onSave: (updates: Partial<ScheduleSession>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [speaker, setSpeaker] = useState(session.speaker ?? "");
  const [location, setLocation] = useState(session.location ?? "");
  const [description, setDescription] = useState(session.description ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="neu-border w-full max-w-md space-y-3 bg-white p-5">
        <h3 className="font-display text-lg font-bold">Edit session</h3>
        <input
          className="neu-border w-full px-3 py-2 font-mono text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <input
          className="neu-border w-full px-3 py-2 font-mono text-sm"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker (optional)"
        />
        <input
          className="neu-border w-full px-3 py-2 font-mono text-sm"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Room / location (optional)"
        />
        <textarea
          className="neu-border w-full px-3 py-2 font-mono text-sm"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 font-mono text-xs font-bold uppercase text-red-600"
          >
            <Trash2 size={14} /> Delete
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  title,
                  speaker: speaker || null,
                  location: location || null,
                  description: description || null,
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
