import React, { useState, useCallback } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Users from "lucide-react/dist/esm/icons/users";
import Eye from "lucide-react/dist/esm/icons/eye";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import CalendarCheck from "lucide-react/dist/esm/icons/calendar-check";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Filter from "lucide-react/dist/esm/icons/filter";
import BarChart2 from "lucide-react/dist/esm/icons/bar-chart-2";
import { SponsorshipValueCalculator } from "@/components/sponsorship/SponsorshipValueCalculator";
import { toast } from "sonner";
import { SkillRadarChart } from "@/components/Clubs/SkillGap/SkillRadarChart";
import { SkillGapSuggestions } from "@/components/Clubs/SkillGap/SkillGapSuggestions";
import { ClubSkillGapService, SkillCount } from "@/services/clubSkillGapService";

// ─── Types ─────────────────────────────────────────────────────────────────

export type TimeRange = "7d" | "30d" | "ytd";

export interface AnalyticsSummary {
  total_rsvps: number;
  total_checkins: number;
  total_posts: number;
  total_comments: number;
  total_views: number;
  total_members: number;
}

export interface TimelineDataPoint {
  date: string;
  rsvps: number;
  checkins: number;
  posts: number;
  comments: number;
  activity: number;
}

export interface TopEventData {
  event_id: string;
  event_title: string;
  views: number;
  rsvps: number;
  event_date: string;
}

export interface AttendanceStats {
  club_id: string;
  event_count: number;
  average: number;
  median: number;
}

export interface AnalyticsPayload {
  range: TimeRange;
  start_date: string;
  end_date: string;
  summary: AnalyticsSummary;
  timeline: TimelineDataPoint[];
  top_events: TopEventData[];
}

