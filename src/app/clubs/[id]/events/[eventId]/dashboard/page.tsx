'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import PartialRefundModal from '@/components/events/PartialRefundModal';

export default function EventDashboardPage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundSuccess, setRefundSuccess] = useState(false);

    // Mock data for demonstration
    const totalRegistrants = 142;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Event Dashboard
                    </h1>
                    <button
                        onClick={() => setShowRefundModal(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white font-medium rounded-lg shadow-md transition-colors"
                    >
                        Issue Partial Refund
                    </button>
                </div>

                {refundSuccess && (
                    <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300">
                        Refunds processed successfully. Affected users have been notified via email.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Total Registrants</h3>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalRegistrants}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Revenue</h3>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">$4,260.00</p>
                    </div>
                </div>

                {/* Rest of the dashboard content remains here */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
                    <p className="text-gray-500 dark:text-gray-400">Activity feed will be displayed here.</p>
                </div>
            </div>

            {showRefundModal && (
                <PartialRefundModal
                    eventId={eventId}
                    totalRegistrants={totalRegistrants}
                    onClose={() => setShowRefundModal(false)}
                    onSuccess={() => {
                        setShowRefundModal(false);
                        setRefundSuccess(true);
                    }}
                />
            )}
        </div>
    );
}
