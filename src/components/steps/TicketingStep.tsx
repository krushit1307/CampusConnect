import React from "react";
import { useEventWizard } from "../../hooks/useEventWizard";

export function TicketingStep({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { context, updateForm } = wizard;
  const { price, currency } = context.formData;
  const { validationErrors } = context;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold mb-4">Ticketing Details</h2>
      <p className="text-muted-foreground text-sm mb-6">Set up the pricing for your paid event.</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium mb-1">
            Ticket Price *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price || ""}
              onChange={(e) => updateForm({ price: parseFloat(e.target.value) })}
              className={`w-full p-2 pl-7 rounded-md border ${validationErrors.price ? "border-red-500" : "border-input"} bg-background`}
              placeholder="0.00"
            />
          </div>
          {validationErrors.price && (
            <p className="text-red-500 text-xs mt-1" aria-live="polite">
              {validationErrors.price}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium mb-1">
            Currency *
          </label>
          <select
            id="currency"
            value={currency || ""}
            onChange={(e) => updateForm({ currency: e.target.value })}
            className={`w-full p-2 rounded-md border ${validationErrors.currency ? "border-red-500" : "border-input"} bg-background`}
          >
            <option value="">Select currency</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
          {validationErrors.currency && (
            <p className="text-red-500 text-xs mt-1" aria-live="polite">
              {validationErrors.currency}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 border-2 border-black bg-blue-50 text-blue-900 shadow-[4px_4px_0_0_#000]">
        <h3 className="font-display font-bold uppercase mb-2">Want to set up Dynamic Pricing?</h3>
        <p className="font-mono text-sm text-blue-800">
          You can configure advanced time-based or capacity-based ticket pricing tiers (e.g., Early Bird, General Admission, Last Minute) from your Event Dashboard <strong>after</strong> this event is created.
        </p>
      </div>
    </div>
  );
}
