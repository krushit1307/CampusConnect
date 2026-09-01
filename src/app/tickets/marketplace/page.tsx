'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import TicketTransferMarketplace from '@/components/tickets/TicketTransferMarketplace';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TicketMarketplacePage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const [eventName, setEventName] = useState<string>('Event');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchEventDetails() {
            try {
                const { data, error } = await supabase
                    .from('events')
                    .select('title')
                    .eq('id', eventId)
                    .single();

                if (!error && data) {
                    setEventName(data.title);
                }
            } catch (error) {
                console.error('Failed to fetch event details:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchEventDetails();
    }, [eventId]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Ticket Transfer Marketplace
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Securely buy or sell tickets for <span className="font-semibold">{eventName}</span>.
                        All transactions are protected by our anti-scalping price cap and cryptographic QR invalidation.
                    </p>
                </div>

                <TicketTransferMarketplace eventId={eventId} eventName={eventName} />

                <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        How It Works
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                        <li>• <strong>Price Cap:</strong> Tickets cannot be listed for more than 120% of their original face value.</li>
                        <li>• <strong>Secure Transfer:</strong> We refund the original buyer and charge the new buyer securely via Stripe.</li>
                        <li>• <strong>Fraud Prevention:</strong> The original QR code is permanently invalidated, and a new cryptographic code is issued to the buyer.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
