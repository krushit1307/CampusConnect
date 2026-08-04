import type { ReactNode } from "react";
import { Check } from "lucide-react";

export interface StepperStep {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

export interface HorizontalStepperProps {
  steps: StepperStep[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  isStepReachable?: (stepIndex: number) => boolean;
  className?: string;
}

export function HorizontalStepper({
  steps,
  currentStep,
  onStepClick,
  isStepReachable,
  className = "",
}: HorizontalStepperProps) {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`} role="navigation">
      {/* Desktop Stepper */}
      <ol className="hidden md:flex items-center w-full justify-between gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const reachable = isStepReachable ? isStepReachable(index) : isCompleted || isCurrent;

          return (
            <li key={step.id} className="flex-1 flex items-center relative">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => {
                  if (reachable && onStepClick) {
                    onStepClick(index);
                  }
                }}
                aria-current={isCurrent ? "step" : undefined}
                className={`group flex items-center gap-3 w-full text-left p-2.5 rounded-md transition-all cursor-pointer disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-black text-cream font-bold shadow-[3px_3px_0_0_#000]"
                    : isCompleted
                      ? "bg-lime/20 text-black hover:bg-lime/40"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
              >
                {/* Step Circle Indicator */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center font-mono text-xs font-black border-2 border-black transition-colors ${
                    isCompleted
                      ? "bg-black text-lime"
                      : isCurrent
                        ? "bg-brand-yellow-base text-black"
                        : "bg-white text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>

                {/* Step Text */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-mono text-xs uppercase tracking-wider truncate font-bold ${
                      isCurrent ? "text-cream" : isCompleted ? "text-black" : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p
                      className={`font-mono text-[10px] truncate ${
                        isCurrent ? "text-gray-300" : "text-gray-500"
                      }`}
                    >
                      {step.description}
                    </p>
                  )}
                </div>
              </button>

              {/* Connecting line between steps */}
              {index < steps.length - 1 && (
                <div
                  className={`hidden lg:block h-0.5 w-4 shrink-0 mx-1 ${
                    stepNumber < currentStep ? "bg-black" : "bg-gray-300"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile Stepper */}
      <div className="md:hidden neu-border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-black">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1]?.title}
          </span>
          <span className="font-mono text-xs font-bold text-gray-500">
            {Math.round((currentStep / steps.length) * 100)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 h-3 border border-black overflow-hidden">
          <div
            className="bg-black h-full transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>

        {/* Mobile Step Quick Jumps */}
        <div className="flex items-center justify-between mt-3 gap-1">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const reachable = isStepReachable ? isStepReachable(index) : isCompleted || isCurrent;

            return (
              <button
                key={step.id}
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onStepClick && onStepClick(index)}
                aria-label={`Go to step ${stepNumber}: ${step.title}`}
                className={`flex-1 py-1 font-mono text-[10px] font-bold border border-black text-center transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-black text-cream"
                    : isCompleted
                      ? "bg-lime text-black"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {stepNumber}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
