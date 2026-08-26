import React from "react";
import { useEventWizard } from "../../hooks/useEventWizard";
import { WizardLayout } from "./WizardLayout";
import { StepIndicator } from "./StepIndicator";
import { Navigation } from "./Navigation";

import { BasicsStep } from "../steps/BasicsStep";
import { TicketingStep } from "../steps/TicketingStep";
import { LocationStep } from "../steps/LocationStep";
import { ReviewStep } from "../steps/ReviewStep";
import { SubmittingStep } from "../steps/SubmittingStep";
import { SuccessStep } from "../steps/SuccessStep";
import { ErrorStep } from "../steps/ErrorStep";

export function EventWizard() {
  const wizard = useEventWizard();
  const { stateValue } = wizard;

  let currentStepComponent = null;

  switch (stateValue) {
    case "basics":
      currentStepComponent = <BasicsStep wizard={wizard} />;
      break;
    case "ticketing":
      currentStepComponent = <TicketingStep wizard={wizard} />;
      break;
    case "location":
      currentStepComponent = <LocationStep wizard={wizard} />;
      break;
    case "review":
      currentStepComponent = <ReviewStep wizard={wizard} />;
      break;
    case "submitting":
      currentStepComponent = <SubmittingStep />;
      break;
    case "success":
      currentStepComponent = <SuccessStep wizard={wizard} />;
      break;
    case "error":
      currentStepComponent = <ErrorStep wizard={wizard} />;
      break;
    default:
      currentStepComponent = <div>Unknown state</div>;
  }

  return (
    <WizardLayout>
      {stateValue !== "success" && stateValue !== "submitting" && stateValue !== "error" && (
        <StepIndicator stateValue={stateValue as string} />
      )}

      <div className="py-6">{currentStepComponent}</div>

      {stateValue !== "success" && stateValue !== "submitting" && stateValue !== "error" && (
        <Navigation wizard={wizard} />
      )}
    </WizardLayout>
  );
}
