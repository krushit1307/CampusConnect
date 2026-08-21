// =============================================================================
// Component: QuietSpaceFAB (Floating Action Button)
// Issue: #3555 - Develop a 'Dynamic "Quiet Space" Finder for Events'
// Description: A persistent, calming floating action button rendered on the
// active event dashboard for checked-in users. Uses muted colors and minimal
// animations to avoid contributing to sensory overload.
// =============================================================================

import React from 'react';
import { useQuietSpace } from '../../hooks/useQuietSpace';
import { QuietSpaceModal } from './QuietSpaceModal';

interface QuietSpaceFABProps {
    eventId: string;
    currentUserId: string;
}

export const QuietSpaceFAB: React.FC<QuietSpaceFABProps> = ({ eventId, currentUserId }) => {
    const { details, isCheckedIn, isLoading } = useQuietSpace(eventId, currentUserId);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    // Only render if the user is checked in and the event has a designated quiet space
    if (isLoading || !isCheckedIn || !details) {
        return null;
    }

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-4 bg-slate-600 dark:bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-slate-300 dark:focus:ring-slate-500"
                aria-label="Find Quiet Space"
            >
                {/* Calming icon (e.g., a leaf or gentle wave) */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="font-medium text-sm tracking-wide">Find Quiet Space</span>
            </button>

            {/* Modal Overlay */}
            {isModalOpen && (
                <QuietSpaceModal
                    details={details}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
};
