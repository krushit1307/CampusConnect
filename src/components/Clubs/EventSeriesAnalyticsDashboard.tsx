import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Users from "lucide-react/dist/esm/icons/users";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import Star from "lucide-react/dist/esm/icons/star";
import UserMinus from "lucide-react/dist/esm/icons/user-minus";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";

type SeriesEvent = {
  week: number;
  event_id: string;
  title: string;
  event_date: string | null;
  attendees: number;
};

type RetentionPoint = {
  week: number;
  attendees: number;
  retained_users: number;
  retention_rate: number;
};

type SuperFan = {
  user_id: string;
  attended_events: number;
  name?: string;
  username?: string;
};

type SeriesAnalytics = {
  series_id: string;
  event_count: number;
  total_unique_attendees: number;
  core_cohort: number;
  one_time_dropins: number;
  events: SeriesEvent[];
  retention: RetentionPoint[];
  super_fans: SuperFan[];
};

type ClubEvent = {
  id: string;
  title: string;
  event_date: string | null;
  status: string;
  series_id: string | null;
};

interface EventSeriesAnalyticsDashboardProps {
  clubId: string;
}

export default function EventSeriesAnalyticsDashboard({
  clubId,
}: EventSeriesAnalyticsDashboardProps) {
  const supabase = createClient();

  const [seriesId, setSeriesId] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creatingSeries, setCreatingSeries] = useState(false);

  const fetchEvents = useCallback(async (): Promise<ClubEvent[]> => {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, event_date, status, series_id")
      .eq("club_id", clubId)
      .order("event_date", { ascending: true });

    if (error) throw error;

    return (data || []) as ClubEvent[];
  }, [clubId, supabase]);

  const eventsQuery = useQuery<ClubEvent[]>({
    queryKey: ["club-series-events", clubId],
    queryFn: fetchEvents,
    enabled: !!clubId,
  });

  const fetchAnalytics = useCallback(async (): Promise<SeriesAnalytics | null> => {
    if (!seriesId) return null;

    const { data, error } = await supabase.rpc(
      "get_event_series_analytics",
      {
        p_series_id: seriesId,
      },
    );

    if (error) {
      toast.error("Failed to load series analytics.");
      throw error;
    }

    return data as SeriesAnalytics;
  }, [seriesId, supabase]);

  const analyticsQuery = useQuery<SeriesAnalytics | null>({
    queryKey: ["event-series-analytics", seriesId],
    queryFn: fetchAnalytics,
    enabled: !!seriesId,
  });

  const events = eventsQuery.data || [];
  const analytics = analyticsQuery.data;

  const availableSeries = useMemo(() => {
    const ids = new Set(
      events
        .map((event) => event.series_id)
        .filter((id): id is string => Boolean(id)),
    );

    return Array.from(ids);
  }, [events]);

  const assignEventsToSeries = async () => {
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event.");
      return;
    }

    setCreatingSeries(true);

    try {
      const newSeriesId = crypto.randomUUID();

      const { error } = await supabase
        .from("events")
        .update({
          series_id: newSeriesId,
        })
        .in("id", selectedEvents);

      if (error) throw error;

      toast.success("Event series created.");

      setSeriesId(newSeriesId);
      setSelectedEvents([]);
      await eventsQuery.refetch();
    } catch (error) {
      console.error(error);
      toast.error("Could not create the event series.");
    } finally {
      setCreatingSeries(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  };

  useEffect(() => {
    if (!seriesId && availableSeries.length > 0) {
      setSeriesId(availableSeries[0]);
    }
  }, [availableSeries, seriesId]);

  return (
    <div className="space-y-6">
      <div className="neu-border bg-white p-6">
        <p className="eyebrow font-bold">Recurring Events</p>

        <h2 className="mt-2 font-display text-3xl font-black uppercase">
          Series Analytics
        </h2>

        <p className="mt-2 max-w-3xl font-mono text-sm text-black/60">
          Combine recurring event instances to understand unique attendance,
          retention, core members, and one-time drop-ins.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="neu-border bg-white p-5">
          <p className="mb-3 font-mono text-xs font-bold uppercase">
            Existing Series
          </p>

          {availableSeries.length > 0 ? (
            <select
              value={seriesId}
              onChange={(event) => setSeriesId(event.target.value)}
              className="w-full border-2 border-black bg-white p-3 font-mono text-sm"
            >
              {availableSeries.map((id) => (
                <option key={id} value={id}>
                  Series {id.slice(0, 8)}
                </option>
              ))}
            </select>
          ) : (
            <p className="font-mono text-sm text-black/50">
              No event series have been created yet.
            </p>
          )}
        </div>

        <div className="neu-border bg-yellow-100 p-5">
          <p className="font-mono text-xs font-bold uppercase">
            Create Series
          </p>

          <p className="mt-2 font-mono text-xs text-black/60">
            Select the recurring event instances below and group them into a
            single series.
          </p>

          <button
            type="button"
            disabled={creatingSeries || selectedEvents.length === 0}
            onClick={assignEventsToSeries}
            className="mt-4 border-2 border-black bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white disabled:opacity-40"
          >
            {creatingSeries
              ? "Creating..."
              : `Create Series (${selectedEvents.length})`}
          </button>
        </div>
      </div>

      <div className="neu-border bg-white p-5">
        <p className="mb-4 font-mono text-xs font-bold uppercase">
          Club Events
        </p>

        <div className="grid gap-2">
          {events.map((event) => (
            <label
              key={event.id}
              className="flex cursor-pointer items-center gap-3 border-2 border-black/10 p-3 hover:border-black"
            >
              <input
                type="checkbox"
                checked={selectedEvents.includes(event.id)}
                onChange={() => toggleEvent(event.id)}
                className="h-4 w-4"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-bold">
                  {event.title}
                </p>

                <p className="mt-1 font-mono text-[10px] text-black/50">
                  {event.event_date
                    ? new Date(event.event_date).toLocaleDateString()
                    : "No date"}{" "}
                  · {event.status}
                </p>
              </div>

              {event.series_id && (
                <span className="border border-black bg-green-100 px-2 py-1 font-mono text-[9px] font-bold uppercase">
                  In Series
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {analytics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              label="Unique Attendees"
              value={analytics.total_unique_attendees}
            />

            <MetricCard
              icon={<UserCheck className="h-5 w-5" />}
              label="Core Cohort"
              value={analytics.core_cohort}
            />

            <MetricCard
              icon={<UserMinus className="h-5 w-5" />}
              label="One-Time Drop-ins"
              value={analytics.one_time_dropins}
            />

            <MetricCard
              icon={<Star className="h-5 w-5" />}
              label="Super Fans"
              value={analytics.super_fans.length}
            />
          </div>

          <div className="neu-border bg-white p-5">
            <div className="mb-5">
              <p className="font-mono text-xs font-bold uppercase">
                Week-over-Week Retention
              </p>

              <p className="mt-1 font-mono text-xs text-black/50">
                Percentage of the original Week 1 cohort that returned.
              </p>
            </div>

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={analytics.retention}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="week"
                    tickFormatter={(week) => `W${week}`}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip
                    formatter={(value: number) => [
                      `${value}%`,
                      "Retention",
                    ]}
                    labelFormatter={(week) => `Week ${week}`}
                  />

                  <Line
                    type="monotone"
                    dataKey="retention_rate"
                    stroke="#000"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="neu-border bg-white p-5">
              <p className="mb-4 font-mono text-xs font-bold uppercase">
                Series Attendance
              </p>

              <div className="space-y-3">
                {analytics.events.map((event) => (
                  <div
                    key={event.event_id}
                    className="flex items-center justify-between border-b-2 border-black/10 pb-3"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold">
                        Week {event.week}
                      </p>

                      <p className="font-mono text-xs text-black/60">
                        {event.title}
                      </p>
                    </div>

                    <span className="font-display text-xl font-black">
                      {event.attendees}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="neu-border bg-yellow-100 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Star className="h-5 w-5" />

                <p className="font-mono text-xs font-bold uppercase">
                  Super Fans
                </p>
              </div>

              <p className="mb-4 font-mono text-xs text-black/60">
                Students who attended every non-cancelled event in this series.
              </p>

              {analytics.super_fans.length === 0 ? (
                <p className="font-mono text-xs text-black/50">
                  No Super Fans yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.super_fans.map((fan) => (
                    <div
                      key={fan.user_id}
                      className="border-2 border-black bg-white p-3 font-mono text-xs"
                    >
                      <p className="font-bold">
                        {fan.name || fan.username || fan.user_id.slice(0, 8)}
                      </p>

                      <p className="mt-1 text-black/50">
                        Attended {fan.attended_events} /{" "}
                        {analytics.event_count} events
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {analyticsQuery.isLoading && (
        <div className="neu-border bg-white p-8 text-center">
          <p className="font-mono text-sm">
            Loading series analytics...
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="neu-border bg-white p-5">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-mono text-[10px] font-bold uppercase text-black/60">
          {label}
        </p>
      </div>

      <p className="mt-3 font-display text-4xl font-black">
        {value}
      </p>
    </div>
  );
}