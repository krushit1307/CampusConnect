import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Key, Copy } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { createSecretTier, CreateSecretTierResult } from "@/lib/secretTiers";

interface TicketTier {
  id?: string;
  name: string;
  price: number;
  capacity: number | null;
  start_date: string;
  end_date: string;
  is_secret?: boolean;
  unlock_hash?: string;
  max_uses?: number;
  uses_remaining?: number;
}

export function ManageTicketTiers({ eventId }: { eventId: string }) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<string | null>(null);
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [secretFormData, setSecretFormData] = useState({
    name: "",
    price: 0,
    capacity: null as number | null,
    max_uses: 5,
    expires_at: "",
  });
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
          })),
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
      if (
        tier.start_date &&
        tier.end_date &&
        new Date(tier.end_date) <= new Date(tier.start_date)
      ) {
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
            `Tier ${i + 1} starts before Tier ${i} ends. Ensure this overlap is intentional (e.g. relying on capacity).`,
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
      const payload = tiers.map((t) => ({
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
      setTiers(tiers.filter((t) => t.id !== tierToDelete));
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

  const handleCreateSecretTier = async () => {
    if (!secretFormData.name || secretFormData.name.trim() === "") {
      toast.error("Secret tier name is required");
      return;
    }
    if (secretFormData.max_uses <= 0) {
      toast.error("Max uses must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const result: CreateSecretTierResult = await createSecretTier(
        eventId,
        secretFormData.name,
        Math.round(secretFormData.price * 100), // convert to cents
        secretFormData.capacity,
        secretFormData.max_uses,
        secretFormData.expires_at || undefined,
      );

      if (result.success) {
        toast.success(`Secret tier created! Unlock URL: ${result.unlock_url}`);
        setShowSecretForm(false);
        setSecretFormData({
          name: "",
          price: 0,
          capacity: null,
          max_uses: 5,
          expires_at: "",
        });
        // Refresh tiers
        const { data } = await supabase
          .from("ticket_tiers")
          .select(
            "id, name, price, capacity, start_date, end_date, is_secret, unlock_hash, uses_remaining, max_uses",
          )
          .eq("event_id", eventId)
          .order("start_date", { ascending: true, nullsFirst: false });
        if (data) {
          setTiers(
            data.map((t) => ({
              id: t.id,
              name: t.name,
              price: t.price / 100,
              capacity: t.capacity,
              start_date: t.start_date ? t.start_date.slice(0, 16) : "",
              end_date: t.end_date ? t.end_date.slice(0, 16) : "",
              is_secret: t.is_secret,
              unlock_hash: t.unlock_hash,
              max_uses: t.max_uses,
              uses_remaining: t.uses_remaining,
            })),
          );
        }
      } else {
        toast.error(result.error);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create secret tier");
    } finally {
      setSaving(false);
    }
  };

  const copyUnlockUrl = (unlockHash: string) => {
    const url = `${window.location.origin}/events/${eventId}?unlock_hash=${unlockHash}`;
    navigator.clipboard.writeText(url);
    toast.success("Unlock URL copied to clipboard!");
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
          <p className="text-sm text-black/60 font-mono mt-1">
            Configure time or capacity-based ticket pricing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSecretForm(!showSecretForm)}
            className="border-2 border-black font-mono font-bold hover:bg-peach shadow-[2px_2px_0px_rgba(0,0,0,1)]"
          >
            <Key className="w-4 h-4 mr-2" />
            {showSecretForm ? "Cancel Secret" : "Add Secret Tier"}
          </Button>
          <Button
            variant="outline"
            onClick={addTier}
            className="border-2 border-black font-mono font-bold hover:bg-peach shadow-[2px_2px_0px_rgba(0,0,0,1)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tier
          </Button>
        </div>
      </div>

      {/* Secret Tier Form */}
      {showSecretForm && (
        <div className="p-4 border-2 border-dashed border-purple-500 bg-purple-50 rounded-lg">
          <h4 className="font-bold font-mono text-purple-900 mb-4">🔐 Create Secret Tier</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-mono text-xs uppercase font-bold text-purple-900/70">
                Secret Tier Name
              </Label>
              <Input
                placeholder="e.g. VIP Early Bird"
                value={secretFormData.name}
                onChange={(e) => setSecretFormData({ ...secretFormData, name: e.target.value })}
                className="mt-1 border-2 border-purple-500"
              />
            </div>
            <div>
              <Label className="font-mono text-xs uppercase font-bold text-purple-900/70">
                Price ($)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={secretFormData.price}
                onChange={(e) =>
                  setSecretFormData({ ...secretFormData, price: parseFloat(e.target.value) })
                }
                className="mt-1 border-2 border-purple-500"
              />
            </div>
            <div>
              <Label className="font-mono text-xs uppercase font-bold text-purple-900/70">
                Capacity (Optional)
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={secretFormData.capacity || ""}
                onChange={(e) =>
                  setSecretFormData({
                    ...secretFormData,
                    capacity: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="mt-1 border-2 border-purple-500"
              />
            </div>
            <div>
              <Label className="font-mono text-xs uppercase font-bold text-purple-900/70">
                Max Uses
              </Label>
              <Input
                type="number"
                min="1"
                value={secretFormData.max_uses}
                onChange={(e) =>
                  setSecretFormData({ ...secretFormData, max_uses: parseInt(e.target.value) })
                }
                className="mt-1 border-2 border-purple-500"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="font-mono text-xs uppercase font-bold text-purple-900/70">
                Expiration Date (Optional)
              </Label>
              <Input
                type="datetime-local"
                value={secretFormData.expires_at}
                onChange={(e) =>
                  setSecretFormData({ ...secretFormData, expires_at: e.target.value })
                }
                className="mt-1 border-2 border-purple-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleCreateSecretTier}
              disabled={saving}
              className="bg-purple-600 text-white hover:bg-purple-700 font-mono font-bold"
            >
              {saving ? "Creating..." : "Create Secret Tier"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSecretForm(false)}
              className="border-2 border-purple-500 font-mono"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {tiers.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-black/20 bg-gray-50 text-black/50 font-mono">
          No pricing tiers configured. The event is currently free or unavailable.
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`p-4 border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] relative group ${tier.is_secret ? "border-purple-500 bg-purple-50" : "border-black bg-white"}`}
            >
              <div className="absolute top-4 right-4 flex gap-2">
                {tier.is_secret && tier.unlock_hash && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                    onClick={() => copyUnlockUrl(tier.unlock_hash!)}
                    title="Copy unlock URL"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {tier.is_secret && (
                <div className="mb-3 flex items-center gap-2 text-purple-700">
                  <Key className="w-4 h-4" />
                  <span className="text-xs font-mono font-bold uppercase">Secret Tier</span>
                  {tier.uses_remaining !== undefined && (
                    <span className="text-xs font-mono text-purple-600">
                      ({tier.uses_remaining}/{tier.max_uses} uses remaining)
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pr-12">
                <div className="lg:col-span-2">
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">
                    Tier Name
                  </Label>
                  <Input
                    placeholder="e.g. Early Bird"
                    value={tier.name}
                    onChange={(e) => updateTier(index, "name", e.target.value)}
                    className="mt-1 border-2 border-black"
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">
                    Price ($)
                  </Label>
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
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">
                    Capacity (Optional)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={tier.capacity || ""}
                    onChange={(e) =>
                      updateTier(
                        index,
                        "capacity",
                        e.target.value ? parseInt(e.target.value) : null,
                      )
                    }
                    className="mt-1 border-2 border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">
                    Start Date
                  </Label>
                  <Input
                    type="datetime-local"
                    value={tier.start_date}
                    onChange={(e) => updateTier(index, "start_date", e.target.value)}
                    className="mt-1 border-2 border-black"
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase font-bold text-black/70">
                    End Date
                  </Label>
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
