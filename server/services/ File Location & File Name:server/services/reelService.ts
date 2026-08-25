// server/services/reelService.ts

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export interface ReelGenerationOptions {
    imagePaths: string[];
    logoPath: string;
    outputFilePath: string;
    durationPerImage?: number; // default 1.5s
}

/**
 * Generates an optimized 15-second vertical MP4 highlight reel from event photos (#4151).
 */
export async function generateEventHighlightReel(options: ReelGenerationOptions): Promise<string> {
    if (options.imagePaths.length === 0 || options.imagePaths.length > 10) {
        throw new Error('Event highlight reel requires between 1 and 10 photos.');
    }

    const duration = options.durationPerImage || 1.5;
    const numImages = options.imagePaths.length;
    
    // Construct inputs for each image loop and the club logo watermark
    const args: string[] = ['-y'];
    
    options.imagePaths.forEach(img => {
        args.push('-loop', '1', '-t', `${duration + 0.5}`, '-i', img);
    });
    
    // Add logo as final input
    args.push('-i', options.logoPath);

    // Build filter graph for vertical 1080x1920 layout with scaling and padding
    const filterGraph = buildReelFilterGraph(numImages);
    args.push('-filter_complex', filterGraph);
    
    // Output encoding options
    args.push(
        '-map', '[vfinal]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-t', `${numImages * duration}`,
        options.outputFilePath
    );

    await execFileAsync('ffmpeg', args);
    return options.outputFilePath;
}

function buildReelFilterGraph(count: number): string {
    let filters: string[] = [];
    
    // Scale and pad each input image to vertical 1080x1920
    for (let i = 0; i < count; i++) {
        filters.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`);
    }

    // Chain crossfades if multiple images exist, or pass single stream
    let currentStream = 'v0';
    if (count > 1) {
        let offset = 1.0;
        for (let i = 1; i < count; i++) {
            const nextStream = i === count - 1 ? 'vxfade' : `vx${i}`;
            filters.push(`[${currentStream}][v${i}]xfade=transition=fade:duration=0.5:offset=${offset}[${nextStream}]`);
            currentStream = nextStream;
            offset += 1.5;
        }
    }

    // Overlay club logo watermark (last input index = count)
    filters.push(`[${currentStream}][${count}:v]overlay=W-w-50:50[vfinal]`);

    return filters.join(';');
}
