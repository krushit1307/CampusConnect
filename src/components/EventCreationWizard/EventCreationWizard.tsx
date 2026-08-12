// src/components/EventCreationWizard/EventCreationWizard.tsx
import { useEffect } from "react";
import { useEventWizardStore, validateMaster } from "../../store/useEventWizardStore";
import { WIZARD_STEPS } from "../../lib/eventWizardSchema";
import { ProgressStepper } from "./ProgressStepper";
import { WizardNavigation } from "./WizardNavigation";
import { BasicsStepForm } from "./steps/BasicsStepForm";
import { DateLocationStepForm } from "./steps/DateLocationStepForm";
import { TicketingStepForm } from "./steps/TicketingStepForm";
import { CustomizationsStepForm } from "./steps/CustomizationsStepForm";
import { ReviewStepForm } from "./steps/ReviewStepForm";
import { SuccessStep } from "./steps/SuccessStep";

/**
 * Props for the wizard. The host route passes in the `onSubmit` callback,
 * which is responsible for pushing the aggregated form data to Supabase.
 * The wizard itself only handles navigation, validation, and state.
 */
export interface EventCreationWizardProps {
  onSubmit: (data: import("../../lib/eventWizardSchema").EventWizardFormData) => Promise<void>;
}

/**
 * The top-level Event Creation Wizard component.
 *
 * Breaks the event creation process into 5 distinct steps (4 data
 * steps + a review step), with per-step validation, a progress
 * stepper, persisted state (localStorage), and browser-back support
 * via the step query parameter.
 */
export function EventCreationWizard({ onSubmit }: EventCreationWizardProps) {
  const step = useEventWizardStore((s) => s.step);
  const formData = useEventWizardStore((s) => s.formData);
  const isComplete = useEventWizardStore((s) => s.isComplete);
  const isSubmitting = useEventWizardStore((s) => s.isSubmitting);
  const submissionError = useEventWizardStore((s) => s.submissionError);
  const setSubmitting = useEventWizardStore((s) => s.setSubmitting);
  const setSubmissionError = useEventWizardStore((s) => s.setSubmissionError);
  const setComplete = useEventWizardStore((s) => s.setComplete);
  const setValidationErrors = useEventWizardStore((s) => s.setValidationErrors);
  const resetWizard = useEventWizardStore((s) => s.resetWizard);

  // ── Browser back button support ──────────────────────────────
  // Sync the URL query param `?step=N` with the store's step, so that
  // hitting the browser Back button navigates to the previous wizard
  // step rather than the previous page in history.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(step));
    window.history.replaceState(null, "", url.toString());
  }, [step]);

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const stepParam = url.searchParams.get("step");
      if (stepParam !== null) {
        const parsed = parseInt(stepParam, 10);
        if (!Number.isNaN(parsed)) {
          useEventWizardStore.getState().goToStep(parsed);
        }
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── Submit handler ────────────────────────────────────────────
  const handleSubmit = async () => {
    // Final validation against the master schema.
    const { errors, isValid } = validateMaster(formData);
    if (!isValid) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);
    try {
      await onSubmit(formData);
      setComplete(true);
      // Clear the persisted localStorage state on success.
      resetWizard();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setSubmissionError(message);
    }
  };

  // ── Success step ──────────────────────────────────────────────
  if (isComplete) {
    return <SuccessStep onCreateAnother={resetWizard} />;
  }

  // ── Current step content ──────────────────────────────────────
  const renderStep = () => {
    switch (WIZARD_STEPS[step].id) {
      case "basics":
        return <BasicsStepForm />;
      case "date-location":
        return <DateLocationStepForm />;
      case "ticketing":
        return <TicketingStepForm />;
      case "customizations":
        return <CustomizationsStepForm />;
      case "review":
        return <ReviewStepForm />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create an Event</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step].label}
        </p>
      </header>

      <ProgressStepper />

      <main className="mt-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        {renderStep()}

        {submissionError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {submissionError}
          </div>
        )}
      </main>

      <div className="mt-6">
        <WizardNavigation onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
