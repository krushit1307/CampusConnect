// =============================================================================
// Component: SponsorshipPricingGrid
// Issue: #3170 - Build a 'Club Sponsorship Tier Management' UI
// Description: SaaS-style pricing grid shown to corporate sponsors on a
// club's marketplace profile. Renders each active tier (Bronze/Silver/Gold)
// with its price and perks, a "Buy Now" button that starts a Stripe
// Checkout session, and a "Contact for Custom Package" button.
// =============================================================================

import { useState } from "react";
import { toast } from "sonner";
import Check from "lucide-react/dist/esm/icons/check";
import { createClient } from "@/lib/supabase/client";
import { useSponsorshipTiers } from "@/hooks/useSponsorshipTiers";
import { formatTierPrice, getRemainingQuantity, isTierSoldOut } from "@/lib/sponsorship/tiers";
import { Button } from "@/components/ui/button";

interface SponsorshipPricingGridProps {
  clubId: string;
  clubName?: string;
}

export function SponsorshipPricingGrid({ clubId, clubName }: SponsorshipPricingGridProps) {
  const { tiers, isLoading } = useSponsorshipTiers(clubId);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const supabase = createClient();

  const activeTiers = tiers.filter((t) => t.is_active);

  const handleBuyNow = async (tierId: string) => {
    setPurchasingId(tierId);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Please sign in as a sponsor to purchase a tier.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-tier-checkout-session", {
        body: { tierId },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout.");
    } finally {
      setPurchasingId(null);
    }
  };

  const handleContactCustom = () => {
    window.location.href = `mailto:sponsorships@campusconnect.app?subject=${encodeURIComponent(
      `Custom sponsorship package for ${clubName || "your club"}`
    )}`;
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />;
  }

  if (activeTiers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
        Sponsorship Tiers
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTiers.map((tier) => {
          const soldOut = isTierSoldOut(tier);
          const remaining = getRemainingQuantity(tier);

          return (
            <div
              key={tier.id}
              className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tier.name}</h3>
              <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                {formatTierPrice(tier.price)}
              </p>
              {remaining !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  {soldOut ? "Sold Out" : `${remaining} of ${tier.available_quantity} slots left`}
                </p>
              )}
              <ul className="mt-4 space-y-2 flex-1">
                {tier.perks_json.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                disabled={soldOut || purchasingId === tier.id}
                onClick={() => handleBuyNow(tier.id)}
              >
                {soldOut ? "Sold Out" : purchasingId === tier.id ? "Redirecting..." : "Buy Now"}
              </Button>
            </div>
          );
        })}
      </div>
      <div className="text-center">
        <Button variant="outline" onClick={handleContactCustom}>
          Contact for Custom Package
        </Button>
      </div>
    </div>
  );
}