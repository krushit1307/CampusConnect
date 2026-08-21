// =============================================================================
// Component: PenaltyBanner
//Issue: #3330 - Implement 'Automated No-Show Penalty' System
//Description: A prominent red warning banner displayed on the user's profile 
//and dashboard if their RSVP privileges are currently suspended.
// =============================================================================

import React from 'react';
import { useUserPenalties } from '../../hooks/useUserPenalties';

export const PenaltyBanner: React.FC = () => {
    const { penalties, isLoading } = useUserPenalties();

    if (isLoading || !penalties.isSuspended) return null;

    return (
        <div className="bg-red-600 text-white rounded-xl shadow-lg p-4 flex items-center gap-4 animate-pulse-slow">
            <div className="flex-shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <div className="flex-1">
                <h3 className="font-black text-lg leading-tight">RSVP Privileges Suspended</h3>
                <p className="text-sm text-red-100 mt-1">
                    You have received 3 strikes for failing to attend events you RSVP'd to.
                    Your ability to register for new events is suspended for <span className="font-bold">{penalties.daysRemaining} days</span>.
                </p>
            </div>

            <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.9; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite;
        }
      `}</style>
        </div>
    );
};
