import React from "react";
import { useEventWizard } from "../../hooks/useEventWizard";

export function Navigation({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { stateValue, canNext, canBack, next, back, submit, canSubmit } = wizard;

  return (
    <div className="flex justify-between mt-8 pt-4 border-t border-border">
      <button
        type="button"
        onClick={back}
        disabled={!canBack}
        className="px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-medium text-sm transition-colors"
      >
        Back
      </button>

      {stateValue === "review" ? (
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-medium text-sm transition-colors"
        >
          Submit Event
        </button>
      ) : (
        <button
          type="button"
          onClick={next}
          disabled={!canNext}
          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-medium text-sm transition-colors"
        >
          Next
        </button>
      )}
    </div>
  );
}
