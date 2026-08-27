/**
 * Data structures and event types for the Watermarking pipeline.
 */

export interface WatermarkConfig {
    id: string;
    clubId: string;
    isEnabled: boolean;
    watermarkType: 'text' | 'logo' | 'both';
    logoUrl?: string;
    textFormat?: string; // e.g. "{EventName} - {Date}"
    position: WatermarkPosition;
    opacity: number;
    scale: number; // Percentage of image width, 1-100
    fontFamily: string;
    fontColor: string;
    minImageWidth: number; // Don't watermark tiny images
    createdAt: string;
    updatedAt: string;
}

export type WatermarkPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center-left'
    | 'center'
    | 'center-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

export interface RequiredComposites {
    inputs: Buffer[];
    gravity: string;
    blend: string;
}

export interface WatermarkJob {
    jobId: string;
    entityId: string; // Gallery ID, Event ID, etc.
    originalFileUrl: string;
    fileName: string;
    config: WatermarkConfig;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    errorMessage?: string;
    queuedAt: string;
    completedAt?: string;
    processedFileUrl?: string;
}

export interface WebhookEventPayload {
    type: 'INSERT' | 'UPDATE';
    table: string;
    record: {
        id: string;
        bucket_id: string;
        name: string;
        owner: string;
        metadata: {
            size: number;
            mimetype: string;
            [key: string]: any;
        };
    };
    schema: string;
}

// Analytics for processed images
export interface WatermarkAnalytics {
    totalProcessed: number;
    totalFailures: number;
    averageProcessingTimeMs: number;
    bandwidthSavedBytes: number;
    clubId: string;
    periodStart: string;
    periodEnd: string;
}

export type FontAsset = {
    id: string;
    name: string;
    weights: number[];
    url: string;
    license: string;
};

export const WATERMARK_CONSTANTS = {
    MAX_IMAGE_DIMENSION: 8192,
    MAX_FILE_SIZE_MB: 50,
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    DEFAULT_OPACITY: 0.85,
    DEFAULT_SCALE: 5,
    DEFAULT_POSITION: 'bottom-right' as WatermarkPosition,
};
