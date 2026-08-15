// =============================================================================
// Component: MiniAppHost
// Issue: #2729 - Develop a Micro-Frontend Architecture for Club-Specific Mini-Apps
// Description: The "Host Area" component placed on the Club Profile page.
// It dynamically imports and renders the remote micro-frontend, wrapping it
// in an Error Boundary and providing a beautiful loading skeleton.
// =============================================================================

import React, { Suspense } from "react";
import { useMiniApp } from "../../hooks/useMiniApp";
import { MiniAppErrorBoundary } from "./MiniAppErrorBoundary";

interface MiniAppHostProps {
  clubId: string;
  clubName: string;
  remoteUrl: string | null;
}

export const MiniAppHost: React.FC<MiniAppHostProps> = ({ clubId, clubName, remoteUrl }) => {
  const { RemoteComponent, isLoading, error, retry } = useMiniApp({
    remoteUrl,
    moduleName: "./App",
    clubId,
  });

  // If no remote URL is configured for this club, show a placeholder
  if (!remoteUrl) {
    return (
      <div className="w-full bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No Custom Mini-App Configured
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {clubName} hasn't deployed a custom micro-frontend yet. Club admins can configure a remote
          URL in the developer settings to inject custom tools here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header for the Mini-App section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {clubName} Custom Tools
          </h3>
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
          Micro-Frontend
        </span>
      </div>

      {/* The actual host container */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg min-h-[400px]">
        <MiniAppErrorBoundary appName={clubName}>
          <Suspense fallback={<MiniAppSkeleton />}>
            {isLoading && !RemoteComponent && <MiniAppSkeleton />}

            {error && !RemoteComponent && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Failed to Load Mini-App
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                  {error}
                </p>
                <button
                  onClick={retry}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* Render the Remote Component if successfully loaded */}
            {RemoteComponent && (
              <div className="mini-app-container w-full h-full">
                {/* 
                  The remote app receives the shared scope (React, Theme, UserID) 
                  via the Module Federation init() call in federation.ts 
                */}
                <RemoteComponent />
              </div>
            )}
          </Suspense>
        </MiniAppErrorBoundary>
      </div>
    </div>
  );
};

/**
 * Loading Skeleton for the Mini-App container
 */
const MiniAppSkeleton: React.FC = () => (
  <div className="p-6 space-y-6 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    </div>

    <div className="space-y-3">
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-4">
      <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="h-10 w-32 bg-indigo-200 dark:bg-indigo-900/50 rounded-lg"></div>
    </div>
  </div>
);
