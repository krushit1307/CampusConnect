'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Auction, PlaceBidResponse } from '@/types/auctions';
import AuctionTimer from '@/components/auctions/AuctionTimer';
import { useAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuctionDetailsPage() {
    const params = useParams();
    const auctionId = params.id as string;
    const { user } = useAuth();

    const [auction, setAuction] = useState<Auction | null>(null);
    const [bidAmount, setBidAmount] = useState<number>(0);
    const [isBidding, setIsBidding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastExtension, setLastExtension] = useState<{ wasExtended: boolean; message?: string }>({ wasExtended: false });

    useEffect(() => {
        async function fetchAuction() {
            const { data, error } = await supabase
                .from('auctions')
                .select('*')
                .eq('id', auctionId)
                .single();

            if (!error && data) {
                setAuction(data);
                setBidAmount((data.current_bid || data.starting_bid) + 10);
            }
        }
        fetchAuction();

        // In production, subscribe to WebSocket for real-time updates
        const interval = setInterval(fetchAuction, 3000);
        return () => clearInterval(interval);
    }, [auctionId]);

    const handlePlaceBid = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !auction) return;

        setIsBidding(true);
        setError(null);

        try {
            const response = await fetch(`/api/auctions/${auctionId}/bid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auctionId,
                    userId: user.id,
                    bidAmount,
                }),
            });

            const data: PlaceBidResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to place bid');
            }

            // Update local state with new auction data
            setAuction(prev => prev ? { ...prev, current_bid: data.newCurrentBid, end_time: data.newEndTime } : null);
            setBidAmount(data.newCurrentBid + 10);

            if (data.wasExtended) {
                setLastExtension({ wasExtended: true, message: data.extensionMessage });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsBidding(false);
        }
    };

    if (!auction) {
        return <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">Loading Auction...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="p-8 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            {auction.resource_name}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Resource Auction ID: {auction.id.slice(0, 8)}
                        </p>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Current Bid</p>
                                <p className="text-5xl font-black text-blue-600 dark:text-blue-400">
                                    {auction.current_bid} pts
                                </p>
                                {auction.current_bidder_id && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                                        Highest bidder: {auction.current_bidder_id.slice(0, 8)}...
                                    </p>
                                )}
                            </div>

                            <AuctionTimer
                                endTime={auction.end_time}
                                wasJustExtended={lastExtension.wasExtended}
                                extensionMessage={lastExtension.message}
                            />
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Place Your Bid</h3>

                            {error && (
                                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handlePlaceBid} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Bid Amount (Points)
                                    </label>
                                    <input
                                        type="number"
                                        value={bidAmount}
                                        onChange={(e) => setBidAmount(Number(e.target.value))}
                                        min={auction.current_bid + 1}
                                        required
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-xl font-bold"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Minimum bid: {auction.current_bid + 1} points
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isBidding || auction.status !== 'active'}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold text-lg rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isBidding ? 'Processing Bid...' : 'Place Bid'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
