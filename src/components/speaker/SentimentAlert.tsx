// =============================================================================
// Component: SentimentAlert
// Issue: #3230 - Implement 'Live Audience Sentiment Analysis'
// Description: A prominent, flashing toast alert that appears on the Speaker 
// Dashboard when a "Confusion Spike" is detected (e.g., 20 people typing "???").
// Automatically dismisses after 10 seconds.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { SentimentState } from '../../hooks/useLiveSentiment';

interface SentimentAlertProps {
    state: SentimentState;
    onDismiss: () => void;
}

export const SentimentAlert: React.FC<SentimentAlertProps> = ({ state, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (state.isConfusionSpike) {
            setIsVisible(true);

            // Auto-dismiss after 10 seconds
            const timer = setTimeout(() => {
                setIsVisible(false);
                onDismiss();
            }, 10000);

            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [state.isConfusionSpike, onDismiss]);

    if (!isVisible) return null;

    return (
        <div className="fixed top-6 right-6 z-50 animate-slide-in-right">
            <div className="bg-red-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-4 max-w-sm border-2 border-red-400 animate-pulse-slow">
                <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <div className="flex-1">
                    <h4 className="font-black text-lg leading-tight mb-1">
                        Confusion Spike Detected!
                    </h4>
                    <p className="text-sm text-red-100 leading-snug">
                        The audience is sending multiple "???" and "what" messages. Consider slowing down or clarifying your last point.
                    </p>
                </div>

                <button
                    onClick={() => { setIsVisible(false); onDismiss(); }}
                    className="flex-shrink-0 p-1 hover:bg-red-700 rounded-lg transition-colors"
                    aria-label="Dismiss alert"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.4s ease-out forwards;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { opacity: 0.95; box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s infinite;
        }
      `}</style>
        </div>
    );
};
