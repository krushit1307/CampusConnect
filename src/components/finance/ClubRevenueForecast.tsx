import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRevenueCents, getRevenueForecastWarning } from "@/lib/revenueForecast";

type ForecastEvent = {
  id: string;
  title: string;
  event_date: string | null;
  status: string | null;
};

type RevenueForecast = {
  event_id: string;
  event_title: string;
  event_date: string;
  current_sold_tickets: number;
  current_revenue_cents: number;
  ticket_capacity: number;
  average_ticket_price_cents: number;
  break_even_cents: number;
  projected_final_tickets: number;
  projected_final_revenue_cents: number;
  projected_variance_cents: number;
  days_until_event: number;
  historical_curve_percent_at_current_offset: number;
  historical_event_count: number;
  sales_curve: Array<{ sale_date: string; tickets_sold: number; revenue_cents: number }>;
};

export function ClubRevenueForecast({ clubId }: { clubId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<ForecastEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setIsLoadingEvents(true);
      const { data, error: queryError } = await supabase
        .from("events")
        .select("id, title, event_date, status")
        .eq("club_id", clubId)
        .neq("status", "cancelled")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      else {
        const nextEvents = (data ?? []) as ForecastEvent[];
        setEvents(nextEvents);
        setSelectedEventId((current) => current || nextEvents[0]?.id || "");
      }
      setIsLoadingEvents(false);
    };
    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, [clubId, supabase]);

  useEffect(() => {
    if (!selectedEventId) {
      setForecast(null);
      return;
    }
    let cancelled = false;
    const loadForecast = async () => {
      setIsLoadingForecast(true);
      const { data, error: rpcError } = await supabase.rpc("get_club_revenue_forecast", {
        p_club_id: clubId,
        p_event_id: selectedEventId,
      });
      if (cancelled) return;
      if (rpcError) setError(rpcError.message);
      else {
        setError(null);
        setForecast((data ?? null) as unknown as RevenueForecast | null);
      }
      setIsLoadingForecast(false);
    };
    void loadForecast();
    const channel = supabase
      .channel(`club-revenue-forecast:${selectedEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => void loadForecast(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_financial_transactions",
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => void loadForecast(),
      )
      .subscribe();
    const refreshTimer = window.setInterval(() => void loadForecast(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [clubId, selectedEventId, supabase]);

  const maxChartCents = useMemo(() => {
    if (!forecast) return 1;
    return Math.max(
      forecast.break_even_cents,
      forecast.projected_final_revenue_cents,
      forecast.current_revenue_cents,
      1,
    );
  }, [forecast]);
  const isShortfall = Boolean(forecast && forecast.projected_variance_cents < 0);

  return (
    <section
      className="rounded-xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]"
      aria-labelledby="revenue-forecast-title"
    >
      <div className="flex flex-col justify-between gap-4 border-b-2 border-black pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
            Sales velocity intelligence
          </p>
          <h2
            id="revenue-forecast-title"
            className="mt-1 flex items-center gap-2 font-display text-2xl font-black uppercase"
          >
            <BarChart3 className="h-6 w-6" /> Revenue forecast
          </h2>
          <p className="mt-1 max-w-2xl font-mono text-xs leading-5 text-gray-600">
            Projected from paid RSVP timestamps and your club’s completed-event sales curves.
            Refreshes automatically as tickets sell.
          </p>
        </div>
        <label className="min-w-[220px] font-mono text-[10px] font-bold uppercase">
          Forecast event
          <select
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            disabled={isLoadingEvents || events.length === 0}
            className="mt-1 w-full border-2 border-black bg-white p-2 text-xs"
          >
            <option value="">{isLoadingEvents ? "Loading events…" : "No upcoming events"}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <div
          className="mt-4 flex items-start gap-2 border-2 border-red-700 bg-red-50 p-3 font-mono text-xs text-red-900"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {isLoadingForecast && !forecast ? (
        <div className="flex items-center gap-2 py-12 font-mono text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculating sales curve…
        </div>
      ) : !forecast ? (
        <div className="border-2 border-dashed border-gray-400 p-8 text-center font-mono text-xs text-gray-600">
          Create an upcoming event and record paid ticket sales to see its forecast.
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-2 border-black bg-indigo-50 p-4">
              <p className="font-mono text-[10px] font-bold uppercase text-gray-600">
                Current revenue
              </p>
              <p className="mt-1 font-display text-2xl font-black">
                {formatRevenueCents(forecast.current_revenue_cents)}
              </p>
              <p className="font-mono text-[10px] text-gray-600">
                {forecast.current_sold_tickets} paid tickets
              </p>
            </div>
            <div className="border-2 border-black bg-lime p-4">
              <p className="font-mono text-[10px] font-bold uppercase text-gray-700">
                Projected final revenue
              </p>
              <p className="mt-1 font-display text-2xl font-black">
                {formatRevenueCents(forecast.projected_final_revenue_cents)}
              </p>
              <p className="font-mono text-[10px] text-gray-700">
                {forecast.projected_final_tickets} projected tickets
              </p>
            </div>
            <div className="border-2 border-black bg-amber-100 p-4">
              <p className="font-mono text-[10px] font-bold uppercase text-gray-700">
                Break-even point
              </p>
              <p className="mt-1 font-display text-2xl font-black">
                {formatRevenueCents(forecast.break_even_cents)}
              </p>
              <p className="font-mono text-[10px] text-gray-700">Recorded event expenses</p>
            </div>
            <div
              className={`border-2 border-black p-4 ${isShortfall ? "bg-red-100" : "bg-emerald-100"}`}
            >
              <p className="font-mono text-[10px] font-bold uppercase text-gray-700">
                Forecast variance
              </p>
              <p
                className={`mt-1 font-display text-2xl font-black ${isShortfall ? "text-red-800" : "text-emerald-800"}`}
              >
                {isShortfall ? "-" : "+"}
                {formatRevenueCents(Math.abs(forecast.projected_variance_cents))}
              </p>
              <p className="font-mono text-[10px] text-gray-700">
                {forecast.days_until_event} days until event
              </p>
            </div>
          </div>
          {isShortfall ? (
            <div
              className="mt-5 flex items-start gap-3 border-4 border-red-800 bg-red-600 p-5 text-white shadow-[4px_4px_0_0_#000]"
              role="status"
            >
              <AlertTriangle className="mt-1 h-7 w-7 shrink-0" />
              <div>
                <p className="font-display text-2xl font-black uppercase">
                  {getRevenueForecastWarning(
                    forecast.projected_final_revenue_cents,
                    forecast.break_even_cents,
                  ) ?? "Projected loss"}
                </p>
                <p className="mt-1 font-mono text-xs leading-5">
                  Sales are currently tracking below break-even. Consider increasing marketing
                  efforts before the event.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="mt-5 flex items-start gap-3 border-2 border-emerald-800 bg-emerald-50 p-4 text-emerald-900"
              role="status"
            >
              <TrendingUp className="mt-0.5 h-5 w-5" />
              <p className="font-mono text-xs leading-5">
                Current sales velocity projects a{" "}
                {formatRevenueCents(forecast.projected_variance_cents)} cushion above break-even.
              </p>
            </div>
          )}
          <div className="mt-6 border-2 border-black bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-black uppercase">
                  Sales curve vs. break-even
                </h3>
                <p className="font-mono text-[10px] text-gray-600">
                  Current revenue is compared with the final projection and recorded costs.
                </p>
              </div>
              <RefreshCw
                className={`h-4 w-4 ${isLoadingForecast ? "animate-spin" : ""}`}
                aria-label="Forecast refreshes every 60 seconds"
              />
            </div>
            <div className="relative h-24 border-b-2 border-l-2 border-black bg-white">
              <div
                className="absolute inset-x-0 border-t-2 border-dashed border-red-600"
                style={{
                  bottom: `${Math.min(100, (forecast.break_even_cents / maxChartCents) * 100)}%`,
                }}
              >
                <span className="absolute -top-5 right-0 bg-red-600 px-1 font-mono text-[9px] font-bold text-white">
                  BREAK-EVEN {formatRevenueCents(forecast.break_even_cents)}
                </span>
              </div>
              <div
                className="absolute bottom-0 left-0 h-1/2 w-1/3 bg-indigo-400"
                style={{
                  height: `${Math.max(4, (forecast.current_revenue_cents / maxChartCents) * 100)}%`,
                }}
                title={`Current revenue ${formatRevenueCents(forecast.current_revenue_cents)}`}
              />
              <div
                className="absolute bottom-0 left-1/3 h-1/2 w-1/3 bg-lime-500"
                style={{
                  height: `${Math.max(4, (forecast.projected_final_revenue_cents / maxChartCents) * 100)}%`,
                }}
                title={`Projected revenue ${formatRevenueCents(forecast.projected_final_revenue_cents)}`}
              />
              <div
                className="absolute bottom-0 left-2/3 h-1/2 w-1/3 bg-amber-400"
                style={{
                  height: `${Math.max(4, (forecast.break_even_cents / maxChartCents) * 100)}%`,
                }}
                title={`Break-even ${formatRevenueCents(forecast.break_even_cents)}`}
              />
            </div>
            <div className="grid grid-cols-3 text-center font-mono text-[10px] font-bold uppercase">
              <span className="pt-2">Now</span>
              <span className="pt-2">Projection</span>
              <span className="pt-2">Break-even</span>
            </div>
          </div>
          <div className="mt-4 grid gap-2 font-mono text-[10px] text-gray-600 sm:grid-cols-3">
            <span>
              Historical events used:{" "}
              <strong className="text-black">{forecast.historical_event_count}</strong>
            </span>
            <span>
              Sales curve at current offset:{" "}
              <strong className="text-black">
                {forecast.historical_curve_percent_at_current_offset}%
              </strong>
            </span>
            <span>
              Average ticket:{" "}
              <strong className="text-black">
                {formatRevenueCents(forecast.average_ticket_price_cents)}
              </strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
