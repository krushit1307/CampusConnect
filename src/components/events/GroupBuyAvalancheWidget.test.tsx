import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GroupBuyAvalancheWidget } from "./GroupBuyAvalancheWidget";
import { GroupBuyCampaign } from "@/lib/groupBuyAvalanche";

describe("GroupBuyAvalancheWidget Component (#4893)", () => {
  const sampleCampaign: GroupBuyCampaign = {
    campaignId: "gbu-gala-2026",
    eventId: "evt-gala-2026",
    originalPrice: 30.0,
    discountedPrice: 15.0,
    targetCommitsCount: 100,
    currentCommitsCount: 85,
    expiresAt: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
    status: "active",
  };

  it("renders Group Buy Avalanche header, progress bar, and price badges", () => {
    render(
      <GroupBuyAvalancheWidget
        eventTitle="Spring Gala 2026"
        initialCampaign={sampleCampaign}
      />
    );

    expect(screen.getByText(/"Group Buy" Avalanche Dynamic Pricing — Spring Gala 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/85 \/ 100 Commits Reached/i)).toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Commit to Group Buy \(\$30\.00 Hold\)/i })).toBeInTheDocument();
  });

  it("commits to group buy and increments commit progress bar count", () => {
    const handleSuccess = vi.fn();
    render(
      <GroupBuyAvalancheWidget
        initialCampaign={sampleCampaign}
        onCommitSuccess={handleSuccess}
      />
    );

    const commitBtn = screen.getByRole("button", { name: /Commit to Group Buy \(\$30\.00 Hold\)/i });
    fireEvent.click(commitBtn);

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizedPrice: 30,
        status: "authorized",
      }),
      expect.objectContaining({
        currentCommitsCount: 86,
      })
    );

    expect(screen.getByText(/86 \/ 100 Commits Reached/i)).toBeInTheDocument();
  });

  it("triggers avalanche unlock celebration banner when 100th commit hits target", () => {
    const nearTargetCampaign: GroupBuyCampaign = {
      ...sampleCampaign,
      currentCommitsCount: 99,
    };

    render(<GroupBuyAvalancheWidget initialCampaign={nearTargetCampaign} />);

    const commitBtn = screen.getByRole("button", { name: /Commit to Group Buy \(\$30\.00 Hold\)/i });
    fireEvent.click(commitBtn);

    expect(screen.getByText(/GROUP BUY AVALANCHE UNLOCKED/i)).toBeInTheDocument();
  });
});
