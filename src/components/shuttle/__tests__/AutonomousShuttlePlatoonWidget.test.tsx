import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutonomousShuttlePlatoonWidget } from "../AutonomousShuttlePlatoonWidget";

describe("AutonomousShuttlePlatoonWidget Component", () => {
  it("renders widget header title, surge demand metrics, and efficiency badge", () => {
    render(<AutonomousShuttlePlatoonWidget eventName="Test Event Let-Out" initialDemand={35} />);

    expect(screen.getByTestId("autonomous-shuttle-platoon-widget")).toBeDefined();
    expect(screen.getByText(/Autonomous Shuttle Capacity Optimizer/i)).toBeDefined();
    expect(screen.getByTestId("platoon-efficiency-badge")).toBeDefined();
    expect(screen.getByText("Test Event Let-Out")).toBeDefined();
  });

  it("updates surge demand when slider is adjusted", () => {
    render(<AutonomousShuttlePlatoonWidget initialDemand={30} />);

    const slider = screen.getByTestId("surge-demand-slider");
    fireEvent.change(slider, { target: { value: "50" } });

    expect(screen.getByText("50")).toBeDefined();
  });

  it("dispatches autonomous platoon convoy when dispatch button is clicked", () => {
    render(<AutonomousShuttlePlatoonWidget initialDemand={40} />);

    const dispatchBtn = screen.getByTestId("dispatch-platoon-btn");
    fireEvent.click(dispatchBtn);

    expect(screen.getByTestId("platoon-notification-banner")).toBeDefined();
    expect(screen.getByTestId("active-platoons-list")).toBeDefined();
  });
});
