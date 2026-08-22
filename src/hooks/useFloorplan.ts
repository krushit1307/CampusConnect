// =============================================================================
// Hook: useFloorplan
// Issue: #3675 - Build an 'Interactive "Event Layout" Floorplan Creator'
// Description: Loads the venue bounds + persisted canvas, exposes CRUD ops
// for draggable assets, recomputes fire-exit collisions on every mutation and
// serializes the canvas back to events.floorplan_json.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FloorplanAsset, FloorplanState, VenueBounds, AssetKind, makeAsset } from '../../lib/floorplan/types';
import { findCollisions, clampToVenue } from '../../lib/floorplan/collision';

interface UseFloorplanReturn {
    venue: VenueBounds | null;
    assets: FloorplanAsset[];
    collidingIds: Set<string>;
    isLoading: boolean;
    isSaving: boolean;
    addAsset: (kind: AssetKind) => void;
    moveAsset: (id: string, x: number, y: number) => void;
    removeAsset: (id: string) => void;
    save: () => Promise<boolean>;
}

export function useFloorplan(eventId: string | null, venueId: string | null): UseFloorplanReturn {
    const [venue, setVenue] = useState<VenueBounds | null>(null);
    const [assets, setAssets] = useState<FloorplanAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load venue bounds + any previously saved canvas
    useEffect(() => {
        const load = async () => {
            if (!eventId || !venueId) { setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const [{ data: venueRow }, { data: eventRow }] = await Promise.all([
                    supabase.from('venues').select('width_ft, height_ft, fire_exits').eq('id', venueId).single(),
                    supabase.from('events').select('floorplan_json').eq('id', eventId).single(),
                ]);

                if (venueRow) {
                    setVenue({
                        width_ft: Number(venueRow.width_ft),
                        height_ft: Number(venueRow.height_ft),
                        fire_exits: (venueRow.fire_exits as any[]) || [],
                    });
                }
                const saved = (eventRow?.floorplan_json as FloorplanState | null);
                setAssets(saved?.assets || []);
            } catch (err) {
                console.error('[useFloorplan] Load failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [eventId, venueId]);

    // Recompute collisions whenever geometry changes
    const collidingIds = useMemo(
        () => (venue ? findCollisions(assets, venue) : new Set<string>()),
        [assets, venue]
    );

    const addAsset = useCallback((kind: AssetKind) => {
        setAssets(prev => {
            // Drop new assets near the center with a slight cascade offset
            const base = venue ? { x: venue.width_ft / 2 - 3, y: venue.height_ft / 2 - 2 } : { x: 10, y: 10 };
            const offset = (prev.length % 5) * 2;
            return [...prev, makeAsset(kind, base.x + offset, base.y + offset, prev.length)];
        });
    }, [venue]);

    const moveAsset = useCallback((id: string, x: number, y: number) => {
        setAssets(prev => prev.map(a => {
            if (a.id !== id || !venue) return a;
            const clamped = clampToVenue({ ...a, x, y }, venue);
            return { ...a, ...clamped };
        }));
    }, [venue]);

    const removeAsset = useCallback((id: string) => {
        setAssets(prev => prev.filter(a => a.id !== id));
    }, []);

    const save = useCallback(async (): Promise<boolean> => {
        if (!eventId) return false;
        setIsSaving(true);
        try {
            const payload: FloorplanState = { assets, updatedAt: new Date().toISOString() };
            const { error } = await supabase.from('events').update({ floorplan_json: payload }).eq('id', eventId);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[useFloorplan] Save failed:', err);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [assets, eventId]);

    return { venue, assets, collidingIds, isLoading, isSaving, addAsset, moveAsset, removeAsset, save };
}
