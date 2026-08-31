import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CryptoDonationSlippageAlertWidget } from "./CryptoDonationSlippageAlertWidget";

describe("CryptoDonationSlippageAlertWidget Component (#4983)", () => {
  it("renders Crypto Donation Slippage Alert header, asset selector, and DEX audit box", () => {
    render(
      <CryptoDonationSlippageAlertWidget
        clubName="Campus Robotics & AI Society"
      />
    );

    expect(screen.getByText(/"Donation Goal" Predictive Slippage Alert — Campus Robotics & AI Society/i)).toBeInTheDocument();
    expect(screen.getByText("Select Crypto Asset *")).toBeInTheDocument();
    expect(screen.getByText("1inch / Uniswap DEX Aggregator Router Audit")).toBeInTheDocument();
  });

  it("displays high slippage warning box when low liquidity ALTCOIN is selected", () => {
    render(<CryptoDonationSlippageAlertWidget />);

    expect(screen.getByText(/WARNING: Low liquidity\. You will lose approximately \$2,000\.00 in slippage/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch to USDC Stablecoin/i })).toBeInTheDocument();
  });

  it("switches token to USDC stablecoin on button click and resolves slippage warning", () => {
    render(<CryptoDonationSlippageAlertWidget />);

    const switchBtn = screen.getByRole("button", { name: /Switch to USDC Stablecoin/i });
    fireEvent.click(switchBtn);

    expect(screen.getByText(/Slippage is optimal/i)).toBeInTheDocument();
    expect(screen.queryByText(/WARNING: Low liquidity/i)).toBeNull();
  });
});
