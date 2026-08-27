import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProfileInterestHeatmap, MOCK_ATTENDED_TAGS } from "./ProfileInterestHeatmap";

describe("ProfileInterestHeatmap Component (#3546)", () => {
  it("renders Interest Heatmap header, tag cloud, and category breakdown", () => {
    render(
      <ProfileInterestHeatmap
        userName="Alex Rivera"
        initialTags={MOCK_ATTENDED_TAGS}
        totalAttendedEvents={8}
        isOwner={true}
      />
    );

    expect(screen.getByText(/Networking Interest Heatmap — Alex Rivera/i)).toBeInTheDocument();
    expect(screen.getByTestId("interest-tag-cloud")).toBeInTheDocument();
    expect(screen.getByText("#React")).toBeInTheDocument();
    expect(screen.getByText("#Art & Design")).toBeInTheDocument();
  });

  it("allows profile owner to toggle privacy setting", () => {
    const handleToggle = vi.fn();
    render(
      <ProfileInterestHeatmap
        userName="Alex Rivera"
        initialTags={MOCK_ATTENDED_TAGS}
        isOwner={true}
        onTogglePrivacy={handleToggle}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /Public Analytics/i });
    fireEvent.click(toggleBtn);

    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it("hides analytics and displays privacy shield message when viewed by others in private mode", () => {
    render(
      <ProfileInterestHeatmap
        userName="Alex Rivera"
        initialTags={MOCK_ATTENDED_TAGS}
        initialIsPrivate={true}
        isOwner={false}
      />
    );

    expect(screen.getByText(/Attendance Analytics Hidden/i)).toBeInTheDocument();
    expect(screen.getByText(/Alex Rivera has chosen to keep their event attendance heatmap/i)).toBeInTheDocument();
    expect(screen.queryByTestId("interest-tag-cloud")).not.toBeInTheDocument();
  });
});
