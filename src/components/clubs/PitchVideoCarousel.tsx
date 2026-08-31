// =============================================================================
// Component: PitchVideoCarousel
// Issue: #3681 - Build an 'Interactive "Club Pitch" Video Carousel'
// Description: Swipeable, scroll-snap carousel of pitch video cards with
// arrow controls. Only cards in the viewport center auto-play (observer).
// =============================================================================

import React, { useRef } from 'react';
import { PitchVideoCard, PitchClub } from './PitchVideoCard';

interface PitchVideoCarouselProps {
    clubs: PitchClub[];
    memberships: Set<string>;
    onJoin: (clubId: string) => void;
}

export const PitchVideoCarousel: React.FC<PitchVideoCarouselProps> = ({ clubs, memberships, onJoin }) => {
    const scrollerRef = useRef<HTMLDivElement>(null);

    const scrollBy = (dir: 1 | -1) => {
        scrollerRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
    };

    if (clubs.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
                No pitch videos yet — clubs can upload a 15-second vertical video from their dashboard.
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Arrow controls */}
            <button
                onClick={() => scrollBy(-1)}
                aria-label="Scroll left"
                className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:scale-110 transition-transform"
            >
                ‹
            </button>
            <button
                onClick={() => scrollBy(1)}
                aria-label="Scroll right"
                className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:scale-110 transition-transform"
            >
                ›
            </button>

            {/* Snap-scrolling carousel */}
            <div
                ref={scrollerRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-2 custom-scrollbar"
            >
                {clubs.map(club => (
                    <PitchVideoCard
                        key={club.id}
                        club={club}
                        isMember={memberships.has(club.id)}
                        onJoin={onJoin}
                    />
                ))}
            </div>
        </div>
    );
};
