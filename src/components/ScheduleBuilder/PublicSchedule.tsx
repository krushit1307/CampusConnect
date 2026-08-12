import React, { useState } from "react";
import Heart from "lucide-react/dist/esm/icons/heart";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import User from "lucide-react/dist/esm/icons/user";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEventSchedule } from "@/hooks/useEventSchedule";
import type { ScheduleSession } from "@/types/schedule";

interface PublicScheduleProps {
  eventId: string;
  currentUserId?: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function PublicSchedule({ eventId, currentUserId }: PublicScheduleProps) {
  const isMobile = useIsMobile();
  const { tracks, days, isLoading, toggleFavorite } = useEventSchedule(eventId, currentUserId);
  const [activeDay, setActiveDay] = useState(0);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-500">
        The schedule hasn't been published yet — check back soon.
      </div>
    );
  }

  const day = days[activeDay] ?? days[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setActiveDay(i)}
            className={`neu-border px-3 py-1.5 font-mono text-xs font-bold uppercase ${
              i === activeDay ? "bg-black text-white" : "bg-white"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {isMobile ? (
        <MobileDayList
          sessions={day.sessions}
          onToggleFavorite={(s) => toggleFavorite(s.id, !!s.is_favorited)}
          canFavorite={!!currentUserId}
        />
      ) : (
        <DesktopTrackGrid
          sessions={day.sessions}
          tracks={tracks}
          onToggleFavorite={(s) => toggleFavorite(s.id, !!s.is_favorited)}
          canFavorite={!!currentUserId}
        />
      )}
    </div>
  );
}

// ─── Mobile: a single vertical, chronologically-ordered list. ────────────────
// A multi-column grid can't be read on a phone, so every session — regardless
// of track — collapses into one scrollable timeline with the track shown as a
// small label instead of a column.

function MobileDayList({
  sessions,
  onToggleFavorite,
  canFavorite,
}: {
  sessions: ScheduleSession[];
  onToggleFavorite: (s: ScheduleSession) => void;
  canFavorite: boolean;
}) {
  return (
    <ol className="space-y-2">
      {sessions.map((session) => (
        <li key={session.id} className="neu-border flex gap-3 bg-white p-3">
          <div className="w-14 shrink-0 font-mono text-xs font-bold text-gray-600">
            {formatTime(session.start_time)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-display text-sm font-bold leading-tight">{session.title}</h4>
              {canFavorite && (
                <button
                  onClick={() => onToggleFavorite(session)}
                  aria-label={session.is_favorited ? "Remove from my schedule" : "Add to my schedule"}
                  className="shrink-0"
                >
                  <Heart
                    size={18}
                    className={session.is_favorited ? "fill-red-500 text-red-500" : "text-gray-400"}
                  />
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-gray-500">
              <span>{session.track_name}</span>
              {session.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {session.location}
                </span>
              )}
              {session.speaker && (
                <span className="flex items-center gap-1">
                  <User size={11} /> {session.speaker}
                </span>
              )}
            </div>
            {session.description && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-600">{session.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Desktop: parallel-track grid, one column per track. ─────────────────────

function DesktopTrackGrid({
  sessions,
  tracks,
  onToggleFavorite,
  canFavorite,
}: {
  sessions: ScheduleSession[];
  tracks: { id: string; name: string; color: string }[];
  onToggleFavorite: (s: ScheduleSession) => void;
  canFavorite: boolean;
}) {
  const dayDate = sessions[0]?.start_time.slice(0, 10);
  const HOUR_PX = 64;
  const DAY_START_HOUR = 7;

  const topFor = (iso: string) => {
    const d = new Date(iso);
    const hourStart = new Date(`${dayDate}T00:00:00`);
    const minutes = (d.getTime() - hourStart.getTime()) / 60000 - DAY_START_HOUR * 60;
    return (minutes / 60) * HOUR_PX;
  };
  const heightFor = (start: string, end: string) =>
    ((new Date(end).getTime() - new Date(start).getTime()) / 3600000) * HOUR_PX;

  return (
    <div className="neu-border overflow-x-auto bg-white">
      <div
        className="grid"
        style={{ gridTemplateColumns: `70px repeat(${tracks.length}, minmax(200px, 1fr))` }}
      >
        <div />
        {tracks.map((t) => (
          <div
            key={t.id}
            className="border-b border-l border-black px-3 py-2 font-mono text-xs font-bold uppercase"
            style={{ borderTop: `4px solid ${t.color}` }}
          >
            {t.name}
          </div>
        ))}

        <div className="relative" style={{ height: 16 * HOUR_PX }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className="absolute right-1 -translate-y-1/2 font-mono text-[10px] text-gray-400"
              style={{ top: i * HOUR_PX }}
            >
              {DAY_START_HOUR + i}:00
            </div>
          ))}
        </div>

        {tracks.map((track) => (
          <div key={track.id} className="relative border-l border-black" style={{ height: 16 * HOUR_PX }}>
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * HOUR_PX }} />
            ))}
            {sessions
              .filter((s) => s.track_id === track.id)
              .map((session) => (
                <div
                  key={session.id}
                  className="group absolute left-1 right-1 overflow-hidden rounded border-2 border-black p-2 text-white shadow-[2px_2px_0_#000]"
                  style={{
                    top: topFor(session.start_time),
                    height: Math.max(heightFor(session.start_time, session.end_time), 28),
                    backgroundColor: track.color,
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-mono text-xs font-bold leading-tight">{session.title}</span>
                    {canFavorite && (
                      <button
                        onClick={() => onToggleFavorite(session)}
                        aria-label={session.is_favorited ? "Remove from my schedule" : "Add to my schedule"}
                      >
                        <Heart
                          size={14}
                          className={session.is_favorited ? "fill-white" : "opacity-60"}
                        />
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-[10px] opacity-90">
                    {formatTime(session.start_time)} – {formatTime(session.end_time)}
                    {session.speaker ? ` · ${session.speaker}` : ""}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
