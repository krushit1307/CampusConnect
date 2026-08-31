// =============================================================================
// Component: TicketSelector
// Issue: #2902 - Implement 'Group Discounts' for Event Ticketing
// Description: Interactive checkout cart UI. As the user increments the 
// ticket quantity, it dynamically calculates and displays the discount.
// Shows "Add X more to get Y% off!" prompts to encourage group purchases.
// =============================================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  calculateTicketPricing,
  formatCurrency,
  DiscountRule,
} from "../../lib/ticketing/discountCalculator";
import { checkSecretUnlock, SecretTierInfo } from "../../lib/secretTiers";

interface TicketTier {
  id: string;
  name: string;
  price: number; // In cents
  remaining_capacity: number;
  discount_rules: DiscountRule[];
  is_secret?: boolean;
  uses_remaining?: number;
}

interface TicketSelectorProps {
  tiers: TicketTier[];
  eventId: string;
  onSelect: (tierId: string, quantity: number, totalCents: number) => void;
}

export const TicketSelector: React.FC<TicketSelectorProps> = ({ tiers, eventId, onSelect }) => {
  const [selectedTierId, setSelectedTierId] = useState<string>(tiers[0]?.id || "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [secretTier, setSecretTier] = useState<SecretTierInfo | null>(null);
  const [allTiers, setAllTiers] = useState<TicketTier[]>(tiers);

  const selectedTier = allTiers.find((t) => t.id === selectedTierId);
  const currentQty = quantities[selectedTierId] || 1;

  // Check for secret unlock hash on mount
  useEffect(() => {
    const checkSecret = async () => {
      const secretInfo = await checkSecretUnlock(eventId);
      if (secretInfo) {
        // Add secret tier to the list
        const secretTierObj: TicketTier = {
          id: secretInfo.id,
          name: secretInfo.name,
          price: secretInfo.price,
          remaining_capacity: secretInfo.uses_remaining,
          discount_rules: [],
          is_secret: true,
          uses_remaining: secretInfo.uses_remaining,
        };
        setAllTiers((prev) => [...prev, secretTierObj]);
        setSecretTier(secretInfo);
        // Auto-select the secret tier
        setSelectedTierId(secretInfo.id);
      }
    };
    checkSecret();
  }, [eventId]);

  // Memoize the heavy pricing calculation
  const pricing = useMemo(() => {
    if (!selectedTier) return null;
    return calculateTicketPricing(
      selectedTier.price,
      currentQty,
      selectedTier.discount_rules || [],
      selectedTier.remaining_capacity,
    );
  }, [selectedTier, currentQty]);

  const handleQuantityChange = (tierId: string, delta: number) => {
    const tier = allTiers.find((t) => t.id === tierId);
    if (!tier) return;

    const current = quantities[tierId] || 1;
    const next = current + delta;

    // Enforce limits: Min 1, Max remaining_capacity (or uses_remaining for secret tiers)
    const maxCapacity = tier.is_secret
      ? tier.uses_remaining || tier.remaining_capacity
      : tier.remaining_capacity;
    if (next < 1 || next > maxCapacity) return;

    setQuantities((prev) => ({ ...prev, [tierId]: next }));
  };

  const handleCheckout = () => {
    if (selectedTier && pricing) {
      onSelect(selectedTier.id, currentQty, pricing.total);
    }
  };

  if (allTiers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No tickets available for this event.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Secret Tier Banner */}
      {secretTier && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg p-4 shadow-md">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.536 16.536m-1.414-1.414l2.828-2.828m0 0a2 2 0 012.828 0 2 2 0 010 2.828l-2.828 2.828m-4-4a2 2 0 012.828 0 2 2 0 010 2.828l-2.828 2.828m-4-4a2 2 0 012.828 0 2 2 0 010 2.828l-2.828 2.828"
              />
            </svg>
            <div>
              <p className="font-bold">🔓 Secret Tier Unlocked!</p>
              <p className="text-sm opacity-90">You have access to an exclusive ticket tier</p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Selection Tabs */}
      {allTiers.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {allTiers.map((tier) => (
            <button
              key={tier.id}
              onClick={() => setSelectedTierId(tier.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedTierId === tier.id
                  ? tier.is_secret
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tier.name}
              {tier.is_secret && <span className="ml-1">🔐</span>}
            </button>
          ))}
        </div>
      )}

      {/* Selected Tier Details & Quantity Selector */}
      {selectedTier && pricing && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedTier.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatCurrency(selectedTier.price)} per ticket
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-full ${
                selectedTier.is_secret
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                  : selectedTier.remaining_capacity > 20
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : selectedTier.remaining_capacity > 5
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {selectedTier.is_secret
                ? `${selectedTier.uses_remaining} secret uses left`
                : `${selectedTier.remaining_capacity} left`}
            </span>
          </div>

          {/* Quantity Stepper */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-4">
            <span className="font-medium text-gray-700 dark:text-gray-300">Quantity</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleQuantityChange(selectedTier.id, -1)}
                disabled={currentQty <= 1}
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-2xl font-bold text-gray-900 dark:text-white w-8 text-center">
                {currentQty}
              </span>
              <button
                onClick={() => handleQuantityChange(selectedTier.id, 1)}
                disabled={
                  currentQty >=
                  (selectedTier.is_secret
                    ? selectedTier.uses_remaining || selectedTier.remaining_capacity
                    : selectedTier.remaining_capacity)
                }
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Dynamic Discount Prompt */}
          {pricing.nextTier && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 mb-4 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                <span className="font-bold">Add {pricing.nextTier.qtyNeeded} more</span> to unlock a{" "}
                {pricing.nextTier.discountPct}% group discount!
              </p>
            </div>
          )}

          {pricing.discountPercentage > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-green-800 dark:text-green-300">
                <span className="font-bold">Group Discount Applied!</span> You're saving{" "}
                {formatCurrency(pricing.discountAmount)}.
              </p>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>
                Subtotal ({currentQty} × {formatCurrency(pricing.basePrice)})
              </span>
              <span>{formatCurrency(pricing.subtotal)}</span>
            </div>
            {pricing.discountAmount > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                <span>Discount ({pricing.discountPercentage}%)</span>
                <span>-{formatCurrency(pricing.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-700">
              <span>Total</span>
              <span>{formatCurrency(pricing.total)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-lg shadow-md active:scale-[0.98]"
          >
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
};
