import { describe, it, expect, vi } from "vitest";
import {
  resolveUpvoteButtonState,
  handleUpvoteClick,
  GUEST_UPVOTE_TOOLTIP,
  AUTHORIZED_UPVOTE_TOOLTIP,
} from "./upvoteButtonGuard";

describe("Disable Upvote Button for Unauthenticated Users Suite (#3824)", () => {
  const authenticatedUser = { id: "usr_101", email: "student@university.edu" };

  it("disables button state and attaches login tooltip for guest users", () => {
    const guestState = resolveUpvoteButtonState(null);

    expect(guestState.isDisabled).toBe(true);
    expect(guestState.tooltipText).toBe(GUEST_UPVOTE_TOOLTIP);
    expect(guestState.cssClasses).toContain("cursor-not-allowed");
  });

  it("enables button state with upvote tooltip for authenticated users", () => {
    const authState = resolveUpvoteButtonState(authenticatedUser, false);

    expect(authState.isDisabled).toBe(false);
    expect(authState.tooltipText).toBe(AUTHORIZED_UPVOTE_TOOLTIP);
    expect(authState.cssClasses).toContain("cursor-pointer");
  });

  it("intercepts click actions for guest users preventing console/runtime errors", () => {
    const mockCallback = vi.fn();

    // Guest click attempt -> Intercepted
    const guestResult = handleUpvoteClick(null, mockCallback);
    expect(guestResult).toBe(false);
    expect(mockCallback).not.toHaveBeenCalled();

    // Authenticated click attempt -> Executed
    const authResult = handleUpvoteClick(authenticatedUser, mockCallback);
    expect(authResult).toBe(true);
    expect(mockCallback).toHaveBeenCalledOnce();
  });
});
