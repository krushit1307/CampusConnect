import { NextRequest, NextResponse } from 'next/server';
import { triggerDropoutRescue } from '@/lib/tutoring/credits';

export async function POST(req: NextRequest) {
    try {
        const { userId, eventSeriesId, seriesName } = await req.json();

        if (!userId || !eventSeriesId || !seriesName) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        const result = await triggerDropoutRescue(userId, eventSeriesId, seriesName);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Rescue email API error:', error);
        return NextResponse.json(
            { error: 'Failed to trigger rescue workflow' },
            { status: 500 }
        );
    }
}
