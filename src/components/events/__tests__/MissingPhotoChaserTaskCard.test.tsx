import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MissingPhotoChaserTaskCard } from "../MissingPhotoChaserTaskCard";
import * as missingPhotoTaskRbacService from "@/services/missingPhotoTaskRbacService";

vi.mock("@/services/missingPhotoTaskRbacService", async () => {
  const actual = await vi.importActual<typeof missingPhotoTaskRbacService>("@/services/missingPhotoTaskRbacService");
  return {
    ...actual,
    claimPhotoChaserWithRbacCheck: vi.fn(),
  };
});

describe("MissingPhotoChaserTaskCard Component", () => {
  const mockTask: missingPhotoTaskRbacService.PhotoChaserRbacTask = {
    id: "task-photo-chaser-evt-gala",
    eventId: "evt-gala",
    eventTitle: "Annual Spring Gala",
    assignedRole: "media_lead",
    bountyPoints: 150,
    bountyXp: 100,
    status: "pending",
    createdAt: "2026-08-26T00:00:00.000Z",
    deadlineAt: "2026-08-28T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missingPhotoTaskRbacService.claimPhotoChaserWithRbacCheck).mockResolvedValue({
      success: true,
      taskId: "task-photo-chaser-evt-gala",
      eventId: "evt-gala",
      claimedByUserId: "user-media",
      claimedByUserRole: "media_lead",
      pointsAwarded: 150,
      xpAwarded: 100,
      newTotalPoints: 1350,
      badgeUnlocked: "Visual Maestro 📸",
      message: "Bribe Claimed!",
    });
  });

  it("renders task card title, bounty points, and RBAC assigned role badge", () => {
    render(<MissingPhotoChaserTaskCard task={mockTask} userRole="media_lead" />);

    expect(screen.getByTestId("missing-photo-chaser-task-card")).toBeDefined();
    expect(screen.getByText("Annual Spring Gala")).toBeDefined();
    expect(screen.getByTestId("rbac-assigned-role-badge")).toBeDefined();
    expect(screen.getByText("Assigned Role: media lead 📸")).toBeDefined();
  });

  it("shows unauthorized warning when userRole is general_attendee", () => {
    render(<MissingPhotoChaserTaskCard task={mockTask} userRole="general_attendee" />);

    expect(screen.getByTestId("rbac-unauthorized-warning")).toBeDefined();
    expect(screen.getByText(/Role-Based Permission Restriction/i)).toBeDefined();

    const claimBtn = screen.getByTestId("claim-photo-chaser-btn");
    expect(claimBtn.hasAttribute("disabled")).toBe(true);
  });

  it("enables bounty claim for authorized media_lead role", async () => {
    const handleClaimed = vi.fn();
    render(
      <MissingPhotoChaserTaskCard
        task={mockTask}
        userRole="media_lead"
        userId="user-media"
        onTaskClaimed={handleClaimed}
      />
    );

    const input = screen.getByTestId("photo-url-input");
    fireEvent.change(input, { target: { value: "https://example.com/poster.jpg" } });

    const claimBtn = screen.getByTestId("claim-photo-chaser-btn");
    fireEvent.click(claimBtn);

    await waitFor(() => {
      expect(missingPhotoTaskRbacService.claimPhotoChaserWithRbacCheck).toHaveBeenCalledWith(
        "task-photo-chaser-evt-gala",
        "evt-gala",
        "https://example.com/poster.jpg",
        "user-media",
        "media_lead"
      );
      expect(handleClaimed).toHaveBeenCalledTimes(1);
    });
  });
});
