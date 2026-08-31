/**
 * Data Privacy and Redaction Types for CampusConnect
 * Defines interfaces for PII detection, audio redaction, and compliance tracking.
 */

/**
 * Represents a detected instance of PII in a media file.
 */
export interface PIIDetection {
    /** Unique identifier for the detection event */
    id: string;
    /** Type of PII detected (e.g., 'name', 'face', 'license_plate') */
    type: 'name' | 'face' | 'other';
    /** The specific text or identifier detected */
    value: string;
    /** Start time in milliseconds */
    startMs: number;
    /** End time in milliseconds */
    endMs: number;
    /** Confidence score of the detection */
    confidence: number;
}

/**
 * Configuration for the audio redaction pipeline.
 */
export interface AudioRedactionConfig {
    /** Path or URL to the source video file */
    videoPath: string;
    /** Path or URL to save the redacted output */
    outputPath: string;
    /** List of PII detections to redact */
    detections: PIIDetection[];
    /** FFmpeg binary path (if not in system PATH) */
    ffmpegPath?: string;
}

/**
 * Result of the audio redaction process.
 */
export interface RedactionResult {
    success: boolean;
    outputPath: string;
    redactedSegments: number;
    processingTimeMs: number;
    message: string;
}

/**
 * User request for data erasure under GDPR/CCPA.
 */
export interface ErasureRequest {
    userId: string;
    firstName: string;
    lastName: string;
    eventId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    requestedAt: string;
}
