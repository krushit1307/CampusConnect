import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  LookalikeMarketingEngine,
  MOCK_ACTIVE_MEMBERS,
  MOCK_CANDIDATE_USERS,
} from "./LookalikeMarketingEngine";

describe("LookalikeMarketingEngine Component (#3585)", () => {
  it("renders Lookalike Marketing Engine header, centroid profile, and ranked lookalike candidates", () => {
    render(
      <LookalikeMarketingEngine
        clubName="Computer Science Society"
        activeMembers={MOCK_ACTIVE_MEMBERS}
        candidates={MOCK_CANDIDATE_USERS}
      />
    );

    expect(screen.getByText(/Automated "Lookalike" Audience Marketing Engine — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText("Club Centroid Profile")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getAllByText(/Matches primary club major/i).length).toBeGreaterThan(0);
  });

  it("displays privacy guard indicator for opted-out students", () => {
    render(
      <LookalikeMarketingEngine
        clubName="Computer Science Society"
        activeMembers={MOCK_ACTIVE_MEMBERS}
        candidates={MOCK_CANDIDATE_USERS}
      />
    );

    expect(screen.getByText(/Privacy Guard Active/i)).toBeInTheDocument();
    expect(screen.getByText(/1 student profiles were automatically excluded/i)).toBeInTheDocument();
  });

  it("opens campaign dispatch modal and sends targeted push notification", () => {
    const handleDispatch = vi.fn();
    render(
      <LookalikeMarketingEngine
        clubName="Computer Science Society"
        activeMembers={MOCK_ACTIVE_MEMBERS}
        candidates={MOCK_CANDIDATE_USERS}
        onDispatchCampaign={handleDispatch}
      />
    );

    const dispatchBtn = screen.getByRole("button", { name: /Dispatch Targeted Invite/i });
    fireEvent.click(dispatchBtn);

    expect(screen.getByRole("heading", { name: /Dispatch Targeted Invite Campaign/i })).toBeInTheDocument();

    const sendBtn = screen.getByRole("button", { name: /Send Targeted Push Notifications/i });
    fireEvent.click(sendBtn);

    expect(handleDispatch).toHaveBeenCalled();
  });
});
