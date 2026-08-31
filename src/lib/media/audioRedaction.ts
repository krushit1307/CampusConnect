import { AudioRedactionConfig, RedactionResult, PIIDetection } from '@/types/privacy';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * Converts milliseconds to FFmpeg time format (HH:MM:SS.mmm).
 */
function msToFFmpegTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (totalSeconds % 60).toFixed(3);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds}`;
}

/**
 * Calculates the duration of a segment in seconds for FFmpeg.
 */
function getDurationSeconds(startMs: number, endMs: number): number {
    return (endMs - startMs) / 1000;
}

/**
 * Applies FFmpeg audio filters to mute specific time ranges where PII is spoken.
 * 
 * @param config The redaction configuration containing paths and detections
 * @returns Promise resolving to the redaction result
 */
export async function applyAudioRedaction(config: AudioRedactionConfig): Promise<RedactionResult> {
    const startTime = Date.now();
    const nameDetections = config.detections.filter(d => d.type === 'name');

    if (nameDetections.length === 0) {
        return {
            success: true,
            outputPath: config.videoPath,
            redactedSegments: 0,
            processingTimeMs: 0,
            message: 'No name detections found. No redaction needed.',
        };
    }

    // Build FFmpeg volume filter for each detection
    // Format: volume=enable='between(t,start,end)':volume=0
    const volumeFilters = nameDetections.map((detection, index) => {
        const startSec = (detection.startMs / 1000).toFixed(3);
        const endSec = (detection.endMs / 1000).toFixed(3);
        return `volume=enable='between(t,${startSec},${endSec})':volume=0`;
    });

    // Join filters with commas for a single complex filter
    const filterComplex = volumeFilters.join(',');

    // FFmpeg command: copy video codec, re-encode audio with volume filters
    const ffmpegCommand = `ffmpeg -y -i "${config.videoPath}" -c:v copy -af "${filterComplex}" "${config.outputPath}"`;

    try {
        console.log(`Executing FFmpeg redaction: ${ffmpegCommand}`);
        const { stdout, stderr } = await execAsync(ffmpegCommand);

        if (stderr && !stderr.includes('frame=')) {
            console.warn('FFmpeg warning:', stderr);
        }

        const processingTime = Date.now() - startTime;

        return {
            success: true,
            outputPath: config.outputPath,
            redactedSegments: nameDetections.length,
            processingTimeMs: processingTime,
            message: `Successfully muted ${nameDetections.length} audio segments containing PII.`,
        };
    } catch (error) {
        console.error('FFmpeg redaction failed:', error);
        throw new Error(`Audio redaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Mock function to simulate Deepgram Speech-to-Text for name detection.
 * In production, this would pipe the audio track through Deepgram and search for the target name.
 */
export async function detectNamesInAudio(
    audioPath: string,
    targetFirstName: string,
    targetLastName: string
): Promise<PIIDetection[]> {
    // Mocked detection for demonstration
    const targetName = `${targetFirstName} ${targetLastName}`.toLowerCase();

    // Simulate finding the name at 15.5 seconds to 17.2 seconds
    return [
        {
            id: 'det-001',
            type: 'name',
            value: targetName,
            startMs: 15500,
            endMs: 17200,
            confidence: 0.95,
        }
    ];
}
