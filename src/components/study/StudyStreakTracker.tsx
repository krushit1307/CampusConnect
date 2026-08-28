import { useState, useMemo } from "react";
import {
  Flame,
  TrendingUp,
  Calendar,
  Clock,
  Target,
  Award,
  Plus,
  Trash2,
  Zap,
  BarChart3,
} from "lucide-react";
import { useStudyStreak } from "../../hooks/useStudyStreak";

const LEVEL_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: "bg-slate-800/50", border: "border-slate-700/30", text: "text-slate-600" },
  1: { bg: "bg-emerald-900/40", border: "border-emerald-700/30", text: "text-emerald-400" },
  2: { bg: "bg-emerald-700/50", border: "border-emerald-500/30", text: "text-emerald-300" },
  3: { bg: "bg-emerald-500/60", border: "border-emerald-400/40", text: "text-emerald-200" },
  4: { bg: "bg-emerald-400", border: "border-emerald-300/50", text: "text-emerald-950" },
};

const LEVEL_LABELS = ["No study", "1–30 min", "31–60 min", "61–120 min", "120+ min"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface StatCardProps {
  icon: typeof Flame;
  label: string;
  value: string | number;
  subtitle?: string;
  colorClass: string;
}

function StatCard({ icon: Icon, label, value, subtitle, colorClass }: StatCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${colorClass}`}>
          <Icon size={12} />
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-xl font-bold text-slate-100 tabular-nums">{value}</span>
      {subtitle && (
        <span className="text-[10px] text-slate-500">{subtitle}</span>
      )}
    </div>
  );
}

export interface StudyStreakTrackerProps {
  userId?: string;
}

export default function StudyStreakTracker({ userId }: StudyStreakTrackerProps) {
  const { stats, heatmapData, logStudySession, clearAllData } = useStudyStreak();
  const [showLogModal, setShowLogModal] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    level: number;
    minutes: number;
  } | null>(null);

  // Group heatmap into weeks (columns) for rendering
  const weeks = useMemo(() => {
    const result: typeof heatmapData[] = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      result.push(heatmapData.slice(i, i + 7));
    }
    return result;
  }, [heatmapData]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = "";
    weeks.forEach((week, idx) => {
      if (week.length > 0) {
        const month = new Date(week[0].date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
        });
        if (month !== lastMonth) {
          labels.push({ month, weekIndex: idx });
          lastMonth = month;
        }
      }
    });
    return labels;
  }, [weeks]);

  const handleQuickLog = (minutes: number) => {
    logStudySession(minutes);
    setShowLogModal(false);
  };

  const handleCustomLog = () => {
    if (customMinutes > 0) {
      logStudySession(customMinutes);
      setShowLogModal(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/20">
            <Flame size={18} className="text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Study Streak</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {stats.currentStreak > 0
                ? `${stats.currentStreak} day${stats.currentStreak !== 1 ? "s" : ""} and counting!`
                : "Start studying to build your streak"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl px-3 py-2 transition-all"
          >
            <Plus size={14} />
            Log Session
          </button>
          <button
            onClick={clearAllData}
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
            aria-label="Clear all data"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard
          icon={Flame}
          label="Current Streak"
          value={`${stats.currentStreak}d`}
          subtitle={stats.longestStreak > 0 ? `Best: ${stats.longestStreak}d` : undefined}
          colorClass="bg-orange-500/15 text-orange-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Study Time"
          value={formatMinutes(stats.totalMinutes)}
          subtitle={`${stats.totalDaysStudied} day${stats.totalDaysStudied !== 1 ? "s" : ""}`}
          colorClass="bg-cyan-500/15 text-cyan-400"
        />
        <StatCard
          icon={Target}
          label="Avg / Day"
          value={formatMinutes(stats.averageMinutesPerDay)}
          subtitle={`${stats.totalSessions} total sessions`}
          colorClass="bg-violet-500/15 text-violet-400"
        />
      </div>

      {/* Heatmap */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Activity (Last 6 Months)
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-600 mr-1">Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`w-2.5 h-2.5 rounded-sm ${LEVEL_COLORS[level].bg} border ${LEVEL_COLORS[level].border}`}
              />
            ))}
            <span className="text-[9px] text-slate-600 ml-1">More</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1 ml-6">
            {monthLabels.map((label, i) => (
              <div
                key={i}
                className="text-[9px] font-mono text-slate-600"
                style={{
                  marginLeft: label.weekIndex === 0 ? 0 : undefined,
                  position: "relative",
                  left: 0,
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          {/* Day labels + grid */}
          <div className="flex gap-0">
            {/* Day of week labels */}
            <div className="flex flex-col gap-[3px] mr-1.5 pt-0">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((day, i) => (
                <div
                  key={i}
                  className="h-[11px] text-[8px] font-mono text-slate-600 flex items-center"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[3px]">
                  {week.map((day) => {
                    const colors = LEVEL_COLORS[day.level];
                    return (
                      <div
                        key={day.date}
                        className={`relative w-[11px] h-[11px] rounded-sm border ${colors.bg} ${colors.border} cursor-pointer hover:ring-1 hover:ring-slate-400/50 transition-all`}
                        onMouseEnter={() =>
                          setHoveredDay({
                            date: day.date,
                            level: day.level,
                            minutes: day.minutes,
                          })
                        }
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredDay && (
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            <Calendar size={10} className="text-slate-500" />
            <span className="text-slate-400">{formatDateLabel(hoveredDay.date)}</span>
            <span className="text-slate-600">·</span>
            <span className={LEVEL_COLORS[hoveredDay.level].text}>
              {hoveredDay.minutes > 0
                ? `${formatMinutes(hoveredDay.minutes)} — ${LEVEL_LABELS[hoveredDay.level]}`
                : "No study"}
            </span>
          </div>
        )}
      </div>

      {/* Streak Milestones */}
      <div className="border-t border-slate-700/40 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Award size={12} className="text-slate-500" />
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Streak Milestones
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { days: 3, label: "3 Days", icon: Zap },
            { days: 7, label: "1 Week", icon: Flame },
            { days: 30, label: "1 Month", icon: Award },
            { days: 100, label: "100 Days", icon: BarChart3 },
            { days: 365, label: "1 Year", icon: TrendingUp },
          ].map(({ days, label, icon: MilestoneIcon }) => {
            const achieved = stats.currentStreak >= days || stats.longestStreak >= days;
            return (
              <div
                key={days}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                  achieved
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-slate-800/50 border-slate-700/30 text-slate-600"
                }`}
              >
                <MilestoneIcon size={10} />
                {label}
                {achieved && <span>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Log Session Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h4 className="text-sm font-bold text-slate-100 mb-4">Log Study Session</h4>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { minutes: 15, label: "15m" },
                { minutes: 25, label: "25m" },
                { minutes: 45, label: "45m" },
                { minutes: 60, label: "1h" },
                { minutes: 90, label: "1.5h" },
                { minutes: 120, label: "2h" },
              ].map(({ minutes, label }) => (
                <button
                  key={minutes}
                  onClick={() => handleQuickLog(minutes)}
                  className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 text-xs font-mono rounded-xl py-2.5 transition-all"
                >
                  <Clock size={10} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <label className="text-[10px] font-mono text-slate-500 uppercase whitespace-nowrap">
                Custom
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-600">min</span>
              <button
                onClick={handleCustomLog}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs rounded-lg px-3 py-1.5 transition-colors"
              >
                Add
              </button>
            </div>

            <button
              onClick={() => setShowLogModal(false)}
              className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
