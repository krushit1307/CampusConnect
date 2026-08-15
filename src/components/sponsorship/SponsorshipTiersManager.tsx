// =============================================================================
// Component: SponsorshipTiersManager
// Issue: #3170 - Build a 'Club Sponsorship Tier Management' UI
// Description: Lets a club Treasurer/admin define standardized sponsorship
// tiers (e.g. Bronze/Silver/Gold), with a price, a list of perks, and an
// optional inventory cap (e.g. only 1 "$5000 Title Sponsor" slot).
// =============================================================================

import { useState } from "react";
import { toast } from "sonner";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";
import { useSponsorshipTiers } from "@/hooks/useSponsorshipTiers";
import { formatTierPrice, getRemainingQuantity } from "@/lib/sponsorship/tiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SponsorshipTiersManagerProps {
  clubId: string;
}

interface DraftTier {
  name: string;
  priceDollars: string;
  perks: string[];
  perkInput: string;
  availableQuantity: string; // empty = unlimited
}

const EMPTY_DRAFT: DraftTier = {
  name: "",
  priceDollars: "",
  perks: [],
  perkInput: "",
  availableQuantity: "",
};

export function SponsorshipTiersManager({ clubId }: SponsorshipTiersManagerProps) {
  const { tiers, isLoading, createTier, updateTier, deleteTier } = useSponsorshipTiers(clubId);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<DraftTier>(EMPTY_DRAFT);

  const addPerk = () => {
    if (!draft.perkInput.trim()) return;
    setDraft({ ...draft, perks: [...draft.perks, draft.perkInput.trim()], perkInput: "" });
  };

  const removePerk = (index: number) => {
    setDraft({ ...draft, perks: draft.perks.filter((_, i) => i !== index) });
  };

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setIsAdding(false);
  };

  const handleSave = () => {
    const priceCents = Math.round(parseFloat(draft.priceDollars || "0") * 100);
    if (!draft.name.trim() || isNaN(priceCents) || priceCents < 0) {
      toast.error("Please enter a tier name and a valid price.");
      return;
    }

    createTier.mutate(
      {
        name: draft.name.trim(),
        price: priceCents,
        perks_json: draft.perks,
        available_quantity: draft.availableQuantity ? parseInt(draft.availableQuantity, 10) : null,
        is_active: true,
      },
      {
        onSuccess: () => {
          toast.success("Sponsorship tier created.");
          resetForm();
        },
        onError: (err: Error) => toast.error(`Failed to create tier: ${err.message}`),
      }
    );
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateTier.mutate(
      { id, is_active: !isActive },
      { onError: (err: Error) => toast.error(`Failed to update tier: ${err.message}`) }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this sponsorship tier? This cannot be undone.")) return;
    deleteTier.mutate(id, {
      onSuccess: () => toast.success("Tier deleted."),
      onError: (err: Error) => toast.error(`Failed to delete tier: ${err.message}`),
    });
  };

  if (isLoading) return <div>Loading sponsorship tiers...</div>;

  return (
    <div className="neu-border bg-white p-6 space-y-6">
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <h2 className="font-display text-2xl font-bold">Sponsorship Tiers</h2>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus size={16} className="mr-1" /> New Tier
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        Define standardized packages (e.g. Bronze, Silver, Gold) that sponsors see as a pricing
        grid on your club's marketplace profile.
      </p>

      {tiers.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 italic">No sponsorship tiers yet. Add your first one above.</p>
      )}

      <div className="space-y-4">
        {tiers.map((tier) => {
          const remaining = getRemainingQuantity(tier);
          return (
            <div key={tier.id} className="border-2 border-black p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{tier.name}</h3>
                  <span className="font-mono text-sm">{formatTierPrice(tier.price)}</span>
                  {!tier.is_active && (
                    <span className="text-xs font-bold uppercase text-gray-400">Hidden</span>
                  )}
                </div>
                <ul className="text-sm text-gray-600 list-disc list-inside mt-1">
                  {tier.perks_json.map((perk, i) => (
                    <li key={i}>{perk}</li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 mt-1">
                  {remaining === null
                    ? "Unlimited availability"
                    : `${remaining} of ${tier.available_quantity} remaining`}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => toggleActive(tier.id, tier.is_active)}>
                  {tier.is_active ? "Hide" : "Show"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(tier.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {isAdding && (
        <div className="border-2 border-black p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">New Tier</h3>
            <button onClick={resetForm}>
              <X size={18} />
            </button>
          </div>
          <Input
            placeholder="Tier name (e.g. Gold)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            placeholder="Price in USD (e.g. 500)"
            type="number"
            min="0"
            value={draft.priceDollars}
            onChange={(e) => setDraft({ ...draft, priceDollars: e.target.value })}
          />
          <Input
            placeholder="Available quantity (leave blank for unlimited)"
            type="number"
            min="1"
            value={draft.availableQuantity}
            onChange={(e) => setDraft({ ...draft, availableQuantity: e.target.value })}
          />

          <div className="flex gap-2">
            <Input
              placeholder="Add a perk (e.g. Logo on all posters)"
              value={draft.perkInput}
              onChange={(e) => setDraft({ ...draft, perkInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPerk();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addPerk}>
              Add
            </Button>
          </div>
          <ul className="space-y-1">
            {draft.perks.map((perk, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-gray-50 px-2 py-1">
                {perk}
                <button onClick={() => removePerk(i)}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>

          <Button onClick={handleSave} disabled={createTier.isPending}>
            Save Tier
          </Button>
        </div>
      )}
    </div>
  );
} 