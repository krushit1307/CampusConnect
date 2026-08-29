// =============================================================================
// Component: WaitlistBiddingLeaderboard
//  Issue: #3544 - Build an 'Interactive Event Waitlist Bidding' System
//  Description: Displays the anonymized live leaderboard of charity bids.
//  Allows the current user to input a new bid amount, triggers the Stripe
//  Elements modal to authorize the card, and updates their rank in real-time.
// =============================================================================

import React, { useState } from "react";
import { useWaitlistBidding } from "@/hooks/useWaitlistBidding";
import { toast } from "sonner";

// Mock Stripe Elements hook for demonstration (in production, use @stripe/react-stripe-js)
const useStripeMock = () => ({
  confirmCardSetup: async (clientSecret: string, data: any) => {
    // Simulate network delay and success
    await new Promise((r) => setTimeout(r, 1500));
    return { setupIntent: { status: "succeeded" }, error: null };
  },
});

interface WaitlistBiddingLeaderboardProps {
  eventId: string;
  userRsvpId: string | null;
}

export const WaitlistBiddingLeaderboard: React.FC<WaitlistBiddingLeaderboardProps> = ({
  eventId,
  userRsvpId,
}) => {
  const { leaderboard, userCurrentBid, isLoading, error, initiateBid, confirmBidSuccess } =
    useWaitlistBidding(eventId, userRsvpId);
  const [bidAmount, setBidAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const stripeMock = useStripeMock();

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRsvpId || !bidAmount) return;

    const amountNum = parseFloat(bidAmount);
    if (isNaN(amountNum) || amountNum <= userCurrentBid / 100) {
      toast.error(
        `Your bid must be higher than your current bid of $${(userCurrentBid / 100).toFixed(2)}`,
      );
      return;
    }

    setIsProcessing(true);

    // 1. Get SetupIntent client secret from backend
    const clientSecret = await initiateBid(userRsvpId, amountNum);

    if (clientSecret) {
      // 2. Confirm card setup via Stripe Elements (Mocked here)
      const { setupIntent, error: stripeError } = await stripeMock.confirmCardSetup(clientSecret, {
        payment_method: { card: {} as any, billing_details: {} },
      });

      if (stripeError) {
        toast.error(`Payment authorization failed: ${(stripeError as any).message}`);
      } else if (setupIntent?.status === "succeeded") {
        await confirmBidSuccess(userRsvpId);
        setBidAmount("");
        toast.success("🎉 Bid authorized! You will be charged only if you win the spot.");
      }
    }

    setIsProcessing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <h3 className="text-xl font-black flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          Charity Waitlist Auction
        </h3>
        <p className="text-sm text-purple-100 mt-1">
          Bid a donation to jump the queue. Highest bidder wins the spot if a ticket opens up.
        </p>
      </div>

      {/* Bidding Form */}
      {userRsvpId && (
        <form
          onSubmit={handleBidSubmit}
          className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold">
                $
              </span>
              <input
                type="number"
                step="1"
                min={userCurrentBid / 100 + 1}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Min $${userCurrentBid / 100 + 1}`}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                disabled={isProcessing}
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !bidAmount}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm shadow-sm"
            >
              {isProcessing ? "Authorizing..." : "Place Bid"}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </form>
      )}

      {/* Leaderboard */}
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"
              ></div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>No bids yet. Be the first to support the cause!</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                  Rank
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                  Bidder
                </th>
                <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                  Bid
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {leaderboard.map((bid) => (
                <tr
                  key={bid.rank}
                  className={bid.is_current_user ? "bg-indigo-50 dark:bg-indigo-900/20" : ""}
                >
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">
                    #{bid.rank}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {bid.is_current_user ? (
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">You</span>
                    ) : (
                      `Anonymous Bidder ${String.fromCharCode(64 + bid.rank)}`
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right">
                    ${(bid.bid_amount_cents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
