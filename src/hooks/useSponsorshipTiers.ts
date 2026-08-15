// =============================================================================
// Hook: useSponsorshipTiers
// Issue: #3170 - Build a 'Club Sponsorship Tier Management' UI
// Description: CRUD access to a club's sponsorship tiers for the Treasurer
// admin UI, and read-only access for the public sponsor-facing pricing grid.
// =============================================================================

import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import type { NewSponsorshipTier, SponsorshipTier } from "@/lib/sponsorship/tiers";

export function useSponsorshipTiers(clubId: string) {
  const supabase = createClient();

  const { data: tiers, isLoading, error, refetch } = useQuery({
    queryKey: ["sponsorship_tiers", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsorship_tiers" as any)
        .select("*")
        .eq("club_id", clubId)
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SponsorshipTier[];
    },
    enabled: !!clubId,
  });

  const createTier = useMutation({
    mutationFn: async (tier: NewSponsorshipTier) => {
      const { error } = await supabase
        .from("sponsorship_tiers" as any)
        .insert({ ...tier, club_id: clubId });
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const updateTier = useMutation({
    mutationFn: async ({ id, ...changes }: Partial<NewSponsorshipTier> & { id: string }) => {
      const { error } = await supabase
        .from("sponsorship_tiers" as any)
        .update(changes)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const deleteTier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sponsorship_tiers" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  return {
    tiers: tiers || [],
    isLoading,
    error,
    createTier,
    updateTier,
    deleteTier,
  };
}