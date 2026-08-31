import { useEffect } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import Users from "lucide-react/dist/esm/icons/users";
import { cn } from "@/lib/utils";

interface LiveCapacityMeterProps {
  eventId: string;
  className?: string;
}

export function LiveCapacityMeter({ eventId, className }: LiveCapacityMeterProps) {
  const supabase = createClient();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["live-capacity", eventId],
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("get_live_capacity", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return res?.[0] || { actual_check_ins: 0, venue_capacity: 0, capacity_percentage: 0 };
    },
  });

  // Broadcast: refetch whenever a ticket is scanned at the door
  useEffect(() => {
    const channel = supabase
      .channel(`live-capacity-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase, refetch]);

  if (isLoading) {
    return (
      <div className={cn("h-16 rounded-lg border-2 border-black bg-slate-50 animate-pulse", className)} />
    );
  }

  const checkIns = data?.actual_check_ins ?? 0;
  const capacity = data?.venue_capacity ?? 0;
  const percentage = Math.min(100, Number(data?.capacity_percentage ?? 0));

  if (!capacity) {
    return null;
  }

  // <30%: Filling up (blue) | 30-79%: Great crowd (green) | 80%+: At Capacity (red)
  let barColor = "bg-blue-500";
  let statusLabel = "Filling up";
  let statusColor = "bg-blue-500/10 text-blue-700 border-blue-500/30";

  if (percentage >= 80) {
    barColor = "bg-red-500 animate-pulse";
    statusLabel = "At Capacity - Expect Lines";
    statusColor = "bg-red-500/10 text-red-700 border-red-500/30 font-bold";
  } else if (percentage >= 30) {
    barColor = "bg-green-500";
    statusLabel = "Great crowd";
    statusColor = "bg-green-500/10 text-green-700 border-green-500/30";
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs font-mono font-bold">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>Live Capacity</span>
        </div>
        <span className={cn("px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border", statusColor)}>
          {statusLabel}
        </span>
      </div>

      <Progress
        value={percentage}
        className="h-3.5 border-2 border-black bg-slate-100"
        indicatorClassName={barColor}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      <div className="flex items-center justify-between text-xs font-mono text-slate-700 pt-0.5">
        <span>
          <strong>{checkIns}</strong> / {capacity} checked in
        </span>
        <span className="font-bold">{percentage}%</span>
      </div>
    </div>
  );
}