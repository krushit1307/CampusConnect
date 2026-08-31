'use client';

import { useState, useEffect } from 'react';
import { BlueLightPhone } from '@/types/safety';

/**
 * Props for the BlueLightLayer component.
 */
interface BlueLightLayerProps {
    /** Array of blue light phones to render on the map */
    phones: BlueLightPhone[];
    /** Callback when a phone marker is clicked */
    onPhoneClick?: (phone: BlueLightPhone) => void;
    /** Whether the layer is currently visible */
    isVisible: boolean;
}

/**
 * Interactive map layer component that renders physical "Blue Light" emergency phones.
 * Supports dark and light mode styling for high visibility.
 */
export default function BlueLightLayer({ phones, onPhoneClick, isVisible }: BlueLightLayerProps) {
    const [hoveredPhoneId, setHoveredPhoneId] = useState<string | null>(null);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="absolute inset-0 pointer-events-none z-20">
            {phones.map((phone) => {
                // Convert coordinates to relative map percentages (mocked for this implementation)
                // In a real map library (e.g., Mapbox, Leaflet), this would use projection utilities
                const left = ((phone.coordinates[0] + 180) / 360) * 100;
                const top = ((90 - phone.coordinates[1]) / 180) * 100;

                const isHovered = hoveredPhoneId === phone.id;
                const isInactive = phone.status !== 'active';

                return (
                    <div
                        key={phone.id}
                        className={`absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isHovered ? 'scale-125 z-30' : 'scale-100 z-20'
                            }`}
                        style={{ left: `${left}%`, top: `${top}%` }}
                        onMouseEnter={() => setHoveredPhoneId(phone.id)}
                        onMouseLeave={() => setHoveredPhoneId(null)}
                        onClick={() => onPhoneClick?.(phone)}
                        role="button"
                        aria-label={`Emergency phone: ${phone.name}, Status: ${phone.status}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                onPhoneClick?.(phone);
                            }
                        }}
                    >
                        {/* Pulsing effect for active phones */}
                        {!isInactive && (
                            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                        )}

                        {/* Main icon container */}
                        <div
                            className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 shadow-lg transition-colors ${isInactive
                                    ? 'bg-gray-300 border-gray-500 dark:bg-gray-700 dark:border-gray-500'
                                    : 'bg-blue-600 border-blue-800 dark:bg-blue-500 dark:border-blue-300 hover:bg-blue-700 dark:hover:bg-blue-400'
                                }`}
                        >
                            <svg
                                className={`w-5 h-5 ${isInactive ? 'text-gray-600 dark:text-gray-400' : 'text-white'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                            </svg>
                        </div>

                        {/* Tooltip on hover */}
                        {isHovered && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl text-xs z-40">
                                <p className="font-bold text-gray-900 dark:text-white mb-1">{phone.name}</p>
                                <p className={`font-medium ${isInactive ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                    }`}>
                                    Status: {phone.status.charAt(0).toUpperCase() + phone.status.slice(1)}
                                </p>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                    Last checked: {new Date(phone.lastChecked).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
