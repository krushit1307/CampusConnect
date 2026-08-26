// src/components/EventCreationWizard/ProgressStepper.tsx
import Check from "lucide-react/dist/esm/icons/check";
import { WIZARD_STEPS } from "../../lib/eventWizardSchema";
import { useEventWizardStore } from "../../store/useEventWizardStore";
import { cn } from "../../lib/utils";

/**
 * A horizontal progress stepper built on Shadcn UI conventions.
 *
 * Renders one circle per step in WIZARD_STEPS. The current step's
 * circle is highlighted; completed steps show a checkmark; future
 * steps are dimmed.
 *
 * Clicking a completed step navigates back to it (allowing the user
 * to edit earlier steps). Future steps are not clickable.
 *
 * Accessibility:
 *   - The nav element exposes role="navigation" and an aria-label.
 *   - Each step button exposes aria-current="step" for the active step.
 *   - Each step button has a descriptive aria-label.
 */
export function ProgressStepper() {
  const currentStep = useEventWizardStore((s) => s.step);
  const goToStep = useEventWizardStore((s) => s.goToStep);

  return (
    <nav className="w-full" aria-label="Event creation progress" role="navigation">
      <ol className="flex items-center justify-between w-full">
        {WIZARD_STEPS.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = index <= currentStep;

          return (
            <li key={step.id} className="flex-1 flex items-center last:flex-none">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && goToStep(index)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${
                  isComplete ? " (completed)" : isCurrent ? " (current)" : ""
                }`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed",
                  isCurrent
                    ? "text-indigo-600 dark:text-indigo-400"
                    : isComplete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    isCurrent
                      ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-900"
                      : isComplete
                        ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-900"
                        : "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800",
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>

              {/* Connector line between steps (except after the last one). */}
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                    index < currentStep
                      ? "bg-emerald-600 dark:bg-emerald-400"
                      : "bg-slate-200 dark:bg-slate-700",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
