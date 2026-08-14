import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BundleReceipt } from "@/components/bundles/BundleReceipt";
import type { Bundle } from "@/components/bundles/BundleCard";

export default function BundleCheckoutPage() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [purchaseStatus, setPurchaseStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const { data: bundle } = useQuery({
    queryKey: ["bundle", bundleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select(`*, bundle_items (id, allocation_amount, club_id, clubs(title))`)
        .eq("id", bundleId)
        .single();
      if (error) throw error;
      return data as Bundle;
    },
    enabled: !!bundleId,
  });

  useEffect(() => {
    if (!user || !bundle) return;

    const processMockCheckout = async () => {
      try {
        const fakeSessionId = "mock_cs_" + Math.random().toString(36).substring(7);

        // Directly call the edge function processing logic
        const { data, error } = await supabase.rpc("rpc_process_bundle_purchase", {
          p_user_id: user.id,
          p_bundle_id: bundle.id,
          p_stripe_session_id: fakeSessionId,
          p_amount_paid: bundle.price,
        });

        if (error) {
          if (error.message.includes("duplicate key value violates unique constraint")) {
            throw new Error("You are already a member of one or more of these clubs.");
          }
          throw error;
        }

        setTransactionId(fakeSessionId);
        setPurchaseStatus("success");
      } catch (err) {
        console.error("Failed checkout", err);
        setPurchaseStatus("error");
      }
    };

    processMockCheckout();
  }, [user, bundle]);

  if (!user) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold">Please log in</h2>
        <button onClick={() => navigate("/auth")} className="text-blue-500 underline">
          Go to Login
        </button>
      </div>
    );
  }

  if (purchaseStatus === "processing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-lg animate-pulse">Processing secure payment...</p>
      </div>
    );
  }

  if (purchaseStatus === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="neu-border bg-red-100 p-8 max-w-md">
          <h2 className="text-2xl font-black text-red-700 mb-4 uppercase">Payment Failed</h2>
          <p className="mb-6">
            We couldn't process your bundle purchase. This could be due to a duplicate membership or
            a payment issue.
          </p>
          <button
            onClick={() => navigate(`/bundles/${bundleId}`)}
            className="neu-border neu-press bg-white px-6 py-2 font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (purchaseStatus === "success" && bundle && transactionId) {
    return (
      <div className="py-12 px-4">
        <BundleReceipt bundle={bundle} transactionId={transactionId} />
      </div>
    );
  }

  return null;
}
