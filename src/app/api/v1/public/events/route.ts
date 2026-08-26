import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
    try {
        // Protected by middleware rate limiting
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        const { data, error } = await supabase
            .from('events')
            .select('id, title, date, location, club_id')
            .eq('status', 'published')
            .range(offset, offset + limit - 1)
            .order('date', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch events' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data, limit, offset });
    } catch (error) {
        console.error('Public Events API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
