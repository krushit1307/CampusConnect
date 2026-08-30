import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DonationGoalThermometerWidget } from "./DonationGoalThermometerWidget";

describe("DonationGoalThermometerWidget Component (#4402)", () => {
  it("renders Donation Goal Thermometer header, metric cards, and live donor ticker", () => {
    render(
      <DonationGoalThermometerWidget
        title="Robotics Competition Fund"
        targetAmount={5000}
        initialCurrentAmount={2000}
      />
    );

    expect(screen.getByText(/Real-Time "Donation Goal" Thermometer — Robotics Competition Fund/i)).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Live Donor Ticker Feed")).toBeInTheDocument();
  });

  it("simulates instant Stripe donation and updates current raised total", () => {
    const handleDonation = vi.fn();
    render(
      <DonationGoalThermometerWidget
        title="Robotics Competition Fund"
        targetAmount={5000}
        initialCurrentAmount={2000}
        onDonationMade={handleDonation}
      />
    );

    const btn50 = screen.getByRole("button", { name: "+$50" });
    fireEvent.click(btn50);

    expect(handleDonation).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAmount: 2050,
      })
    );
  });

  it("triggers celebration banner when fundraising goal is reached", () => {
    render(
      <DonationGoalThermometerWidget
        title="Robotics Competition Fund"
        targetAmount={5000}
        initialCurrentAmount={4950}
      />
    );

    const btn50 = screen.getByRole("button", { name: "+$50" });
    fireEvent.click(btn50);

    expect(screen.getByText(/FUNDRAISING GOAL REACHED!/i)).toBeInTheDocument();
  });
});
