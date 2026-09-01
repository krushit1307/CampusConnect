import { NextRequest, NextResponse } from 'next/server';
import { fetchTransitRoute } from '@/lib/transit/gtfsRouter';
import { TransitRequest } from '@/types/transit';

export async function POST(req: NextRequest) {
    try {
        const body: TransitRequest = await req.json();

        if (!body.originLat || !body.destLat || !body.departureTime || !body.eventEndTime) {
            return NextResponse.json(
                { error: 'Missing required routing parameters' },
                { status: 400 }
            );
        }

        const result = await fetchTransitRoute(body);

        return NextResponse.json({
            success: true,
            route: result.route,
            warning: result.warning,
        });
    } catch (error) {
        console.error('Transit routing error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to calculate transit route' },
            { status: 500 }
        );
    }
}
