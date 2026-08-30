'use client';

import { useState } from 'react';
import { SponsorCPCSetting } from '@/types/sponsors';
import { useAuth } from '@/lib/auth';

interface SponsorLogoDisplayProps {
    setting: SponsorCPCSetting;
}

export default function SponsorLogoDisplay({ setting }: SponsorLogoDisplayProps) {
    const { user } = useAuth();
    const [isHovered, setIsHovered] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isProcessing || !setting.is_active) return;

        setIsProcessing(true);

        try {
            const response = await fetch('/api/sponsors/track-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sponsorSettingId: setting.id,
                    eventId: setting.event_id,
                    userId: user?.id || null,
                    ipAddress: '', // Will be captured by server
                }),
            });

            const data = await response.json();

            if (response.ok && data.redirectUrl) {
                window.open(data.redirectUrl, '_blank');
            } else if (data.isBudgetExhausted) {
                // Reload to hide the logo if budget is exhausted
                window.location.reload();
            } else {
                console.warn('Click blocked:', data.error);
            }
        } catch (error) {
            console.error('Failed to track click:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!setting.is_active) {
        return null; // Dynamically remove logo if budget is hit
    }

    return (
        <a
            href="#"
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
        relative block p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm 
        border-2 transition-all duration-300 transform
        ${isHovered ? 'border-blue-500 dark:border-blue-400 scale-105 shadow-lg' : 'border-gray-200 dark:border-gray-700'}
        ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
      `}
        >
            <div className="flex flex-col items-center text-center">
                <img
                    src={setting.logo_url}
                    alt={`${setting.sponsor_name} logo`}
                    className="h-16 w-auto object-contain mb-3"
                />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {setting.sponsor_name}
                </p>
                {isHovered && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium animate-pulse">
                        Click to visit sponsor
                    </p>
                )}
            </div>

            {/* CPC Indicator for transparency (optional, can be hidden) */}
            <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                    Sponsored
                </span>
            </div>
        </a>
    );
}
