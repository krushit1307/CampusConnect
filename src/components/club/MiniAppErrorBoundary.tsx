// =============================================================================
// Component: MiniAppErrorBoundary
// Issue: #2729 - Develop a Micro-Frontend Architecture for Club-Specific Mini-Apps
// Description: A strict React Error Boundary that catches crashes in remote
// micro-frontends. Prevents a buggy club mini-app from taking down the entire
// CampusConnect host application.
// =============================================================================

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  appName?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MiniAppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[MiniAppErrorBoundary] Uncaught error in ${this.props.appName || "Remote App"}:`,
      error,
      errorInfo,
    );

    // Call optional error reporting callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default beautiful error UI for the mini-app container
      return (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
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
          </div>

          <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">
            {this.props.appName || "Club Mini-App"} Crashed
          </h3>

          <p className="text-sm text-red-600 dark:text-red-400 mb-4 max-w-md mx-auto">
            The custom application provided by this club encountered a fatal error and was safely
            isolated. The main CampusConnect platform remains unaffected.
          </p>

          <details className="text-left bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-900 max-w-lg mx-auto">
            <summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Technical Details (For Club Developers)
            </summary>
            <pre className="mt-3 text-xs text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre-wrap font-mono">
              {this.state.error?.message}
              {"\n\n"}
              {this.state.error?.stack?.substring(0, 500)}...
            </pre>
          </details>

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Attempt Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
