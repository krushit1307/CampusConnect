export interface ImageTransformOptions {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "cover" | "contain" | "fill";
}
export declare function isSupabasePublicImage(url: string): boolean;
export declare function isSafeImageSrc(source: string): boolean;
export declare function getOptimizedImageUrl(source: string, options?: ImageTransformOptions): string;
export declare function buildResponsiveImageSrcSet(source: string, widths: number[], options?: Omit<ImageTransformOptions, "width">): string | undefined;
