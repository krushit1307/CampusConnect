import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/types/database.types";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type MerchItem = Database["public"]["Tables"]["merch_items"]["Row"];
type MerchVariant = Database["public"]["Tables"]["merch_variants"]["Row"];

interface MerchItemWithVariants extends MerchItem {
  variants: MerchVariant[];
}

export function ManageMerch({ clubId }: { clubId: string }) {
  const [items, setItems] = useState<MerchItemWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  // New Item State
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [fundingGoalCount, setFundingGoalCount] = useState<number>(0);
  const [campaignEndDate, setCampaignEndDate] = useState("");

  // New Variant State
  const [addingVariantTo, setAddingVariantTo] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantStock, setNewVariantStock] = useState(0);
  const [newVariantPrice, setNewVariantPrice] = useState(0); // Display in standard currency format (e.g. 799)

  useEffect(() => {
    fetchMerch();
  }, [clubId]);

  const fetchMerch = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("merch_items")
      .select(
        `
        *,
        variants:merch_variants(*)
      `,
      )
      .eq("club_id", clubId);

    if (error) {
      toast.error("Failed to load inventory");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim()) return;
    const { data, error } = await supabase
      .from("merch_items")
      .insert({
        club_id: clubId,
        name: newItemName,
        description: newItemDesc,
        funding_goal_count: fundingGoalCount > 0 ? fundingGoalCount : null,
        campaign_end_date: campaignEndDate || null,
        campaign_status: fundingGoalCount > 0 ? "active" : null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Item created");
      setNewItemName("");
      setNewItemDesc("");
      setFundingGoalCount(0);
      setCampaignEndDate("");
      fetchMerch();
    }
  };

  const handleCreateVariant = async (itemId: string) => {
    if (!newVariantName.trim()) return;
    const { data, error } = await supabase.from("merch_variants").insert({
      merch_item_id: itemId,
      name: newVariantName,
      stock: newVariantStock,
      price: newVariantPrice * 100, // convert to cents
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Variant added");
      setAddingVariantTo(null);
      setNewVariantName("");
      setNewVariantStock(0);
      setNewVariantPrice(0);
      fetchMerch();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item and all its variants?")) return;
    const { error } = await supabase.from("merch_items").delete().eq("id", itemId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Item deleted");
      fetchMerch();
    }
  };

  if (loading) {
    return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10 text-indigo-600" />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Add New Merchandise
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Item Name
              </label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Club Hoodie"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <Input
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                placeholder="e.g. 100% cotton"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Crowdfunding Goal Count (Optional, e.g. 50 orders)
              </label>
              <Input
                type="number"
                min={0}
                value={fundingGoalCount || ""}
                onChange={(e) => setFundingGoalCount(parseInt(e.target.value) || 0)}
                placeholder="No goal (direct sale)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Campaign End Date (Required if Goal is set)
              </label>
              <Input
                type="datetime-local"
                value={campaignEndDate}
                onChange={(e) => setCampaignEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreateItem}>Add Item</Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Inventory</h3>
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{item.name}</h4>
                {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                {(item as any).funding_goal_count && (item as any).funding_goal_count > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                      Goal: {(item as any).funding_goal_count} Orders
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      Ends: {(item as any).campaign_end_date ? new Date((item as any).campaign_end_date).toLocaleDateString() : "N/A"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 uppercase">
                      Status: {(item as any).campaign_status}
                    </span>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteItem(item.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-2">Variant</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {item.variants.map((variant) => (
                    <tr key={variant.id} className="border-b dark:border-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {variant.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        ₹{(variant.price / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {variant.stock}
                      </td>
                    </tr>
                  ))}
                  {addingVariantTo === item.id ? (
                    <tr className="bg-gray-50 dark:bg-gray-900/30">
                      <td className="px-4 py-2">
                        <Input
                          size={10}
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          placeholder="Size"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={newVariantPrice}
                          onChange={(e) => setNewVariantPrice(parseInt(e.target.value))}
                          placeholder="Price"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={newVariantStock}
                          onChange={(e) => setNewVariantStock(parseInt(e.target.value))}
                          placeholder="Qty"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleCreateVariant(item.id)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAddingVariantTo(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600"
                          onClick={() => setAddingVariantTo(item.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Add Variant
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No merchandise items found.
          </p>
        )}
      </div>
    </div>
  );
}
