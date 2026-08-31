import { NextRequest, NextResponse } from 'next/server';
import { calculateEmergencyNavigation } from '@/lib/hardware/uwbNavigation';
import { UserPosition, UWBBeacon } from '@/types/uwb';

/**
 * API route to calculate UWB-based emergency navigation for a user.
 * In a real implementation, this would be a WebSocket or low-latency edge endpoint.
 */
export async function POST(req: NextRequest) {
    try {
        const { userPosition, deviceHeading } = await req.json();

        if (!userPosition || deviceHeading === undefined) {
            return NextResponse.json(
                { error: 'Missing userPosition or deviceHeading' },
                { status: 400 }
            );
        }

        // Mocked venue beacon data (In production, fetch from venue configuration)
        const venueBeacons: UWBBeacon[] = [
            { id: 'b1', name: 'Main Entrance', x: 0, y: 0, z: 0, isExit: true },
            { id: 'b2', name: 'North Corridor', x: 10, y: 20, z: 0, isExit: false },
            { id: 'b3', name: 'Emergency Exit East', x: 30, y: 10, z: 0, isExit: true },
            { id: 'b4', name: 'Emergency Exit West', x: -30, y: 10, z: 0, isExit: true },
        ];

        const navState = calculateEmergencyNavigation(
            userPosition as UserPosition,
            venueBeacons,
            deviceHeading as number
        );

        return NextResponse.json({
            success: true,
            navigationState: navState,
        });
    } catch (error) {
        console.error('UWB routing error:', error);
        return NextResponse.json(
            { error: 'Failed to calculate UWB navigation' },
            { status: 500 }
        );
    }
}

export const config = {
    runtime: 'edge',
};
