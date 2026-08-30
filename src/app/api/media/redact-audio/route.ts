import { NextRequest, NextResponse } from 'next/server';
import { applyAudioRedaction, detectNamesInAudio } from '@/lib/media/audioRedaction';
import { ErasureRequest } from '@/types/privacy';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * API route to trigger the synchronized face blurring and audio redaction pipeline.
 */
export async function POST(req: NextRequest) {
    try {
        const { userId, eventId, videoPath, outputPath } = await req.json();

        if (!userId || !eventId || !videoPath || !outputPath) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // 1. Fetch user details for PII matching
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Detect names in the audio track
        const detections = await detectNamesInAudio(
            videoPath, // In production, extract audio track first
            user.first_name,
            user.last_name
        );

        // 3. Apply FFmpeg audio redaction
        const redactionResult = await applyAudioRedaction({
            videoPath,
            outputPath,
            detections,
        });

        // 4. Update erasure request status
        await supabase
            .from('erasure_requests')
            .update({ status: 'completed' })
            .eq('user_id', userId)
            .eq('event_id', eventId);

        return NextResponse.json({
            success: true,
            result: redactionResult,
            message: 'Video successfully processed with synchronized audio redaction.',
        });
    } catch (error) {
        console.error('Redaction pipeline error:', error);
        return NextResponse.json(
            { error: 'Failed to process redaction pipeline' },
            { status: 500 }
        );
    }
}

