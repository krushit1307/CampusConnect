// =============================================================================
// Component: FeedbackPrompt
// Issue: #4042 - Implement 'Automated "Post-Event Feedback" Aggregation'
// Description: The landing page for 1-click email feedback links. Validates 
// the HMAC token and submits the rating without requiring a login.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEventFeedback } from '../../hooks/useEventFeedback';

export const FeedbackPrompt: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { submitFeedback, isSubmitting, error } = useEventFeedback();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        const eventId = searchParams.get('event');
        const userId = searchParams.get('user');
        const token = searchParams.get('token');
        const ratingStr = searchParams.get('rating');

        if (!eventId || !userId || !token || !ratingStr) {
            setStatus('error');
            return;
        }

        const rating = parseInt(ratingStr, 10);
        if (rating < 1 || rating > 5) {
            setStatus('error');
            return;
        }

        const submit = async () => {
            const success = await submitFeedback(eventId, userId, token, rating);
            setStatus(success ? 'success' : 'error');
        };

        submit();
    }, [searchParams, submitFeedback]);

    if (status === 'loading' || isSubmitting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Submitting your rating...</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Thank You!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Your feedback has been recorded. It helps us improve future events.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-sm"
                    >
                        Return to CampusConnect
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-red-200 dark:border-red-800">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Invalid or Expired Link</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {error || 'This feedback link is no longer valid. Please log in to your account to rate the event.'}
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                >
                    Return Home
                </button>
            </div>
        </div>
    );
};
