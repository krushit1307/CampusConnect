import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  formatChurnBucket,
  getRecommendedOverbookCapacity,
  OVERBOOKING_POSTURES,
  type OverbookingPosture,
  type WaitlistChurnPrediction,
} from "@/lib/waitlistChurn";

export function WaitlistChurnPredictionCard({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const [posture, setPosture] = useState<OverbookingPosture>("balanced");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["event_churn_prediction", eventId],
    queryFn: async () => {
      const { data: prediction, error } = await supabase.rpc("predict_event_churn", {
        p_event_id: eventId,
        p_weather_modifier: 0,
      });
      if (error) throw error;
      return prediction as WaitlistChurnPrediction;
    },
    enabled: Boolean(eventId),
  });

  const prediction = data as WaitlistChurnPrediction | undefined;
  const recommendedCapacity = prediction ? getRecommendedOverbookCapacity(prediction, posture) : 0;
  const chartOption = useMemo(() => {
    if (!prediction) return {};
    const labels = prediction.prediction_matrix.map((bucket) =>
      formatChurnBucket(bucket.hours_before_event),
    );
    const predicted = prediction.prediction_matrix.map(
      (bucket) => bucket.predicted_churn_count ?? 0,
    );
    const actualByHour = new Map(
      prediction.actual_matrix.map((bucket) => [
        bucket.hours_before_event,
        bucket.actual_churn_count ?? 0,
      ]),
    );
    const actual = prediction.prediction_matrix.map(
      (bucket) => actualByHour.get(bucket.hours_before_event) ?? null,
    );

    return {
      animationDuration: 500,
      color: ["#2563eb", "#111827"],
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number | null) => (value == null ? "—" : `${value} people`),
      },
      legend: { bottom: 0, textStyle: { fontFamily: "monospace" } },
      grid: { left: 12, right: 16, top: 20, bottom: 40, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { fontFamily: "monospace", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        name: "Cumulative churn",
        nameTextStyle: { fontFamily: "monospace" },
      },
      series: [
        {
          name: "Predicted churn",
          type: "line",
          smooth: true,
          data: predicted,
          lineStyle: { width: 3 },
          symbolSize: 8,
        },
        {
          name: "Actual churn",
          type: "line",
          smooth: true,
          data: actual,
          connectNulls: false,
          lineStyle: { width: 3, type: "dashed" },
          symbolSize: 8,
        },
      ],
    };
  }, [prediction]);

  if (isLoading) {
    return (
      <div className="neu-border bg-white p-6 font-mono text-sm">Calculating the churn curve…</div>
    );
  }
  if (isError || !prediction) {
    return (
      <div className="neu-border border-red-600 bg-red-50 p-6 font-mono text-sm text-red-900">
        Churn prediction is unavailable for this event. You can still manage the waitlist normally.
      </div>
    );
  }

  const selectedPosture = OVERBOOKING_POSTURES[posture];

  return (
    <section
      className="neu-border bg-white p-5 shadow-[4px_4px_0_0_#000]"
      data-testid="waitlist-churn-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-blue-700">
            Organizer capacity planning
          </p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase">
            Predicted waitlist churn
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-black/70">
            A transparent estimate from the ten most similar completed events. It predicts drop-offs
            as the event approaches; it does not guarantee attendance.
          </p>
        </div>
        <div className="flex items-center gap-2 border-2 border-black bg-blue-50 px-3 py-2 font-mono text-xs font-bold">
          <ShieldCheck size={16} /> {prediction.similar_event_count} historical matches
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="border-2 border-black bg-blue-50 p-4">
          <p className="font-mono text-xs font-bold uppercase">Expected no-shows</p>
          <p className="mt-1 font-display text-4xl font-black">{prediction.expected_no_shows}</p>
        </div>
        <div className="border-2 border-black bg-yellow-100 p-4">
          <p className="font-mono text-xs font-bold uppercase">Waitlist size</p>
          <p className="mt-1 font-display text-4xl font-black">{prediction.waitlist_count}</p>
        </div>
        <div className="border-2 border-black bg-emerald-50 p-4">
          <p className="font-mono text-xs font-bold uppercase">Target capacity</p>
          <p className="mt-1 font-display text-4xl font-black">{recommendedCapacity}</p>
          <p className="mt-1 font-mono text-[10px]">Base capacity: {prediction.capacity}</p>
        </div>
      </div>

      <div className="mt-5 border-2 border-black bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor={`overbooking-posture-${eventId}`}
            className="font-mono text-xs font-bold uppercase"
          >
            Overbooking posture: {selectedPosture.label}
          </label>
          <span className="font-mono text-xs font-bold">{recommendedCapacity} seats</span>
        </div>
        <input
          id={`overbooking-posture-${eventId}`}
          type="range"
          min={0}
          max={2}
          step={1}
          value={posture === "conservative" ? 0 : posture === "balanced" ? 1 : 2}
          onChange={(event) =>
            setPosture(
              ["conservative", "balanced", "aggressive"][
                Number(event.target.value)
              ] as OverbookingPosture,
            )
          }
          className="mt-3 w-full accent-black"
          aria-describedby={`overbooking-description-${eventId}`}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] font-bold uppercase">
          <span>Conservative</span>
          <span>Balanced</span>
          <span>Aggressive</span>
        </div>
        <p
          id={`overbooking-description-${eventId}`}
          className="mt-2 font-mono text-xs text-black/70"
        >
          {selectedPosture.description}
        </p>
      </div>

      <div className="mt-5 h-[340px] border-2 border-black bg-white p-2">
        <ReactECharts
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>

      <div className="mt-4 flex items-start gap-2 border-2 border-amber-700 bg-amber-50 p-3 font-mono text-xs leading-relaxed text-amber-950">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          <strong>Normal-conditions assumption:</strong> {prediction.assumption} Review fire-code,
          venue, staffing, and emergency constraints before changing capacity.
        </span>
      </div>
    </section>
  );
}
