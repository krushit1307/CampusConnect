import { useEffect } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Users, Info, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

interface CrowdDensityMeterProps {
  eventId: string;
}

export function CrowdDensityMeter({ eventId }: CrowdDensityMeterProps) {
  const supabase = createClient();

  // Fetch initial density metrics
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["live-crowd-density", eventId],
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("get_live_density", {
        p_event_id: eventId
      });
      if (error) throw error;
      return res?.[0] || { checked_in_count: 0, square_footage: 2000, density_ratio: 0, density_status: "Plenty of Space" };
    }
  });

  // Setup Supabase Realtime listener to update the meter reactively
  useEffect(() => {
    const channel = supabase
      .channel(`live-density-tracker-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${eventId}`
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase, refetch]);

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-50 border border-gray-200 h-16 rounded-none flex items-center justify-center">
        <span className="font-mono text-xs text-gray-400">Loading crowd metrics...</span>
      </div>
    );
  }

  const count = data?.checked_in_count || 0;
  const sqFt = data?.square_footage || 2000;
  const ratio = Number(data?.density_ratio || 0);
  const status = data?.density_status || "Plenty of Space";

  // Determine colors and layout values
  let meterPercentage = Math.min(100, (ratio / 0.12) * 100);
  let statusColor = "bg-green-500 text-white";
  let statusText = "Plenty of Space";
  let statusDescription = "The venue is quiet and has plenty of room to move around.";

  if (status === "Packed") {
    statusColor = "bg-red-500 text-white border-red-600";
    statusText = "Packed";
    statusDescription = "Venue is currently crowded (shoulder-to-shoulder). You might experience wait times.";
  } else if (status === "Getting Busy") {
    statusColor = "bg-yellow-500 text-black border-yellow-600";
    statusText = "Getting Busy";
    statusDescription = "Steady stream of checked-in users. Venue is filling up quickly.";
  }

  // Calculate reciprocal space per person for human-readable tooltip details
  const spacePerPerson = count > 0 ? Math.round(sqFt / count) : sqFt;

  return (
    <div className="neu-border bg-white p-5 text-black shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-black text-sm uppercase tracking-wider flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Live Crowd Density
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 border uppercase ${statusColor}`}>
          {statusText}
        </span>
      </div>

      {/* Progress Bar Meter */}
      <div className="space-y-1">
        <div className="relative h-4 bg-gray-100 border border-black overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${meterPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full ${
              status === "Packed" ? "bg-red-500" :
              status === "Getting Busy" ? "bg-yellow-400" : "bg-[#a3e635]"
            }`}
          />
        </div>
        <div className="flex justify-between font-mono text-[9px] text-gray-500 uppercase">
          <span>Empty</span>
          <span>Moderate</span>
          <span>Dense</span>
        </div>
      </div>

      {/* Descriptive Text & Breakdown */}
      <div className="bg-gray-50 border border-black/10 p-3 font-mono text-[11px] leading-relaxed dark:bg-zinc-800 dark:border-white/10">
        <p className="text-gray-700 dark:text-gray-300">
          {statusDescription}
        </p>
        <div className="mt-2 pt-2 border-t border-black/10 flex justify-between items-center text-xs text-black dark:text-white font-bold">
          <span>Checked-in: {count} people</span>
          <span>Space per person: ~{spacePerPerson} sq ft</span>
        </div>
      </div>
    </div>
  );
}
