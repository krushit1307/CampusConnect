// src/components/EventCreationWizard/WizardNavigation.tsx
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Check from "lucide-react/dist/esm/icons/check";
import { Button } from "../ui/button";
import { WIZARD_STEPS } from "../../lib/eventWizardSchema";
import { useEventWizardStore } from "../../store/useEventWizardStore";
import { cn } from "../../lib/utils";

/**
 * The footer navigation bar for the wizard: Back / Next / Submit.
 *
 * The Next button is disabled when the current step's data is invalid
 * (validation runs on click — if invalid, the errors are surfaced via
 * the store and the user stays on the same step).
 *
 * On the final step (Review), the Next button is replaced by a
 * Submit button that triggers the master-schema validation and
 * Supabase submission.
 */
interface WizardNavigationProps {
  onSubmit: () => void | Promise<void>;
}

export function WizardNavigation({ onSubmit }: WizardNavigationProps) {
  const step = useEventWizardStore((s) => s.step);
  const next = useEventWizardStore((s) => s.next);
  const back = useEventWizardStore((s) => s.back);
  const canAdvance = useEventWizardStore((s) => s.canAdvance);
  const isSubmitting = useEventWizardStore((s) => s.isSubmitting);
  const isComplete = useEventWizardStore((s) => s.isComplete);

  const isFirstStep = step === 0;
  const isLastStep = step === WIZARD_STEPS.length - 1;

  if (isComplete) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      <Button
        type="button"
        variant="ghost"
        onClick={back}
        disabled={isFirstStep || isSubmitting}
        className={cn("gap-1", isFirstStep && "invisible")}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Button>

      {isLastStep ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canAdvance()}
          className="gap-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Submit Event
            </>
          )}
        </Button>
      ) : (
        <Button type="button" onClick={next} disabled={isSubmitting} className="gap-1">
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
