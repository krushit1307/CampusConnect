'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ClubSubscription } from '@/types/subscriptions';
import ProratedUpgradeModal from '@/components/clubs/ProratedUpgradeModal';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClubMembershipPage() {
    const params = useParams();
    const clubId = params.id as string;

    const [subscription, setSubscription] = useState<ClubSubscription | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSubscription() {
            const { data, error } = await supabase
                .from('club_subscriptions')
                .select('*')
                .eq('club_id', clubId)
                .single();

            if (!error && data) {
                setSubscription(data);
            }
            setIsLoading(false);
        }
        fetchSubscription();
    }, [clubId]);

    if (isLoading || !subscription) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                    Club Membership & Billing
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Plan Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                                    {subscription.current_tier.charAt(0).toUpperCase() + subscription.current_tier.slice(1)}
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
                                Active
                            </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                            Billed monthly. Next billing date: {new Date(subscription.billing_cycle_anchor).toLocaleDateString()}
                        </p>

                        {subscription.current_tier === 'basic' && (
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors"
                            >
                                Upgrade to Premium
                            </button>
                        )}
                    </div>

                    {/* Benefits Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            {subscription.current_tier === 'premium' ? 'Premium Benefits' : 'Upgrade to Unlock'}
                        </h3>
                        <ul className="space-y-3 text-gray-600 dark:text-gray-300">
                            <li className="flex items-center space-x-2">
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Unlimited event creations</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Advanced analytics dashboard</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Priority support</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {showUpgradeModal && (
                <ProratedUpgradeModal
                    clubId={clubId}
                    newPriceId="price_premium_monthly_123" // Replace with actual Stripe Price ID
                    currentTier={subscription.current_tier}
                    onClose={() => setShowUpgradeModal(false)}
                    onSuccess={() => {
                        setShowUpgradeModal(false);
                        window.location.reload();
                    }}
                />
            )}
        </div>
    );
}
