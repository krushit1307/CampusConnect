import { createClient } from "@/lib/supabase/client";

export interface ClubCategory {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  depth: number;
  sort_order: number;
}

/**
 * The whole tree is small (dozens of rows across 3 levels), so we fetch it
 * once and do all filtering/lookups in memory instead of round-tripping to
 * the DB every time a dropdown changes.
 */
export async function fetchClubCategories(): Promise<ClubCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("club_categories")
    .select("id, parent_id, name, slug, depth, sort_order")
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** Children grouped by parent_id, with root categories keyed under "root". */
export type ClubCategoryChildrenMap = Map<string, ClubCategory[]>;

const ROOT_KEY = "root";

export function buildCategoryChildrenMap(categories: ClubCategory[]): ClubCategoryChildrenMap {
  const map: ClubCategoryChildrenMap = new Map();
  for (const category of categories) {
    const key = category.parent_id ?? ROOT_KEY;
    const siblings = map.get(key) ?? [];
    siblings.push(category);
    map.set(key, siblings);
  }
  return map;
}

export function getChildCategories(
  map: ClubCategoryChildrenMap,
  parentId: string | null,
): ClubCategory[] {
  return map.get(parentId ?? ROOT_KEY) ?? [];
}

/**
 * Reverse-engineers the full ancestor chain for a leaf category id, e.g.
 * given "Robotics" returns [Academic, Engineering, Robotics] (root -> leaf).
 * Used to pre-populate and open every dropdown level when editing a club
 * that already has a category_id set.
 */
export function getCategoryPath(
  categories: ClubCategory[],
  leafId: string | null | undefined,
): ClubCategory[] {
  if (!leafId) return [];

  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: ClubCategory[] = [];
  let current = byId.get(leafId);

  while (current) {
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return path;
}
