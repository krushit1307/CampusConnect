import { NextRequest, NextResponse } from 'next/server';
import { SafetyValidationRequest } from '@/types/safety';
import { validateEventSafety } from '@/lib/geo/spatialUtils';

/**
 * API route to validate event safety against campus Blue Light phone infrastructure.
 * 
 * @param req The incoming request containing event geofence and night-time status
 * @param params Route parameters containing the event ID
 * @returns JSON response with safety validation results
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const eventId = params.id;
        const body: SafetyValidationRequest = await req.json();

        if (body.eventId !== eventId) {
            return NextResponse.json(
                { error: 'Event ID mismatch' },
                { status: 400 }
            );
        }

        // In production, fetch actual phone data from Campus Security database
        // const { data: phones, error } = await supabase.from('blue_light_phones').select('*');
        const mockPhones = [
            {
                id: 'bl-001',
                name: 'North Quad Entrance',
                coordinates: [-73.978, 40.755],
                status: 'active',
                lastChecked: new Date().toISOString(),
            },
            {
                id: 'bl-002',
                name: 'Remote Parking Lot B',
                coordinates: [-73.990, 40.760],
                status: 'maintenance',
                lastChecked: new Date(Date.now() - 86400000 * 5).toISOString(),
            },
        ];

        // Perform spatial validation
        const result = validateEventSafety(body, mockPhones);

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error('Safety validation API error:', error);
        return NextResponse.json(
            { error: 'Internal server error during safety validation' },
            { status: 500 }
        );
    }
}
