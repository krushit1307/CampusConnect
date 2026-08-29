// src/components/InactivityWarningBanner.jsx

import React from 'react';

export default function InactivityWarningBanner({ decayActive }) {
    if (!decayActive) return null;

    return (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-sm">
            <div className="flex items-center">
                <div className="flex-shrink-0 text-amber-500 font-bold text-lg mr-3">
                    ⚠️
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-amber-800">INACTIVITY PENALTY ACTIVE</h4>
                    <p className="text-sm text-amber-700 mt-0.5">
                        Your club is losing 5% of its points every week! Host an event to stop the decay and restore your leaderboard standing.
                    </p>
                </div>
            </div>
        </div>
    );
}
