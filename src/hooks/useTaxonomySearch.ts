import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export function useTaxonomySearch() {
  const [taxonomyMap, setTaxonomyMap] = useState<Record<string, string[]>>({});
  const supabase = createClient();

  useEffect(() => {
    async function loadTaxonomy() {
      // Fetch nodes and mappings to build a search expansion dictionary
      // For instance, querying "STEM" should return ["STEM", "Computer Science", "Web Development", "ReactJS"]

      const { data: stdNodes } = await supabase
        .from("standard_taxonomy")
        .select("id, name, parent_id");
      const { data: mappings } = await supabase
        .from("custom_tag_mappings")
        .select("custom_tag, standard_taxonomy_id");

      if (!stdNodes) return;

      // Build adjacency list for tree
      const childrenMap: Record<string, string[]> = {};
      stdNodes.forEach((node) => {
        if (node.parent_id) {
          if (!childrenMap[node.parent_id]) childrenMap[node.parent_id] = [];
          childrenMap[node.parent_id].push(node.id);
        }
      });

      // Build descendants helper
      const getDescendants = (nodeId: string): string[] => {
        const children = childrenMap[nodeId] || [];
        let all = [...children];
        children.forEach((child) => {
          all = all.concat(getDescendants(child));
        });
        return all;
      };

      // Mappings grouped by taxonomy node
      const tagByTaxonomy: Record<string, string[]> = {};
      if (mappings) {
        mappings.forEach((m) => {
          if (!tagByTaxonomy[m.standard_taxonomy_id]) tagByTaxonomy[m.standard_taxonomy_id] = [];
          tagByTaxonomy[m.standard_taxonomy_id].push(m.custom_tag.toLowerCase());
        });
      }

      const newMap: Record<string, string[]> = {};

      stdNodes.forEach((node) => {
        // Find all descendant nodes
        const descendantIds = [node.id, ...getDescendants(node.id)];

        // Find all names and custom tags associated with these nodes
        const expandedTerms = new Set<string>();
        descendantIds.forEach((id) => {
          const n = stdNodes.find((x) => x.id === id);
          if (n) expandedTerms.add(n.name.toLowerCase());

          const associatedTags = tagByTaxonomy[id] || [];
          associatedTags.forEach((t) => expandedTerms.add(t));
        });

        newMap[node.name.toLowerCase()] = Array.from(expandedTerms);
      });

      setTaxonomyMap(newMap);
    }

    loadTaxonomy();
  }, [supabase]);

  // Returns all expanded terms if the query matches a taxonomy node
  const expandQuery = (query: string): string[] => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    // If the query exactly matches or is contained in a top-level taxonomy node,
    // we expand it to include all child nodes and custom tags.
    // For a simple implementation, we check if the query is a key in the map.
    // E.g. "stem" -> ["computer science", "web development", "reactjs", ...]

    const matchedKeys = Object.keys(taxonomyMap).filter((k) => k.includes(q));
    if (matchedKeys.length > 0) {
      const results = new Set<string>();
      results.add(q);
      matchedKeys.forEach((k) => {
        taxonomyMap[k].forEach((term) => results.add(term));
      });
      return Array.from(results);
    }

    return [q];
  };

  return { expandQuery };
}
