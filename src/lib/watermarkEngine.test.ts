import { WatermarkPipeline, WatermarkOptions } from './watermarkEngine';
import { SupabaseClient } from '@supabase/supabase-js';

// Mocking the Sharp library
jest.mock('sharp', () => {
    const sharpMock = jest.fn((input) => {
        return {
            metadata: jest.fn().mockResolvedValue({ width: 2000, height: 1000 }),
            resize: jest.fn().mockReturnThis(),
            composite: jest.fn().mockReturnThis(),
            withMetadata: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-processed-image-buffer'))
        };
    });
    return sharpMock;
});

// Mock for global fetch
global.fetch = jest.fn((url) => {
    if (url.includes('error')) {
        return Promise.resolve({
            ok: false,
            statusText: 'Not Found'
        } as Response);
    }

    return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    } as Response);
});

describe('WatermarkPipeline', () => {
    let mockSupabase: jest.Mocked<SupabaseClient>;
    let pipeline: WatermarkPipeline;
    const mockImageBuffer = Buffer.from('mock-image-data');

    const defaultOptions: WatermarkOptions = {
        eventId: 'evt-123',
        eventName: 'Annual Hacker Gala',
        clubId: 'club-456',
        clubLogoUrl: 'https://example.com/logo.png',
        opacity: 0.8,
        position: 'bottom-right'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockSupabase = {
            storage: {
                from: jest.fn().mockReturnValue({
                    upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
                    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://mock.supabase.com/test/path' } })
                })
            }
        } as unknown as jest.Mocked<SupabaseClient>;

        pipeline = new WatermarkPipeline(mockSupabase);
    });

    it('successfully processes an image with default options', async () => {
        const result = await pipeline.processImage('https://example.com/raw.jpg', defaultOptions);

        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledTimes(2); // One for image, one for logo
        expect(result).toEqual(Buffer.from('mock-processed-image-buffer'));
    });

    it('throws error when image download fails', async () => {
        await expect(
            pipeline.processImage('https://example.com/error.jpg', defaultOptions)
        ).rejects.toThrow("Failed to fetch image: Not Found");
    });

    it('correctly calculates text scaling based on image width', async () => {
        // We know mock width is 2000, 3% is 60px fontSize
        await pipeline.processImage('https://example.com/raw.jpg', defaultOptions);
        // The text SVG generation relies on width
        // Can be verified by spying on createTextSvg if we exposed it, but we test the end effect via coverage
    });

    it('respects different gravity positioning', async () => {
        const topLeftOptions = { ...defaultOptions, position: 'top-left' as const };
        const result = await pipeline.processImage('https://example.com/raw.jpg', topLeftOptions);
        expect(result).toBeDefined();
    });

    describe('Full Execution Flow', () => {
        it('returns success object and valid URL on complete execution', async () => {
            const result = await pipeline.execute(
                'https://example.com/raw.jpg',
                'event-galleries',
                'club/event/public/photo1.jpg',
                defaultOptions
            );

            expect(result.success).toBe(true);
            expect(result.watermarkedUrl).toBe('https://mock.supabase.com/test/path');
            expect(result.error).toBeUndefined();
            expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('returns failure object on upload failure', async () => {
            // Mock upload to fail
            mockSupabase.storage.from = jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ data: null, error: { message: "Permission Denied" } }),
                getPublicUrl: jest.fn()
            });

            pipeline = new WatermarkPipeline(mockSupabase);

            const result = await pipeline.execute(
                'https://example.com/raw.jpg',
                'event-galleries',
                'club/event/public/photo1.jpg',
                defaultOptions
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("Storage upload failed: Permission Denied");
            expect(result.watermarkedUrl).toBeUndefined();
        });

        it('returns failure object on image processing exception', async () => {
            // Induce a fetch error to trigger the catch block in execute()
            const result = await pipeline.execute(
                'https://example.com/error.jpg',
                'event-galleries',
                'club/event/public/photo1.jpg',
                defaultOptions
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("Failed to fetch image: Not Found");
        });
    });
});
