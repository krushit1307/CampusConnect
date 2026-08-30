'use client';

import { useState, useEffect } from 'react';
import { MarketplaceListing, TicketTransferResult } from '@/types/tickets';
import { useAuth } from '@/lib/auth';

interface TicketTransferMarketplaceProps {
    eventId: string;
    eventName: string;
}

export default function TicketTransferMarketplace({ eventId, eventName }: TicketTransferMarketplaceProps) {
    const { user } = useAuth();
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchListings() {
            try {
                const response = await fetch(`/api/tickets/transfer?eventId=${eventId}`);
                const data = await response.json();
                if (response.ok) {
                    setListings(data.listings);
                } else {
                    setError(data.error);
                }
            } catch (err) {
                setError('Failed to load marketplace listings.');
            } finally {
                setIsLoading(false);
            }
        }
        fetchListings();
    }, [eventId]);

    const handlePurchase = async (listing: MarketplaceListing) => {
        if (!user) {
            setError('You must be logged in to purchase a ticket.');
            return;
        }

        setIsPurchasing(listing.ticketId);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch('/api/tickets/transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.id
                },
                body: JSON.stringify({
                    action: 'purchase',
                    ticketId: listing.ticketId,
                    buyerId: user.id,
                    paymentMethodId: 'pm_mock_123', // In production, get from Stripe Elements
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Purchase failed');
            }

            const result = data.result as TicketTransferResult;
            setSuccessMessage(result.message);

            // Remove purchased listing from UI
            setListings(prev => prev.filter(l => l.ticketId !== listing.ticketId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsPurchasing(null);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                Loading official ticket transfers...
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Official Ticket Transfer Marketplace
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Secure, anti-scalping protected transfers for {eventName}. Prices are capped at 120% of face value.
                </p>
            </div>

            {error && (
                <div className="m-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="m-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300">
                    {successMessage}
                </div>
            )}

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {listings.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No tickets currently available for transfer.
                    </div>
                ) : (
                    listings.map((listing) => (
                        <div key={listing.ticketId} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-900 dark:text-white">{listing.sellerName}</span>
                                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                                            Verified Seller
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                        <span>Face Value: ${listing.faceValue.toFixed(2)}</span>
                                        <span className="text-gray-400">•</span>
                                        <span>Listed: {new Date(listing.listedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                            ${listing.listingPrice.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            Max Allowed: ${listing.maxAllowedPrice.toFixed(2)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handlePurchase(listing)}
                                        disabled={isPurchasing === listing.ticketId}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isPurchasing === listing.ticketId ? 'Processing...' : 'Buy Now'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}


