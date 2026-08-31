// =============================================================================
// Component: QuickEscapeButton
//Issue: #3562 - Build an 'Interactive Campus "Safe Space" Directory'
//Description: A critical digital safety feature standard on domestic violence
//and safety sites.Instantly redirects the browser to a neutral site(like
//Google or a weather site) and replaces the history state so the user can
//quickly hide that they were viewing sensitive resources.
// =============================================================================

import React, { useCallback, useEffect } from 'react';

export const QuickEscapeButton: React.FC = () => {

    const handleEscape = useCallback(() => {
        // 1. Redirect to a neutral, safe site immediately
        const neutralUrl = 'https://www.google.com/search?q=weather';

        // 2. Replace the current history entry so the "Back" button doesn't return to the sensitive page
        window.location.replace(neutralUrl);

        // 3. Fallback: If replace fails, force navigation
        window.location.href = neutralUrl;
    }, []);

    // Listen for the "Escape" key (Keyboard shortcut for quick exit)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Trigger on 'Escape' key or 'Ctrl+Shift+X'
            if (e.key === 'Escape' || (e.ctrlKey && e.shiftKey && e.key === 'X')) {
                handleEscape();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleEscape]);

    return (
        <div className="fixed top-4 right-4 z-50 md:static md:mb-6">
            <button
                onClick={handleEscape}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg transition-all font-bold text-sm focus:outline-none focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800 active:scale-95"
                aria-label="Quick Escape: Leave this site immediately"
                title="Press ESC or Ctrl+Shift+X to quickly exit"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden md:inline">Quick Escape</span>
                <span className="md:hidden">Exit</span>
            </button>

            <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px] font-mono">ESC</kbd> to leave quickly
            </p>
        </div>
    );
};
