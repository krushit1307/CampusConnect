// =============================================================================
// Component: AccessResultModal
// Issue: #4047 - Develop a 'Dynamic "VIP/Sponsor" Access Control'
// Description: Full-screen overlay that flashes GREEN for authorized access 
// or massive RED for rejection, prominently displaying the user's tier.
// =============================================================================

import React, { useEffect } from 'react';
import { ScanResult } from '../../hooks/useZoneScanner';

interface AccessResultModalProps {
    result: ScanResult;
    onDismiss: () => void;
}

export const AccessResultModal: React.FC<AccessResultModalProps> = ({ result, onDismiss }) => {
    // Auto-dismiss after 3 seconds for rapid scanning
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const isSuccess = result.authorized;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in ${isSuccess ? 'bg-green-900/95' : 'bg-red-900/95'
            }`}>
            <div className="w-full max-w-lg text-center text-white space-y-6">
                {/* Status Icon */}
                <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center border-4 ${isSuccess ? 'bg-green-500 border-green-300' : 'bg-red-500 border-red-300'
                    }`}>
                    {isSuccess ? (
                        <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                </div>

                {/* Main Message */}
                <div>
                    <h1 className="text-5xl font-black tracking-tight mb-2">
                        {isSuccess ? 'ADMIT' : 'REJECT'}
                    </h1>
                    <p className="text-xl font-medium opacity-90">
                        {isSuccess ? `Welcome to the ${result.zone_name}` : result.reject_reason}
                    </p>
                </div>

                {/* User Details */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-3">
                    <div className="flex items-center justify-center gap-4">
                        {result.ticket.avatar_url ? (
                            <img src={result.ticket.avatar_url} alt="" className="w-16 h-16 rounded-full border-2 border-white/50" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                                {result.ticket.user_name.charAt(0)}
                            </div>
                        )}
                        <div className="text-left">
                            <p className="text-2xl font-bold">{result.ticket.user_name}</p>
                            <p className={`text-sm font-black uppercase tracking-wider px-2 py-1 rounded inline-block mt-1 ${result.ticket.tier === 'vip' ? 'bg-purple-500' :
                                    result.ticket.tier === 'sponsor' ? 'bg-yellow-500 text-black' :
                                        result.ticket.tier === 'staff' ? 'bg-blue-500' : 'bg-gray-500'
                                }`}>
                                {result.ticket.tier.toUpperCase()} TICKET
                            </p>
                        </div>
                    </div>
                </div>

                {/* Dismiss Button */}
                <button
                    onClick={onDismiss}
                    className="px-8 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-lg transition-colors"
                >
                    Dismiss
                </button>
            </div>

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
