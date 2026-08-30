import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyForPointLoan } from "@/services/studentUnionBankService";
import { toast } from "sonner";

export function StudentUnionBankModal({
  clubId,
  onClose,
}: {
  clubId: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    try {
      const result = await applyForPointLoan(supabase, clubId);
      if (!result.success) {
        toast.error(result.message || "Loan application was rejected.");
        return;
      }
      toast.success(
        `Loan approved: ${result.locked_auction_points} auction-locked points granted. Total owed: ${result.total_owed_points}.`,
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply for a Point Loan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Student Union Bank</h2>
        <p className="text-sm text-gray-600 mb-4">
          Apply for a Resource Loan: 1,000 points locked to the Auction system, at 10% interest
          (-1,100 points on your ledger). 50% of points your club earns will be garnished for the
          next 3 months to repay the loan.
        </p>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg text-gray-600" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50"
            onClick={handleApply}
            disabled={loading}
          >
            {loading ? "Applying..." : "Apply for Point Loan"}
          </button>
        </div>
      </div>
    </div>
  );
}