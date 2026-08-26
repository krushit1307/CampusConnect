/**
 * Venue and Facility Types for CampusConnect
 * Defines interfaces for venue layouts, accessibility nodes, and spatial data.
 */

export type FacilityNodeType = 'wheelchair_ramp' | 'elevator' | 'accessible_restroom' | 'emergency_exit';

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
    created_at: string;
    updated_at: string;
}

export interface SerializedVenueData {
    venue_id: string;
    layout_name: string;
    grid_size: number;
    facilities_json: string;
}
