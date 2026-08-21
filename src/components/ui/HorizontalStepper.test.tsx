import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HorizontalStepper, type StepperStep } from "./HorizontalStepper";

const testSteps: StepperStep[] = [
  { id: "step-1", title: "Basic Info", description: "Essentials" },
  { id: "step-2", title: "Mission", description: "Details" },
  { id: "step-3", title: "Socials", description: "Links" },
];

describe("HorizontalStepper", () => {
  it("renders all step titles", () => {
    render(<HorizontalStepper steps={testSteps} currentStep={1} />);

    expect(screen.getAllByText("Basic Info").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mission").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Socials").length).toBeGreaterThan(0);
  });

  it("marks current active step with aria-current='step'", () => {
    render(<HorizontalStepper steps={testSteps} currentStep={2} />);

    const stepButtons = screen.getAllByRole("button");
    const activeStepButton = stepButtons.find(
      (button) => button.getAttribute("aria-current") === "step",
    );

    expect(activeStepButton).toBeDefined();
    expect(activeStepButton).toHaveTextContent("Mission");
  });

  it("invokes onStepClick for reachable steps", () => {
    const onStepClick = vi.fn();
    render(
      <HorizontalStepper
        steps={testSteps}
        currentStep={2}
        onStepClick={onStepClick}
        isStepReachable={(index) => index <= 1}
      />,
    );

    const stepButtons = screen.getAllByRole("button");
    const firstStepButton = stepButtons.find((btn) => btn.textContent?.includes("Basic Info"));

    if (firstStepButton) {
      fireEvent.click(firstStepButton);
      expect(onStepClick).toHaveBeenCalledWith(0);
    }
  });
});
