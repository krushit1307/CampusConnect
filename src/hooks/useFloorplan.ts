// =============================================================================
// Hook: useFloorplan
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
//         #4420 - Real-Time "Accessibility Need" Venue Map
//         #5290 - Emergency Exit Evacuation Bottleneck Simulator
// Description: Loads the persisted canvas from events.floorplan_json, exposes
// CRUD ops for draggable assets (incl. sponsor assignment) and accessibility
// POIs, recomputes fire-exit collisions on every mutation and serializes the
// canvas back to the JSON contract requested by #4145. Every mutation also
// re-runs the evacuation simulation (#5290) so the editor can block a save that
// would exceed the fire marshal's Time To Evacuate limit.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AccessibilityPoi,
  AccessibilityPoiKind,
  AssetKind,
  DEFAULT_VENUE,
  FloorplanAsset,
  SponsorAssignment,
  VenueBounds,
  makeAsset,
  makePoi,
} from "../lib/floorplan/types";
import { findCollisions, clampToVenue } from "../lib/floorplan/collision";
import {
  EvacuationComplianceError,
  EvacuationSimulation,
  simulateEvacuation,
} from "../lib/floorplan/evacuation";
import { toFloorplanState } from "../lib/floorplan/serialize";
import { loadFloorplan, saveFloorplan } from "../lib/floorplan/service";

interface UseFloorplanReturn {
  eventTitle: string | null;
  venue: VenueBounds;
  assets: FloorplanAsset[];
  collidingIds: Set<string>;
  isLoading: boolean;
  isSaving: boolean;
  addAsset: (kind: AssetKind, at?: { x: number; y: number }) => void;
  moveAsset: (id: string, x: number, y: number) => void;
  updateAsset: (id: string, patch: Partial<Omit<FloorplanAsset, "id" | "kind">>) => void;
  assignSponsor: (id: string, assignment: SponsorAssignment | null) => void;
  removeAsset: (id: string) => void;
  setVenueSize: (widthFt: number, heightFt: number) => void;
  /** #4420 accessibility POI operations, stored inside the venue JSON. */
  addPoi: (kind: AccessibilityPoiKind, at?: { x_ft: number; y_ft: number }) => void;
  movePoi: (id: string, x_ft: number, y_ft: number) => void;
  updatePoi: (id: string, patch: Partial<Omit<AccessibilityPoi, "id" | "kind">>) => void;
  removePoi: (id: string) => void;
  /** #5290 event capacity, i.e. how many particles the simulation spawns. */
  capacity: number;
  /** #5290 live evacuation simulation for the current layout. */
  evacuation: EvacuationSimulation;
  /** #5290 blocking message from the last rejected save, if any. */
  saveError: string | null;
  save: () => Promise<boolean>;
}

export function useFloorplan(eventId: string | null): UseFloorplanReturn {
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [venue, setVenue] = useState<VenueBounds>(DEFAULT_VENUE);
  const [assets, setAssets] = useState<FloorplanAsset[]>([]);
  const [capacity, setCapacity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load the saved floorplan document
  useEffect(() => {
    const load = async () => {
      if (!eventId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const supabase = createClient();
        const result = await loadFloorplan(supabase, eventId);
        setEventTitle(result.meta?.title ?? null);
        setAssets(result.assets);
        setVenue(result.venue);
        setCapacity(result.capacity);
      } catch (err) {
        console.error("[useFloorplan] Load failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [eventId]);

  // Recompute collisions whenever geometry changes
  const collidingIds = useMemo(() => findCollisions(assets, venue), [assets, venue]);

  // #5290: the same geometry drives the evacuation simulation, so the organizer
  // sees the Time To Evacuate update as they drag rather than only on save.
  const evacuation = useMemo(
    () => simulateEvacuation(assets, venue, capacity),
    [assets, venue, capacity],
  );

  const addAsset = useCallback(
    (kind: AssetKind, at?: { x: number; y: number }) => {
      setAssets((prev) => {
        const base = at ?? {
          x: venue.width_ft / 2 - 3,
          y: venue.height_ft / 2 - 2,
        };
        const offset = (prev.length % 5) * 2;
        return [...prev, makeAsset(kind, base.x + offset, base.y + offset, prev.length)];
      });
    },
    [venue],
  );

  const moveAsset = useCallback(
    (id: string, x: number, y: number) => {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== id || !venue) return a;
          const clamped = clampToVenue({ ...a, x, y }, venue);
          return { ...a, ...clamped };
        }),
      );
    },
    [venue],
  );

  const updateAsset = useCallback(
    (id: string, patch: Partial<Omit<FloorplanAsset, "id" | "kind">>) => {
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [],
  );

  const assignSponsor = useCallback(
    (id: string, assignment: SponsorAssignment | null) => {
      updateAsset(id, { assignment });
    },
    [updateAsset],
  );

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const setVenueSize = useCallback((widthFt: number, heightFt: number) => {
    setVenue((prev) => ({
      ...prev,
      width_ft: Math.max(20, widthFt),
      height_ft: Math.max(20, heightFt),
    }));
  }, []);

  // #4420: POIs live inside the venue JSON, next to fire_exits.
  const addPoi = useCallback((kind: AccessibilityPoiKind, at?: { x_ft: number; y_ft: number }) => {
    setVenue((prev) => {
      const existing = prev.accessibility_pois ?? [];
      const base = at ?? {
        x_ft: prev.width_ft / 2,
        y_ft: prev.height_ft / 2,
      };
      const poi = makePoi(kind, base.x_ft, base.y_ft, existing.length);
      return { ...prev, accessibility_pois: [...existing, poi] };
    });
  }, []);

  const movePoi = useCallback((id: string, x_ft: number, y_ft: number) => {
    setVenue((prev) => ({
      ...prev,
      accessibility_pois: (prev.accessibility_pois ?? []).map((p) =>
        p.id === id
          ? {
              ...p,
              x_ft: Math.min(Math.max(x_ft, 0), prev.width_ft),
              y_ft: Math.min(Math.max(y_ft, 0), prev.height_ft),
            }
          : p,
      ),
    }));
  }, []);

  const updatePoi = useCallback(
    (id: string, patch: Partial<Omit<AccessibilityPoi, "id" | "kind">>) => {
      setVenue((prev) => ({
        ...prev,
        accessibility_pois: (prev.accessibility_pois ?? []).map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      }));
    },
    [],
  );

  const removePoi = useCallback((id: string) => {
    setVenue((prev) => ({
      ...prev,
      accessibility_pois: (prev.accessibility_pois ?? []).filter((p) => p.id !== id),
    }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!eventId) return false;
    setIsSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      await saveFloorplan(supabase, eventId, toFloorplanState(assets, venue), capacity);
      return true;
    } catch (err) {
      // #5290: a layout that cannot be evacuated in time is rejected outright,
      // and the organizer is told the number of seconds and the remedy.
      if (err instanceof EvacuationComplianceError) {
        setSaveError(err.message);
        return false;
      }
      console.error("[useFloorplan] Save failed:", err);
      setSaveError(err instanceof Error ? err.message : "Could not save floorplan.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [assets, venue, capacity, eventId]);

  return {
    eventTitle,
    venue,
    assets,
    collidingIds,
    isLoading,
    isSaving,
    addAsset,
    moveAsset,
    updateAsset,
    assignSponsor,
    removeAsset,
    setVenueSize,
    addPoi,
    movePoi,
    updatePoi,
    removePoi,
    capacity,
    evacuation,
    saveError,
    save,
  };
}
