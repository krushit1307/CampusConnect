import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WaitlistPromotionPushWidget } from "./WaitlistPromotionPushWidget";

describe("WaitlistPromotionPushWidget Component (#4404)", () => {
  it("renders Waitlist Promotion Push Widget header and FCM token info", () => {
    render(
      <WaitlistPromotionPushWidget
        eventTitle="Annual Spring Gala"
        initialFcmToken="fcm_tok_sample_991823"
      />
    );

    expect(screen.getByText(/Automated "Waitlist Promotion" Push Notifications — Annual Spring Gala/i)).toBeInTheDocument();
    expect(screen.getByText("fcm_tok_sample_991823")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trigger Waitlist Promotion Push/i })).toBeInTheDocument();
  });

  it("dispatches push notification and renders mobile lock screen banner preview", () => {
    render(
      <WaitlistPromotionPushWidget
        eventTitle="Annual Spring Gala"
      />
    );

    const triggerBtn = screen.getByRole("button", { name: /Trigger Waitlist Promotion Push/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByText(/🚨 URGENT: Ticket Opened Up for Annual Spring Gala!/i)).toBeInTheDocument();
    expect(screen.getByText(/24H CLAIM TIMER ACTIVE/i)).toBeInTheDocument();
  });

  it("triggers deep-link click callback and opens Stripe Checkout modal", () => {
    const handleDeepLink = vi.fn();
    render(
      <WaitlistPromotionPushWidget
        eventTitle="Annual Spring Gala"
        onDeepLinkClick={handleDeepLink}
      />
    );

    const triggerBtn = screen.getByRole("button", { name: /Trigger Waitlist Promotion Push/i });
    fireEvent.click(triggerBtn);

    const pushBanner = screen.getByText(/🚨 URGENT: Ticket Opened Up for Annual Spring Gala!/i).closest("div");
    if (pushBanner) fireEvent.click(pushBanner);

    expect(handleDeepLink).toHaveBeenCalledWith(
      expect.stringContaining("campusconnect://checkout?")
    );
    expect(screen.getByText("Stripe Checkout (Deep-Linked)")).toBeInTheDocument();
  });
});
