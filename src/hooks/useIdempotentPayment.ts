import { useState, useCallback } from "react";
import { generateIdempotencyKey, hashPayload } from "@/lib/idempotency";
import { supabase } from "@/lib/supabaseClient"; // Adjust path to your actual supabase client
import { toast } from "sonner";

interface PaymentPayload {
  eventId: string;
  quantity: number;
  amount: number;
  // Add other relevant payment fields
}

interface UseIdempotentPaymentReturn {
  processPayment: (payload: PaymentPayload) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
}

/**
 * Custom hook to handle idempotent payment processing.
 * Generates a unique key per checkout session and ensures the backend
 * processes the payment exactly once, even on network retries.
 */
export function useIdempotentPayment(): UseIdempotentPaymentReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPayment = useCallback(
    async (payload: PaymentPayload) => {
      if (isProcessing) {
        console.warn("Payment already in progress, ignoring duplicate call.");
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // 1. Generate a unique idempotency key for this specific checkout attempt
        const idempotencyKey = generateIdempotencyKey();

        // 2. Hash the payload to ensure integrity
        const payloadHash = await hashPayload(payload);

        // 3. Call the Supabase Edge Function with the idempotency key in headers
        const { data, error: fnError } = await supabase.functions.invoke("process-payment", {
          body: payload,
          headers: {
            "Idempotency-Key": idempotencyKey,
            "X-Payload-Hash": payloadHash,
          },
        });

        if (fnError) {
          // Handle 409 Conflict specifically (already processing)
          if (fnError.message?.includes("409") || fnError.message?.includes("Conflict")) {
            toast.info("Payment is already being processed. Please wait.");
            return;
          }
          throw new Error(fnError.message || "Payment processing failed");
        }

        toast.success("Payment processed successfully!");
        return data;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred during payment.";
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing],
  );

  return { processPayment, isProcessing, error };
}
