// =============================================================================
// Page: NoShowFeedbackLanding
//  Issue: #3563 - Implement 'Automated Post-Event "No-Show" Feedback Loop'
//  Description: The landing page users are redirected to after clicking a
//  1-click survey link in their email. Handles the 'thanks' and 'error' states.
//  =============================================================================

import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export const NoShowFeedbackLanding: React.FC = () => {
    const [searchParams] = useSearchParams();
    const isThanks = window.location.pathname.includes('/thanks');
    const errorMessage = searchParams.get('message');

    if (isThanks) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Thanks for the feedback!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Your response has been recorded. This helps organizers plan better events in the future.
                    </p>
                    <Link
                        to="/events"
                        className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm"
                    >
                        Browse Upcoming Events
                    </Link>
                </div>
            </div>
        );
    }

    // Error State
    const errorMessages: Record<string, string> = {
        missing_params: 'The survey link is invalid or missing required information.',
        invalid_rsvp: 'We couldn\'t verify your RSVP status for this event.',
        server_error: 'Something went wrong while recording your feedback. Please try again later.'
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-red-200 dark:border-red-800">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Oops! Something went wrong.</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {errorMessages[errorMessage || ''] || 'We couldn\'t process your feedback. The link may have expired.'}
                </p>
                <Link
                    to="/"
                    className="inline-block px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                >
                    Return Home
                </Link>
            </div>
        </div>
    );
};
