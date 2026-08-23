// =============================================================================
// Utility: Floorplan Collision Detection
// Issue: #3675 - Build an 'Interactive "Event Layout" Floorplan Creator'
// Description: Pure geometry helpers. Derives fire-exit clearance pathways
// from the venue definition and flags any asset that intersects them so the
// canvas can paint it red and the editor can surface safety warnings.
// =============================================================================

import { FloorplanAsset, VenueBounds, FireExit, FIRE_EXIT_CLEARANCE_FT } from './types';

export interface Rect { x: number; y: number; w: number; h: number; }

/** True when two axis-aligned rectangles overlap. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Builds the mandatory clearance rectangle for a fire exit door.
 * The pathway extends FIRE_EXIT_CLEARANCE_FT inward from the door position.
 */
export function fireExitPathway(exit: FireExit, venue: VenueBounds): Rect {
    const c = FIRE_EXIT_CLEARANCE_FT;
    const doorW = 4; // standard 4ft door

    switch (exit.side) {
        case 'top': return { x: exit.x_ft - doorW / 2, y: 0, w: doorW, h: c };
        case 'bottom': return { x: exit.x_ft - doorW / 2, y: venue.height_ft - c, w: doorW, h: c };
        case 'left': return { x: 0, y: exit.y_ft - doorW / 2, w: c, h: doorW };
        case 'right': return { x: venue.width_ft - c, y: exit.y_ft - doorW / 2, w: c, h: doorW };
    }
}

/** All clearance pathways for a venue. */
export function allFirePathways(venue: VenueBounds): Rect[] {
    return venue.fire_exits.map(e => fireExitPathway(e, venue));
}

/** Returns the ids of assets that violate a fire-exit clearance pathway. */
export function findCollisions(assets: FloorplanAsset[], venue: VenueBounds): Set<string> {
    const pathways = allFirePathways(venue);
    const colliding = new Set<string>();

    for (const asset of assets) {
        const a: Rect = { x: asset.x, y: asset.y, w: asset.width, h: asset.height };
        if (pathways.some(p => rectsIntersect(a, p))) colliding.add(asset.id);
    }
    return colliding;
}

/** Clamps an asset so it never leaves the venue outer walls. */
export function clampToVenue(asset: FloorplanAsset, venue: VenueBounds): { x: number; y: number } {
    return {
        x: Math.min(Math.max(0, asset.x), Math.max(0, venue.width_ft - asset.width)),
        y: Math.min(Math.max(0, asset.y), Math.max(0, venue.height_ft - asset.height)),
    };
}
