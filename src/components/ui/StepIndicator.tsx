import { motion } from "framer-motion";
import Check from "lucide-react/dist/esm/icons/check";

export interface StepIndicatorProps {
  currentStep: number; // 1-indexed, e.g., 1-5
  steps: string[];
  onStepClick?: (stepIndex: number) => void;
  isStepReachable?: (stepIndex: number) => boolean;
}

export function StepIndicator({
  currentStep,
  steps,
  onStepClick,
  isStepReachable,
}: StepIndicatorProps) {
  const totalSteps = steps.length;
  // Calculate percentage fill of the line (0% to 100%)
  const fillPercentage = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;

  return (
    <nav aria-label="Progress Stepper" className="w-full py-4 px-2 select-none">
      <div className="relative flex items-center justify-between w-full max-w-3xl mx-auto">
        {/* Background Track Line */}
        <div className="absolute top-5 left-4 right-4 h-1.5 bg-gray-200 border border-black -translate-y-1/2 -z-10 rounded-full" />

        {/* Animated Progress Fill Line */}
        <motion.div
          className="absolute top-5 left-4 h-1.5 bg-emerald-500 border border-black -translate-y-1/2 -z-10 rounded-full origin-left"
          style={{ right: `${100 - fillPercentage}%` }}
          initial={{ right: "100%" }}
          animate={{ right: `${100 - fillPercentage}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />

        {/* Step Nodes */}
        {steps.map((title, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const reachable = isStepReachable ? isStepReachable(index) : true;

          return (
            <div key={title} className="relative flex flex-col items-center flex-1">
              <button
                type="button"
                onClick={() => onStepClick && onStepClick(index)}
                disabled={!onStepClick || !reachable}
                className="focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${stepNumber}: ${title}`}
              >
                {/* Step Circle */}
                <motion.div
                  className={`flex items-center justify-center w-10 h-10 border-2 rounded-full font-mono text-sm font-black transition-shadow duration-200 ${
                    isCompleted
                      ? "bg-emerald-500 border-black text-white shadow-[2px_2px_0_0_#000]"
                      : isActive
                        ? "bg-brand-yellow-base border-black text-black shadow-[4px_4px_0_0_#000]"
                        : "bg-white border-gray-300 text-gray-400 shadow-none"
                  }`}
                  animate={isActive ? { scale: [1, 1.1, 1.05] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 stroke-[3]" data-testid={`check-icon-${index}`} />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </motion.div>
              </button>

              {/* Step Label - Responsive (Hidden on mobile) */}
              <div className="absolute top-12 hidden md:block w-32 text-center">
                <span
                  className={`font-mono text-xs uppercase tracking-wider font-bold block truncate ${
                    isActive
                      ? "text-black font-black"
                      : isCompleted
                        ? "text-emerald-600"
                        : "text-gray-400"
                  }`}
                >
                  {title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
