import { BlueLightPhone, EventGeofence, SafetyValidationResult } from '@/types/safety';

/**
 * Calculates the Haversine distance between two geographic points.
 * 
 * @param lat1 Latitude of the first point in degrees
 * @param lon1 Longitude of the first point in degrees
 * @param lat2 Latitude of the second point in degrees
 * @param lon2 Longitude of the second point in degrees
 * @returns Distance between the two points in feet
 */
export function calculateHaversineDistanceFeet(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 3959; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMiles = R * c;

    // Convert miles to feet (1 mile = 5280 feet)
    return distanceMiles * 5280;
}

/**
 * Finds the nearest active Blue Light phone to a given geofence center.
 * 
 * @param geofenceCenter The center coordinates [longitude, latitude] of the event geofence
 * @param phones Array of all campus Blue Light phones
 * @returns The nearest active phone and the distance in feet
 */
export function findNearestActiveBlueLight(
    geofenceCenter: [number, number],
    phones: BlueLightPhone[]
): { phone: BlueLightPhone | null; distanceFeet: number } {
    let nearestPhone: BlueLightPhone | null = null;
    let minDistance = Infinity;

    for (const phone of phones) {
        if (phone.status !== 'active') {
            continue; // Skip maintenance or offline phones
        }

        const [lon, lat] = phone.coordinates;
        const [centerLon, centerLat] = geofenceCenter;

        const distance = calculateHaversineDistanceFeet(centerLat, centerLon, lat, lon);

        if (distance < minDistance) {
            minDistance = distance;
            nearestPhone = phone;
        }
    }

    return { phone: nearestPhone, distanceFeet: minDistance === Infinity ? -1 : minDistance };
}

/**
 * Validates if an event geofence meets campus safety requirements.
 * 
 * @param request The safety validation request containing geofence and event details
 * @param phones Array of all campus Blue Light phones
 * @returns SafetyValidationResult detailing compliance and required actions
 */
export function validateEventSafety(
    request: SafetyValidationRequest,
    phones: BlueLightPhone[]
): SafetyValidationResult {
    const { phone: nearestPhone, distanceFeet } = findNearestActiveBlueLight(
        request.geofence.center,
        phones
    );

    // Safety threshold: 500 feet for night-time events
    const SAFETY_THRESHOLD_FEET = 500;
    const isCompliant = distanceFeet <= SAFETY_THRESHOLD_FEET || !request.isNightTimeEvent;
    const requiresPrivateSecurity = distanceFeet > SAFETY_THRESHOLD_FEET && request.isNightTimeEvent;

    let message = '';
    if (isCompliant) {
        message = `Event geofence is within ${distanceFeet.toFixed(0)} feet of an active Blue Light phone (${nearestPhone?.name}). Safety requirements met.`;
    } else if (requiresPrivateSecurity) {
        message = `WARNING: Event geofence is ${distanceFeet.toFixed(0)} feet from the nearest Blue Light phone. For night-time events, this exceeds the 500-foot safety threshold. You must allocate budget for private security to proceed.`;
    } else {
        message = `Nearest Blue Light phone is ${distanceFeet.toFixed(0)} feet away.`;
    }

    return {
        isCompliant,
        distanceToNearestPhoneFeet: distanceFeet,
        nearestPhoneId: nearestPhone?.id || null,
        nearestPhoneName: nearestPhone?.name || null,
        message,
        requiresPrivateSecurity,
    };
}

export interface SafetyValidationRequest {
    geofence: EventGeofence;
    isNightTimeEvent: boolean;
}
