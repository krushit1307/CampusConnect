/**
 * Captioning and Diarization Types for CampusConnect
 * Defines interfaces for speaker diarization, VTT generation, and accessible media playback.
 */

/**
 * Represents a single word or phrase segment with speaker attribution.
 */
export interface DiarizedWord {
    /** The spoken text */
    text: string;
    /** Start time in seconds */
    start: number;
    /** End time in seconds */
    end: number;
    /** Speaker identifier (e.g., "speaker_0", "speaker_1") */
    speaker: string;
    /** Confidence score of the transcription */
    confidence: number;
}

/**
 * Represents a grouped utterance by a single speaker.
 */
export interface DiarizedUtterance {
    /** Speaker identifier */
    speaker: string;
    /** Display name for the speaker (e.g., "Speaker 1", or mapped name) */
    speakerName: string;
    /** Start time of the utterance in seconds */
    start: number;
    /** End time of the utterance in seconds */
    end: number;
    /** The full text of the utterance */
    text: string;
    /** Individual words making up the utterance */
    words: DiarizedWord[];
}

/**
 * Configuration for generating diarized captions.
 */
export interface DiarizationConfig {
    /** Deepgram API key */
    apiKey: string;
    /** Language code (e.g., "en-US") */
    language: string;
    /** Whether to enable diarization */
    diarize: boolean;
    /** Number of expected speakers (optional, helps model accuracy) */
    numSpeakers?: number;
}

/**
 * Result of the diarization and VTT generation process.
 */
export interface DiarizationResult {
    /** The generated WebVTT string with CSS classes */
    vttContent: string;
    /** Array of structured utterances for UI rendering */
    utterances: DiarizedUtterance[];
    /** Total number of unique speakers detected */
    speakerCount: number;
}
