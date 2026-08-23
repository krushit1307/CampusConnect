// =============================================================================
// Service: Floorplan persistence on events.floorplan_json
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
// Description: Thin Supabase wrappers. The floorplan JSON document is stored
// on events.floorplan_json (see supabase/migrations/20261110000002_event_floorplan.sql).
// Scoped casts are used because database.types.ts has not been regenerated
// since that migration landed.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { FloorplanState, VenueBounds } from "./types";
import { parseFloorplanState } from "./serialize";

export interface EventMeta {
  title: string;
}

/** Loads event title + the saved floorplan document. */
export async function loadFloorplan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{
  meta: EventMeta | null;
  assets: ReturnType<typeof parseFloorplanState>["assets"];
  venue: VenueBounds;
}> {
  const { data, error } = await supabase
    .from("events")
    .select("title, floorplan_json")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const parsed = parseFloorplanState((data as { floorplan_json?: unknown } | null)?.floorplan_json);
  return {
    meta: data ? { title: (data as { title: string }).title } : null,
    assets: parsed.assets,
    venue: parsed.venue,
  };
}

/** Persists the full floorplan document for an event. */
export async function saveFloorplan(
  supabase: SupabaseClient,
  eventId: string,
  state: FloorplanState,
): Promise<void> {
  // database.types.ts predates the floorplan_json migration, so we narrow
  // the table client to just the update operation we need.
  const eventsTable = supabase.from("events") as unknown as {
    update: (values: unknown) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await eventsTable.update({ floorplan_json: state }).eq("id", eventId);
  if (error) throw new Error(error.message || "Failed to save floorplan");
}
