import { TransitRoute, TransitRequest, TransitWarning, TransitStep } from '@/types/transit';

/**
 * Calculates the Haversine distance between two coordinates in miles.
 */
function calculateDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Determines if public transit routing should be the default.
 */
export function shouldUsePublicTransit(distanceMiles: number): boolean {
    return distanceMiles > 2.0;
}

/**
 * Mock GTFS Realtime API integration.
 * In production, this would query the local city's GTFS Realtime endpoint or Google Maps Transit API.
 */
export async function fetchTransitRoute(request: TransitRequest): Promise<{ route: TransitRoute; warning: TransitWarning }> {
    const distanceMiles = calculateDistanceInMiles(
        request.originLat, request.originLng, request.destLat, request.destLng
    );

    if (!shouldUsePublicTransit(distanceMiles)) {
        throw new Error('Distance is under 2 miles. Walking or driving is recommended.');
    }

    // Mocked GTFS response for demonstration
    const departureDate = new Date(request.departureTime);
    const arrivalDate = new Date(departureDate.getTime() + 35 * 60000); // 35 mins later
    const eventEndDate = new Date(request.eventEndTime);

    // Mock last train time (e.g., 5:00 PM)
    const lastTrainTime = new Date(departureDate);
    lastTrainTime.setHours(17, 0, 0, 0);

    const steps: TransitStep[] = [
        {
            mode: 'WALK',
            instructions: 'Walk 5 mins to Main St Station',
            durationMinutes: 5,
            distanceMeters: 400,
        },
        {
            mode: 'TRANSIT',
            instructions: 'Take the Red Line towards Downtown',
            durationMinutes: 20,
            distanceMeters: 5000,
            transitDetails: {
                routeName: 'Red Line',
                routeColor: '#EF4444',
                departureTime: new Date(departureDate.getTime() + 5 * 60000).toISOString(),
                arrivalTime: new Date(departureDate.getTime() + 25 * 60000).toISOString(),
                departureStop: 'Main St Station',
                arrivalStop: 'Downtown Campus',
            },
        },
        {
            mode: 'WALK',
            instructions: 'Walk 3 mins to Event Venue',
            durationMinutes: 3,
            distanceMeters: 250,
        }
    ];

    const route: TransitRoute = {
        origin: 'University Campus',
        destination: 'Downtown Event Venue',
        totalDurationMinutes: 35,
        totalDistanceMeters: 5650,
        departureTime: departureDate.toISOString(),
        arrivalTime: arrivalDate.toISOString(),
        steps,
        lastTransitDeparture: lastTrainTime.toISOString(),
    };

    // Check if the last train leaves before the session ends
    const returnDepartureTime = new Date(eventEndDate.getTime() - 35 * 60000); // Assume same duration back
    const hasWarning = returnDepartureTime > lastTrainTime;

    const warning: TransitWarning = hasWarning
        ? {
            hasWarning: true,
            message: `CRITICAL: The last Red Line train departs at ${lastTrainTime.toLocaleTimeString()}. Your session ends at ${eventEndDate.toLocaleTimeString()}. You will not be able to return via public transit.`,
            severity: 'critical',
        }
        : {
            hasWarning: false,
            message: '',
            severity: 'info',
        };

    return { route, warning };
}
