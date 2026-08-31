import { NextRequest, NextResponse } from 'next/server';
import { generateDiarizedCaptions } from '@/lib/media/deepgramDiarization';
import { DiarizationConfig } from '@/types/captions';

/**
 * API route to generate diarized captions for a given media file.
 */
export async function POST(req: NextRequest) {
    try {
        const { audioUrl, eventId } = await req.json();

        if (!audioUrl) {
            return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 });
        }

        const config: DiarizationConfig = {
            apiKey: process.env.DEEPGRAM_API_KEY || '',
            language: 'en-US',
            diarize: true,
            numSpeakers: 4, // Optimized for panel debates
        };

        if (!config.apiKey) {
            // Return mock data for development if no API key is present
            console.warn('DEEPGRAM_API_KEY not found. Returning mock diarization data.');
        }

        const result = await generateDiarizedCaptions(audioUrl, config);

        // In production, save the VTT content to cloud storage (e.g., S3)
        // and update the event record with the caption URL.

        return NextResponse.json({
            success: true,
            vttContent: result.vttContent,
            speakerCount: result.speakerCount,
            utterances: result.utterances,
        });
    } catch (error) {
        console.error('Caption generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate diarized captions' },
            { status: 500 }
        );
    }
}
