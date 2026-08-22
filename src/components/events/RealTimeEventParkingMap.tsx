import React, { useEffect, useState } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { EventParkingMap } from "./EventParkingMap";
import { DesignatedParkingLot } from "@/lib/campusParking";
import { useSupabaseSubscription } from "@/hooks/useSupabaseSubscription";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface RealTimeEventParkingMapProps {
  eventId: string;
  eventName?: string;
  venueName?: string;
  className?: string;
}

export const RealTimeEventParkingMap: React.FC<RealTimeEventParkingMapProps> = ({
  eventId,
  eventName = "Campus Event",
  venueName = "Main Auditorium",
  className,
}) => {
  const [supabase] = useState(() => createClient());
  const [parkingLots, setParkingLots] = useState<DesignatedParkingLot[] | null>(null);

  const { data, isLoading, error } = useQuery<{
    designated_parking_lots: DesignatedParkingLot[] | null;
  }>({
    queryKey: ["event-parking", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("designated_parking_lots")
        .eq("id", eventId)
        .maybeSingle();

      if (error) throw error;
      return data as { designated_parking_lots: DesignatedParkingLot[] | null };
    },
  });

  useEffect(() => {
    if (data?.designated_parking_lots) {
      setParkingLots(data.designated_parking_lots);
    }
  }, [data]);

  // Real-time subscription
  useSupabaseSubscription<{ designated_parking_lots: DesignatedParkingLot[] }>({
    table: "events",
    event: "UPDATE",
    filter: `id=eq.${eventId}`,
    enabled: Boolean(eventId),
    onData: (payload) => {
      if (payload.new && "designated_parking_lots" in payload.new) {
        const updatedLots = payload.new.designated_parking_lots as DesignatedParkingLot[];
        setParkingLots(updatedLots || []);
      }
    },
  });

  if (isLoading) {
    return (
      <Skeleton
        data-testid="parking-map-skeleton"
        className="w-full h-[400px] rounded-xl border-2 border-black"
      />
    );
  }

  if (error) {
    return (
      <div
        data-testid="parking-map-error"
        className="p-4 border-2 border-rose-500 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2 font-mono"
      >
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>Failed to load parking availability data. Please try again later.</span>
      </div>
    );
  }

  if (!parkingLots || parkingLots.length === 0) {
    return (
      <div
        data-testid="parking-map-empty"
        className="p-8 border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 rounded-xl flex flex-col items-center justify-center text-center font-mono"
      >
        <span className="font-bold text-gray-600 mb-1">No Designated Parking</span>
        <span className="text-sm">
          There are currently no designated parking lots set up for this event.
        </span>
      </div>
    );
  }

  return (
    <div data-testid="realtime-parking-map">
      <EventParkingMap
        eventName={eventName}
        venueName={venueName}
        parkingLots={parkingLots}
        className={className}
      />
    </div>
  );
};
