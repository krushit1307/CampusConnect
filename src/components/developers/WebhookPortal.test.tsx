import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WebhookPortal, MOCK_INITIAL_ENDPOINTS, MOCK_INITIAL_DELIVERIES } from "./WebhookPortal";

describe("WebhookPortal Component (#3543)", () => {
  it("renders Webhook Portal header and registered endpoints", () => {
    render(
      <WebhookPortal
        clubName="Computer Science Society"
        initialEndpoints={MOCK_INITIAL_ENDPOINTS}
        initialDeliveries={MOCK_INITIAL_DELIVERIES}
      />
    );

    expect(screen.getByText(/Developer Webhook Subscriptions Portal — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText(/discord\.com\/api\/webhooks/i)).toBeInTheDocument();
    expect(screen.getAllByText("rsvp.created").length).toBeGreaterThan(0);
  });

  it("opens add webhook endpoint modal", () => {
    render(
      <WebhookPortal
        clubName="Computer Science Society"
        initialEndpoints={MOCK_INITIAL_ENDPOINTS}
      />
    );

    const addBtn = screen.getByRole("button", { name: /Add Webhook Endpoint/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Register New Webhook Endpoint")).toBeInTheDocument();
    expect(screen.getByLabelText(/Callback Endpoint URL \*/i)).toBeInTheDocument();
  });

  it("sends test ping and displays HMAC SHA-256 signature confirmation", () => {
    render(
      <WebhookPortal
        clubName="Computer Science Society"
        initialEndpoints={MOCK_INITIAL_ENDPOINTS}
      />
    );

    const testPingBtn = screen.getByRole("button", { name: /Test Ping/i });
    fireEvent.click(testPingBtn);

    expect(screen.getByText(/Test ping delivered/i)).toBeInTheDocument();
    expect(screen.getByText(/Signature: t=/i)).toBeInTheDocument();
  });

  it("allows deleting a webhook endpoint", () => {
    const handleDelete = vi.fn();
    render(
      <WebhookPortal
        clubName="Computer Science Society"
        initialEndpoints={MOCK_INITIAL_ENDPOINTS}
        onDeleteEndpoint={handleDelete}
      />
    );

    const deleteBtn = screen.getByTitle("Delete endpoint");
    fireEvent.click(deleteBtn);

    expect(handleDelete).toHaveBeenCalledWith("ep-1");
  });
});
