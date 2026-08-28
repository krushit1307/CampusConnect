import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CarpoolGasCostSplitterWidget } from "./CarpoolGasCostSplitterWidget";

describe("CarpoolGasCostSplitterWidget Component (#4478)", () => {
  it("renders Carpool Gas Cost Splitter header, gas input, and rider list", () => {
    render(
      <CarpoolGasCostSplitterWidget
        tripTitle="Campus to Regional Robotics Competition"
        driverName="Alex Rivera"
      />
    );

    expect(screen.getByText(/Dynamic "Carpool" Gas Cost Splitter — Campus to Regional Robotics Competition/i)).toBeInTheDocument();
    expect(screen.getByText("Total Gas Receipt Amount ($) *")).toBeInTheDocument();
    expect(screen.getByText("Alice Vance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Split Gas & Credit Driver/i })).toBeInTheDocument();
  });

  it("calculates per-rider split when gas receipt total changes", () => {
    render(
      <CarpoolGasCostSplitterWidget
        tripTitle="Campus to Regional Robotics Competition"
      />
    );

    const input = screen.getByLabelText(/Total Gas Receipt Amount/i);
    fireEvent.change(input, { target: { value: "30.00" } });

    expect(screen.getByText("$10.00 / rider")).toBeInTheDocument();
  });

  it("executes gas split and displays Stripe Express payout confirmation", () => {
    const handleSettlement = vi.fn();
    render(
      <CarpoolGasCostSplitterWidget
        tripTitle="Campus to Regional Robotics Competition"
        driverName="Alex Rivera"
        onSettlementCompleted={handleSettlement}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Split Gas & Credit Driver/i });
    fireEvent.click(submitBtn);

    expect(handleSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "settled",
        splitAmountPerRider: 5,
        totalGasCost: 15,
      })
    );
    expect(screen.getAllByText(/STRIPE EXPRESS TRANSFER/i).length).toBeGreaterThan(0);
  });
});
