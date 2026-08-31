// =============================================================================
// File: src/components/festivals/InteractiveFestivalRoadmap.tsx
// Issue: #3944 - Build an 'Interactive "Event Roadmap" for Multi-Day Festivals'
// Description: Multi-day, multi-track festival schedule visualizer with Gantt
//              time-matrix grid, conflict detection, and .ics itinerary exporter.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Download,
  Search,
  Filter,
  Sparkles,
  AlertTriangle,
  Users,
  Building,
  Info,
  ChevronRight,
  Share2,
  CalendarCheck,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  FestivalDaySchedule,
  FestivalSession,
  FestivalTrack,
} from "@/types/festivalRoadmap";
import {
  STANDARD_FESTIVAL_TRACKS,
  getMockFestivalSchedule,
  minutesToTimeString,
  timeStringToMinutes,
  detectItineraryConflicts,
  exportItineraryToICal,
  syncPersonalItinerary,
} from "@/services/festivalRoadmapService";

interface InteractiveFestivalRoadmapProps {
  festivalId?: string;
  festivalTitle?: string;
  initialSchedules?: FestivalDaySchedule[];
  currentUserId?: string;
}

export const InteractiveFestivalRoadmap: React.FC<InteractiveFestivalRoadmapProps> = ({
  festivalId = "fest-summit-2026",
  festivalTitle = "CampusConnect Innovation & Tech Summit 2026",
  initialSchedules,
  currentUserId = "usr-demo",
}) => {
  const [schedules] = useState<FestivalDaySchedule[]>(
    initialSchedules || getMockFestivalSchedule(festivalId)
  );

  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState<boolean>(false);
  const [bookmarkedSessionIds, setBookmarkedSessionIds] = useState<Set<string>>(
    new Set(["sess-101", "sess-102", "sess-103"]) // default sample bookmarks with 1 deliberate conflict
  );

  const [selectedSessionForModal, setSelectedSessionForModal] = useState<FestivalSession | null>(null);
  const [isItineraryModalOpen, setIsItineraryModalOpen] = useState<boolean>(false);

  // Active day schedule
  const activeDaySchedule = useMemo(() => {
    return schedules.find((s) => s.dayNumber === selectedDayNumber) || schedules[0];
  }, [schedules, selectedDayNumber]);

  // All sessions across all days
  const allSessions = useMemo(() => {
    return schedules.flatMap((s) => s.sessions);
  }, [schedules]);

  // User's bookmarked sessions array
  const bookmarkedSessions = useMemo(() => {
    return allSessions.filter((s) => bookmarkedSessionIds.has(s.id));
  }, [allSessions, bookmarkedSessionIds]);

  // Conflict detection
  const { conflictSessionIds, conflictPairs } = useMemo(() => {
    return detectItineraryConflicts(bookmarkedSessions);
  }, [bookmarkedSessions]);

  // Filtered sessions for current active day
  const filteredSessions = useMemo(() => {
    return activeDaySchedule.sessions.filter((session) => {
      // Track filter
      if (selectedTrackId !== "all" && session.trackId !== selectedTrackId) {
        return false;
      }
      // Bookmark filter
      if (showOnlyBookmarked && !bookmarkedSessionIds.has(session.id)) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = session.title.toLowerCase().includes(q);
        const matchesAbstract = session.abstract.toLowerCase().includes(q);
        const matchesRoom = session.venueRoom.toLowerCase().includes(q);
        const matchesSpeaker = session.speakers.some((sp) => sp.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAbstract && !matchesRoom && !matchesSpeaker) {
          return false;
        }
      }
      return true;
    });
  }, [activeDaySchedule, selectedTrackId, showOnlyBookmarked, bookmarkedSessionIds, searchQuery]);

  // Toggle bookmark handler
  const handleToggleBookmark = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setBookmarkedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      // Sync in background
      syncPersonalItinerary(currentUserId, festivalId, Array.from(next));
      return next;
    });
  };

  // Time slots for current active day (hourly markers from startHour to endHour)
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let h = activeDaySchedule.startHour; h <= activeDaySchedule.endHour; h++) {
      slots.push(h * 60);
    }
    return slots;
  }, [activeDaySchedule]);

  // Active tracks to display
  const displayTracks = useMemo(() => {
    if (selectedTrackId === "all") {
      return activeDaySchedule.tracks;
    }
    return activeDaySchedule.tracks.filter((t) => t.id === selectedTrackId);
  }, [activeDaySchedule, selectedTrackId]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Itinerary Action Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Calendar className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Multi-Track Festival Roadmap
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Interactive Conference Grid, Conflict Resolution Engine & Personalized Itinerary Builder
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsItineraryModalOpen(true)}
              className="neu-border relative flex items-center gap-1.5 bg-zinc-100 font-mono text-xs font-bold uppercase text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white"
            >
              <Bookmark className="h-3.5 w-3.5" />
              My Itinerary ({bookmarkedSessions.length})
              {conflictSessionIds.size > 0 && (
                <span className="ml-1 flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </Button>

            <Button
              size="sm"
              onClick={() => exportItineraryToICal(bookmarkedSessions, festivalTitle)}
              disabled={bookmarkedSessions.length === 0}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              <Download className="h-3.5 w-3.5" />
              Export .ICS (iCal)
            </Button>
          </div>
        </div>

        {/* Conflict Alert Banner if any bookmarked sessions overlap */}
        {conflictSessionIds.size > 0 && (
          <div className="neu-border mt-4 flex items-center justify-between border-rose-500 bg-rose-50 p-3 dark:border-rose-700 dark:bg-rose-950/40">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span className="font-mono text-xs font-bold text-rose-900 dark:text-rose-200">
                Scheduling Conflict Detected: You have {conflictPairs.length} overlapping session(s)
                bookmarked in your personal itinerary!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsItineraryModalOpen(true)}
              className="font-mono text-xs font-black uppercase text-rose-700 underline hover:text-rose-900 dark:text-rose-300"
            >
              Review Conflicts →
            </button>
          </div>
        )}

        {/* Day Selector & Search/Filter Controls */}
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {/* Day Tabs */}
          <div className="flex flex-wrap gap-2">
            {schedules.map((sch) => (
              <button
                key={sch.dayNumber}
                type="button"
                onClick={() => setSelectedDayNumber(sch.dayNumber)}
                className={`neu-border px-4 py-2 font-mono text-xs font-black uppercase transition-colors ${
                  selectedDayNumber === sch.dayNumber
                    ? "bg-black text-white dark:bg-lime dark:text-black"
                    : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {sch.dayLabel}
              </button>
            ))}
          </div>

          {/* Search & Bookmark Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search sessions, topics, speakers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="neu-border pl-8 pr-3 py-1.5 font-mono text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white w-64"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOnlyBookmarked((prev) => !prev)}
              className={`neu-border flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                showOnlyBookmarked
                  ? "bg-lime text-black"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <BookmarkCheck className="h-3.5 w-3.5" />
              Bookmarked Only
            </button>
          </div>
        </div>

        {/* Track Filter Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedTrackId("all")}
            className={`rounded px-2.5 py-1 font-mono text-[11px] font-bold uppercase transition-colors ${
              selectedTrackId === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            All Tracks ({activeDaySchedule.sessions.length})
          </button>
          {STANDARD_FESTIVAL_TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTrackId(t.id)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] font-bold uppercase transition-colors ${
                selectedTrackId === t.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: t.colorHex }}
              />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Gantt / Multi-Track Time Matrix Visualizer */}
      <div className="neu-border overflow-x-auto bg-white p-4 dark:bg-zinc-900">
        <div className="min-w-[900px]">
          {/* Tracks Header Row */}
          <div
            className="grid gap-3 border-b-2 border-black pb-3 dark:border-zinc-700"
            style={{
              gridTemplateColumns: `80px repeat(${displayTracks.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="font-mono text-xs font-black uppercase text-zinc-400 self-end">
              Time
            </div>
            {displayTracks.map((track) => (
              <div
                key={track.id}
                className="rounded border-l-4 p-2"
                style={{
                  borderLeftColor: track.colorHex,
                  backgroundColor: track.bgLightHex + "40",
                }}
              >
                <span className="font-mono text-xs font-black uppercase text-zinc-900 dark:text-white">
                  {track.name}
                </span>
                <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                  {track.description}
                </p>
              </div>
            ))}
          </div>

          {/* Timeline & Sessions Matrix Body */}
          <div className="relative mt-4 space-y-4">
            {timeSlots.map((slotMin) => {
              const timeLabel = minutesToTimeString(slotMin);
              const nextSlotMin = slotMin + 60;

              return (
                <div
                  key={slotMin}
                  className="grid gap-3 border-t border-zinc-100 py-3 dark:border-zinc-800/80 min-h-[90px]"
                  style={{
                    gridTemplateColumns: `80px repeat(${displayTracks.length}, minmax(0, 1fr))`,
                  }}
                >
                  {/* Left Time Column Marker */}
                  <div className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {timeLabel}
                  </div>

                  {/* Track Cells */}
                  {displayTracks.map((track) => {
                    // Find sessions starting in this hour slot
                    const slotSessions = filteredSessions.filter(
                      (s) =>
                        s.trackId === track.id &&
                        s.startMinutesFromMidnight >= slotMin &&
                        s.startMinutesFromMidnight < nextSlotMin
                    );

                    return (
                      <div key={track.id} className="space-y-2">
                        {slotSessions.map((session) => {
                          const isBookmarked = bookmarkedSessionIds.has(session.id);
                          const hasConflict = conflictSessionIds.has(session.id);

                          return (
                            <div
                              key={session.id}
                              onClick={() => setSelectedSessionForModal(session)}
                              className={`neu-border relative cursor-pointer p-3 transition-all duration-150 hover:shadow-[4px_4px_0_0_#000] ${
                                hasConflict
                                  ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40"
                                  : isBookmarked
                                  ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                                  : session.isKeynote
                                  ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-500"
                                  : "bg-white dark:bg-zinc-800"
                              }`}
                            >
                              {/* Keynote / Conflict Badge */}
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-mono text-[10px] font-black uppercase text-zinc-500">
                                  {session.startTime} - {session.endTime} ({session.durationMinutes}m)
                                </span>

                                <div className="flex items-center gap-1">
                                  {hasConflict && (
                                    <span className="rounded bg-rose-200 px-1 py-0.5 font-mono text-[9px] font-black uppercase text-rose-900 dark:bg-rose-900 dark:text-rose-200">
                                      Conflict
                                    </span>
                                  )}
                                  {session.isKeynote && (
                                    <span className="rounded bg-amber-200 px-1 py-0.5 font-mono text-[9px] font-black uppercase text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                                      ⭐ Plenary
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleBookmark(session.id, e)}
                                    className="p-1 text-zinc-400 hover:text-emerald-600 transition-colors"
                                  >
                                    {isBookmarked ? (
                                      <BookmarkCheck className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <Bookmark className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Title */}
                              <h4 className="font-mono text-xs font-black leading-tight text-zinc-900 dark:text-white">
                                {session.title}
                              </h4>

                              {/* Venue Room & Capacity */}
                              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {session.venueRoom}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {session.currentRsvpCount}/{session.capacity}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Session Inspector Modal */}
      <Dialog
        open={Boolean(selectedSessionForModal)}
        onOpenChange={(open) => !open && setSelectedSessionForModal(null)}
      >
        <DialogContent className="neu-border max-w-2xl bg-white p-6 dark:bg-zinc-900">
          {selectedSessionForModal && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase text-white"
                    style={{
                      backgroundColor:
                        STANDARD_FESTIVAL_TRACKS.find(
                          (t) => t.id === selectedSessionForModal.trackId
                        )?.colorHex || "#000",
                    }}
                  >
                    {selectedSessionForModal.trackName}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">
                    Day {selectedSessionForModal.dayNumber} • {selectedSessionForModal.startTime} -{" "}
                    {selectedSessionForModal.endTime}
                  </span>
                </div>
                <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white">
                  {selectedSessionForModal.title}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {selectedSessionForModal.venueRoom} • {selectedSessionForModal.buildingName}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4 font-mono text-xs">
                <div>
                  <h5 className="font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                    Abstract & Learning Objectives
                  </h5>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {selectedSessionForModal.abstract}
                  </p>
                </div>

                {/* Speakers */}
                {selectedSessionForModal.speakers.length > 0 && (
                  <div>
                    <h5 className="font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-2">
                      Featured Presenters ({selectedSessionForModal.speakers.length})
                    </h5>
                    <div className="space-y-2">
                      {selectedSessionForModal.speakers.map((spk) => (
                        <div
                          key={spk.id}
                          className="neu-border bg-zinc-50 p-2.5 dark:bg-zinc-800 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">{spk.name}</p>
                            <p className="text-[10px] text-zinc-500">
                              {spk.title} • {spk.companyOrOrg}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <Button
                    onClick={() => handleToggleBookmark(selectedSessionForModal.id)}
                    className={`neu-border font-mono text-xs font-bold uppercase ${
                      bookmarkedSessionIds.has(selectedSessionForModal.id)
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-lime text-black hover:bg-lime/80"
                    }`}
                  >
                    {bookmarkedSessionIds.has(selectedSessionForModal.id) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 mr-1.5" /> Bookmarked in Itinerary
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4 mr-1.5" /> Add to My Itinerary
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Personal Itinerary Drawer / Modal */}
      <Dialog open={isItineraryModalOpen} onOpenChange={setIsItineraryModalOpen}>
        <DialogContent className="neu-border max-w-3xl bg-white p-6 dark:bg-zinc-900">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-emerald-600" />
                My Personalized Festival Itinerary
              </DialogTitle>
              <Button
                size="sm"
                onClick={() => exportItineraryToICal(bookmarkedSessions, festivalTitle)}
                disabled={bookmarkedSessions.length === 0}
                className="neu-border bg-lime font-mono text-xs font-bold text-black"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Download .ICS
              </Button>
            </div>
            <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {bookmarkedSessions.length} sessions bookmarked across {schedules.length} festival days.
            </DialogDescription>
          </DialogHeader>

          {/* Conflict Alert in Modal */}
          {conflictPairs.length > 0 && (
            <div className="mt-3 rounded border border-rose-500 bg-rose-50 p-3 text-xs font-mono dark:bg-rose-950/40">
              <span className="font-black text-rose-800 dark:text-rose-200">
                ⚠️ Overlapping Sessions in Your Schedule:
              </span>
              <ul className="mt-1 list-disc pl-4 space-y-1 text-rose-700 dark:text-rose-300">
                {conflictPairs.map((pair, idx) => (
                  <li key={idx}>
                    <strong>"{pair.sessionA.title}"</strong> ({pair.sessionA.startTime}) overlaps with{" "}
                    <strong>"{pair.sessionB.title}"</strong> ({pair.sessionB.startTime})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bookmarked Sessions List */}
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {bookmarkedSessions.length === 0 ? (
              <div className="neu-border bg-zinc-50 p-8 text-center font-mono text-xs text-zinc-500">
                No sessions bookmarked yet. Click the bookmark icon on any session card in the roadmap to build your personal itinerary!
              </div>
            ) : (
              bookmarkedSessions.map((session) => (
                <div
                  key={session.id}
                  className={`neu-border flex items-center justify-between p-3 ${
                    conflictSessionIds.has(session.id)
                      ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20"
                      : "bg-zinc-50 dark:bg-zinc-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-zinc-500">
                        Day {session.dayNumber} • {session.startTime} - {session.endTime}
                      </span>
                      <span className="font-mono text-[10px] font-black uppercase text-blue-600">
                        {session.trackName}
                      </span>
                    </div>
                    <h5 className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                      {session.title}
                    </h5>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {session.venueRoom} • {session.buildingName}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleBookmark(session.id)}
                    className="neu-border font-mono text-[10px] font-bold uppercase text-rose-600 hover:bg-rose-50"
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InteractiveFestivalRoadmap;
