import { Suspense, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import LayoutPanelLeft from "lucide-react/dist/esm/icons/layout-panel-left";
import X from "lucide-react/dist/esm/icons/x";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import differenceInDays from "date-fns/differenceInDays";
import format from "date-fns/format";
import subDays from "date-fns/subDays";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { EventTrafficHeatmap } from "@/components/admin/EventTrafficHeatmap";

interface ProfileRole {
  role: string | null;
}

interface DauRecord {
  activity_date: string;
  daily_active_users: number;
}

interface EventOption {
  id: string;
  title: string;
}

interface EventAnalytics {
  rsvps_by_date?: { date: string; count: number }[];
  total_rsvps?: number;
  total_attendees?: number;
  check_in_rate?: number;
}

const MIN_PANEL_WIDTH_PERCENT = 30;

function EventAnalyticsPanel({
  events,
  eventId,
  label,
  onEventChange,
}: {
  events: EventOption[];
  eventId: string;
  label: string;
  onEventChange: (eventId: string) => void;
}) {
  const [supabase] = useState(() => createClient());
  const {
    data: analytics,
    isError,
    isLoading,
  } = useQuery<EventAnalytics>({
    queryKey: ["event_analytics_comparison", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_analytics", { p_event_id: eventId });
      if (error) throw new Error(error.message);
      return data as EventAnalytics;
    },
    enabled: Boolean(eventId),
  });

  const rsvpsByDate = analytics?.rsvps_by_date ?? [];

  return (
    <article className="min-w-0 space-y-5 bg-white p-5 dark:bg-zinc-900">
      <div className="space-y-2">
        <label
          htmlFor={`event-selector-${label}`}
          className="font-mono text-xs font-bold uppercase tracking-wider text-black/65 dark:text-white/70"
        >
          {label} event
        </label>
        <select
          id={`event-selector-${label}`}
          aria-label={`${label} event`}
          value={eventId}
          onChange={(event) => onEventChange(event.target.value)}
          className="neu-border w-full bg-white p-3 font-mono text-sm dark:bg-zinc-900 dark:text-white"
        >
          <option value="">Select an event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>

      {!eventId ? (
        <div className="flex h-80 items-center justify-center border-2 border-dashed border-black/20 p-6 text-center font-mono text-sm text-black/55 dark:border-white/25 dark:text-white/65">
          Select an event to compare its RSVP and attendance data.
        </div>
      ) : isLoading ? (
        <div className="flex h-80 items-center justify-center" aria-label="Loading event analytics">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="flex h-80 items-center justify-center border-2 border-red-500 bg-red-50 p-6 text-center font-mono text-sm text-red-700">
          Could not load analytics for this event.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="RSVPs" value={analytics?.total_rsvps ?? 0} />
            <Metric label="Attendees" value={analytics?.total_attendees ?? 0} />
            <Metric label="Check-in" value={`${analytics?.check_in_rate ?? 0}%`} />
          </div>
          <div className="neu-border h-80 min-w-0 p-3">
            <h2 className="mb-3 font-display text-lg font-bold uppercase">RSVP trend</h2>
            {rsvpsByDate.length === 0 ? (
              <div className="flex h-[calc(100%-2rem)] items-center justify-center font-mono text-sm text-black/50 dark:text-white/60">
                No RSVP activity recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={rsvpsByDate} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                  <defs>
                    <linearGradient id={`rsvp-gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A3E635" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#A3E635" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontFamily: "monospace", fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontFamily: "monospace", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      border: "2px solid #000",
                      boxShadow: "3px 3px 0 #000",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="RSVPs"
                    stroke="#000"
                    strokeWidth={2}
                    fill={`url(#rsvp-gradient-${label})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-2 border-black bg-cream p-3 dark:border-white dark:bg-zinc-800">
      <p className="font-mono text-[10px] font-bold uppercase text-black/55 dark:text-white/60">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-black">{value}</p>
    </div>
  );
}

/**
 * DauChartSection — owns its own data fetching so it can be wrapped in a
 * Suspense boundary, allowing the page shell (navbar/sidebar) to stream
 * to the client before the heavy analytics payload resolves.
 */
function DauChartSection({ dateRange }: { dateRange: DateRange | undefined }) {
  const [supabase] = useState(() => createClient());
  const [dauData, setDauData] = useState<DauRecord[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  const loadDauData = useCallback(
    async (start?: Date, end?: Date) => {
      setIsChartLoading(true);
      setChartError(null);
      try {
        const params: { start_date?: string; end_date?: string } = {};
        if (start) params.start_date = format(start, "yyyy-MM-dd");
        if (end) params.end_date = format(end, "yyyy-MM-dd");

        const { data, error } = await supabase.rpc("get_dau_analytics", params);
        if (error) throw new Error(error.message);

        const formatted: DauRecord[] = (
          (data || []) as { activity_date: string; daily_active_users: string | number }[]
        )
          .map((item) => ({
            activity_date: item.activity_date,
            daily_active_users: Number(item.daily_active_users),
          }))
          .reverse();
        setDauData(formatted);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load analytics data.";
        setChartError(message);
        toast.error(message);
      } finally {
        setIsChartLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadDauData(dateRange?.from, dateRange?.to);
  }, [dateRange, loadDauData]);

  const totalDays = dauData.length;
  const maxDau = totalDays > 0 ? Math.max(...dauData.map((day) => day.daily_active_users)) : 0;
  const averageDau =
    totalDays > 0
      ? Math.round(dauData.reduce((total, day) => total + day.daily_active_users, 0) / totalDays)
      : 0;
  const currentDau = totalDays > 0 ? dauData[totalDays - 1].daily_active_users : 0;
  const dateRangeDays =
    dateRange?.from && dateRange?.to
      ? differenceInDays(dateRange.to, dateRange.from) + 1
      : totalDays;

  if (isChartLoading) {
    return <ChartSkeleton height="450px" />;
  }

  if (chartError) {
    return (
      <div className="neu-border flex h-96 items-center justify-center border-red-500 bg-red-50 p-6 text-center font-mono text-sm text-red-700">
        {chartError}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Current DAU" value={currentDau} />
        <Metric label="Average DAU" value={averageDau} />
        <Metric label="Peak DAU" value={maxDau} />
        <Metric label="Time horizon" value={`${dateRangeDays} days`} />
      </div>
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <h2 className="font-display text-xl font-bold uppercase">Active user trend</h2>
        <p className="mb-6 font-mono text-xs text-gray-500">
          {dateRange?.from && dateRange?.to
            ? `Daily active users mapped from ${format(dateRange.from, "LLL dd, yyyy")} to ${format(dateRange.to, "LLL dd, yyyy")}`
            : "Daily active users mapped across the selected range"}
        </p>
        <div className="h-96 w-full">
          {dauData.length === 0 ? (
            <div className="flex h-full items-center justify-center font-mono text-sm text-gray-400">
              No active session data recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dauData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A3E635" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#A3E635" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="activity_date" stroke="#000" fontSize={10} fontFamily="monospace" />
                <YAxis stroke="#000" fontSize={10} fontFamily="monospace" />
                <Tooltip
                  contentStyle={{
                    border: "2px solid #000",
                    boxShadow: "4px 4px 0 #000",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="daily_active_users"
                  name="Active Users"
                  stroke="#000"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#dauGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}

function EventCollisionMatrix() {
  const [supabase] = useState(() => createClient());
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("all");
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    hour: number;
    count: number;
    attendees: number;
  } | null>(null);

  const { data: semesters = [] } = useQuery({
    queryKey: ["admin_semesters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semesters")
        .select("id, name")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: matrixData = [], isLoading } = useQuery({
    queryKey: ["event_collision_matrix", selectedSemesterId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_collision_matrix", {
        p_semester_id: selectedSemesterId === "all" ? null : selectedSemesterId,
      });
      if (error) throw error;
      return data || [];
    },
  });

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const formatHourLabel = (h: number) => {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  const lookup = useMemo(() => {
    const map: Record<string, { count: number; attendees: number }> = {};
    matrixData.forEach((row: any) => {
      map[`${row.day_of_week}-${row.hour_of_day}`] = {
        count: Number(row.concurrent_events),
        attendees: Number(row.total_attendees),
      };
    });
    return map;
  }, [matrixData]);

  const getCellBgColor = (count: number) => {
    if (count === 0) return "bg-white";
    if (count < 5) return "bg-red-100";
    if (count < 10) return "bg-red-300";
    if (count < 15) return "bg-red-500";
    if (count < 20) return "bg-red-700";
    return "bg-red-900";
  };

  return (
    <div className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] space-y-6 text-black">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-2 border-black pb-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase">
            Automated Event Collision Matrix
          </h2>
          <p className="font-mono text-xs text-black/60">
            Identify hot spots and optimize club scheduling across campus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="semester-select" className="font-mono text-xs font-bold uppercase">
            Semester:
          </label>
          <select
            id="semester-select"
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="neu-border bg-white p-2 font-mono text-xs"
          >
            <option value="all">All Semesters (Historical)</option>
            {semesters.map((sem: any) => (
              <option key={sem.id} value={sem.id}>
                {sem.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tooltip display bar */}
      <div className="h-12 border-2 border-black bg-yellow-50 p-3 font-mono text-xs flex items-center justify-between shadow-[2px_2px_0_0_#000]">
        {hoveredCell ? (
          <div>
            <span className="font-bold text-red-600">
              {hoveredCell.day}s at {formatHourLabel(hoveredCell.hour)}:
            </span>{" "}
            <span>
              {hoveredCell.count} concurrent events, {hoveredCell.attendees} total attendees.
            </span>
          </div>
        ) : (
          <span className="text-black/50 italic">
            Hover over any grid cell to view temporal event collisions.
          </span>
        )}

        <div className="flex items-center gap-1 text-[10px] uppercase font-bold">
          <span>Less</span>
          <span className="w-3 h-3 bg-white border border-black" />
          <span className="w-3 h-3 bg-red-100 border border-black" />
          <span className="w-3 h-3 bg-red-300 border border-black" />
          <span className="w-3 h-3 bg-red-500 border border-black" />
          <span className="w-3 h-3 bg-red-700 border border-black" />
          <span className="w-3 h-3 bg-red-900 border border-black" />
          <span>More</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center border-2 border-black">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1000px] border-2 border-black p-4 bg-gray-50">
            {/* Grid Hours Header */}
            <div className="grid grid-cols-[100px_repeat(24,1fr)] gap-1 mb-2">
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div
                  key={h}
                  className="font-mono text-[9px] font-bold text-center uppercase tracking-tighter truncate"
                  title={formatHourLabel(h)}
                >
                  {formatHourLabel(h)}
                </div>
              ))}
            </div>

            {/* Grid Days Rows */}
            <div className="space-y-1">
              {DAYS.map((dayName, dayIndex) => {
                const dayOfWeek = dayIndex + 1; // 1-indexed (isodow)
                return (
                  <div
                    key={dayName}
                    className="grid grid-cols-[100px_repeat(24,1fr)] gap-1 items-center"
                  >
                    <div className="font-mono text-xs font-bold uppercase">{dayName}</div>
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const key = `${dayOfWeek}-${hour}`;
                      const cell = lookup[key] || { count: 0, attendees: 0 };
                      return (
                        <div
                          key={hour}
                          onMouseEnter={() =>
                            setHoveredCell({
                              day: dayName,
                              hour,
                              count: cell.count,
                              attendees: cell.attendees,
                            })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`h-8 border border-black/35 cursor-pointer transition-transform hover:scale-110 hover:border-black hover:z-10 ${getCellBgColor(
                            cell.count,
                          )}`}
                          title={`${dayName}s at ${formatHourLabel(hour)}: ${cell.count} events`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsAdmin() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: subDays(today, 29), to: today };
  });
  const [isSplitScreen, setIsSplitScreen] = useState(false);
  const [leftEventId, setLeftEventId] = useState("");
  const [rightEventId, setRightEventId] = useState("");
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const { data: events = [] } = useQuery<EventOption[]>({
    queryKey: ["analytics-comparison-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title")
        .order("start_time", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: role === "system_admin",
  });

  // Auth check only — no data fetching here so the shell renders instantly
  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!active) return;
        setUser(currentUser);
        if (!currentUser) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single<ProfileRole>();
        if (profileError) throw new Error(profileError.message);
        if (!active) return;

        setRole(profile.role);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load analytics data.");
      } finally {
        if (active) setAuthChecked(true);
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!isSplitScreen || events.length === 0) return;
    setLeftEventId((current) => current || events[0].id);
    setRightEventId(
      (current) => current || events.find((event) => event.id !== events[0].id)?.id || events[0].id,
    );
  }, [events, isSplitScreen]);

  useEffect(() => {
    if (!isDraggingDivider) return;
    const updateDivider = (event: PointerEvent) => {
      const bounds = comparisonRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const ratio = ((event.clientX - bounds.left) / bounds.width) * 100;
      setLeftPanelWidth(
        Math.min(100 - MIN_PANEL_WIDTH_PERCENT, Math.max(MIN_PANEL_WIDTH_PERCENT, ratio)),
      );
    };
    const stopDragging = () => setIsDraggingDivider(false);
    window.addEventListener("pointermove", updateDivider);
    window.addEventListener("pointerup", stopDragging);
    return () => {
      window.removeEventListener("pointermove", updateDivider);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [isDraggingDivider]);

  // Redirect unauthenticated or unauthorized users once the auth check completes
  if (authChecked && (!user || role !== "system_admin")) return <Navigate to="/" replace />;

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-[#E9D5FF] px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-black">
                <BarChart3 className="h-4 w-4" /> System Analytics
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold text-black md:text-6xl">
                Daily Active Users.
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <button
                type="button"
                onClick={() => setIsSplitScreen((current) => !current)}
                className="neu-border flex items-center justify-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white hover:bg-black/80"
              >
                {isSplitScreen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <LayoutPanelLeft className="h-4 w-4" />
                )}
                {isSplitScreen ? "Close comparison" : "Enable split screen"}
              </button>
              <Link
                to="/admin/dlq"
                className="neu-border text-center bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
              >
                Dead Letter Queue
              </Link>
              <Link
                to="/admin/clubs/pending"
                className="neu-border bg-white px-4 py-2 text-center font-mono text-xs font-bold uppercase hover:bg-cream"
              >
                Moderation Panel
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl space-y-8">
          {isSplitScreen ? (
            <div className="space-y-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase">Event comparison</h2>
                  <p className="font-mono text-xs text-black/60">
                    Choose two events, then drag the divider to focus your analysis.
                  </p>
                </div>
                <p className="font-mono text-xs font-bold uppercase text-black/60">
                  Drag range: 30%–70%
                </p>
              </div>
              <div
                ref={comparisonRef}
                className="neu-border grid overflow-hidden bg-black"
                style={{ gridTemplateColumns: `${leftPanelWidth}% 4px ${100 - leftPanelWidth}%` }}
              >
                <EventAnalyticsPanel
                  events={events}
                  eventId={leftEventId}
                  label="Left"
                  onEventChange={setLeftEventId}
                />
                <div
                  role="separator"
                  aria-label="Resize comparison panels"
                  aria-orientation="vertical"
                  tabIndex={0}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setIsDraggingDivider(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft")
                      setLeftPanelWidth((width) => Math.max(MIN_PANEL_WIDTH_PERCENT, width - 5));
                    if (event.key === "ArrowRight")
                      setLeftPanelWidth((width) =>
                        Math.min(100 - MIN_PANEL_WIDTH_PERCENT, width + 5),
                      );
                  }}
                  className="cursor-col-resize touch-none bg-black outline-offset-[-2px] focus:outline focus:outline-2 focus:outline-lime"
                />
                <EventAnalyticsPanel
                  events={events}
                  eventId={rightEventId}
                  label="Right"
                  onEventChange={setRightEventId}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <Suspense fallback={<ChartSkeleton height="450px" />}>
                <DauChartSection dateRange={dateRange} />
              </Suspense>
              <EventTrafficHeatmap dateRange={dateRange} enabled={role === "system_admin"} />
              <EventCollisionMatrix />
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
