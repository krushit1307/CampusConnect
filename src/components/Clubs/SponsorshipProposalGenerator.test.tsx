import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SponsorshipProposalGenerator, MOCK_PAST_EVENTS } from "./SponsorshipProposalGenerator";

describe("SponsorshipProposalGenerator Component (#3541)", () => {
  it("renders Pitch Deck Generator header and aggregated stats", () => {
    render(
      <SponsorshipProposalGenerator
        clubName="Developer Student Club"
        availableEvents={MOCK_PAST_EVENTS}
        activeMembersCount={500}
      />
    );

    expect(screen.getByText(/Sponsorship Pitch Deck Generator — Developer Student Club/i)).toBeInTheDocument();
    expect(screen.getByText(/1,500\+/i)).toBeInTheDocument(); // 400+350+250+500 = 1500
    expect(screen.getByText("Annual 36-Hour Hackathon")).toBeInTheDocument();
    expect(screen.getByText("Bronze Partner")).toBeInTheDocument();
  });

  it("updates target sponsor name via input field", () => {
    render(
      <SponsorshipProposalGenerator
        clubName="Developer Student Club"
      />
    );

    const sponsorInput = screen.getByLabelText(/Target Corporate Sponsor Name \*/i);
    fireEvent.change(sponsorInput, { target: { value: "Microsoft" } });

    expect(sponsorInput).toHaveValue("Microsoft");
  });

  it("opens live proposal preview modal", () => {
    render(
      <SponsorshipProposalGenerator
        clubName="Developer Student Club"
      />
    );

    const previewBtn = screen.getByRole("button", { name: /Live Preview/i });
    fireEvent.click(previewBtn);

    expect(screen.getByText("Live Sponsorship Pitch Deck Preview")).toBeInTheDocument();
  });

  it("triggers PDF print action", () => {
    const printSpy = vi.spyOn(window, "open").mockReturnValue({
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    } as any);

    render(
      <SponsorshipProposalGenerator
        clubName="Developer Student Club"
      />
    );

    const printBtn = screen.getByRole("button", { name: /Download Proposal PDF/i });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
