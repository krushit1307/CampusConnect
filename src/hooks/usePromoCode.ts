import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface PromoValidationResult {
  valid: boolean;
  promo_code?: string;
  discount_type?: "percentage" | "fixed";
  discount_amount_cents?: number;
  final_price_cents?: number;
  is_free?: boolean;
  error?: string;
}

export function usePromoCode(eventId?: string, originalPriceCents: number = 2000) {
  const [promoCode, setPromoCode] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyCode = useCallback(
    async (codeToApply?: string) => {
      const code = (codeToApply ?? promoCode).trim();
      if (!code) {
        setError("Please enter a valid promo code.");
        return null;
      }

      setIsValidating(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("validate-promo-code", {
          body: {
            event_id: eventId,
            code_string: code,
            original_price_cents: originalPriceCents,
          },
        });

        if (invokeError) throw new Error(invokeError.message);

        if (!data?.valid) {
          setError(data?.error || "Invalid or expired promo code.");
          setAppliedPromo(null);
          return null;
        }

        setAppliedPromo(data);
        return data as PromoValidationResult;
      } catch (err) {
        const message = (err as Error).message || "Error validating promo code.";
        setError(message);
        setAppliedPromo(null);
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    [eventId, originalPriceCents, promoCode]
  );

  const removeCode = useCallback(() => {
    setPromoCode("");
    setAppliedPromo(null);
    setError(null);
  }, []);

  return {
    promoCode,
    setPromoCode,
    applyCode,
    removeCode,
    isValidating,
    appliedPromo,
    error,
    finalPriceCents: appliedPromo?.final_price_cents ?? originalPriceCents,
  };
}
