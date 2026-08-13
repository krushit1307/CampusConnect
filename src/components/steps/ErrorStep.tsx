import React from "react";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { useEventWizard } from "../../hooks/useEventWizard";

export function ErrorStep({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { retry, back } = wizard;

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
      <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground text-center mb-8 max-w-sm">
        We encountered an error while trying to submit your event. Please try again.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={back}
          className="px-6 py-2 border border-input bg-background hover:bg-accent rounded-md font-medium transition-colors"
        >
          Go Back
        </button>
        <button
          type="button"
          onClick={retry}
          className="px-6 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
