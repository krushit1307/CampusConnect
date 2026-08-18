import React from "react";
import { Tag, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { usePromoCode } from "@/hooks/usePromoCode";

interface PromoCodeInputProps {
  eventId?: string;
  originalPriceCents: number;
  onApplySuccess?: (discountAmountCents: number, finalPriceCents: number) => void;
  className?: string;
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  eventId,
  originalPriceCents,
  onApplySuccess,
  className = "",
}) => {
  const {
    promoCode,
    setPromoCode,
    applyCode,
    removeCode,
    isValidating,
    appliedPromo,
    error,
    finalPriceCents,
  } = usePromoCode(eventId, originalPriceCents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await applyCode();
    if (result?.valid && onApplySuccess) {
      onApplySuccess(result.discount_amount_cents || 0, result.final_price_cents || 0);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-indigo-500" />
          Have a sponsor promo code?
        </span>
        {appliedPromo && (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            -${((appliedPromo.discount_amount_cents || 0) / 100).toFixed(2)} OFF
          </span>
        )}
      </div>

      {!appliedPromo ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="e.g. MSFTRECRUIT5"
            disabled={isValidating}
            className="flex-1 px-3 py-2 text-sm uppercase font-mono tracking-wider bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isValidating || !promoCode.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-mono font-bold">{appliedPromo.promo_code}</span>
            <span className="text-xs opacity-90">
              ({appliedPromo.is_free ? "100% Free Ticket" : `Price: $${(finalPriceCents / 100).toFixed(2)}`})
            </span>
          </div>
          <button
            type="button"
            onClick={removeCode}
            className="text-xs text-neutral-500 hover:text-rose-500 transition-colors p-1"
            title="Remove code"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-500 font-medium flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
};
