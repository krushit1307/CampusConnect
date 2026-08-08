import React from "react";

const STEPS = ["basics", "ticketing", "location", "review"];

export function StepIndicator({ stateValue }: { stateValue: string }) {
  const currentIndex = STEPS.indexOf(stateValue);

  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step} className="flex flex-col items-center relative flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium z-10 
              ${
                isCurrent
                  ? "bg-primary text-primary-foreground border-2 border-primary"
                  : isCompleted
                    ? "bg-primary/20 text-primary border-2 border-primary/20"
                    : "bg-muted text-muted-foreground border-2 border-muted"
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {index + 1}
            </div>
            <span className="text-xs mt-2 capitalize font-medium text-muted-foreground">
              {step}
            </span>
            {index < STEPS.length - 1 && (
              <div
                className={`absolute top-4 left-1/2 w-full h-[2px] -z-10
                ${isCompleted ? "bg-primary/50" : "bg-muted"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
