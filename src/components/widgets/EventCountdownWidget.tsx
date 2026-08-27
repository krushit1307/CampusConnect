// =============================================================================
// Component: EventCountdownWidget
// Issue: #3228 - Develop a 'Dynamic Event Countdown Widget' for Mobile Homescreens
// Description: The visual UI for the countdown widget. This component is used 
// both as a preview inside the app's "Widget Settings" page and serves as 
// the exact visual template for the native iOS/Android Widget Extension.
// Supports Dark/Light mode and handles empty states gracefully.
// =============================================================================

import React from 'react';
import { useNextEventWidget } from '../../hooks/useNextEventWidget';
import { generateEventDeepLink } from '../../lib/pwa/widgetBridge';
import { LiveNowBadge } from '../events/LiveNowBadge';

export const EventCountdownWidget: React.FC = () => {
    const { event, countdown, isLoading, error, isEmpty, emptyMessage } = useNextEventWidget();

    if (isLoading) {
        return (
            <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
                <div className="flex gap-4">
                    <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-sm mx-auto bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-200 dark:border-red-800 p-6 text-center">
                <p className="text-red-600 dark:text-red-400 font-medium">Failed to load widget data.</p>
            </div>
        );
    }

    if (isEmpty) {
        return (
            <a
                href="/events"
                className="block w-full max-w-sm mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl p-6 text-center text-white hover:scale-[1.02] transition-transform"
            >
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Your Schedule is Clear</h3>
                <p className="text-indigo-100 text-sm">Tap to discover new events on campus!</p>
            </a>
        );
    }

    if (!event || !countdown) return null;

    const deepLink = generateEventDeepLink(event.eventId);

    return (
        <a
            href={deepLink}
            className="block w-full max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-all group"
        >
            {/* Cover Image Header */}
            <div className="relative h-32 bg-gray-100 dark:bg-gray-900 overflow-hidden">
                {event.coverImage ? (
                    <img
                        src={event.coverImage}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <svg className="w-12 h-12 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}

                {/* Live Badge */}
                {countdown.isLive && (
                    <div className="absolute top-3 left-3">
                        <LiveNowBadge>LIVE NOW</LiveNowBadge>
                    </div>
                )}
            </div>

            {/* Content Body */}
            <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate mb-1">
                    {event.title}
                </h3>

                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{event.location}</span>
                </div>

                {/* Countdown Timer Blocks */}
                {!countdown.isPast && (
                    <div className="grid grid-cols-4 gap-2">
                        <TimeBlock value={countdown.days} label="Days" />
                        <TimeBlock value={countdown.hours} label="Hours" />
                        <TimeBlock value={countdown.minutes} label="Mins" />
                        <TimeBlock value={countdown.seconds} label="Secs" />
                    </div>
                )}

                {/* Relative Text Fallback */}
                {countdown.isPast && (
                    <div className="text-center py-2 text-gray-500 dark:text-gray-400 font-medium">
                        Event has ended
                    </div>
                )}
            </div>
        </a>
    );
};

/**
 * Sub-component: Individual Time Block for the countdown
 */
const TimeBlock: React.FC<{ value: number; label: string }> = ({ value, label }) => (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl p-2 border border-gray-100 dark:border-gray-700">
        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
            {String(value).padStart(2, '0')}
        </span>
        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">
            {label}
        </span>
    </div>
);
