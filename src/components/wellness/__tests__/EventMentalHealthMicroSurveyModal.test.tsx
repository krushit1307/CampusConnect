import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventMentalHealthMicroSurveyModal } from "../EventMentalHealthMicroSurveyModal";
import * as eventMentalHealthSurveyService from "@/services/eventMentalHealthSurveyService";

vi.mock("@/services/eventMentalHealthSurveyService", async () => {
  const actual = await vi.importActual<typeof eventMentalHealthSurveyService>("@/services/eventMentalHealthSurveyService");
  return {
    ...actual,
    submitMicroSurveyResponse: vi.fn(),
  };
});

describe("EventMentalHealthMicroSurveyModal Component", () => {
  const qualifyingEvent = {
    id: "evt-hackathon",
    title: "24-Hour Hackathon",
    tags: ["technology"],
    durationHours: 24,
  };

  const nonQualifyingEvent = {
    id: "evt-meeting",
    title: "Quick Club Meeting",
    tags: ["social"],
    durationHours: 1.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eventMentalHealthSurveyService.submitMicroSurveyResponse).mockResolvedValue({
      success: true,
      isCrisisEscalated: false,
    });
  });

  it("does NOT render when isOpen is false", () => {
    render(
      <EventMentalHealthMicroSurveyModal
        isOpen={false}
        onClose={vi.fn()}
        event={qualifyingEvent}
      />
    );
    expect(screen.queryByTestId("mental-health-survey-modal")).toBeNull();
  });

  it("does NOT render when event does NOT qualify for a mental health survey", () => {
    render(
      <EventMentalHealthMicroSurveyModal
        isOpen={true}
        onClose={vi.fn()}
        event={nonQualifyingEvent}
      />
    );
    expect(screen.queryByTestId("mental-health-survey-modal")).toBeNull();
  });

  it("renders micro-survey modal when event qualifies (> 12 hours)", () => {
    render(
      <EventMentalHealthMicroSurveyModal
        isOpen={true}
        onClose={vi.fn()}
        event={qualifyingEvent}
      />
    );

    expect(screen.getByTestId("mental-health-survey-modal")).toBeDefined();
    expect(screen.getByText("24-Hour Hackathon")).toBeDefined();
    expect(screen.getByTestId("stress-level-selector")).toBeDefined();
  });

  it("renders micro-survey modal when event is tagged as High Stress", () => {
    const highStressShortEvent = {
      id: "evt-finals",
      title: "Final Exam Prep",
      tags: ["High Stress"],
      durationHours: 2,
    };

    render(
      <EventMentalHealthMicroSurveyModal
        isOpen={true}
        onClose={vi.fn()}
        event={highStressShortEvent}
      />
    );

    expect(screen.getByTestId("mental-health-survey-modal")).toBeDefined();
  });

  it("submits micro-survey response on form submission", async () => {
    const handleSubmitted = vi.fn();
    render(
      <EventMentalHealthMicroSurveyModal
        isOpen={true}
        onClose={vi.fn()}
        event={qualifyingEvent}
        onSubmitted={handleSubmitted}
      />
    );

    // Select stress level 4
    fireEvent.click(screen.getByTestId("stress-level-btn-4"));

    // Click submit
    fireEvent.click(screen.getByTestId("submit-survey-button"));

    await waitFor(() => {
      expect(eventMentalHealthSurveyService.submitMicroSurveyResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "evt-hackathon",
          stressLevel: 4,
        })
      );
      expect(handleSubmitted).toHaveBeenCalledTimes(1);
    });
  });
});
