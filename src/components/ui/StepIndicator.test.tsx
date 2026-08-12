import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepIndicator } from "./StepIndicator";

describe("StepIndicator Component", () => {
  const steps = ["Basic Info", "Constitution", "Officers", "Review", "Submit"];

  it("renders correctly on Step 1", () => {
    const { container } = render(<StepIndicator currentStep={1} steps={steps} />);

    // Circle 1 should have active step indicators or labels
    const btn1 = screen.getByRole("button", { name: "Step 1: Basic Info" });
    expect(btn1).toBeInTheDocument();
    expect(btn1.getAttribute("aria-current")).toBe("step");

    // Other steps should not be marked as current
    const btn2 = screen.getByRole("button", { name: "Step 2: Constitution" });
    expect(btn2.getAttribute("aria-current")).toBeNull();

    // Check we display text descriptions/labels
    expect(screen.getByText("Basic Info")).toBeInTheDocument();
    expect(screen.getByText("Constitution")).toBeInTheDocument();
    expect(screen.getByText("Officers")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();

    // No check icon should be rendered yet on step 1
    expect(container.querySelector("[data-testid^='check-icon']")).toBeNull();
  });

  it("renders correct completed states when on Step 3", () => {
    render(<StepIndicator currentStep={3} steps={steps} />);

    // Steps 1 & 2 should display checkmarks (indicating completion)
    expect(screen.getByTestId("check-icon-0")).toBeInTheDocument();
    expect(screen.getByTestId("check-icon-1")).toBeInTheDocument();

    // Step 3 should be current active
    const btn3 = screen.getByRole("button", { name: "Step 3: Officers" });
    expect(btn3.getAttribute("aria-current")).toBe("step");

    // Step 4 and 5 should not be active or completed
    const btn4 = screen.getByRole("button", { name: "Step 4: Review" });
    expect(btn4.getAttribute("aria-current")).toBeNull();
    expect(screen.queryByTestId("check-icon-3")).toBeNull();
  });
});
