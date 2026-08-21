import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BundleSummary } from "@/components/bundles/BundleSummary";
import { BundlePurchaseButton } from "@/components/bundles/BundlePurchaseButton";
import type { Bundle } from "@/components/bundles/BundleCard";

export default function BundleDetailsPage() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const { user } = useAuth();

  const {
    data: bundle,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bundle", bundleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select(
          `
          *,
          bundle_items (
            id,
            allocation_amount,
            club_id,
            clubs (
              id,
              title,
              slug
            )
          )
        `,
        )
        .eq("id", bundleId)
        .single();

      if (error) throw error;
      return data as Bundle;
    },
    enabled: !!bundleId,
  });

  const { data: existingMemberships } = useQuery({
    queryKey: ["bundle_conflicts", bundleId, user?.id],
    queryFn: async () => {
      if (!user || !bundle?.bundle_items) return [];
      const clubIds = bundle.bundle_items.map((i) => i.club_id);
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, clubs(title)")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .in("club_id", clubIds);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!user && !!bundle?.bundle_items,
  });

  if (isLoading) return <div className="p-12 text-center">Loading Bundle...</div>;
  if (error || !bundle)
    return <div className="p-12 text-center text-red-500">Error loading bundle</div>;

  const hasConflicts = existingMemberships && existingMemberships.length > 0;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <Link
        to="/clubs"
        className="inline-flex items-center gap-2 mb-6 text-gray-600 hover:text-black"
      >
        <ArrowLeft size={16} /> Back to Clubs
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h1 className="text-4xl font-black uppercase mb-4">{bundle.title}</h1>
          <p className="text-lg text-gray-700 mb-8 whitespace-pre-wrap">{bundle.description}</p>

          <h2 className="font-bold text-xl mb-4 border-b-2 border-black pb-2">Clubs Included</h2>
          <ul className="space-y-4">
            {bundle.bundle_items?.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center bg-gray-50 neu-border p-4"
              >
                <span className="font-bold">{item.clubs?.title}</span>
                <span className="text-gray-500 text-sm italic">
                  Individual Value: ${Number(item.allocation_amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-6">
          <BundleSummary bundle={bundle} />

          {hasConflicts && (
            <div className="neu-border bg-red-100 border-red-400 p-4 flex gap-3 text-red-900">
              <AlertTriangle className="shrink-0" />
              <div>
                <p className="font-bold">Duplicate Membership Detected</p>
                <p className="text-sm mt-1">
                  You already belong to: {existingMemberships.map((m) => m.clubs?.title).join(", ")}
                  . Bundle purchase cannot continue because duplicate memberships are not supported.
                </p>
              </div>
            </div>
          )}

          {!user && (
            <div className="neu-border p-4 text-center bg-gray-100">
              <p>You must be logged in to purchase a bundle.</p>
              <Link to="/auth" className="text-blue-600 font-bold underline mt-2 inline-block">
                Log In
              </Link>
            </div>
          )}

          {user && !hasConflicts && <BundlePurchaseButton bundleId={bundle.id} />}
        </div>
      </div>
    </div>
  );
}
