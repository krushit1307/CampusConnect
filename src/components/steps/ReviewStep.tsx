import React from "react";
import { useEventWizard } from "../../hooks/useEventWizard";

export function ReviewStep({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { context } = wizard;
  const { formData } = context;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold mb-2">Review Event Details</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Please review your event details before submitting.
      </p>

      <div className="space-y-4 border rounded-md p-4 bg-muted/30">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Title</h3>
          <p className="font-medium">{formData.title}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
          <p className="whitespace-pre-wrap">{formData.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Date & Time</h3>
            <p>
              {new Date(formData.startDate).toLocaleString()} -{" "}
              {new Date(formData.endDate).toLocaleString()}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
            <p className="capitalize">{formData.category}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
          <p>{formData.location}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Ticketing</h3>
          <p>
            {formData.isPaid ? `Paid Event - ${formData.price} ${formData.currency}` : "Free Event"}
          </p>
        </div>
      </div>
    </div>
  );
}
