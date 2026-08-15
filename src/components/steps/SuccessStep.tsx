import React from "react";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { useEventWizard } from "../../hooks/useEventWizard";

export function SuccessStep({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { reset } = wizard;

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in-95 duration-500">
      <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
      <h2 className="text-2xl font-bold mb-2">Event Created!</h2>
      <p className="text-muted-foreground text-center mb-8 max-w-sm">
        Your event has been successfully created and published.
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium transition-colors"
      >
        Create Another Event
      </button>
    </div>
  );
}
