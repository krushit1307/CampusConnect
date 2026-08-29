import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  CampusSafetyIncidentReporterWidget,
  MOCK_ACTIVE_INCIDENT,
} from "./CampusSafetyIncidentReporterWidget";

describe("CampusSafetyIncidentReporterWidget Component (#4286)", () => {
  it("renders Campus Safety Incident Reporter header and emergency launcher button", () => {
    render(
      <CampusSafetyIncidentReporterWidget
        eventTitle="Campus Spring Music Concert"
      />
    );

    expect(screen.getByText(/Campus Safety Incident Reporter — Campus Spring Music Concert/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Report Emergency Incident/i })).toBeInTheDocument();
  });

  it("opens rapid triage modal and submits emergency incident report", () => {
    const handleSubmitted = vi.fn();
    render(
      <CampusSafetyIncidentReporterWidget
        eventTitle="Campus Spring Music Concert"
        onReportSubmitted={handleSubmitted}
      />
    );

    const openBtn = screen.getByRole("button", { name: /Report Emergency Incident/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole("heading", { name: /Rapid Triage Emergency Reporter/i })).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Dispatch High-Priority Alert & SMS/i });
    fireEvent.click(submitBtn);

    expect(handleSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "medical_emergency",
        status: "active",
      })
    );
  });

  it("renders organizer high-priority alert banner and Campus PD SMS link", () => {
    render(
      <CampusSafetyIncidentReporterWidget
        eventTitle="Campus Spring Music Concert"
        initialReport={MOCK_ACTIVE_INCIDENT}
      />
    );

    expect(screen.getByText(/ORGANIZER HIGH-PRIORITY ALERT: MEDICAL EMERGENCY ALERT/i)).toBeInTheDocument();
    expect(screen.getByText("Near North Stage")).toBeInTheDocument();
    expect(screen.getByText(/Open Direct Google Maps Location/i)).toBeInTheDocument();
  });
});
