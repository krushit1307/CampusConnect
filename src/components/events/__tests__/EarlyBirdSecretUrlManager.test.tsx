import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EarlyBirdSecretUrlManager } from "../EarlyBirdSecretUrlManager";

describe("EarlyBirdSecretUrlManager Component", () => {
  it("renders secret link manager title, generator form, and active tokens list", () => {
    render(<EarlyBirdSecretUrlManager eventId="evt-100" eventTitle="Test Concert" isOrganizer={true} />);

    expect(screen.getByTestId("early-bird-secret-url-manager")).toBeDefined();
    expect(screen.getByText(/Secret Early Bird Link Manager/i)).toBeDefined();
    expect(screen.getByTestId("secret-url-generator-form")).toBeDefined();
  });

  it("generates a new secret URL when form is submitted", () => {
    render(<EarlyBirdSecretUrlManager eventId="evt-100" isOrganizer={true} />);

    const discountInput = screen.getByTestId("input-discount-percent");
    fireEvent.change(discountInput, { target: { value: "40" } });

    const submitBtn = screen.getByTestId("create-secret-url-btn");
    fireEvent.click(submitBtn);

    expect(screen.getByText("40% OFF Early Bird Link")).toBeDefined();
  });

  it("renders attendee secret claim banner when activeSecretToken prop is provided", () => {
    render(
      <EarlyBirdSecretUrlManager
        eventId="evt-100"
        isOrganizer={false}
        activeSecretToken="eb_sec_demo_12345"
      />
    );

    expect(screen.getByTestId("attendee-secret-claim-banner")).toBeDefined();
  });
});
