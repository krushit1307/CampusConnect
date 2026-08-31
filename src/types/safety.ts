/**
 * Campus Safety and Spatial Types for CampusConnect
 * Defines interfaces for emergency infrastructure, geofencing, and spatial validation.
 */

/**
 * Represents a physical emergency phone (Blue Light) on campus.
 */
export interface BlueLightPhone {
    /** Unique identifier for the emergency phone */
    id: string;
    /** Human-readable name or location description */
    name: string;
    /** GeoJSON Point coordinates [longitude, latitude] */
    coordinates: [number, number];
    /** Operational status of the phone */
    status: 'active' | 'maintenance' | 'offline';
    /** Timestamp of last maintenance check */
    lastChecked: string;
}

/**
 * Represents the geofence boundary of a planned event.
 */
export interface EventGeofence {
    /** Unique identifier for the event */
    eventId: string;
    /** GeoJSON Polygon coordinates defining the event boundary */
    polygon: [number, number][][];
    /** Center point of the geofence for quick distance calculations */
    center: [number, number];
    /** Radius of the geofence in feet (approximate) */
    radiusFeet: number;
}

/**
 * Result of a spatial safety validation check.
 */
export interface SafetyValidationResult {
    /** Whether the event passes safety requirements */
    isCompliant: boolean;
    /** Distance in feet to the nearest active blue light phone */
    distanceToNearestPhoneFeet: number;
    /** ID of the nearest blue light phone */
    nearestPhoneId: string | null;
    /** Name of the nearest blue light phone */
    nearestPhoneName: string | null;
    /** Detailed message explaining the validation result */
    message: string;
    /** Whether private security is required due to distance */
    requiresPrivateSecurity: boolean;
}

/**
 * Payload for validating event safety against campus infrastructure.
 */
export interface SafetyValidationRequest {
    eventId: string;
    geofence: EventGeofence;
    isNightTimeEvent: boolean;
}
