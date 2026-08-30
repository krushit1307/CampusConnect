/**
 * @fileoverview Main orchestration for Event Photography Watermarking.
 * Handles the complete pipeline from receiving raw images, applying dynamic Watermarks,
 * and storing them securely.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Types
export interface WatermarkOptions {
    eventId: string;
    eventName: string;
    clubId: string;
    clubLogoUrl: string;
    opacity?: number;
    padding?: number;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    fontSize?: number;
    textColor?: string;
    fontFamily?: string;
}

export interface ProcessingResult {
    success: boolean;
    watermarkedUrl?: string;
    originalUrl?: string;
    error?: string;
    processingTimeMs?: number;
}

export class WatermarkPipeline {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Downloads an image into a buffer
     */
    private async downloadImage(url: string): Promise<Buffer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Creates a text SVG for the watermark
     */
    private createTextSvg(text: string, width: number, options: WatermarkOptions): Buffer {
        const fontSize = options.fontSize || Math.max(16, Math.floor(width * 0.03));
        const color = options.textColor || 'rgba(255, 255, 255, 0.85)';
        const font = options.fontFamily || 'Arial, Helvetica, sans-serif';
        
        const svg = `
            <svg width="${width}" height="${fontSize * 2}">
                <style>
                    .title { 
                        fill: ${color}; 
                        font-size: ${fontSize}px; 
                        font-family: ${font};
                        font-weight: bold;
                        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    }
                </style>
                <text x="10" y="${fontSize * 1.2}" class="title">${text}</text>
            </svg>
        `;
        return Buffer.from(svg);
    }

    /**
     * Process a single image with a club logo and event text
     */
    public async processImage(rawImageUrl: string, options: WatermarkOptions): Promise<Buffer> {
        try {
            // Fetch images
            const [baseImageBuffer, logoBuffer] = await Promise.all([
                this.downloadImage(rawImageUrl),
                this.downloadImage(options.clubLogoUrl)
            ]);

            const baseImage = sharp(baseImageBuffer);
            const metadata = await baseImage.metadata();
            
            if (!metadata.width || !metadata.height) {
                throw new Error("Invalid image metadata");
            }

            // Calculate target logo width (5% of base image width as per requirements)
            const targetLogoWidth = Math.max(50, Math.floor(metadata.width * 0.05));
            
            // Resize logo
            const resizedLogo = await sharp(logoBuffer)
                .resize({ width: targetLogoWidth, fit: 'inside' })
                .toBuffer();

            // Create text SVG
            const textSvg = this.createTextSvg(options.eventName, metadata.width, options);

            const padding = options.padding || 20;

            // Prepare composite operations
            const composites = [
                {
                    input: resizedLogo,
                    gravity: options.position === 'bottom-left' ? 'southwest' : 
                             options.position === 'top-left' ? 'northwest' :
                             options.position === 'top-right' ? 'northeast' : 'southeast',
                    blend: 'over' as sharp.Blend
                },
                {
                    input: textSvg,
                    gravity: 'south',
                    blend: 'over' as sharp.Blend
                }
            ];

            return await baseImage
                .composite(composites)
                .withMetadata()
                .jpeg({ quality: 90 }) // Optimize for web
                .toBuffer();

        } catch (error: any) {
            console.error("Watermark processing failed:", error);
            throw new Error(`Watermark generation failed: ${error.message}`);
        }
    }

    /**
     * Upload processed image back to Storage
     */
    public async uploadProcessedImage(
        bucketName: string, 
        fileName: string, 
        buffer: Buffer
    ): Promise<string> {
        const { data, error } = await this.supabase.storage
            .from(bucketName)
            .upload(fileName, buffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            throw new Error(`Storage upload failed: ${error.message}`);
        }

        const { data: { publicUrl } } = this.supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        return publicUrl;
    }

    /**
     * Full execution flow
     */
    public async execute(
        sourceUrl: string, 
        destinationBucket: string,
        destinationPath: string,
        options: WatermarkOptions
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        try {
            const processedBuffer = await this.processImage(sourceUrl, options);
            const watermarkedUrl = await this.uploadProcessedImage(
                destinationBucket, 
                destinationPath, 
                processedBuffer
            );

            return {
                success: true,
                originalUrl: sourceUrl,
                watermarkedUrl,
                processingTimeMs: Date.now() - startTime
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                originalUrl: sourceUrl,
                processingTimeMs: Date.now() - startTime
            };
        }
    }
}
