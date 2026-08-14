import React from "react";
import type { Bundle } from "./BundleCard";

interface BundleSummaryProps {
  bundle: Bundle;
}

export const BundleSummary: React.FC<BundleSummaryProps> = ({ bundle }) => {
  const individualValue =
    bundle.bundle_items?.reduce((acc, item) => acc + Number(item.allocation_amount), 0) || 0;
  const bundlePrice = Number(bundle.price);
  const savings = individualValue - bundlePrice;

  return (
    <div className="neu-border bg-peach/30 p-6 flex flex-col gap-4">
      <h3 className="font-bold text-xl mb-2">Bundle Summary</h3>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 font-medium">Individual Value:</span>
        <span className="line-through text-gray-500">${individualValue.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-lg font-bold text-blue-800">
        <span>Bundle Price:</span>
        <span>${bundlePrice.toFixed(2)}</span>
      </div>

      {savings > 0 && (
        <div className="mt-4 pt-4 border-t-2 border-black border-dashed flex justify-between items-center text-green-700 font-bold">
          <span>You Save:</span>
          <span className="text-xl">${savings.toFixed(2)}!</span>
        </div>
      )}
    </div>
  );
};
