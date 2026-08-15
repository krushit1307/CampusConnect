// src/components/EventCreationWizard/steps/TicketingStepForm.tsx
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { useEventWizardStore } from "../../../store/useEventWizardStore";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";
import type { TicketTier } from "../../../lib/eventWizardSchema";

/**
 * Step 3: Ticketing.
 * Toggle paid/free, and manage ticket tiers for paid events.
 */
export function TicketingStepForm() {
  const formData = useEventWizardStore((s) => s.formData);
  const updateFormData = useEventWizardStore((s) => s.updateFormData);
  const validationErrors = useEventWizardStore((s) => s.validationErrors);

  const addTier = () => {
    const newTier: TicketTier = {
      name: "",
      price: 0,
      capacity: 50,
      description: "",
      isEarlyBird: false,
      earlyBirdEndDate: undefined,
      isActive: true,
    };
    updateFormData({ tickets: [...formData.tickets, newTier] });
  };

  const updateTier = (index: number, partial: Partial<TicketTier>) => {
    const updated = formData.tickets.map((t, i) => (i === index ? { ...t, ...partial } : t));
    updateFormData({ tickets: updated });
  };

  const removeTier = (index: number) => {
    updateFormData({ tickets: formData.tickets.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isPaid"
          checked={formData.isPaid}
          onCheckedChange={(checked) => updateFormData({ isPaid: checked === true })}
        />
        <Label htmlFor="isPaid" className="cursor-pointer">
          This is a paid event (requires at least one ticket tier)
        </Label>
      </div>

      <div className="flex items-center space-x-2 mt-4">
        <Checkbox
          id="isResumeRequired"
          checked={formData.isResumeRequired}
          onCheckedChange={(checked) => updateFormData({ isResumeRequired: checked === true })}
        />
        <Label htmlFor="isResumeRequired" className="cursor-pointer">
          Require resume during RSVP
        </Label>
      </div>

      {formData.isPaid && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ticket Tiers</h3>
            <Button type="button" variant="outline" size="sm" onClick={addTier} className="gap-1">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Tier
            </Button>
          </div>

          {validationErrors.tickets && (
            <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.tickets}</p>
          )}

          {formData.tickets.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No ticket tiers yet. Click "Add Tier" to create one.
            </p>
          ) : (
            formData.tickets.map((tier, index) => (
              <div
                key={index}
                className="rounded-md border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-medium">Tier {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(index)}
                    className="text-red-600 hover:text-red-700"
                    aria-label={`Remove tier ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`tier-${index}-name`}>Name</Label>
                    <Input
                      id={`tier-${index}-name`}
                      value={tier.name}
                      onChange={(e) => updateTier(index, { name: e.target.value })}
                      placeholder="e.g. Early Bird"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tier-${index}-price`}>Price ($)</Label>
                    <Input
                      id={`tier-${index}-price`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={tier.price}
                      onChange={(e) =>
                        updateTier(index, { price: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tier-${index}-capacity`}>Capacity</Label>
                    <Input
                      id={`tier-${index}-capacity`}
                      type="number"
                      min={1}
                      value={tier.capacity}
                      onChange={(e) =>
                        updateTier(index, { capacity: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center space-x-2">
                  <Checkbox
                    id={`tier-${index}-earlybird`}
                    checked={tier.isEarlyBird}
                    onCheckedChange={(checked) =>
                      updateTier(index, { isEarlyBird: checked === true })
                    }
                  />
                  <Label htmlFor={`tier-${index}-earlybird`} className="cursor-pointer text-xs">
                    Early bird tier (requires an end date)
                  </Label>
                </div>

                {tier.isEarlyBird && (
                  <div className="mt-2 space-y-1">
                    <Label htmlFor={`tier-${index}-earlybird-end`}>Early Bird End Date</Label>
                    <Input
                      id={`tier-${index}-earlybird-end`}
                      type="datetime-local"
                      value={tier.earlyBirdEndDate ?? ""}
                      onChange={(e) => updateTier(index, { earlyBirdEndDate: e.target.value })}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {!formData.isPaid && (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          This is a free event. Attendees can RSVP without purchasing a ticket.
        </p>
      )}
    </div>
  );
}
