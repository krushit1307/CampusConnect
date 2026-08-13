import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ClubHierarchyNode {
  id: string;
  name: string;
  logo_url: string | null;
  parent_club_id: string | null;
  president_name: string | null;
  depth: number;
}

export function useClubTree() {
  return useQuery({
    queryKey: ["club-tree-hierarchy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_hierarchy_view")
        .select("*")
        .order("depth", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return data as ClubHierarchyNode[];
    },
  });
}
