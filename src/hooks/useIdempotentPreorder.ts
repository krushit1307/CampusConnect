import { useState, useCallback } from "react";
import { generateIdempotencyKey, hashPayload } from "@/lib/idempotency";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface PreorderPayload {
  userId: string;
  merchItemId: string;
  variantId: string;
  quantity: number;
}

interface UseIdempotentPreorderReturn {
  processPreorder: (payload: PreorderPayload) => Promise<any>;
  isProcessing: boolean;
  error: string | null;
}

export function useIdempotentPreorder(): UseIdempotentPreorderReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPreorder = useCallback(
    async (payload: PreorderPayload) => {
      if (isProcessing) {
        console.warn("Pre-order already in progress, ignoring duplicate call.");
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const idempotencyKey = generateIdempotencyKey();
        const payloadHash = await hashPayload(payload);

        const { data, error: fnError } = await supabase.functions.invoke("process-preorder", {
          body: payload,
          headers: {
            "Idempotency-Key": idempotencyKey,
            "X-Payload-Hash": payloadHash,
          },
        });

        if (fnError) {
          if (fnError.message?.includes("409") || fnError.message?.includes("Conflict")) {
            toast.info("Pre-order is already being processed. Please wait.");
            return;
          }
          throw new Error(fnError.message || "Pre-order processing failed");
        }

        toast.success("Pre-order campaign backed successfully!");
        return data;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred during preorder.";
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing],
  );

  return { processPreorder, isProcessing, error };
}
