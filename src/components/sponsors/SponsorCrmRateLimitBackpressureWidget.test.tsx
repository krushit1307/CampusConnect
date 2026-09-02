import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SponsorCrmRateLimitBackpressureWidget } from "./SponsorCrmRateLimitBackpressureWidget";

describe("SponsorCrmRateLimitBackpressureWidget Component (#5061)", () => {
  it("renders Sponsor CRM Rate Limit Backpressure header, metrics, and simulation controls", () => {
    render(
      <SponsorCrmRateLimitBackpressureWidget
        sponsorName="TechCorp Global (Salesforce CRM)"
      />
    );

    expect(screen.getByText(/"Sponsor Lead" CRM Webhook Rate Limit Backpressure — TechCorp Global \(Salesforce CRM\)/i)).toBeInTheDocument();
    expect(screen.getByText("Queue Rate & Throttling Metrics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Simulate HTTP 429 \(Retry-After: 60s\)/i })).toBeInTheDocument();
  });

  it("simulates HTTP 429 rate limit response and pauses SQS queue consumer", () => {
    const handleTriggered = vi.fn();
    render(<SponsorCrmRateLimitBackpressureWidget onBackpressureTriggered={handleTriggered} />);

    const btn429 = screen.getByRole("button", { name: /Simulate HTTP 429 \(Retry-After: 60s\)/i });
    fireEvent.click(btn429);

    expect(handleTriggered).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        backpressureTriggered: true,
        retryAfterSeconds: 60,
        nextThrottledRatePerSec: 5,
      })
    );

    expect(screen.getByText(/SQS CONSUMER PAUSED \(429\)/i)).toBeInTheDocument();
  });

  it("simulates HTTP 200 success response and resumes normal queue rate", () => {
    render(<SponsorCrmRateLimitBackpressureWidget />);

    const btn200 = screen.getByRole("button", { name: /Simulate HTTP 200 Success Response/i });
    fireEvent.click(btn200);

    expect(screen.getByText(/SQS CONSUMER ACTIVE/i)).toBeInTheDocument();
  });
});
