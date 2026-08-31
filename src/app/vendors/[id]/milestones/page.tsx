'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { VendorMilestone, SLACalculationResult } from '@/types/vendors';
import SLAScanner from '@/components/vendors/SLAScanner';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function VendorMilestonesPage() {
    const params = useParams();
    const milestoneId = params.id as string;

    const [milestone, setMilestone] = useState<VendorMilestone | null>(null);
    const [slaResult, setSlaResult] = useState<SLACalculationResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchMilestone() {
            const { data, error } = await supabase
                .from('vendor_milestones')
                .select('*')
                .eq('id', milestoneId)
                .single();

            if (!error && data) {
                setMilestone(data);
            }
            setIsLoading(false);
        }
        fetchMilestone();
    }, [milestoneId]);

    if (isLoading || !milestone) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 flex flex-col items-center justify-center">
            {!milestone.actual_arrival_timestamp && !slaResult ? (
                <SLAScanner
                    milestoneId={milestone.id}
                    vendorId={milestone.vendor_id}
                    clubId={milestone.club_id}
                    deadline={milestone.deadline_timestamp}
                    totalAmount={milestone.total_amount}
                    onScanComplete={setSlaResult}
                />
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Check-In Complete</h3>

                    <div className="space-y-4 text-left bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-6">
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Delay:</span>
                            <span className={`font-bold ${(slaResult?.delayMinutes || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {slaResult?.delayMinutes || 0} minutes
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Penalty:</span>
                            <span className="font-bold text-red-600 dark:text-red-400">
                                -${(slaResult?.penaltyAmount || 0).toFixed(2)} ({slaResult?.penaltyPercentage || 0}%)
                            </span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between">
                            <span className="text-gray-900 dark:text-white font-semibold">Final Payout:</span>
                            <span className="font-black text-xl text-gray-900 dark:text-white">
                                ${(slaResult?.finalPayout || milestone.total_amount).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {slaResult?.message || 'Milestone completed successfully.'}
                    </p>
                </div>
            )}
        </div>
    );
}
