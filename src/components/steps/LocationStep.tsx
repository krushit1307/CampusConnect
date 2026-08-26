import React from "react";
import { useEventWizard } from "../../hooks/useEventWizard";

export function LocationStep({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { context, updateForm } = wizard;
  const { location } = context.formData;
  const { validationErrors } = context;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold mb-4">Event Location</h2>
      <p className="text-muted-foreground text-sm mb-6">Where will your event take place?</p>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Venue or Address *
        </label>
        <input
          id="location"
          type="text"
          value={location || ""}
          onChange={(e) => updateForm({ location: e.target.value })}
          className={`w-full p-2 rounded-md border ${validationErrors.location ? "border-red-500" : "border-input"} bg-background`}
          placeholder="e.g. Student Union, Room 101"
        />
        {validationErrors.location && (
          <p className="text-red-500 text-xs mt-1" aria-live="polite">
            {validationErrors.location}
          </p>
        )}
      </div>
    </div>
  );
}
