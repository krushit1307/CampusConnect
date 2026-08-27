import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import type { Bundle } from "./BundleCard";

interface BundleReceiptProps {
  bundle: Bundle;
  transactionId: string;
}

export const BundleReceipt: React.FC<BundleReceiptProps> = ({ bundle, transactionId }) => {
  return (
    <div className="max-w-md mx-auto neu-border p-8 bg-white text-center">
      <div className="flex justify-center mb-6 text-green-500">
        <CheckCircle2 size={64} strokeWidth={2.5} />
      </div>

      <h2 className="text-3xl font-black mb-2 uppercase tracking-wide">Success!</h2>
      <p className="text-gray-600 mb-6">
        You've officially purchased the <strong>{bundle.title}</strong>.
      </p>

      <div className="text-left bg-gray-50 neu-border p-4 mb-6">
        <p className="text-sm font-bold text-gray-500 uppercase mb-3 border-b-2 border-black pb-1">
          Memberships Activated
        </p>
        <ul className="space-y-2">
          {bundle.bundle_items?.map((item) => (
            <li key={item.id} className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="text-green-600" />
              {item.clubs?.title || "Unknown Club"}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between items-center text-sm font-mono border-t-2 border-black border-dashed pt-4 mb-8">
        <span className="text-gray-500">Transaction ID</span>
        <span className="font-bold">{transactionId.substring(0, 8).toUpperCase()}</span>
      </div>

      <Link
        to="/dashboard"
        className="block neu-border neu-press w-full py-3 bg-black text-white font-bold tracking-wide uppercase"
      >
        Go to Dashboard
      </Link>
    </div>
  );
};
