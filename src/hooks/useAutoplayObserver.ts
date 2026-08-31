// =============================================================================
// Hook: useAutoplayObserver
// Issue: #3681 - Build an 'Interactive "Club Pitch" Video Carousel'
// Description: IntersectionObserver that auto-plays a muted <video> when its
// card scrolls into the center band of the viewport and pauses it when it
// leaves, saving battery and bandwidth across a 500-club directory.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

interface UseAutoplayObserverReturn {
    containerRef: React.RefObject<HTMLDivElement>;
    videoRef: React.RefObject<HTMLVideoElement>;
    isInView: boolean;
}

export function useAutoplayObserver(): UseAutoplayObserverReturn {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const video = videoRef.current;
        if (!container || !video) return;

        // Only the central 60% band of the viewport counts as "visible"
        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
                setIsInView(visible);

                if (visible) {
                    video.muted = true;          // autoplay policies require muted
                    video.playsInline = true;
                    video.play().catch(() => {/* user may need to interact first */ });
                } else {
                    video.pause();
                }
            },
            { threshold: [0, 0.6, 1] }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    return { containerRef, videoRef, isInView };
}
