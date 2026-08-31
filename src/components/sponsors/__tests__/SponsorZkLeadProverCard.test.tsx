// =============================================================================
// Component Tests: SponsorZkLeadProverCard
// Issue: #5130 - Real-Time "Sponsor Lead" CRM Webhook Zero-Knowledge Proof
// Description: RTL component tests for ZK lead proof generation UI, verified proxy badge,
// interview offer proxy box, and explicit PII release consent acceptance flow.
// =============================================================================

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SponsorZkLeadProverCard } from "../SponsorZkLeadProverCard";
import { globalSponsorZkLeadService } from "@/services/sponsorZkLeadService";

describe("SponsorZkLeadProverCard Component (#5130)", () => {
  beforeEach(() => {
    globalSponsorZkLeadService.clearAll();
  });

  afterEach(() => {
    globalSponsorZkLeadService.clearAll();
  });

  it("renders sponsor criteria, student data vault, and ZK privacy guarantee banner", () => {
    render(<SponsorZkLeadProverCard />);

    expect(screen.getByTestId("zk-lead-prover-card")).toBeInTheDocument();
    expect(screen.getByText(/Sponsor Lead CRM ZK Verification/i)).toBeInTheDocument();
    expect(screen.getByText(/Required Major:/i)).toBeInTheDocument();
    expect(screen.getByText(/Minimum GPA:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Computer Science/i).length).toBeGreaterThan(0);

    expect(screen.getByTestId("generate-zkp-btn")).toBeInTheDocument();
  });

  it("generates ZK proof and displays ZK Verified badge on click", async () => {
    render(<SponsorZkLeadProverCard />);

    const generateBtn = screen.getByTestId("generate-zkp-btn");

    await act(async () => {
      fireEvent.click(generateBtn);
    });

    expect(screen.getByTestId("zk-verified-badge")).toBeInTheDocument();
    expect(screen.getByText(/ZK Proof Verified by Sponsor CRM!/i)).toBeInTheDocument();
    expect(screen.getByText(/0 PII SHARED/i)).toBeInTheDocument();
  });

  it("handles interview offer simulation and explicit PII release consent acceptance", async () => {
    render(<SponsorZkLeadProverCard />);

    // 1. Generate ZK proof
    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-zkp-btn"));
    });

    // 2. Simulate sponsor sending offer via proxy
    const simulateLink = screen.getByText(/Simulate Sponsor Sending Interview Offer/i);
    act(() => {
      fireEvent.click(simulateLink);
    });

    expect(screen.getByTestId("interview-offer-box")).toBeInTheDocument();
    expect(screen.getByTestId("offer-status-badge")).toHaveTextContent("PENDING");
    expect(screen.getByText(/PII Release Warning:/i)).toBeInTheDocument();

    // 3. Student clicks Accept & Release Contact Info
    const acceptBtn = screen.getByTestId("accept-offer-btn");
    act(() => {
      fireEvent.click(acceptBtn);
    });

    expect(screen.getByTestId("offer-status-badge")).toHaveTextContent("ACCEPTED");
    expect(screen.getByTestId("pii-released-confirmation")).toBeInTheDocument();
    expect(screen.getByText(/Alex Johnson/i)).toBeInTheDocument();
    expect(screen.getByText(/alex.johnson@university.edu/i)).toBeInTheDocument();
  });
});
