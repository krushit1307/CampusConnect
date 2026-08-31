/**
 * Venue and Facility Types for CampusConnect
 * Defines interfaces for venue layouts, accessibility nodes, and evacuation routes.
 */

export type FacilityNodeType = 'wheelchair_ramp' | 'elevator' | 'accessible_restroom' | 'emergency_exit';

export interface Point {
    x: number;
    y: number;
}

export interface EvacuationRoute {
    id: string;
    name: string;
    points: Point[];
    color: string;
    width: number;
}

export interface FacilityNode {
    id: string;
    type: FacilityNodeType;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
    label?: string;
}

export interface VenueLayout {
    id: string;
    venue_id: string;
    name: string;
    background_image_url?: string;
    grid_size: number;
    facilities: FacilityNode[];
    evacuation_routes: EvacuationRoute[];
    created_at: string;
    updated_at: string;
}
