// =============================================================================
// Component: ManageEventMenu
// Issue: #3341 - Build an 'Interactive Food Menu with Allergen Filters'
// Description: Organizer UI to add catering dishes to an event and tag
// each one with allergen checkboxes (vegan, gluten-free, nuts, dairy).
// =============================================================================

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";

interface MenuItemForm {
  id?: string;
  name: string;
  description: string;
  is_vegan: boolean;
  is_gluten_free: boolean;
  contains_nuts: boolean;
  contains_dairy: boolean;
}

const BLANK_ITEM: MenuItemForm = {
  name: "",
  description: "",
  is_vegan: false,
  is_gluten_free: false,
  contains_nuts: false,
  contains_dairy: false,
};

export function ManageEventMenu({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<MenuItemForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("event_menu_items")
          .select(
            "id, name, description, is_vegan, is_gluten_free, contains_nuts, contains_dairy",
          )
          .eq("event_id", eventId)
          .order("name", { ascending: true });

        if (error) throw error;
        setItems(
          (data || []).map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description || "",
            is_vegan: d.is_vegan,
            is_gluten_free: d.is_gluten_free,
            contains_nuts: d.contains_nuts,
            contains_dairy: d.contains_dairy,
          })),
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [eventId]);

  const updateItem = (index: number, patch: Partial<MenuItemForm>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { ...BLANK_ITEM }]);

  const removeItem = async (index: number) => {
    const item = items[index];
    if (item.id) {
      const { error } = await supabase.from("event_menu_items").delete().eq("id", item.id);
      if (error) {
        toast.error(error.message || "Failed to remove dish");
        return;
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    for (const item of items) {
      if (!item.name.trim()) {
        toast.error("Every dish needs a name.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        event_id: eventId,
        name: item.name.trim(),
        description: item.description.trim() || null,
        is_vegan: item.is_vegan,
        is_gluten_free: item.is_gluten_free,
        contains_nuts: item.contains_nuts,
        contains_dairy: item.contains_dairy,
      }));

      if (payload.length === 0) {
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.from("event_menu_items").upsert(payload).select("id");
      if (error) throw error;

      if (data && data.length === items.length) {
        setItems(items.map((item, idx) => ({ ...item, id: data[idx].id })));
      }
      toast.success("Menu updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save menu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="font-mono text-sm text-black/50">Loading menu...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <UtensilsCrossed size={20} />
        <h3 className="font-display text-xl font-bold uppercase">Event Menu</h3>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id ?? `new-${index}`} className="neu-border bg-cream p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <Label>Dish Name</Label>
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                  placeholder="e.g. Paneer Tikka Skewers"
                />
                <Label>Description (optional)</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Short description shown to attendees"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeItem(index)}
                aria-label="Remove dish"
              >
                <Trash2 size={16} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 font-mono text-xs uppercase">
                <Checkbox
                  checked={item.is_vegan}
                  onCheckedChange={(checked) => updateItem(index, { is_vegan: !!checked })}
                />
                Vegan
              </label>
              <label className="flex items-center gap-2 font-mono text-xs uppercase">
                <Checkbox
                  checked={item.is_gluten_free}
                  onCheckedChange={(checked) => updateItem(index, { is_gluten_free: !!checked })}
                />
                Gluten-Free
              </label>
              <label className="flex items-center gap-2 font-mono text-xs uppercase">
                <Checkbox
                  checked={item.contains_nuts}
                  onCheckedChange={(checked) => updateItem(index, { contains_nuts: !!checked })}
                />
                Contains Nuts
              </label>
              <label className="flex items-center gap-2 font-mono text-xs uppercase">
                <Checkbox
                  checked={item.contains_dairy}
                  onCheckedChange={(checked) => updateItem(index, { contains_dairy: !!checked })}
                />
                Contains Dairy
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus size={16} className="mr-1" /> Add Dish
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Menu"}
        </Button>
      </div>
    </div>
  );
}