import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useIdempotentPayment } from "@/hooks/useIdempotentPayment";
import { useIdempotentPreorder } from "@/hooks/useIdempotentPreorder";
import { useMerchCartStore } from "@/store/useMerchCartStore";
import { Database } from "@/types/database.types";
import { formatCurrency } from "@/lib/ticketing/discountCalculator";
import { Loader2, ShoppingBag, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type MerchItem = Database["public"]["Tables"]["merch_items"]["Row"];
type MerchVariant = Database["public"]["Tables"]["merch_variants"]["Row"];

interface MerchItemWithVariants extends MerchItem {
  variants: MerchVariant[];
}

export function MerchStore({ clubId }: { clubId: string }) {
  const [items, setItems] = useState<MerchItemWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const { processPayment, isProcessing: isPaying } = useIdempotentPayment();
  const { processPreorder, isProcessing: isPreordering } = useIdempotentPreorder();
  const {
    items: cartItems,
    addItem,
    removeItem,
    clearCart,
    getTotalQuantity,
    getItems,
  } = useMerchCartStore();

  useEffect(() => {
    fetchMerch();
  }, [clubId]);

  const fetchMerch = async () => {
    setLoading(true);
    const { data: itemsData, error: itemsError } = await supabase
      .from("merch_items")
      .select(
        `
        *,
        variants:merch_variants(*),
        preorders:merch_preorders(quantity)
      `,
      )
      .eq("club_id", clubId);

    if (itemsError) {
      toast.error("Failed to load merchandise.");
    } else {
      setItems(itemsData || []);
    }
    setLoading(false);
  };

  const handleBuy = async (item: MerchItemWithVariants, variant: MerchVariant) => {
    const isCampaign = (item as any).funding_goal_count && (item as any).funding_goal_count > 0;
    const isExpired = (item as any).campaign_end_date
      ? new Date((item as any).campaign_end_date).getTime() <= Date.now()
      : false;

    if (isCampaign) {
      if (isExpired) {
        toast.error("This pre-order campaign has ended.");
        return;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Please log in to back this item!");
          return;
        }

        await processPreorder({
          userId: user.id,
          merchItemId: item.id,
          variantId: variant.id,
          quantity: 1,
        });
        fetchMerch();
      } catch (err) {
        // Handled by hook
      }
    } else {
      try {
        await processPayment({
          quantity: 1,
          amount: variant.price,
          merchVariantId: variant.id,
          merchQuantity: 1,
        });
        fetchMerch();
      } catch (err) {
        // Handled by hook
      }
    }
  };

  const handleAddToCart = (variant: MerchVariant, quantity = 1) => {
    addItem(variant.id, quantity);
    toast.success("Added to cart");
  };

  const handleCheckout = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) {
      toast.error("Please log in to checkout");
      return;
    }

    if (getTotalQuantity() === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("process-merch-checkout", {
        body: {
          userId: user.data.user.id,
          clubId: clubId,
          variantIds: getItems().map((item) => item.variantId),
          quantities: getItems().map((item) => item.quantity),
        },
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
          "X-Payload-Hash": await (async () => {
            const payload = {
              userId: user.data.user.id,
              clubId,
              variantIds: getItems().map((item) => item.variantId),
              quantities: getItems().map((item) => item.quantity),
            };
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(payload));
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
          })(),
        },
      });

      if (error) {
        throw new Error(error.message || "Checkout failed");
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Checkout session could not be created");
      }
    } catch (err: any) {
      toast.error(err.message || "Checkout failed. Please try again.");
    }
  };

  const isProcessing = isPaying || isPreordering;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <ShoppingBag className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Store is Empty</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          This club hasn't added any merchandise yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cart Summary */}
      {getTotalQuantity() > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-600 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-indigo-600 mb-2">Cart</h4>
          <div className="space-y-2 text-sm">
            {getItems().map((cartItem) => {
              const variant = items
                .flatMap((item) => item.variants)
                .find((v) => v.id === cartItem.variantId);
              const quantity = cartItem.quantity;
              if (!variant) return null;
              return (
                <div key={variant.id} className="flex justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {variant.name}{" "}
                    {quantity > 1 && <span className="text-gray-500">x{quantity}</span>}
                  </span>
                  <span className="font-medium text-indigo-600">
                    {formatCurrency(variant.price * quantity)}
                  </span>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
              <span className="font-bold text-indigo-600">
                {formatCurrency(
                  getItems().reduce((total, cartItem) => {
                    const variant = items
                      .flatMap((item) => item.variants)
                      .find((v) => v.id === cartItem.variantId);
                    return total + (variant?.price || 0) * cartItem.quantity;
                  }, 0),
                )}
              </span>
            </div>
          </div>
          <Button
            onClick={handleCheckout}
            disabled={isProcessing || getTotalQuantity() === 0}
            className="w-full mt-2"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ShoppingBag className="w-4 h-4 mr-2" />
            )}
            Checkout ({getTotalQuantity()} items)
          </Button>
        </div>
      )}

      {items.map((item) => {
        const isCampaign = (item as any).funding_goal_count && (item as any).funding_goal_count > 0;
        const isExpired = (item as any).campaign_end_date
          ? new Date((item as any).campaign_end_date).getTime() <= Date.now()
          : false;

        return (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{item.name}</h2>
              {item.description && (
                <p className="mt-2 text-gray-600 dark:text-gray-300">{item.description}</p>
              )}

              {/* Crowdfunding Campaign Widget */}
              {isCampaign && (
                <div className="mt-4 border-2 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-lg">
                  {(() => {
                    const currentOrders =
                      (item as any).preorders?.reduce(
                        (acc: number, p: any) => acc + p.quantity,
                        0,
                      ) || 0;
                    const targetGoal = (item as any).funding_goal_count;
                    const pct = Math.min(100, Math.round((currentOrders / targetGoal) * 100));
                    const campaignEndDate = (item as any).campaign_end_date;
                    const timeLeftMs = campaignEndDate
                      ? new Date(campaignEndDate).getTime() - Date.now()
                      : 0;
                    const daysLeft = Math.max(0, Math.ceil(timeLeftMs / (1000 * 60 * 60 * 24)));

                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                            <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                            {currentOrders} / {targetGoal} Orders Backed
                          </span>
                          <span className="font-mono font-medium text-gray-600 dark:text-gray-400">
                            {isExpired ? "Campaign Ended" : `${daysLeft} Days Left!`}
                          </span>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {isExpired ? (
                          <div className="mt-2 text-xs font-semibold">
                            {currentOrders >= targetGoal ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" /> Crowdfunding Goal Achieved!
                                (Production starts soon)
                              </span>
                            ) : (
                              <span className="text-red-600">
                                Crowdfunding Goal Not Reached. Campaign failed.
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            Cards are only charged if the campaign reaches {targetGoal} backers by
                            the deadline.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="p-6 bg-gray-50 dark:bg-gray-900/50">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Available Options
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {item.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                            {variant.name}
                          </h4>
                          {variant.stock === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : variant.stock < 5 ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              Low Stock
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xl font-bold text-indigo-600 mt-2">
                          {formatCurrency(variant.price)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {variant.stock} left
                        </p>
                      </div>
                      <div>
                        <Button
                          className="mt-2 w-full"
                          onClick={() => handleAddToCart(variant)}
                          disabled={
                            variant.stock === 0 || isProcessing || (isCampaign && isExpired)
                          }
                        >
                          {variant.stock === 0
                            ? "Out of Stock"
                            : isProcessing
                              ? "Adding..."
                              : isCampaign && isExpired
                                ? "Campaign Closed"
                                : isCampaign
                                  ? "Add to Cart"
                                  : "Buy Now"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