interface ClubAnalyticsDashboardProps {
  clubId: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ClubAnalyticsDashboard({ clubId }: ClubAnalyticsDashboardProps) {
  const supabase = createClient();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  // Fetch analytics data via RPC
  const fetchAnalytics = useCallback(async (): Promise<AnalyticsPayload> => {
    const { data, error } = await supabase.rpc("get_club_analytics", {
      p_club_id: clubId,
      p_range: timeRange,
    });

    if (error) {
      console.error("[ClubAnalytics] RPC error:", error);
      toast.error("Failed to load analytics data");
      throw error;
    }

    return data as AnalyticsPayload;
  }, [clubId, timeRange, supabase]);

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsPayload>({
    queryKey: ["club-analytics", clubId, timeRange],
    queryFn: fetchAnalytics,
    enabled: !!clubId,
  });

  // Fetch average & median attendance pre-computed in Postgres (issue #2308).
  // Returns null on error so this secondary metric never breaks the dashboard.
  const fetchAttendanceStats = useCallback(async (): Promise<AttendanceStats | null> => {
    const { data, error } = await supabase.rpc("get_club_attendance_stats", {
      p_club_id: clubId,
    });

    if (error) {
      console.error("[ClubAnalytics] attendance stats RPC error:", error);
      return null;
    }

    return (data as AttendanceStats) ?? null;
  }, [clubId, supabase]);

  const attendanceQuery = useQuery<AttendanceStats | null>({
    queryKey: ["club-attendance-stats", clubId],
    queryFn: fetchAttendanceStats,
    enabled: !!clubId,
  });

  const fetchSkills = useCallback(async (): Promise<SkillCount[]> => {
    return ClubSkillGapService.getBoardSkills(clubId);
  }, [clubId]);

  const skillQuery = useQuery<SkillCount[]>({
    queryKey: ["club-board-skills", clubId],
    queryFn: fetchSkills,
    enabled: !!clubId,
  });

  const summary = data?.summary ?? {
    total_rsvps: 0,
    total_checkins: 0,
    total_posts: 0,
    total_comments: 0,
    total_views: 0,
    total_members: 0,
  };

  const timeline = data?.timeline ?? [];
  const topEvents = data?.top_events ?? [];

  // Calculate check-in rate percentage
  const checkinRate =
    summary.total_rsvps > 0 ? Math.round((summary.total_checkins / summary.total_rsvps) * 100) : 0;

  // Format short date for X-axis
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${month}/${day}`;
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Time-Range Selector ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-black bg-cream p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-800 dark:border-white">
        <div>
          <h2 className="font-display font-black text-xl uppercase tracking-wide flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-brand-blue-base" />
            Club Analytics & Insights
          </h2>
          <p className="font-mono text-xs text-gray-600 dark:text-gray-300 mt-1">
            Real-time engagement trends, RSVPs, page views, and discussion metrics.
          </p>
        </div>

        {/* Time-Range Filter Buttons */}
        <div className="flex items-center gap-1 bg-white p-1 border-2 border-black dark:bg-zinc-900 dark:border-white">
          <Filter className="h-4 w-4 ml-2 mr-1 text-gray-500" />
          {(
            [
              { label: "7 Days", value: "7d" },
              { label: "30 Days", value: "30d" },
              { label: "Year to Date", value: "ytd" },
            ] as const
          ).map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all ${
                timeRange === range.value
                  ? "bg-lime text-black border-2 border-black shadow-[2px_2px_0_0_#000]"
                  : "text-gray-600 hover:text-black hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 border-2 border-black bg-gray-100 dark:bg-zinc-800 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 border-2 border-black bg-red-50 text-center font-mono text-sm text-red-600">
          <p>Failed to load analytics data for this club.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 bg-black text-white font-bold uppercase border-2 border-black"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ─── Summary KPI Cards ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: RSVPs & Check-ins */}
            <div className="border-2 border-black bg-lime p-4 shadow-[4px_4px_0_0_#000] dark:bg-lime/20 dark:border-white">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
                  Total RSVPs
                </span>
                <CalendarCheck className="h-5 w-5 text-black" />
              </div>
              <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
                {summary.total_rsvps}
              </p>
              <div className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between border-t border-black/20 pt-1">
                <span>Check-ins: {summary.total_checkins}</span>
                <span className="bg-black text-white px-1.5 py-0.5 rounded-none text-[10px]">
                  {checkinRate}% rate
                </span>
              </div>
            </div>

            {/* KPI 2: Page Views */}
            <div className="border-2 border-black bg-brand-yellow-base p-4 shadow-[4px_4px_0_0_#000] dark:bg-yellow-500/20 dark:border-white">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
                  Event Page Views
                </span>
                <Eye className="h-5 w-5 text-black" />
              </div>
              <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
                {summary.total_views}
              </p>
              <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
                Cumulative event views
              </p>
            </div>

            {/* KPI 3: Discussion Activity */}
            <div className="border-2 border-black bg-brand-blue-base text-white p-4 shadow-[4px_4px_0_0_#000] dark:bg-blue-600/20 dark:border-white">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  Discussions
                </span>
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="font-display font-black text-3xl mt-2">
                {summary.total_posts + summary.total_comments}
              </p>
              <div className="mt-2 font-mono text-[11px] font-bold flex items-center justify-between border-t border-white/20 pt-1">
                <span>Posts: {summary.total_posts}</span>
                <span>Comments: {summary.total_comments}</span>
              </div>
            </div>

            {/* KPI 4: Active Members */}
            <div className="border-2 border-black bg-peach p-4 shadow-[4px_4px_0_0_#000] dark:bg-orange-500/20 dark:border-white">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
                  Approved Members
                </span>
                <Users className="h-5 w-5 text-black" />
              </div>
              <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
                {summary.total_members}
              </p>
              <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
                Total active roster
              </p>
            </div>
          </div>

          {/* ─── Attendance Stats (aggregated in Postgres) ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
                  Average Attendance
                </span>
                <Users className="h-5 w-5 text-black" />
              </div>
              <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
                {attendanceQuery.data?.average ?? 0}
              </p>
              <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
                Mean RSVPs per event · computed in Postgres
              </p>
            </div>

            <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
                  Median Attendance
                </span>
                <Calendar className="h-5 w-5 text-black" />
              </div>
              <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
                {attendanceQuery.data?.median ?? 0}
              </p>
              <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
                PERCENTILE_CONT(0.5) · resists outlier events
              </p>
            </div>
          </div>

          <SponsorshipValueCalculator
            averageAttendance={attendanceQuery.data?.average ?? 0}
            appImpressions={summary.total_views}
            targetedAudiencePercent={80}
          />

          {/* ─── Chart 1: RSVP & Attendance Trends (Line Chart) ─── */}
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 dark:border-white">
              <div>
                <h3 className="font-display font-black text-lg uppercase flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-lime-600" />
                  RSVP & Attendance Trends
                </h3>
                <p className="font-mono text-xs text-gray-500">
                  Daily RSVP counts vs actual event check-ins over the selected period.
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              {timeline.length === 0 ? (
                <div className="h-full flex items-center justify-center font-mono text-xs text-gray-400">
                  No RSVP data for this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      tick={{ fontSize: 11, fontFamily: "monospace" }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: "monospace" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFF8F0",
                        border: "2px solid #000",
                        boxShadow: "3px 3px 0 #000",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="rsvps"
                      name="RSVPs"
                      stroke="#84cc16"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="checkins"
                      name="Check-ins"
                      stroke="#0284c7"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ─── Chart 2: Discussion Activity Over Time (Bar Chart) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3 dark:border-white">
                <div>
                  <h3 className="font-display font-black text-base uppercase flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-brand-blue-base" />
                    Discussion Activity
                  </h3>
                  <p className="font-mono text-xs text-gray-500">
                    Daily breakdown of posts and comments created.
                  </p>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                {timeline.length === 0 ? (
                  <div className="h-full flex items-center justify-center font-mono text-xs text-gray-400">
                    No discussion activity data for this range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeline} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDateLabel}
                        tick={{ fontSize: 11, fontFamily: "monospace" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fontFamily: "monospace" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFF8F0",
                          border: "2px solid #000",
                          boxShadow: "3px 3px 0 #000",
                          fontFamily: "monospace",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "12px" }} />
                      <Bar dataKey="posts" name="Posts" fill="#3b82f6" stackId="a" />
                      <Bar dataKey="comments" name="Comments" fill="#f59e0b" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ─── Chart 3: Top Events by Engagement ─── */}
            <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3 dark:border-white">
                <div>
                  <h3 className="font-display font-black text-base uppercase flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-500" />
                    Top Events by Page Views
                  </h3>
                  <p className="font-mono text-xs text-gray-500">
                    Most viewed events and their total RSVPs.
                  </p>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                {topEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center font-mono text-xs text-gray-400">
                    No event view data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={topEvents}
                      margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fontFamily: "monospace" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="event_title"
                        tick={{ fontSize: 10, fontFamily: "monospace" }}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFF8F0",
                          border: "2px solid #000",
                          boxShadow: "3px 3px 0 #000",
                          fontFamily: "monospace",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "12px" }} />
                      <Bar dataKey="views" name="Page Views" fill="#8b5cf6" />
                      <Bar dataKey="rsvps" name="RSVPs" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ─── Chart 4: Executive Board Analyzer (Skill Gap) ─── */}
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white mt-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 dark:border-white">
              <div>
                <h3 className="font-display font-black text-lg uppercase flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-purple-600" />
                  Executive Board Analyzer
                </h3>
                <p className="font-mono text-xs text-gray-500">
                  Assess your leadership team's competencies against the Healthy Board heuristic.
                  Identify missing skills to guide your next recruitment campaign.
                </p>
              </div>
            </div>

            {skillQuery.isLoading ? (
              <div className="h-64 animate-pulse bg-gray-100 dark:bg-zinc-800" />
            ) : skillQuery.isError ? (
              <div className="p-4 border-2 border-red-500 bg-red-50 font-mono text-xs text-red-600">
                Failed to load skills matrix.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                <SkillRadarChart currentSkills={skillQuery.data || []} />
                <SkillGapSuggestions clubId={clubId} currentSkills={skillQuery.data || []} />
              </div>
            )}
          </div>
        </>
      )}
      {/* ── NEW (Issue #3682): Roster Pruning Report ── */}
      <ClubPruneReportPanel clubId={clubId} />
    </div>
  );
}
