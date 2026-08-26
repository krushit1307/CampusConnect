import { useQuery } from "@/hooks/useReactQueryReplacement";
import { eventMapService } from "@/services/eventMapService";
import { buildHeatmapDataset } from "@/utils/heatmap";
import { useMemo } from "react";

export function useHeatmapData() {
  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["active-events-heatmap"],
    queryFn: () => eventMapService.getActiveEventsForMap(),
    staleTime: 60000, // 1 minute
  });

  const heatmapData = useMemo(() => {
    if (!events) return [];
    return buildHeatmapDataset(events);
  }, [events]);

  return {
    events: events || [],
    heatmapData,
    isLoading,
    error,
  };
}
