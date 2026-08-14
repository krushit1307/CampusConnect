import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { EventAvailabilitySlot, SlotPopularity } from "@/types/eventAvailability";
import { toast } from "sonner";

export function useEventAvailability(eventId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const queryKey = ["event_availability", eventId];

  // All rows for the event — every committee member's slots. The heatmap
  // component only needs the current user's own subset to pre-paint on
  // load; the full set is kept around so we can render an aggregated
  // "N people free" overlay alongside each admin's own edit view.
  const {
    data: slots = [],
    isLoading,
    error,
  } = useQuery<EventAvailabilitySlot[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_availability_slots")
        .select("*")
        .eq("event_id", eventId);

      if (error) throw new Error(error.message);
      return data as EventAvailabilitySlot[];
    },
    enabled: !!eventId,
  });

  const { data: currentUserId = null } = useQuery<string | null>({
    queryKey: ["current_user_id"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: 1000 * 60 * 60, // rarely changes within a session
  });

  const popularity: SlotPopularity[] = useMemo(() => {
    const byStart = new Map<string, string[]>();
    for (const slot of slots) {
      const existing = byStart.get(slot.slot_start) ?? [];
      existing.push(slot.user_id);
      byStart.set(slot.slot_start, existing);
    }
    return Array.from(byStart.entries()).map(([slot_start, user_ids]) => ({
      slot_start,
      count: user_ids.length,
      user_ids,
    }));
  }, [slots]);

  const ownSlots = useMemo(
    () =>
      currentUserId
        ? slots.filter((s) => s.user_id === currentUserId).map((s) => s.slot_start)
        : [],
    [slots, currentUserId],
  );

  const saveMutation = useMutation({
    mutationFn: async (selectedSlots: string[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to submit availability.");

      const { error } = await supabase.rpc("save_event_availability", {
        p_event_id: eventId,
        p_slots: selectedSlots,
      });

      if (error) throw new Error(error.message);
      return selectedSlots;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Availability saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save availability: ${err.message}`);
    },
  });

  return {
    slots,
    popularity,
    ownSlots,
    currentUserId,
    isLoading,
    error,
    saveAvailability: saveMutation.mutate,
    saveAvailabilityAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
