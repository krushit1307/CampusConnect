'use client';

import { useState, useEffect } from 'react';

interface AuctionTimerProps {
    endTime: string;
    wasJustExtended: boolean;
    extensionMessage?: string;
}

export default function AuctionTimer({ endTime, wasJustExtended, extensionMessage }: AuctionTimerProps) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [showExtensionBanner, setShowExtensionBanner] = useState(wasJustExtended);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = new Date(endTime).getTime() - Date.now();

            if (difference <= 0) {
                setTimeLeft('Auction Ended');
                setIsUrgent(false);
                return;
            }

            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            setTimeLeft(`${minutes}m ${seconds}s`);
            setIsUrgent(minutes < 5);
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [endTime]);

    useEffect(() => {
        if (wasJustExtended) {
            setShowExtensionBanner(true);
            const timer = setTimeout(() => setShowExtensionBanner(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [wasJustExtended]);

    return (
        <div className="space-y-3">
            {showExtensionBanner && extensionMessage && (
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg text-blue-800 dark:text-blue-200 text-sm font-medium animate-pulse flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {extensionMessage}
                </div>
            )}

            <div className={`p-4 rounded-xl border-2 text-center transition-colors duration-300 ${isUrgent
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Time Remaining
                </p>
                <p className={`text-4xl font-black tabular-nums ${isUrgent ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-900 dark:text-white'
                    }`}>
                    {timeLeft}
                </p>
            </div>
        </div>
    );
}
