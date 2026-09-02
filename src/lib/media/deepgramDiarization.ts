import { DiarizationConfig, DiarizationResult, DiarizedUtterance, DiarizedWord } from '@/types/captions';

/**
 * Colors assigned to different speakers for visual distinction in the video player.
 */
export const SPEAKER_COLORS: Record<string, string> = {
    speaker_0: 'text-cyan-400',
    speaker_1: 'text-yellow-400',
    speaker_2: 'text-pink-400',
    speaker_3: 'text-green-400',
    speaker_4: 'text-purple-400',
    default: 'text-white',
};

/**
 * Formats seconds into WebVTT timestamp format (HH:MM:SS.mmm).
 * 
 * @param seconds Time in seconds
 * @returns Formatted VTT timestamp string
 */
export function formatVttTimestamp(seconds: number): string {
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Processes audio through Deepgram with diarization enabled and generates a styled WebVTT file.
 * 
 * @param audioUrl URL or buffer of the audio to process
 * @param config Diarization configuration
 * @returns Promise resolving to the diarization result
 */
export async function generateDiarizedCaptions(
    audioUrl: string,
    config: DiarizationConfig
): Promise<DiarizationResult> {
    // In production, fetch audio and send to Deepgram API
    // const response = await fetch('https://api.deepgram.com/v1/listen?diarize=true&language=en-US', { ... })

    // Mocked Deepgram response structure for demonstration
    const mockDeepgramResponse = {
        results: {
            channels: [
                {
                    alternatives: [
                        {
                            words: [
                                { word: 'Hello', start: 0.5, end: 1.0, speaker: 0, confidence: 0.99 },
                                { word: 'everyone,', start: 1.1, end: 1.5, speaker: 0, confidence: 0.98 },
                                { word: 'welcome', start: 1.6, end: 2.0, speaker: 0, confidence: 0.99 },
                                { word: 'to', start: 2.1, end: 2.3, speaker: 1, confidence: 0.97 },
                                { word: 'the', start: 2.4, end: 2.6, speaker: 1, confidence: 0.99 },
                                { word: 'debate.', start: 2.7, end: 3.2, speaker: 1, confidence: 0.98 },
                            ],
                        },
                    ],
                },
            ],
        },
    };

    const words = mockDeepgramResponse.results.channels[0].alternatives[0].words;
    const utterances: DiarizedUtterance[] = [];
    let currentUtterance: DiarizedUtterance | null = null;

    // Group words by speaker
    for (const w of words) {
        const speakerId = `speaker_${w.speaker}`;
        const speakerName = `Speaker ${w.speaker + 1}`;

        if (!currentUtterance || currentUtterance.speaker !== speakerId) {
            if (currentUtterance) {
                utterances.push(currentUtterance);
            }
            currentUtterance = {
                speaker: speakerId,
                speakerName,
                start: w.start,
                end: w.end,
                text: w.word,
                words: [{ ...w, speaker: speakerId }],
            };
        } else {
            currentUtterance.end = w.end;
            currentUtterance.text += ` ${w.word}`;
            currentUtterance.words.push({ ...w, speaker: speakerId });
        }
    }
    if (currentUtterance) {
        utterances.push(currentUtterance);
    }

    // Generate WebVTT with CSS classes
    let vttContent = 'WEBVTT\n\n';
    utterances.forEach((utt, index) => {
        const colorClass = SPEAKER_COLORS[utt.speaker] || SPEAKER_COLORS.default;
        vttContent += `${index + 1}\n`;
        vttContent += `${formatVttTimestamp(utt.start)} --> ${formatVttTimestamp(utt.end)}\n`;
        vttContent += `<c.${colorClass.replace('text-', '')}>${utt.speakerName}: ${utt.text}</c>\n\n`;
    });

    const uniqueSpeakers = new Set(utterances.map(u => u.speaker)).size;

    return {
        vttContent,
        utterances,
        speakerCount: uniqueSpeakers,
    };
}
