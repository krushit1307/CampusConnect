import React, { useState, useMemo } from "react";
import {
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  Layers,
  TrendingUp,
  Users,
  Zap,
  Calendar,
  Download,
  Filter,
  RefreshCw,
} from "lucide-react";
import StudyStreakCalendar, { StreakCalendarLegend } from "./StudyStreakCalendar";
import StudyHourChart from "./StudyHourChart";
import StudyLeaderboard from "./StudyLeaderboard";
import StudyGoalProgress from "./StudyGoalProgress";
import { useStudyGroupAnalytics } from "@/hooks/useStudyGroupAnalytics";

type TimeRange = "1m" | "3m" | "6m" | "1y";

/**
 * Main analytics dashboard combining KPI cards, a scrollable weekly hour
 * chart, a contribution-style heatmap calendar, goal progress rings,
 * group performance leaderboard, and per-course breakdowns.
 */
export default function StudyGroupAnalyticsDashboard() {
  const { activity, streakData, rankings, weeklyHours, courseDistribution } =
    useStudyGroupAnalytics();

  const [timeRange, setTimeRange] = useState<TimeRange>("6m");
  const [activeTab, setActiveTab] = useState<"overview" | "heatmap" | "leaderboard" | "courses">(
    "overview",
  );

  const filteredActivity = useMemo(() => {
    const now = new Date();
    const monthsMap: Record<TimeRange, number> = {
      "1m": 1,
      "3m": 3,
      "6m": 6,
      "1y": 12,
    };
    const monthsBack = monthsMap[timeRange];
    const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    return activity.filter((a) => new Date(a.date) >= cutoff);
  }, [activity, timeRange]);

  const totalHoursAllTime = useMemo(
    () => Math.round(activity.reduce((s, a) => s + a.hoursStudied, 0)),
    [activity],
  );

  const totalSessionsAllTime = useMemo(
    () => activity.reduce((s, a) => s + a.sessionsAttended, 0),
    [activity],
  );

  const avgDailyHours = useMemo(() => {
    if (activity.length === 0) return 0;
    return Math.round((activity.reduce((s, a) => s + a.hoursStudied, 0) / 365) * 10) / 10;
  }, [activity]);

  const courseData = useMemo(() => {
    return Object.entries(courseDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([course, hours]) => ({
        course,
        hours: Math.round(hours * 10) / 10,
      }));
  }, [courseDistribution]);

  const maxCourseHours = useMemo(
    () => Math.max(...courseData.map((c) => c.hours), 1),
    [courseData],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-violet-900/60 via-indigo-900/40 to-slate-900 border border-violet-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-5 bottom-0 w-48 h-48 bg-indigo-500/8 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-violet-500/20 text-violet-300 text-xs px-3 py-1 rounded-full font-semibold border border-violet-500/30 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Study Group Analytics
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> 365 days of data
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-violet-200 bg-clip-text text-transparent">
              Study Analytics Dashboard
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Track your study habits across all enrolled circles. Monitor streaks, weekly targets,
              and group performance to stay ahead.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-medium transition flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-violet-600/30 transition flex items-center gap-2 border border-violet-400/20 text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh Data
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs + Time Range */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {[
              {
                key: "overview" as const,
                label: "Overview",
                icon: <BarChart3 className="w-4 h-4" />,
              },
              {
                key: "heatmap" as const,
                label: "Activity Map",
                icon: <Flame className="w-4 h-4" />,
              },
              {
                key: "leaderboard" as const,
                label: "Leaderboard",
                icon: <TrendingUp className="w-4 h-4" />,
              },
              { key: "courses" as const, label: "By Course", icon: <Layers className="w-4 h-4" /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                  activeTab === key
                    ? "bg-violet-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            {(["1m", "3m", "6m", "1y"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
                  timeRange === range
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                    : "bg-slate-900/60 text-slate-500 border border-slate-800 hover:text-slate-300 hover:bg-slate-800"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards - Always visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={<Flame className="w-5 h-5" />}
            label="Current Streak"
            value={`${streakData.currentStreak}`}
            unit="days"
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
          />
          <KPICard
            icon={<Clock className="w-5 h-5" />}
            label="This Month"
            value={`${streakData.totalHoursThisMonth}`}
            unit="hours"
            color="text-cyan-400"
            bgColor="bg-cyan-500/10"
            borderColor="border-cyan-500/30"
          />
          <KPICard
            icon={<Zap className="w-5 h-5" />}
            label="Total Sessions"
            value={`${totalSessionsAllTime}`}
            unit="all time"
            color="text-indigo-400"
            bgColor="bg-indigo-500/10"
            borderColor="border-indigo-500/30"
          />
          <KPICard
            icon={<BookOpen className="w-5 h-5" />}
            label="Avg Daily"
            value={`${avgDailyHours}`}
            unit="hrs/day"
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
          />
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Chart + Heatmap */}
            <div className="lg:col-span-2 space-y-6">
              {/* Weekly Hours Chart */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Weekly Study Hours
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Total: {totalHoursAllTime}h
                  </span>
                </div>
                <StudyHourChart data={weeklyHours} visibleWeeks={14} />
              </div>

              {/* Activity Heatmap */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Study Activity Heatmap
                    </h2>
                  </div>
                  <StreakCalendarLegend />
                </div>
                <StudyStreakCalendar
                  activity={filteredActivity}
                  weeksToShow={timeRange === "1m" ? 5 : timeRange === "3m" ? 13 : 26}
                />
              </div>
            </div>

            {/* Right Column: Goals + Streak */}
            <div className="space-y-6">
              <StudyGoalProgress
                weeklyHoursCompleted={streakData.weeklyHoursCompleted}
                weeklyGoalHours={streakData.weeklyGoalHours}
                monthlyHoursCompleted={streakData.monthlyHoursCompleted}
                monthlyHoursTarget={streakData.monthlyHoursTarget}
              />

              {/* Streak Stats */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Streak Stats
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">Longest Streak</span>
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {streakData.longestStreak} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">Total Study Days</span>
                    <span className="text-sm font-bold font-mono text-cyan-400">
                      {streakData.totalStudyDays}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">Current Streak</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {streakData.currentStreak} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">Best Streak Rate</span>
                    <span className="text-sm font-bold font-mono text-violet-400">
                      {streakData.longestStreak > 0
                        ? Math.round((streakData.currentStreak / streakData.longestStreak) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>

                {/* 7-day streak visualizer */}
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                    Streak Health
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-mono font-bold ${
                          i < streakData.currentStreak
                            ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                            : "bg-slate-800/40 text-slate-600 border border-slate-800"
                        }`}
                      >
                        {i < streakData.currentStreak ? "🔥" : (i + 1).toString()}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 mt-2 block text-center">
                    {Math.max(0, 7 - streakData.currentStreak)} days until 7-day streak
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "heatmap" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Full Year Study Activity
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <StreakCalendarLegend />
                </div>
              </div>
              <StudyStreakCalendar activity={activity} weeksToShow={52} />
            </div>

            {/* Monthly Breakdown Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider mb-4">
                Monthly Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-2 text-slate-500 font-medium">Month</th>
                      <th className="text-right py-2 text-slate-500 font-medium">Hours</th>
                      <th className="text-right py-2 text-slate-500 font-medium">Sessions</th>
                      <th className="text-right py-2 text-slate-500 font-medium">Avg/Day</th>
                      <th className="text-right py-2 text-slate-500 font-medium">Days Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateMonthlyBreakdown(activity).map((row) => (
                      <tr
                        key={row.month}
                        className="border-b border-slate-800/40 hover:bg-slate-800/20 transition"
                      >
                        <td className="py-2.5 text-slate-300 font-semibold">{row.month}</td>
                        <td className="py-2.5 text-right text-cyan-400 font-bold">
                          {row.hours.toFixed(1)}h
                        </td>
                        <td className="py-2.5 text-right text-violet-400">{row.sessions}</td>
                        <td className="py-2.5 text-right text-slate-400">
                          {row.avgPerDay.toFixed(1)}h
                        </td>
                        <td className="py-2.5 text-right text-emerald-400">{row.daysActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                Group Performance Leaderboard
              </h2>
            </div>
            <StudyLeaderboard rankings={rankings} />
          </div>
        )}

        {activeTab === "courses" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Course Distribution Bars */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Hours by Course
                </h2>
              </div>
              <div className="space-y-4">
                {courseData.map((course, idx) => {
                  const pct = Math.round((course.hours / maxCourseHours) * 100);
                  const colors = [
                    "from-cyan-500 to-blue-500",
                    "from-violet-500 to-purple-500",
                    "from-amber-500 to-orange-500",
                    "from-emerald-500 to-teal-500",
                    "from-rose-500 to-pink-500",
                  ];
                  return (
                    <div key={course.course}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-mono font-bold text-slate-200">
                          {course.course}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{course.hours}h</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Course Stats Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Course Engagement Summary
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-2 text-slate-500 font-medium">Course</th>
                      <th className="text-right py-2 text-slate-500 font-medium">Total Hrs</th>
                      <th className="text-right py-2 text-slate-500 font-medium">% of Total</th>
                      <th className="text-right py-2 text-slate-500 font-medium">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseData.map((course, idx) => {
                      const totalHrs = courseData.reduce((s, c) => s + c.hours, 0);
                      const sharePct =
                        totalHrs > 0 ? Math.round((course.hours / totalHrs) * 100) : 0;
                      return (
                        <tr
                          key={course.course}
                          className="border-b border-slate-800/40 hover:bg-slate-800/20 transition"
                        >
                          <td className="py-2.5 text-slate-200 font-bold">{course.course}</td>
                          <td className="py-2.5 text-right text-cyan-400">{course.hours}h</td>
                          <td className="py-2.5 text-right text-slate-400">{sharePct}%</td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                                idx === 0
                                  ? "bg-amber-500/20 text-amber-300"
                                  : idx === 1
                                    ? "bg-slate-400/20 text-slate-300"
                                    : idx === 2
                                      ? "bg-orange-600/20 text-orange-300"
                                      : "bg-slate-800 text-slate-500"
                              }`}
                            >
                              #{idx + 1}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  unit,
  color,
  bgColor,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-2xl p-4 transition-all hover:scale-[1.02] duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
        <span className="text-[10px] font-mono text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function generateMonthlyBreakdown(
  activity: Array<{
    date: string;
    hoursStudied: number;
    sessionsAttended: number;
  }>,
) {
  const months: Record<string, { hours: number; sessions: number; daysActive: number }> = {};
  activity.forEach((a) => {
    const monthKey = a.date.substring(0, 7); // YYYY-MM
    if (!months[monthKey]) months[monthKey] = { hours: 0, sessions: 0, daysActive: 0 };
    months[monthKey].hours += a.hoursStudied;
    months[monthKey].sessions += a.sessionsAttended;
    months[monthKey].daysActive++;
  });

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, data]) => {
      const [year, month] = key.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      return {
        month: `${monthNames[month - 1]} ${year}`,
        hours: data.hours,
        sessions: data.sessions,
        avgPerDay: daysInMonth > 0 ? data.hours / daysInMonth : 0,
        daysActive: data.daysActive,
      };
    });
}
