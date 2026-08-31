// tests/unit/reelService.test.ts

import { generateEventHighlightReel } from '../../server/services/reelService';

describe('Interactive Event Highlight Reel Generator (#4151)', () => {

    it('should throw an error if more than 10 images are provided', async () => {
        const tooManyImages = Array.from({ length: 11 }, (_, i) => `/path/img-${i}.jpg`);
        
        await expect(generateEventHighlightReel({
            imagePaths: tooManyImages,
            logoPath: '/path/logo.png',
            outputFilePath: '/output/reel.mp4'
        })).rejects.toThrow('Event highlight reel requires between 1 and 10 photos.');
    });

    it('should throw an error if 0 images are provided', async () => {
        await expect(generateEventHighlightReel({
            imagePaths: [],
            logoPath: '/path/logo.png',
            outputFilePath: '/output/reel.mp4'
        })).rejects.toThrow('Event highlight reel requires between 1 and 10 photos.');
    });
});
