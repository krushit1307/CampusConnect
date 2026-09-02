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
import {
  EvacuationSimulation,
  FIRE_MARSHAL_TTE_LIMIT_SEC,
  assertEvacuationCompliance,
} from "./evacuation";

export interface EventMeta {
  title: string;
}

/** Loads event title + capacity + the saved floorplan document. */
export async function loadFloorplan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{
  meta: EventMeta | null;
  assets: ReturnType<typeof parseFloorplanState>["assets"];
  venue: VenueBounds;
  /** Event capacity, used to spawn evacuation particles (#5290). */
  capacity: number;
}> {
  const { data, error } = await supabase
    .from("events")
    .select("title, floorplan_json, max_attendees")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const parsed = parseFloorplanState((data as { floorplan_json?: unknown } | null)?.floorplan_json);
  return {
    meta: data ? { title: (data as { title: string }).title } : null,
    assets: parsed.assets,
    venue: parsed.venue,
    capacity: Math.max(
      0,
      Number((data as { max_attendees?: number | null } | null)?.max_attendees) || 0,
    ),
  };
}

/**
 * Persists the full floorplan document for an event.
 *
 * Runs the mandatory evacuation simulation first (#5290) and throws
 * `EvacuationComplianceError` when the layout cannot be cleared inside the fire
 * marshal's limit. The gate lives here rather than only in the editor because
 * this function is the single choke point every save passes through — a warning
 * the organizer can click past is what produced the 7-minute evacuation.
 *
 * @param capacity - Event capacity; one evacuation particle is spawned per head.
 * @throws {EvacuationComplianceError}
 */
export async function saveFloorplan(
  supabase: SupabaseClient,
  eventId: string,
  state: FloorplanState,
  capacity: number,
  limitSec: number = FIRE_MARSHAL_TTE_LIMIT_SEC,
): Promise<EvacuationSimulation> {
  // Simulate exactly what is about to be written, not the editor's in-memory copy.
  const persisted = parseFloorplanState(state);
  const simulation = assertEvacuationCompliance(
    persisted.assets,
    persisted.venue,
    capacity,
    limitSec,
  );

  // database.types.ts predates the floorplan_json migration, so we narrow
  // the table client to just the update operation we need.
  const eventsTable = supabase.from("events") as unknown as {
    update: (values: unknown) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await eventsTable.update({ floorplan_json: state }).eq("id", eventId);
  if (error) throw new Error(error.message || "Failed to save floorplan");

  return simulation;
}
