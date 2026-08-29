import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/types/database.types";
import { Loader2, Plus, Trash2, Package, X } from "lucide-react";
import { toast } from "sonner";

type EventMerchItem = Database["public"]["Tables"]["event_merch_items"]["Row"];
type EventMerchVariant = Database["public"]["Tables"]["event_merch_variants"]["Row"];

interface EventMerchItemWithVariants extends EventMerchItem {
  variants: EventMerchVariant[];
}

interface EventMerchManagerProps {
  eventId: string;
}

export function EventMerchManager({ eventId }: EventMerchManagerProps) {
  const [items, setItems] = useState<EventMerchItemWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemImage, setItemImage] = useState("");

  const [addingVariantTo, setAddingVariantTo] = useState<string | null>(null);
  const [variantSize, setVariantSize] = useState("");
  const [variantStock, setVariantStock] = useState("");

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

  const handleCreateItem = async () => {
    if (!itemName.trim()) {
      toast.error("Item name is required.");
      return;
    }

    const priceCents = Math.round(parseFloat(itemPrice) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      toast.error("Please enter a valid price.");
      return;
    }

    const { error } = await supabase.from("event_merch_items").insert({
      event_id: eventId,
      name: itemName.trim(),
      description: itemDesc.trim() || null,
      price: priceCents,
      image_url: itemImage.trim() || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Merch item created!");
      setItemName("");
      setItemDesc("");
      setItemPrice("");
      setItemImage("");
      setShowForm(false);
      fetchMerch();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("event_merch_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to delete item.");
    } else {
      toast.success("Item deleted.");
      fetchMerch();
    }
  };

  const handleAddVariant = async (itemId: string) => {
    if (!variantSize.trim()) {
      toast.error("Size is required.");
      return;
    }

    const stock = parseInt(variantStock) || 0;

    const { error } = await supabase.from("event_merch_variants").insert({
      item_id: itemId,
      size: variantSize.trim().toUpperCase(),
      stock_quantity: stock,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Variant ${variantSize.toUpperCase()} added.`);
      setVariantSize("");
      setVariantStock("");
      setAddingVariantTo(null);
      fetchMerch();
    }
  };

  const handleUpdateStock = async (variantId: string, newStock: number) => {
    const { error } = await supabase
      .from("event_merch_variants")
      .update({ stock_quantity: Math.max(0, newStock) })
      .eq("id", variantId);

    if (error) {
      toast.error("Failed to update stock.");
    } else {
      toast.success("Stock updated.");
      fetchMerch();
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    const { error } = await supabase
      .from("event_merch_variants")
      .delete()
      .eq("id", variantId);

    if (error) {
      toast.error("Failed to delete variant.");
    } else {
      toast.success("Variant removed.");
      fetchMerch();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Event Merchandise</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/30"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Add Item"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <input
            type="text"
            placeholder="Item name (e.g. Hackathon 2026 T-Shirt)"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <textarea
            placeholder="Description (optional)"
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Price (USD)"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              step="0.01"
              min="0"
              className="w-32 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="url"
              placeholder="Image URL (optional)"
              value={itemImage}
              onChange={(e) => setItemImage(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateItem}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            Create Item
          </button>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-gray-500" />
          <p className="text-sm text-gray-400">No merchandise items yet. Click "Add Item" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-white">{item.name}</h4>
                    <p className="text-xs text-gray-400">
                      ${(item.price / 100).toFixed(2)}
                      {item.description && ` — ${item.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAddingVariantTo(addingVariantTo === item.id ? null : item.id)
                    }
                    className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-gray-300 transition hover:bg-white/10"
                  >
                    <Plus className="inline h-3 w-3" /> Size
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="rounded-lg bg-red-500/10 p-1.5 text-red-400 transition hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {item.variants && item.variants.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {item.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                          {variant.size}
                        </span>
                        <span className="text-xs text-gray-400">
                          Stock:{" "}
                          <input
                            type="number"
                            value={variant.stock_quantity}
                            onChange={(e) => {
                              setItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id
                                    ? {
                                        ...it,
                                        variants: it.variants.map((v) =>
                                          v.id === variant.id
                                            ? { ...v, stock_quantity: parseInt(e.target.value) || 0 }
                                            : v,
                                        ),
                                      }
                                    : it,
                                ),
                              );
                            }}
                            onBlur={(e) =>
                              handleUpdateStock(variant.id, parseInt(e.target.value) || 0)
                            }
                            className="w-16 rounded bg-white/10 px-1.5 py-0.5 text-center text-xs text-white outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingVariantTo === item.id && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 p-2">
                  <input
                    type="text"
                    placeholder="Size (S, M, L, XL...)"
                    value={variantSize}
                    onChange={(e) => setVariantSize(e.target.value)}
                    className="w-28 rounded bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <input
                    type="number"
                    placeholder="Stock"
                    value={variantStock}
                    onChange={(e) => setVariantStock(e.target.value)}
                    className="w-20 rounded bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddVariant(item.id)}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventMerchManager;
