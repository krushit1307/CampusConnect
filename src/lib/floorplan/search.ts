// =============================================================================
// Utility: Career Fair booth search index
// Issue: #4157 - Interactive "Career Fair" Digital Map
// Description: Pure, dependency-free indexing + matching over floorplan
// assets so the public map can answer "which booths are hiring for X?".
// Every assigned sponsor contributes its company name, table label and
// hiring_tags to a lowercase token index; a query tokenizes into terms that
// must ALL match at least one field of an asset (AND across terms, OR across
// fields). Returns asset ids so the SVG canvas can dim non-matches and pulse
// matches without mutating the underlying layout data.
// =============================================================================

import { FloorplanAsset } from "./types";

/** One indexed entry per asset with every searchable string pre-lowercased. */
export interface BoothSearchEntry {
  assetId: string;
  fields: string[]; // already lowercase
}

/**
 * "Internship, Software Engineer, CS" -> ["Internship", "Software Engineer", "CS"]
 * Trims, drops empties and de-duplicates (case-insensitively).
 */
export function parseHiringTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

/** Build the searchable index for a set of floorplan assets. */
export function buildSearchIndex(assets: FloorplanAsset[]): Map<string, BoothSearchEntry> {
  const index = new Map<string, BoothSearchEntry>();
  for (const asset of assets) {
    const fields: string[] = [asset.label ?? ""];
    if (asset.assignment?.companyName) fields.push(asset.assignment.companyName);
    for (const tag of asset.assignment?.hiringTags ?? []) fields.push(tag);
    index.set(asset.id, { assetId: asset.id, fields: fields.map((f) => f.toLowerCase()) });
  }
  return index;
}

function entryMatches(entry: BoothSearchEntry, term: string): boolean {
  return entry.fields.some((field) => field.includes(term));
}

/**
 * Match assets against a free-text query.
 * - Empty/whitespace query -> null (no filtering is active).
 * - Otherwise returns the Set of asset ids where EVERY query term matches
 *   at least one indexed field (company name, label or hiring tag).
 */
export function searchBooths(
  assets: FloorplanAsset[],
  query: string,
  index?: Map<string, BoothSearchEntry>,
): Set<string> | null {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return null;

  const idx = index ?? buildSearchIndex(assets);
  const hits = new Set<string>();
  for (const asset of assets) {
    const entry = idx.get(asset.id);
    if (!entry) continue;
    if (terms.every((term) => entryMatches(entry, term))) hits.add(asset.id);
  }
  return hits;
}
