/**
 * Public Transit and GTFS Types for CampusConnect
 * Defines interfaces for transit routing, stops, and schedule warnings.
 */

export interface TransitStep {
    mode: 'WALK' | 'TRANSIT';
    instructions: string;
    durationMinutes: number;
    distanceMeters: number;
    transitDetails?: {
        routeName: string;
        routeColor: string;
        departureTime: string;
        arrivalTime: string;
        departureStop: string;
        arrivalStop: string;
    };
}

export interface TransitRoute {
    origin: string;
    destination: string;
    totalDurationMinutes: number;
    totalDistanceMeters: number;
    departureTime: string;
    arrivalTime: string;
    steps: TransitStep[];
    lastTransitDeparture: string | null;
}

export interface TransitWarning {
    hasWarning: boolean;
    message: string;
    severity: 'info' | 'warning' | 'critical';
}

export interface TransitRequest {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    departureTime: string; // ISO string
    eventEndTime: string; // ISO string to check against last train
}
