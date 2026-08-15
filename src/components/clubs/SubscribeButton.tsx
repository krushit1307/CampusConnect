// =============================================================================
// Component: SubscribeButton
// Issue: #2817 - Implement Push Subscriptions for Specific Clubs
// Description: Renders a bell icon toggle button next to the "Join Club" action.
// Includes a satisfying micro-animation when toggling the subscription state.
// Fully supports Dark/Light mode.
// =============================================================================

import React, { useState } from "react";
import { useClubSubscription } from "../../hooks/useClubSubscription";

interface SubscribeButtonProps {
  clubId: string;
  clubName: string;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({ clubId, clubName }) => {
  const { isSubscribed, isLoading, toggleSubscription } = useClubSubscription(clubId);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);

    await toggleSubscription();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        group relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300
        ${
          isSubscribed
            ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60"
            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      aria-label={isSubscribed ? `Unsubscribe from ${clubName}` : `Subscribe to ${clubName}`}
      title={isSubscribed ? "Receiving notifications" : "Get notified about new events"}
    >
      {/* Bell Icon with Animation */}
      <div className={`relative ${isAnimating ? "animate-bell-ring" : ""}`}>
        {isSubscribed ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        )}

        {/* Notification Dot for unsubscribed state to draw attention */}
        {!isSubscribed && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        )}
      </div>

      <span className="text-sm hidden sm:inline">{isSubscribed ? "Subscribed" : "Subscribe"}</span>

      {/* Custom CSS for the bell ring animation */}
      <style>{`
        @keyframes bell-ring {
          0% { transform: rotate(0); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-2deg); }
          100% { transform: rotate(0); }
        }
        .animate-bell-ring {
          animation: bell-ring 0.6s ease-in-out;
          transform-origin: top center;
        }
      `}</style>
    </button>
  );
};
