// src/hooks/useClubAffiliations.ts
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { ClubAffiliationService } from "@/services/clubAffiliationService";
import { ClubAffiliation } from "@/types/clubAffiliation";

export function useClubAffiliations(userId: string | null | undefined) {
  const { data: affiliations = [], isLoading, error } = useQuery<ClubAffiliation[]>({
    queryKey: ["club_affiliations", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await ClubAffiliationService.getUserAffiliations(userId);
    },
    enabled: !!userId,
  });

  return {
    affiliations,
    isLoading,
    error,
  };
}
