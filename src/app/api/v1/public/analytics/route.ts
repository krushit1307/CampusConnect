import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
    try {
        // By the time we reach here, the middleware has already verified the rate limit
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get('eventId');

        if (!eventId) {
            return NextResponse.json(
                { error: 'Missing eventId parameter' },
                { status: 400 }
            );
        }

        // Fetch analytics data (This is now protected from infinite loops by Redis)
        const { data, error } = await supabase
            .from('event_analytics')
            .select('*')
            .eq('event_id', eventId)
            .single();

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch analytics data' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Analytics API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
