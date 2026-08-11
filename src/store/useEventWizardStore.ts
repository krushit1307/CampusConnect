// src/store/useEventWizardStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  EventWizardFormData,
  WIZARD_STEPS,
  WizardStepId,
  DEFAULT_EVENT_WIZARD_DATA,
  eventWizardMasterSchema,
} from "../lib/eventWizardSchema";

/**
 * The shape of the wizard store.
 *
 * The store holds:
 *   - `step`: the current step index (0-based).
 *   - `formData`: the accumulated form data across all steps.
 *   - `validationErrors`: per-step validation errors (cleared on each
 *     successful step transition).
 *   - `isSubmitting`: true while the final submission request is in
 *     flight (used to disable the submit button and show a spinner).
 *   - `submissionError`: error message from the last submission
 *     attempt (cleared on retry).
 *   - `isComplete`: true after a successful submission (used to
 *     render the success step).
 *
 * The store is persisted to localStorage via the `persist` middleware
 * so that the user does not lose progress if they accidentally close
 * the tab. The persisted state is cleared on a successful submission.
 */
export interface EventWizardStore {
  step: number;
  formData: EventWizardFormData;
  validationErrors: Record<string, string>;
  isSubmitting: boolean;
  submissionError: string | null;
  isComplete: boolean;

  // Navigation
  goToStep: (step: number) => void;
  next: () => void;
  back: () => void;
  canAdvance: () => boolean;

  // Form data
  updateFormData: (partial: Partial<EventWizardFormData>) => void;
  setValidationErrors: (errors: Record<string, string>) => void;
  clearValidationErrors: () => void;

  // Submission
  setSubmitting: (submitting: boolean) => void;
  setSubmissionError: (error: string | null) => void;
  setComplete: (complete: boolean) => void;

  // Reset
  resetWizard: () => void;
}

/**
 * Helper: validate the current step's slice of the form data against
 * the per-step Zod schema. Returns the validation errors (empty if
 * valid) and a boolean indicating whether the step is valid.
 *
 * Exported separately so unit tests can call it directly without
 * going through the store.
 */
export function validateStep(
  stepIndex: number,
  formData: EventWizardFormData,
): { errors: Record<string, string>; isValid: boolean } {
  const step = WIZARD_STEPS[stepIndex];
  if (!step || !step.schema) {
    return { errors: {}, isValid: true };
  }

  // Extract only the fields this step's schema cares about, so that
  // partially-filled fields from later steps don't trigger errors.
  let baseSchema: z.ZodTypeAny = step.schema as any;
  while (baseSchema instanceof z.ZodEffects) {
    baseSchema = baseSchema.innerType();
  }
  const stepShape = (baseSchema as z.ZodObject<any>).shape as Record<string, z.ZodTypeAny>;
  const stepData: Record<string, unknown> = {};
  for (const key of Object.keys(stepShape)) {
    stepData[key] = (formData as Record<string, unknown>)[key];
  }

  const result = step.schema.safeParse(stepData);
  if (result.success) {
    return { errors: {}, isValid: true };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_";
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { errors, isValid: false };
}

/**
 * Helper: validate the entire form against the master schema.
 * Used on the final step before submitting to Supabase.
 */
export function validateMaster(formData: EventWizardFormData): {
  errors: Record<string, string>;
  isValid: boolean;
} {
  const result = eventWizardMasterSchema.safeParse(formData);
  if (result.success) {
    return { errors: {}, isValid: true };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_";
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { errors, isValid: false };
}

// z is imported lazily inside validateStep to avoid a top-level import
// in case the store is loaded in an environment where zod isn't
// available yet (rare, but keeps the module self-contained).
import { z } from "zod";

/**
 * The Zustand store, persisted to localStorage under the key
 * `event-wizard-state`.
 *
 * The `persist` middleware automatically serialises the store state
 * to localStorage on every change and rehydrates it on page load.
 * This satisfies the issue's edge case: "Prevent data loss if the
 * user accidentally closes the tab (save intermediate state to
 * localStorage)."
 *
 * On a successful submission, `resetWizard` clears both the in-memory
 * state and the persisted localStorage entry.
 */
export const useEventWizardStore = create<EventWizardStore>()(
  persist(
    (set, get) => ({
      step: 0,
      formData: { ...DEFAULT_EVENT_WIZARD_DATA },
      validationErrors: {},
      isSubmitting: false,
      submissionError: null,
      isComplete: false,

      // ── Navigation ───────────────────────────────────────────────
      goToStep: (step: number) => {
        const clamped = Math.max(0, Math.min(step, WIZARD_STEPS.length - 1));
        set({ step: clamped, validationErrors: {} });
      },

      next: () => {
        const { step, formData } = get();
        const { errors, isValid } = validateStep(step, formData);
        if (!isValid) {
          set({ validationErrors: errors });
          return;
        }
        const nextStep = Math.min(step + 1, WIZARD_STEPS.length - 1);
        set({ step: nextStep, validationErrors: {} });
      },

      back: () => {
        const { step } = get();
        const prevStep = Math.max(step - 1, 0);
        set({ step: prevStep, validationErrors: {} });
      },

      canAdvance: () => {
        const { step, formData } = get();
        return validateStep(step, formData).isValid;
      },

      // ── Form data ───────────────────────────────────────────────
      updateFormData: (partial: Partial<EventWizardFormData>) => {
        set((state) => ({
          formData: { ...state.formData, ...partial },
        }));
      },

      setValidationErrors: (errors: Record<string, string>) => {
        set({ validationErrors: errors });
      },

      clearValidationErrors: () => {
        set({ validationErrors: {} });
      },

      // ── Submission ──────────────────────────────────────────────
      setSubmitting: (submitting: boolean) => {
        set({ isSubmitting: submitting });
      },

      setSubmissionError: (error: string | null) => {
        set({ submissionError: error, isSubmitting: false });
      },

      setComplete: (complete: boolean) => {
        set({ isComplete: complete });
      },

      // ── Reset ───────────────────────────────────────────────────
      resetWizard: () => {
        set({
          step: 0,
          formData: { ...DEFAULT_EVENT_WIZARD_DATA },
          validationErrors: {},
          isSubmitting: false,
          submissionError: null,
          isComplete: false,
        });
      },
    }),
    {
      name: "event-wizard-state",
      storage: createJSONStorage(() => localStorage),
      // Only persist the step and formData — transient UI state like
      // isSubmitting / submissionError / isComplete should not survive
      // a page reload (otherwise the user would see a perpetually
      // "submitting" spinner on reload).
      partialize: (state) => ({
        step: state.step,
        formData: state.formData,
      }),
    },
  ),
);

/**
 * Convenience hook to get the current step's id and label.
 */
export function useCurrentStep() {
  const step = useEventWizardStore((s) => s.step);
  return WIZARD_STEPS[step] ?? WIZARD_STEPS[0];
}

export { WIZARD_STEPS, type WizardStepId };
