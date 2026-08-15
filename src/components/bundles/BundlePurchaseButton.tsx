import React, { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface BundlePurchaseButtonProps {
  bundleId: string;
  disabled?: boolean;
}

export const BundlePurchaseButton: React.FC<BundlePurchaseButtonProps> = ({
  bundleId,
  disabled,
}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePurchase = async () => {
    setLoading(true);
    try {
      // MOCK: In a real implementation, we'd call an Edge Function to create a Stripe Checkout Session
      // const { data } = await supabase.functions.invoke('create-bundle-checkout', { body: { bundleId } });
      // window.location.href = data.url;

      // Mocking the checkout redirect to a fake checkout page
      toast.info("Redirecting to secure checkout...");
      setTimeout(() => {
        navigate(`/bundles/${bundleId}/checkout`);
      }, 1000);
    } catch (error) {
      toast.error("Failed to initiate checkout. Please try again.");
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePurchase}
      disabled={disabled || loading}
      className="neu-border neu-press w-full py-4 text-xl font-black bg-green-500 text-white tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Processing..." : "Purchase Bundle"}
    </button>
  );
};
