// =============================================================================
// Component: AccessibilityStatusBadge
// Issue: #3551 - Implement 'Dynamic Accessibility Sign Language Interpreter Request'
// Description: Displays the current status of an accessibility request on the
// user's digital ticket. Shows "Pending Confirmation" or "Confirmed" so the
// user knows support will be available at the event.
// =============================================================================

import React from 'react';
import { RequestStatus } from '../../hooks/useAccessibilityRequests';

interface AccessibilityStatusBadgeProps {
    status: RequestStatus;
    requestType: string;
}

export const AccessibilityStatusBadge: React.FC<AccessibilityStatusBadgeProps> = ({ status, requestType }) => {

    const formatType = (type: string) => {
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getStatusConfig = () => {
        switch (status) {
            case 'pending':
                return {
                    bg: 'bg-amber-100 dark:bg-amber-900/30',
                    text: 'text-amber-800 dark:text-amber-300',
                    border: 'border-amber-200 dark:border-amber-800',
                    icon: (
                        <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ),
                    label: 'Pending Confirmation'
                };
            case 'confirmed':
                return {
                    bg: 'bg-green-100 dark:bg-green-900/30',
                    text: 'text-green-800 dark:text-green-300',
                    border: 'border-green-200 dark:border-green-800',
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ),
                    label: 'Confirmed'
                };
            case 'denied':
                return {
                    bg: 'bg-red-100 dark:bg-red-900/30',
                    text: 'text-red-800 dark:text-red-300',
                    border: 'border-red-200 dark:border-red-800',
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ),
                    label: 'Unable to Fulfill'
                };
            case 'fulfilled':
                return {
                    bg: 'bg-blue-100 dark:bg-blue-900/30',
                    text: 'text-blue-800 dark:text-blue-300',
                    border: 'border-blue-200 dark:border-blue-800',
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ),
                    label: 'Fulfilled'
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className={`p-3 rounded-lg border ${config.bg} ${config.border} flex items-start gap-3`}>
            <div className={`flex-shrink-0 mt-0.5 ${config.text}`}>
                {config.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${config.text}`}>
                    {formatType(requestType)}: {config.label}
                </p>
                {status === 'pending' && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        The Disability Center has been notified and is confirming availability.
                    </p>
                )}
                {status === 'confirmed' && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                        Support has been confirmed and will be available at the event.
                    </p>
                )}
            </div>
        </div>
    );
};
