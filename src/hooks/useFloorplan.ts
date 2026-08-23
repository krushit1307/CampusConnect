// =============================================================================
// Hook: useFloorplan
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
// Description: Loads the persisted canvas from events.floorplan_json, exposes
// CRUD ops for draggable assets (incl. sponsor assignment), recomputes
// fire-exit collisions on every mutation and serializes the canvas back to
// the JSON contract requested by #4145.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AssetKind,
  DEFAULT_VENUE,
  FloorplanAsset,
  SponsorAssignment,
  VenueBounds,
  makeAsset,
} from "../lib/floorplan/types";
import { findCollisions, clampToVenue } from "../lib/floorplan/collision";
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
  save: () => Promise<boolean>;
}

export function useFloorplan(eventId: string | null): UseFloorplanReturn {
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [venue, setVenue] = useState<VenueBounds>(DEFAULT_VENUE);
  const [assets, setAssets] = useState<FloorplanAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  const save = useCallback(async (): Promise<boolean> => {
    if (!eventId) return false;
    setIsSaving(true);
    try {
      const supabase = createClient();
      await saveFloorplan(supabase, eventId, toFloorplanState(assets, venue));
      return true;
    } catch (err) {
      console.error("[useFloorplan] Save failed:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [assets, venue, eventId]);

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
    save,
  };
}
