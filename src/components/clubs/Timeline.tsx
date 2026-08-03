import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TimelineEvent from './TimelineEvent';

/**
 * Represents a single historical milestone for a club.
 */
export interface TimelineMilestone {
    /** Unique identifier for the milestone */
    id: string;
    /** The year the milestone occurred */
    year: number;
    /** Title of the milestone event */
    title: string;
    /** Detailed description of the milestone */
    description: string;
    /** Optional image URL to display in the event card */
    imageUrl?: string;
    /** Optional icon name from lucide-react */
    icon?: string;
}

interface TimelineProps {
    /** Array of milestones to display in the timeline */
    milestones: TimelineMilestone[];
    /** Optional className for additional styling */
    className?: string;
}

/**
 * Timeline Component
 * 
 * A fluid, horizontally scrolling timeline component designed to showcase
 * a club's history and major milestones. It utilizes native CSS scroll snapping
 * for a smooth mobile experience and implements a custom wheel event listener
 * to translate vertical mouse wheel scrolling into horizontal movement for
 * desktop users.
 * 
 * It also features an IntersectionObserver to detect which event card is
 * currently centered in the viewport, dynamically updating a floating header
 * to display the active year.
 */
const Timeline: React.FC<TimelineProps> = ({ milestones, className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeYear, setActiveYear] = useState<number | null>(
        milestones.length > 0 ? milestones[0].year : null
    );
    const [isHovered, setIsHovered] = useState(false);

    /**
     * IntersectionObserver setup to track which TimelineEvent is currently
     * in the center of the viewport. This drives the floating active year header.
     */
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observerOptions: IntersectionObserverInit = {
            root: container,
            // The rootMargin creates a narrow vertical strip in the exact center of the container.
            // Only elements intersecting this strip are considered "active".
            rootMargin: '0px -40% 0px -40%',
            threshold: 0.5,
        };

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const year = entry.target.getAttribute('data-year');
                    if (year) {
                        setActiveYear(parseInt(year, 10));
                    }
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        // Observe all timeline event cards
        const eventCards = container.querySelectorAll('[data-timeline-event]');
        eventCards.forEach((card) => observer.observe(card));

        return () => {
            eventCards.forEach((card) => observer.unobserve(card));
            observer.disconnect();
        };
    }, [milestones]);

    /**
     * Wheel Event Listener for Desktop Horizontal Scrolling
     * 
     * Native horizontal scrolling is intuitive on touchscreens but frustrating
     * for desktop users with standard vertical mouse wheels. This listener
     * intercepts vertical scroll events (deltaY) and translates them into
     * horizontal scroll movements (scrollBy) when the user is hovering over
     * the timeline container.
     */
    const handleWheel = useCallback((e: WheelEvent) => {
        // Only intercept vertical scrolling
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();

            if (containerRef.current) {
                // Translate vertical delta to horizontal scroll
                // We multiply by 2 to make the scrolling feel snappy and responsive
                containerRef.current.scrollBy({
                    left: e.deltaY * 2,
                    behavior: 'auto', // 'auto' is smoother for continuous wheel events than 'smooth'
                });
            }
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Add the wheel listener with { passive: false } to allow preventDefault()
        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [handleWheel]);

    /**
     * Calculates the scroll percentage to dynamically adjust the background
     * line or parallax effects if needed in the future.
     */
    const handleScroll = () => {
        // Reserved for future parallax or progress bar implementations
    };

    return (
        <div
            className={`relative w-full ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Floating Active Year Header */}
            <AnimatePresence mode="wait">
                {activeYear && (
                    <motion.div
                        key={activeYear}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="sticky top-0 z-20 flex justify-center pointer-events-none mb-8"
                    >
                        <div className="px-8 py-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full shadow-lg border border-gray-200 dark:border-slate-700">
                            <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                                {activeYear}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Horizontal Scroll Container */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="relative flex overflow-x-auto scroll-snap-type-x mandatory gap-8 pb-8 px-4 md:px-8 scrollbar-hide"
                style={{
                    // Hide scrollbar across different browsers
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE/Edge
                }}
            >
                {/* Continuous Horizontal SVG Line behind the cards */}
                <svg
                    className="absolute top-1/2 left-0 w-full h-2 -translate-y-1/2 pointer-events-none z-0"
                    preserveAspectRatio="none"
                >
                    <line
                        x1="0"
                        y1="50%"
                        x2="100%"
                        y2="50%"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-gray-200 dark:text-slate-700"
                        strokeDasharray="8 8"
                    />
                </svg>

                {/* Timeline Event Cards */}
                {milestones.map((milestone, index) => (
                    <TimelineEvent
                        key={milestone.id}
                        milestone={milestone}
                        index={index}
                        isActive={activeYear === milestone.year}
                    />
                ))}

                {/* Spacer at the end to allow the last card to snap to center */}
                <div className="flex-shrink-0 w-[10%]" />
            </div>

            {/* Scroll Hint Overlay for Desktop Users */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute bottom-2 right-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-900/80 px-3 py-1 rounded-full shadow-sm pointer-events-none"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                        <span>Scroll to explore</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CSS to hide scrollbar in WebKit browsers */}
            <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
        </div>
    );
};

export default Timeline;
