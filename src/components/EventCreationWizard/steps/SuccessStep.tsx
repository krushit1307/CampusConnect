// src/components/EventCreationWizard/steps/SuccessStep.tsx
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { Button } from "../../ui/button";

interface SuccessStepProps {
  onCreateAnother: () => void;
}

/**
 * Final success screen. Shown after the Supabase submission succeeds.
 * The persisted localStorage state is cleared by the wizard before
 * rendering this step, so closing the tab here won't restore a
 * half-finished wizard.
 */
export function SuccessStep({ onCreateAnother }: SuccessStepProps) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <CheckCircle2
        className="mx-auto h-16 w-16 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
      <h2 className="mt-4 text-2xl font-bold">Event Created!</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Your event has been submitted successfully. Attendees can now find it on the events page.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button type="button" onClick={onCreateAnother} variant="outline">
          Create Another Event
        </Button>
      </div>
    </div>
  );
}
