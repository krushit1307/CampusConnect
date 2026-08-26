import { useMemo } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import {
  buildCategoryChildrenMap,
  fetchClubCategories,
  getCategoryPath,
  type ClubCategory,
} from "@/lib/clubCategories";

export function useClubCategories() {
  const query = useQuery<ClubCategory[]>({
    queryKey: ["club-categories"],
    queryFn: fetchClubCategories,
    staleTime: 1000 * 60 * 30, // categories change rarely
  });

  const categories = query.data ?? [];
  const childrenMap = useMemo(() => buildCategoryChildrenMap(categories), [categories]);

  return {
    categories,
    childrenMap,
    isLoading: query.isLoading,
    error: query.error,
    /** Root -> leaf ancestor chain for a given deepest category id. */
    getPath: (leafId: string | null | undefined) => getCategoryPath(categories, leafId),
  };
}
