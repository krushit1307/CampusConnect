'use client';

import { useState, useEffect } from 'react';
import { getAvailableCredits } from '@/lib/tutoring/credits';
import { useAuth } from '@/lib/auth';

export default function DropoutRescueBanner() {
    const { user } = useAuth();
    const [credits, setCredits] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchCredits() {
            if (!user) return;
            const available = await getAvailableCredits(user.id);
            setCredits(available);
            setIsLoading(false);
        }
        fetchCredits();
    }, [user]);

    if (isLoading || credits === 0) {
        return null;
    }

    return (
        <div className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 text-white p-6 shadow-lg">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <div className="bg-white/20 p-3 rounded-full">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">You have {credits} Free Tutoring Session{credits > 1 ? 's' : ''}!</h3>
                        <p className="text-purple-100 mt-1">
                            We noticed you might be falling behind. Book a 1-on-1 session with a Club Executive to catch up on the material.
                        </p>
                    </div>
                </div>
                <a
                    href="/tutoring/book?credit=applied"
                    className="flex-shrink-0 bg-white text-purple-700 hover:bg-purple-50 dark:bg-gray-900 dark:text-purple-300 dark:hover:bg-gray-800 font-bold py-3 px-6 rounded-lg shadow-md transition-colors duration-200 text-center"
                >
                    Book a Session Now
                </a>
            </div>
        </div>
    );
}
