// =============================================================================
// Component: RSVPGuard
// Issue: #3330 - Implement 'Automated No-Show Penalty' System
// Description: Wraps the standard RSVP button. If the user is suspended, it 
// replaces the button with a disabled state and a tooltip explaining the ban.
// Also shows a warning if they are 1 strike away from suspension.
// =============================================================================

import React, { useState } from 'react';
import { useUserPenalties } from '../../hooks/useUserPenalties';

interface RSVPGuardProps {
    onRSVP: () => void;
    isAttending: boolean;
    eventTitle: string;
}

export const RSVPGuard: React.FC<RSVPGuardProps> = ({ onRSVP, isAttending, eventTitle }) => {
    const { penalties, canRSVP, isLoading } = useUserPenalties();
    const [showTooltip, setShowTooltip] = useState(false);

    if (isLoading) {
        return <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>;
    }

    // If suspended, render the blocked state
    if (!canRSVP) {
        return (
            <div className="relative inline-block">
                <button
                    disabled
                    className="px-6 py-2.5 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed font-bold text-sm flex items-center gap-2"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    RSVP Blocked
                </button>

                {showTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-10">
                        <p className="font-bold mb-1">Account Suspended</p>
                        <p>You have {penalties.noShowCount} no-show strikes. RSVP privileges are suspended for {penalties.daysRemaining} more days.</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    </div>
                )}
            </div>
        );
    }

    // Warning state: 2 strikes (1 away from ban)
    const isWarning = penalties.noShowCount === 2 && !isAttending;

    return (
        <div className="relative inline-block">
            <button
                onClick={onRSVP}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95 ${isAttending
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
            >
                {isAttending ? 'Attending ✓' : 'RSVP Now'}
            </button>

            {isWarning && (
                <p className="absolute top-full left-0 mt-1 text-xs text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                    ⚠️ Warning: 1 strike away from 30-day suspension!
                </p>
            )}
        </div>
    );
};
