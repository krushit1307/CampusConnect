// =============================================================================
// Component: BountyBadge
//  Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
//  Description: A prominent visual badge displayed on Lost Item cards to 
//  indicate an active monetary reward. Pulses gently to draw attention.
// =============================================================================

import React from 'react';

interface BountyBadgeProps {
    amountCents: number;
    status: 'none' | 'escrow' | 'released' | 'refunded' | 'disputed';
}

export const BountyBadge: React.FC<BountyBadgeProps> = ({ amountCents, status }) => {
    if (status === 'none' || amountCents <= 0) return null;

    const amountDollars = (amountCents / 100).toFixed(0);

    const getStatusConfig = () => {
        switch (status) {
            case 'escrow':
                return {
                    bg: 'bg-amber-100 dark:bg-amber-900/40',
                    text: 'text-amber-800 dark:text-amber-300',
                    border: 'border-amber-300 dark:border-amber-700',
                    label: '💰 Reward',
                    animate: true
                };
            case 'released':
                return {
                    bg: 'bg-green-100 dark:bg-green-900/40',
                    text: 'text-green-800 dark:text-green-300',
                    border: 'border-green-300 dark:border-green-700',
                    label: '✅ Paid Out',
                    animate: false
                };
            case 'disputed':
                return {
                    bg: 'bg-red-100 dark:bg-red-900/40',
                    text: 'text-red-800 dark:text-red-300',
                    border: 'border-red-300 dark:border-red-700',
                    label: '⚠️ Disputed',
                    animate: false
                };
            default:
                return {
                    bg: 'bg-gray-100 dark:bg-gray-700',
                    text: 'text-gray-800 dark:text-gray-300',
                    border: 'border-gray-300 dark:border-gray-600',
                    label: 'Reward',
                    animate: false
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${config.bg} ${config.text} ${config.border} ${config.animate ? 'animate-pulse-slow' : ''}`}>
            <span className="text-xs font-bold uppercase tracking-wider">
                {config.label}
            </span>
            <span className="text-sm font-black">
                ${amountDollars}
            </span>

            <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { opacity: 0.95; box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s infinite;
        }
      `}</style>
        </div>
    );
};
