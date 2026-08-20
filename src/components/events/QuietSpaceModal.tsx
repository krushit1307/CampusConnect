// =============================================================================
// Component: QuietSpaceModal
// Issue: #3555 - Develop a 'Dynamic "Quiet Space" Finder for Events'
// Description: A highly accessible, low-stimulation modal displaying the
// location, written directions, and a photo of the quiet decompression zone.
// Uses muted colors, large typography, and avoids jarring animations.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { QuietSpaceDetails } from '../../hooks/useQuietSpace';

interface QuietSpaceModalProps {
    details: QuietSpaceDetails;
    onClose: () => void;
}

export const QuietSpaceModal: React.FC<QuietSpaceModalProps> = ({ details, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Trap focus inside the modal for accessibility
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Focus the modal container when it opens
        modalRef.current?.focus();

        // Prevent body scroll while modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                // Close if clicking outside the modal content
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="quiet-space-title"
                className="w-full max-w-lg bg-slate-50 dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 focus:outline-none"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-100 dark:bg-slate-900/50">
                    <h2 id="quiet-space-title" className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                        Quiet Decompression Zone
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Close modal"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Location Highlight */}
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-teal-100 dark:bg-teal-900/40 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-teal-700 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {details.location}
                            </p>
                        </div>
                    </div>

                    {/* Directions */}
                    {details.description && (
                        <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                How to get there
                            </p>
                            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                                {details.description}
                            </p>
                        </div>
                    )}

                    {/* Photo Reference */}
                    {details.photoUrl && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Look for this door:</p>
                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                <img
                                    src={details.photoUrl}
                                    alt={`Entrance to ${details.location}`}
                                    className="w-full h-48 object-cover"
                                />
                            </div>
                        </div>
                    )}

                    {/* Reassurance Message */}
                    <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                            This space is reserved for decompression. Low lighting and silence are maintained.
                        </p>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-700 dark:bg-slate-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors font-medium text-base focus:outline-none focus:ring-4 focus:ring-slate-300 dark:focus:ring-slate-500"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
