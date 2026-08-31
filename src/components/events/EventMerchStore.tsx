import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/types/database.types";
import { Loader2, Plus, Minus, ShoppingCart, Tag } from "lucide-react";
import { toast } from "sonner";

type EventMerchItem = Database["public"]["Tables"]["event_merch_items"]["Row"];
type EventMerchVariant = Database["public"]["Tables"]["event_merch_variants"]["Row"];

interface EventMerchItemWithVariants extends EventMerchItem {
  variants: EventMerchVariant[];
}

export interface EventMerchCartEntry {
  variantId: string;
  itemId: string;
  itemName: string;
  size: string;
  price: number;
  quantity: number;
}

interface EventMerchStoreProps {
  eventId: string;
  cart: EventMerchCartEntry[];
  onCartUpdate: (cart: EventMerchCartEntry[]) => void;
}

export function EventMerchStore({ eventId, cart, onCartUpdate }: EventMerchStoreProps) {
  const [items, setItems] = useState<EventMerchItemWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMerch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_merch_items")
      .select(
        `
        *,
        variants:event_merch_variants(*)
      `,
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load event merchandise.");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchMerch();
  }, [fetchMerch]);

  const addToCart = (item: EventMerchItemWithVariants, variant: EventMerchVariant) => {
    if (variant.stock_quantity <= 0) {
      toast.error("This size is out of stock.");
      return;
    }

    const existingIdx = cart.findIndex((e) => e.variantId === variant.id);
    let newCart: EventMerchCartEntry[];

    if (existingIdx >= 0) {
      const currentQty = cart[existingIdx].quantity;
      if (currentQty >= variant.stock_quantity) {
        toast.error(`Only ${variant.stock_quantity} available for ${variant.size}.`);
        return;
      }
      newCart = cart.map((e, i) =>
        i === existingIdx ? { ...e, quantity: e.quantity + 1 } : e,
      );
    } else {
      newCart = [
        ...cart,
        {
          variantId: variant.id,
          itemId: item.id,
          itemName: item.name,
          size: variant.size,
          price: variant.price,
          quantity: 1,
        },
      ];
    }

    onCartUpdate(newCart);
    toast.success(`${item.name} (${variant.size}) added to cart.`);
  };

  const removeFromCart = (variantId: string) => {
    onCartUpdate(cart.filter((e) => e.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, delta: number) => {
    const entry = cart.find((e) => e.variantId === variantId);
    if (!entry) return;

    const variant = items
      .flatMap((i) => i.variants)
      .find((v) => v.id === variantId);

    if (delta > 0 && variant && entry.quantity >= variant.stock_quantity) {
      toast.error(`Only ${variant.stock_quantity} available.`);
      return;
    }

    const newQty = entry.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(variantId);
    } else {
      onCartUpdate(
        cart.map((e) =>
          e.variantId === variantId ? { ...e, quantity: newQty } : e,
        ),
      );
    }
  };

  const cartTotal = cart.reduce((sum, e) => sum + e.price * e.quantity, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <Tag className="mx-auto mb-2 h-8 w-8 text-gray-500" />
        <p className="text-sm text-gray-400">No merchandise available for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Event Merchandise</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.name}
                className="mb-3 h-32 w-full rounded-lg object-cover"
                loading="lazy"
              />
            )}
            <h4 className="text-sm font-medium text-white">{item.name}</h4>
            {item.description && (
              <p className="mt-1 text-xs text-gray-400">{item.description}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {item.variants.map((variant) => {
                const inCart = cart.find((e) => e.variantId === variant.id);
                const isOutOfStock = variant.stock_quantity <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => addToCart(item, variant)}
                    disabled={isOutOfStock}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      inCart
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-white/10 bg-white/5 text-gray-300 hover:border-indigo-500/50 hover:bg-indigo-500/10"
                    }`}
                  >
                    {variant.size} — ${(variant.price / 100).toFixed(2)}
                    {isOutOfStock && " (Sold out)"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Your Cart
          </h4>
          <div className="space-y-2">
            {cart.map((entry) => (
              <div
                key={entry.variantId}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-300">
                  {entry.itemName} ({entry.size})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(entry.variantId, -1)}
                    className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-white">{entry.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(entry.variantId, 1)}
                    className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="ml-2 w-16 text-right text-gray-400">
                    ${((entry.price * entry.quantity) / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(entry.variantId)}
                    className="ml-1 text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-sm font-semibold text-white">Merch Total</span>
            <span className="text-sm font-bold text-indigo-300">
              ${(cartTotal / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventMerchStore;
