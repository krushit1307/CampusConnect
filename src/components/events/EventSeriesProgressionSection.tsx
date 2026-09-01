import React, { useState, useEffect } from "react";
import {
  EventSeriesProgressionService,
  EventSeries,
  UserSeriesProgress,
} from "@/services/eventSeriesProgressionService";
import { EventSeriesProgressBar } from "./EventSeriesProgressBar";
import { SeriesCompletionCelebrationModal } from "./SeriesCompletionCelebrationModal";
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Trophy,
  Award,
  ChevronRight,
  TrendingUp,
  Layers,
} from "lucide-react";

interface EventSeriesProgressionSectionProps {
  userId?: string;
  userName?: string;
}

export const EventSeriesProgressionSection: React.FC<EventSeriesProgressionSectionProps> = ({
  userId = "user-current-student-01",
  userName = "Alex Chen",
}) => {
  const [allSeries, setAllSeries] = useState<EventSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>("");
  const [progress, setProgress] = useState<UserSeriesProgress | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const list = EventSeriesProgressionService.getAllSeries();
    setAllSeries(list);
    if (list.length > 0) {
      setSelectedSeriesId(list[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedSeriesId) {
      const userProg = EventSeriesProgressionService.getUserSeriesProgress(
        userId,
        selectedSeriesId,
        userName,
      );
      setProgress({ ...userProg });
    }
  }, [selectedSeriesId, userId, userName]);

  const currentSeries = allSeries.find((s) => s.id === selectedSeriesId);

  const handleSimulateAttendance = (sessionId: string) => {
    if (!currentSeries) return;
    const result = EventSeriesProgressionService.recordAttendance(
      userId,
      currentSeries.id,
      sessionId,
      userName,
    );
    setProgress({ ...result.progress });
    if (result.justCompleted) {
      setShowCelebration(true);
    }
  };

  if (!currentSeries || !progress) return null;

  return (
    <div className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 shadow-lg space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Layers className="w-3.5 h-3.5" />
            Active Event Series Progression
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            {currentSeries.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {currentSeries.description}
          </p>
        </div>

        {allSeries.length > 1 && (
          <select
            value={selectedSeriesId}
            onChange={(e) => setSelectedSeriesId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border-0"
          >
            {allSeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Progress Bar Card */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
        <EventSeriesProgressBar
          eventsAttended={progress.eventsAttended}
          totalEvents={progress.totalEvents}
          completionPercentage={progress.completionPercentage}
          isCompleted={progress.isCompleted}
        />

        {progress.isCompleted && (
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span>Series 100% Completed! Reward Ready: {currentSeries.rewardTitle}</span>
            </div>
            <button
              onClick={() => setShowCelebration(true)}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
            >
              View Reward
            </button>
          </div>
        )}
      </div>

      {/* Milestones and Rewards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {currentSeries.milestones.map((m) => {
          const isUnlocked = progress.eventsAttended >= m.requiredAttendedCount;
          return (
            <div
              key={m.id}
              className={`p-4 rounded-2xl border transition-all ${
                isUnlocked
                  ? "bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Checkpoint ({m.requiredAttendedCount} Events)
                </span>
                {isUnlocked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">Locked</span>
                )}
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                {m.milestoneName}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {m.perkDescription}
              </p>
            </div>
          );
        })}
      </div>

      {/* Sessions Timeline & Attendance Check-In Simulation */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-purple-500" />
          Series Curriculum Sessions ({currentSeries.sessions.length} Workshops)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentSeries.sessions.map((session) => {
            const isAttended = progress.attendedEventIds.includes(session.id);
            return (
              <div
                key={session.id}
                className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                  isAttended
                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Session {session.sessionNumber}
                    </span>
                    {isAttended && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                        Attended
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {session.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-purple-400" />
                      {new Date(session.eventDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-400" />
                      {session.location}
                    </span>
                  </div>
                </div>

                <div>
                  {isAttended ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-1" />
                  ) : (
                    <button
                      onClick={() => handleSimulateAttendance(session.id)}
                      className="px-3 py-1 rounded-xl text-xs font-semibold bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 transition-colors whitespace-nowrap"
                    >
                      Check-In
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Celebration Modal */}
      <SeriesCompletionCelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        series={currentSeries}
        progress={progress}
        onRewardClaimed={() => {
          const userProg = EventSeriesProgressionService.getUserSeriesProgress(
            userId,
            currentSeries.id,
            userName,
          );
          setProgress({ ...userProg });
        }}
      />
    </div>
  );
};
