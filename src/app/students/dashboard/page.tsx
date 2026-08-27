'use client';

import { useState, useEffect } from 'react';
import DropoutRescueBanner from '@/components/tutoring/DropoutRescueBanner';
import { useAuth } from '@/lib/auth';

export default function StudentDashboardPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate data fetching
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Render the rescue banner if the user has been granted credits */}
            <DropoutRescueBanner />

            <div className="max-w-7xl mx-auto p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Welcome back, {user?.user_metadata?.full_name || 'Student'}!
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Upcoming Events</h3>
                        <p className="text-gray-600 dark:text-gray-300">You have 2 events this week.</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Gamification Points</h3>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">1,250</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tutoring Sessions</h3>
                        <p className="text-gray-600 dark:text-gray-300">No upcoming sessions.</p>
                    </div>
                </div>

                {/* Rest of the dashboard content remains here */}
                <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recommended for You</h2>
                    <p className="text-gray-500 dark:text-gray-400">Personalized event recommendations will be displayed here.</p>
                </div>
            </div>
        </div>
    );
}
