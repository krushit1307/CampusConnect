// =============================================================================
// Component: Storefront
// Issue: #2813 - Implement an In - App Wallet for Gamification Points
// Description: Renders the Campus Store grid where students can browse and
// purchase items using their ConnectCoins.Handles purchase confirmations
// and displays stock availability.
// =============================================================================

import React, { useState } from "react";
import { useWallet, StoreItem } from "../../hooks/useWallet";

export const Storefront: React.FC = () => {
  const { storeItems, balance, purchaseItem, isPurchasing } = useWallet();
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const handlePurchase = async (item: StoreItem) => {
    const success = await purchaseItem(item.id, 1);
    if (success) {
      setPurchaseSuccess(true);
      setSelectedItem(null);
      setTimeout(() => setPurchaseSuccess(false), 3000);
    }
  };

  const canAfford = (cost: number) => (balance?.balance || 0) >= cost;

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {purchaseSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Purchase successful!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {storeItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            {/* Item Image */}
            <div className="h-48 bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <svg
                  className="w-16 h-16 text-gray-300 dark:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              )}
            </div>

            {/* Item Details */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{item.name}</h3>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    item.item_type === "physical"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      : item.item_type === "digital"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {item.item_type}
                </span>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-1 line-clamp-2">
                {item.description || "No description available."}
              </p>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {item.cost}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">coins</span>
                </div>

                {item.stock_quantity !== -1 && (
                  <span
                    className={`text-xs font-medium ${
                      item.stock_quantity > 5
                        ? "text-green-600 dark:text-green-400"
                        : item.stock_quantity > 0
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {item.stock_quantity > 0 ? `${item.stock_quantity} left` : "Out of stock"}
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedItem(item)}
                disabled={!canAfford(item.cost) || item.stock_quantity === 0 || isPurchasing}
                className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                  canAfford(item.cost) && item.stock_quantity !== 0
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                }`}
              >
                {!canAfford(item.cost)
                  ? "Insufficient Funds"
                  : item.stock_quantity === 0
                    ? "Out of Stock"
                    : "Purchase Item"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Confirmation Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Purchase
            </h3>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400">Item:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedItem.name}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400">Cost:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedItem.cost} coins
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Your Balance:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {balance?.balance} coins
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {(balance?.balance || 0) - selectedItem.cost} coins
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                disabled={isPurchasing}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurchase(selectedItem)}
                disabled={isPurchasing}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {isPurchasing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Confirm Purchase"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
