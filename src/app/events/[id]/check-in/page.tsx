'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { awardEventPoints } from '@/lib/gamification';
import { CheckInResponse } from '@/types/gamification';
import CheckInFeedback from '@/components/events/CheckInFeedback';
import { useAuth } from '@/lib/auth'; // Assumed existing auth hook

export default function EventCheckInPage() {
    const params = useParams();
    const eventId = params.id as string;
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [checkInResponse, setCheckInResponse] = useState<CheckInResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheckIn = async () => {
        if (!user) {
            setError('You must be logged in to check in.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Assuming base points are fetched or standardized at 10 for this example
            const basePoints = 10;
            const response = await awardEventPoints(user.id, eventId, basePoints);
            setCheckInResponse(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check in');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    Event Check-In
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">
                    Confirm your attendance to earn gamification points and maintain your event series streak!
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleCheckIn}
                    disabled={isLoading}
                    className={`
            w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
            ${isLoading
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                        }
          `}
                >
                    {isLoading ? 'Processing Check-In...' : 'Check In Now'}
                </button>
            </div>

            <CheckInFeedback
                response={checkInResponse}
                onClose={() => setCheckInResponse(null)}
            />
        </div>
    );
}
