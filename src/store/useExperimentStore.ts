import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Variant = "A" | "B";

interface ExperimentState {
  variant: Variant | null;
  initializeVariant: () => Variant;
  trackRegistration: () => void;
}

export const useExperimentStore = create<ExperimentState>()(
  persist(
    (set, get) => ({
      variant: null,
      initializeVariant: () => {
        const { variant } = get();
        if (variant) return variant;

        const assignedVariant: Variant = Math.random() < 0.5 ? "A" : "B";
        set({ variant: assignedVariant });
        return assignedVariant;
      },
      trackRegistration: () => {
        const { variant } = get();
        if (!variant) return;

        // Telemetry tracking registration success for the variant
        console.log(`[Telemetry] Registration success under variant: ${variant}`);
        if (typeof window !== "undefined") {
          // Emit telemetry / custom analytics event
          const event = new CustomEvent("experiment_registration", { detail: { variant } });
          window.dispatchEvent(event);
        }
      },
    }),
    {
      name: "ab-experiment-storage",
    },
  ),
);
