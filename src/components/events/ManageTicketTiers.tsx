import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface TicketTier {
  id?: string;
  name: string;
  price: number;
  capacity: number | null;
  start_date: string;
  end_date: string;
}

export function ManageTicketTiers({ eventId }: { eventId: string }) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchTiers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("ticket_tiers")
          .select("id, name, price, capacity, start_date, end_date")
          .eq("event_id", eventId)
          .order("start_date", { ascending: true, nullsFirst: false });

        if (error) throw error;
        setTiers(
          (data || []).map((t) => ({
            id: t.id,
            name: t.name,
            price: t.price / 100, // convert cents to dollars
            capacity: t.capacity,
            start_date: t.start_date ? t.start_date.slice(0, 16) : "", // format for datetime-local
            end_date: t.end_date ? t.end_date.slice(0, 16) : "",
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTiers();
  }, [eventId]);

  const validateTiers = () => {
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (!tier.name || tier.name.trim() === "") {
        toast.error(`Tier ${i + 1} is missing a name.`);
        return false;
      }
      if (tier.price < 0) {
        toast.error(`Tier ${i + 1} cannot have a negative price.`);
        return false;
      }
      if (tier.capacity !== null && tier.capacity <= 0) {
        toast.error(`Tier ${i + 1} capacity must be greater than 0 if specified.`);
        return false;
      }
      if (tier.start_date && tier.end_date && new Date(tier.end_date) <= new Date(tier.start_date)) {
        toast.error(`Tier ${i + 1} end date must be after its start date.`);
        return false;
      }
      // Overlap check (basic)
      if (i > 0) {
        const prevTier = tiers[i - 1];
        if (
          prevTier.end_date &&
          tier.start_date &&
          new Date(tier.start_date) < new Date(prevTier.end_date)
        ) {
          toast.warning(
            `Tier ${i + 1} starts before Tier ${i} ends. Ensure this overlap is intentional (e.g. relying on capacity).`
          );
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateTiers()) return;
    setSaving(true);
    try {
      // Upsert tiers
      const payload = tiers.map(t => ({
        ...(t.id ? { id: t.id } : {}),
        event_id: eventId,
        name: t.name,
        price: Math.round(t.price * 100), // convert dollars to cents
        capacity: t.capacity,
        start_date: t.start_date ? new Date(t.start_date).toISOString() : null,
        end_date: t.end_date ? new Date(t.end_date).toISOString() : null,
      }));

      const { data, error } = await supabase.from("ticket_tiers").upsert(payload).select("id");
      if (error) throw error;
      toast.success("Pricing tiers updated successfully!");
      
      // Update local state with inserted IDs
      if (data && data.length === tiers.length) {
         setTiers(tiers.map((t, idx) => ({ ...t, id: data[idx].id })));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save tiers");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (index: number) => {
    const tier = tiers[index];
    if (tier.id) {
      setTierToDelete(tier.id);
    } else {
      setTiers(tiers.filter((_, i) => i !== index));
    }
  };

  const confirmDelete = async () => {
    if (!tierToDelete) return;
    try {
      const { error } = await supabase.from("ticket_tiers").delete().eq("id", tierToDelete);
      if (error) throw error;
      setTiers(tiers.filter(t => t.id !== tierToDelete));
      toast.success("Tier deleted");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete tier");
    } finally {
      setTierToDelete(null);
    }
  };

  const addTier = () => {
    setTiers([...tiers, { name: "", price: 0, capacity: null, start_date: "", end_date: "" }]);
  };

  const updateTier = (index: number, field: keyof TicketTier, value: any) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-lg border-2 border-black"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold font-display uppercase">Dynamic Pricing Tiers</h3>
          <p className="text-sm text-black/60 font-mono mt-1">Configure time or capacity-based ticket pricing.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={addTier}
          className="border-2 border-black font-mono font-bold hover:bg-peach shadow-[2px_2px_0px_rgba(0,0,0,1)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-black/20 bg-gray-50 text-black/50 font-mono">
          No pricing tiers configured. The event is currently free or unavailable.
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier, index) => (
            <div key={index} className="p-4 border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] relative group">
              <div className="absolute top-4 right-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pr-12">
                <div className="lg:col-span-2">
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">Tier Name</Label>
                  <Input 
                    placeholder="e.g. Early Bird" 
                    value={tier.name}
                    onChange={(e) => updateTier(index, "name", e.target.value)}
                    className="mt-1 border-2 border-black"
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">Price ($)</Label>
                  <Input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={tier.price}
                    onChange={(e) => updateTier(index, "price", parseFloat(e.target.value))}
                    className="mt-1 border-2 border-black"
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">Capacity (Optional)</Label>
                  <Input 
                    type="number" 
                    min="1"
                    placeholder="Unlimited"
                    value={tier.capacity || ""}
                    onChange={(e) => updateTier(index, "capacity", e.target.value ? parseInt(e.target.value) : null)}
                    className="mt-1 border-2 border-black"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">Start Date</Label>
                  <Input 
                    type="datetime-local" 
                    value={tier.start_date}
                    onChange={(e) => updateTier(index, "start_date", e.target.value)}
                    className="mt-1 border-2 border-black"
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">End Date</Label>
                  <Input 
                    type="datetime-local" 
                    value={tier.end_date}
                    onChange={(e) => updateTier(index, "end_date", e.target.value)}
                    className="mt-1 border-2 border-black"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 border-t-2 border-black/10">
        <Button 
          onClick={handleSave} 
          disabled={saving || tiers.length === 0}
          className="w-full sm:w-auto font-display uppercase tracking-widest font-black bg-black text-white hover:bg-black/80"
        >
          {saving ? "Saving..." : "Save Pricing Strategy"}
        </Button>
      </div>

      <ConfirmModal
        open={!!tierToDelete}
        onOpenChange={(open) => !open && setTierToDelete(null)}
        title="Delete Pricing Tier?"
        description="Are you sure you want to delete this pricing tier? This action cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
