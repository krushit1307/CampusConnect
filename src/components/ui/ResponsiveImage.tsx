// =============================================================================
// Component: ResponsiveImage
//  Issue: #3548 - Implement 'Automated Event Poster Auto-Cropping & Resizing'
//  Description: A wrapper component that utilizes the HTML <picture> element
//  and srcset to serve the exact right image size based on the user's screen.
//  Dramatically improves Largest Contentful Paint (LCP) and prevents layout shift.
// =============================================================================

import React from 'react';

interface ResponsiveImageProps {
    thumbUrl?: string | null;
    bannerUrl?: string | null;
    fullUrl?: string | null;
    originalUrl: string;
    alt: string;
    className?: string;
    aspectRatio?: 'square' | 'banner' | 'auto';
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
    thumbUrl,
    bannerUrl,
    fullUrl,
    originalUrl,
    alt,
    className = '',
    aspectRatio = 'auto'
}) => {

    // Determine the aspect ratio class for the container to prevent layout shift
    const getAspectRatioClass = () => {
        switch (aspectRatio) {
            case 'square': return 'aspect-square';
            case 'banner': return 'aspect-[1200/630]';
            case 'auto': return '';
            default: return '';
        }
    };

    // Build the srcset string for the <img> tag
    // The browser will automatically pick the best size based on viewport and DPR
    const buildSrcSet = () => {
        const sources: string[] = [];
        if (thumbUrl) sources.push(`${thumbUrl} 400w`);
        if (bannerUrl) sources.push(`${bannerUrl} 1200w`);
        if (fullUrl) sources.push(`${fullUrl} 2000w`);
        return sources.length > 0 ? sources.join(', ') : undefined;
    };

    // Determine the default src (fallback to original if variants aren't ready)
    const defaultSrc = bannerUrl || fullUrl || originalUrl;

    return (
        <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${getAspectRatioClass()} ${className}`}>
            <picture>
                {/* Serve WebP if supported */}
                {bannerUrl && (
                    <source
                        type="image/webp"
                        srcSet={`${thumbUrl || bannerUrl} 400w, ${bannerUrl} 1200w`}
                        sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
                    />
                )}

                {/* Fallback img tag */}
                <img
                    src={defaultSrc}
                    srcSet={buildSrcSet()}
                    sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-opacity duration-300"
                />
            </picture>

            {/* Loading skeleton overlay if no image is ready yet */}
            {!defaultSrc && (
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            )}
        </div>
    );
};
