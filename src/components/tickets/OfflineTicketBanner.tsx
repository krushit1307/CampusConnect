// =============================================================================
// Component: OfflineTicketBanner
// Issue: #2899 - Implement 'Offline Mode' Ticket Caching with Service Workers
// Description: Displays a persistent warning banner when the user's device 
// loses internet connection, reassuring them that their cached tickets are 
// still accessible and valid for scanning.
// =============================================================================

import React from 'react';

interface OfflineTicketBannerProps {
    isOffline: boolean;
}

export const OfflineTicketBanner: React.FC<OfflineTicketBannerProps> = ({ isOffline }) => {
    if (!isOffline) return null;

    return (
        <div className="w-full bg-amber-500 dark:bg-amber-600 text-white px-4 py-3 shadow-md animate-slide-down">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.07-7.071m7.07 7.071L5.636 18.364M8.464 8.464L5.636 5.636m2.828 2.828a5 5 0 017.072 0" />
                </svg>
                <div className="text-center">
                    <p className="font-bold text-sm sm:text-base">
                        Offline Mode: Showing saved tickets
                    </p>
                    <p className="text-xs sm:text-sm text-amber-100 dark:text-amber-200 hidden sm:block">
                        Your QR codes are cached locally and will scan perfectly at the door.
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
