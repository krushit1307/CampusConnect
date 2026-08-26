import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { HorizontalStepper, type StepperStep } from "@/components/ui/HorizontalStepper";

export interface WizardStep<TFieldValues extends FieldValues> {
  id: string;
  title: string;
  description?: string;
  fields: Array<Path<TFieldValues>>;
  render: (form: UseFormReturn<TFieldValues>) => React.ReactNode;
}

interface WizardProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>;
  steps: WizardStep<TFieldValues>[];
  storageKey: string;
  basePath: string;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmitted?: () => void;
}

const STEP_PARAM = "step";

function readStepFromUrl(searchParams: URLSearchParams, total: number): number {
  const raw = Number(searchParams.get(STEP_PARAM));
  if (!Number.isInteger(raw) || raw < 1) return 1;
  return Math.min(raw, total);
}

export function Wizard<TFieldValues extends FieldValues>({
  form,
  steps,
  storageKey,
  basePath,
  isSubmitting = false,
  submitLabel = "Submit",
  onSubmitted,
}: WizardProps<TFieldValues>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);

  const step = readStepFromUrl(searchParams, steps.length);

  // Rehydrate cached form data from sessionStorage on mount so a hard refresh
  // does not lose the user's progress.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<TFieldValues>;
        form.reset({ ...form.getValues(), ...parsed });
      }
    } catch {
      // Ignore corrupt cache entries and keep default values.
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  // Persist every keystroke to sessionStorage.
  useEffect(() => {
    if (!hydrated) return;
    const subscription = form.watch((values) => {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form, hydrated, storageKey]);

  // Routing guard: never allow a step that requires data from an earlier
  // (incomplete) step. This also blocks manually typed ?step=5 URLs.
  useEffect(() => {
    if (!hydrated) return;
    let furthestReachable = 1;
    for (let i = 0; i < steps.length - 1; i += 1) {
      const previousStepsComplete = steps.slice(0, i + 1).every((s) =>
        s.fields.every((f) => {
          const value = form.getValues(f);
          return value !== undefined && value !== null && value !== "";
        }),
      );
      if (!previousStepsComplete) break;
      furthestReachable = i + 2;
    }
    if (step > furthestReachable) {
      navigate(`${basePath}?${STEP_PARAM}=${furthestReachable}`, { replace: true });
    }
  }, [hydrated, step, steps, basePath, form, navigate]);

  const currentStep = steps[step - 1];

  const goToStep = (nextStep: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(STEP_PARAM, String(nextStep));
      return next;
    });
  };

  const handleNext = async () => {
    const valid = await form.trigger(currentStep.fields);
    if (!valid) return;
    goToStep(step + 1);
  };

  const handleBack = () => {
    goToStep(step - 1);
  };

  const stepperSteps: StepperStep[] = useMemo(
    () => steps.map((s) => ({ id: s.id, title: s.title, description: s.description })),
    [steps],
  );

  const isStepReachable = (index: number) => {
    return steps.slice(0, index).every((st) =>
      st.fields.every((f) => {
        const value = form.getValues(f);
        return value !== undefined && value !== null && value !== "";
      }),
    );
  };

  const isLastStep = step === steps.length;

  return (
    <div className="w-full">
      {/* Horizontal Stepper component */}
      <div className="mb-8">
        <HorizontalStepper
          steps={stepperSteps}
          currentStep={step}
          onStepClick={(index) => goToStep(index + 1)}
          isStepReachable={isStepReachable}
        />
      </div>

      <div className="neu-border bg-white p-6 shadow-[6px_6px_0_0_#000]">
        <div className="mb-5 border-b-2 border-black pb-3">
          <h2 className="font-display text-xl font-bold uppercase tracking-widest text-black">
            {currentStep.title}
          </h2>
          {currentStep.description && (
            <p className="mt-1 font-mono text-xs text-gray-600">{currentStep.description}</p>
          )}
        </div>

        {currentStep.render(form)}

        <div className="mt-8 flex items-center justify-between border-t-2 border-black pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="neu-border bg-white px-5 py-2.5 font-mono text-xs font-bold uppercase text-black hover:bg-gray-100 cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {isLastStep ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (onSubmitted) onSubmitted();
              }}
              className="neu-border neu-press bg-black px-6 py-2.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : submitLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="neu-border neu-press bg-black px-6 py-2.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black transition-colors cursor-pointer"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
