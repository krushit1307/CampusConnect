import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ResponderCoverageTimeline } from "./ResponderCoverageTimeline";
import {
  analyseCoverage,
  type CertificationLevel,
  type EventRiskTier,
  type ResponderCertification,
  type ResponderDuty,
} from "@/lib/responderCoverage";

const mockUseResponderCoverage = vi.fn();

vi.mock("@/hooks/useResponderCoverage", () => ({
  useResponderCoverage: (...args: unknown[]) => mockUseResponderCoverage(...args),
}));

const EVENT_START = "2026-06-10T14:00:00.000Z";
const EVENT_END = "2026-06-10T20:00:00.000Z";

const ASSESSMENT = {
  event_id: "e1",
  expected_attendance: 100,
  activity_risk: "sedentary" as const,
  derived_tier: "low" as EventRiskTier,
  override_tier: null,
  override_reason: null,
  coverage_starts_at: EVENT_START,
  coverage_ends_at: EVENT_END,
};

function duty(
  id: string,
  responderId: string,
  startsAt: string,
  endsAt: string,
  responderName = `Responder ${responderId}`,
): ResponderDuty {
  return {
    id,
    responderId,
    responderName,
    startsAt,
    endsAt,
    station: "Main gate",
  };
}

function cert(
  userId: string,
  level: CertificationLevel = "basic",
  expiresOn = "2027-01-01T00:00:00.000Z",
): ResponderCertification {
  return {
    id: `cert-${userId}-${expiresOn}`,
    userId,
    level,
    issuingBody: "Red Cross",
    issuedOn: "2025-01-01T00:00:00.000Z",
    expiresOn,
  };
}

function hookResult(
  duties: ResponderDuty[],
  certifications: ResponderCertification[],
  tier: EventRiskTier = "low",
  overrides: Record<string, unknown> = {},
) {
  return {
    assessment: ASSESSMENT,
    effectiveTier: tier,
    analysis: analyseCoverage(duties, certifications, EVENT_START, EVENT_END, tier),
    duties,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseResponderCoverage.mockReset();
});

describe("ResponderCoverageTimeline", () => {
  it("shows a loading state while coverage is checked", () => {
    mockUseResponderCoverage.mockReturnValue(hookResult([], [], "low", { isLoading: true }));
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(screen.getByText(/Checking responder coverage/i)).toBeTruthy();
  });

  it("surfaces an error with a retry", async () => {
    const refresh = vi.fn();
    mockUseResponderCoverage.mockReturnValue(
      hookResult([], [], "low", { error: "not authorised", refresh }),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);

    expect(screen.getByText(/not authorised/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("prompts for a safety assessment when none exists", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([], [], "low", {
        assessment: null,
        analysis: null,
        effectiveTier: null,
      }),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(screen.getByText(/No safety assessment has been recorded/i)).toBeTruthy();
  });

  it("declares a fully covered event compliant", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([duty("d1", "r1", EVENT_START, EVENT_END)], [cert("r1")]),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);

    expect(screen.getByText("Coverage is compliant")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("raises an alert and shows the gap window when cover breaks", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult(
        [
          duty("d1", "r1", "2026-06-10T14:00:00Z", "2026-06-10T16:00:00Z"),
          duty("d2", "r2", "2026-06-10T16:20:00Z", "2026-06-10T20:00:00Z"),
        ],
        [cert("r1"), cert("r2")],
      ),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Coverage is not compliant")).toBeTruthy();
    // Appears in both the verdict summary and the gap list header.
    expect(screen.getAllByText(/1 coverage gap/).length).toBeGreaterThan(0);
    expect(screen.getByText("No cover")).toBeTruthy();
    expect(screen.getByText(/No certified responder on duty for 20 min/)).toBeTruthy();
  });

  it("states the tier requirement in the header", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([duty("d1", "r1", EVENT_START, EVENT_END)], [cert("r1", "advanced")], "high"),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(screen.getByText(/requires 3 concurrent intermediate responders/i)).toBeTruthy();
  });

  it("labels an under-certified roster distinctly from an absent one", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([duty("d1", "r1", EVENT_START, EVENT_END)], [cert("r1", "basic")], "extreme"),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(screen.getByText("Under-certified")).toBeTruthy();
  });

  it("warns when a certification lapses mid-event", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult(
        [duty("d1", "r1", EVENT_START, EVENT_END, "Priya Nair")],
        [cert("r1", "basic", "2026-06-10T17:00:00.000Z")],
      ),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);

    expect(screen.getByText(/Certification lapses during this event/i)).toBeTruthy();
    expect(screen.getByText(/stop counting toward cover from that moment/i)).toBeTruthy();
  });

  it("flags a zero-overlap handover even though cover is continuous", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult(
        [
          duty("d1", "r1", EVENT_START, "2026-06-10T17:00:00Z"),
          duty("d2", "r2", "2026-06-10T17:00:00Z", EVENT_END),
        ],
        [cert("r1"), cert("r2")],
      ),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);

    expect(screen.getByText("Coverage is compliant")).toBeTruthy();
    expect(screen.getByText(/1 handover with no overlap/i)).toBeTruthy();
  });

  it("says plainly that an empty roster leaves the event uncovered", () => {
    mockUseResponderCoverage.mockReturnValue(hookResult([], []));
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(
      screen.getByText(/Nobody is rostered. The entire event window is uncovered/i),
    ).toBeTruthy();
  });

  it("lists each rostered responder with their station", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([duty("d1", "r1", EVENT_START, EVENT_END, "Arun Mehta")], [cert("r1")]),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);

    expect(screen.getByText("Arun Mehta")).toBeTruthy();
    expect(screen.getByText("Main gate")).toBeTruthy();
  });

  it("surfaces a manual tier override with its justification", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([duty("d1", "r1", EVENT_START, EVENT_END)], [cert("r1")], "high", {
        assessment: {
          ...ASSESSMENT,
          override_tier: "high" as EventRiskTier,
          override_reason: "Pyrotechnics licence in force",
        },
      }),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(screen.getByText(/Pyrotechnics licence in force/)).toBeTruthy();
  });

  it("describes the coverage band for assistive technology", () => {
    mockUseResponderCoverage.mockReturnValue(
      hookResult([duty("d1", "r1", EVENT_START, EVENT_END)], [cert("r1")]),
    );
    render(<ResponderCoverageTimeline eventId="e1" />);
    expect(screen.getByLabelText(/Coverage across the event window with 0 gaps/i)).toBeTruthy();
  });

  it("passes the event id through to the hook", () => {
    mockUseResponderCoverage.mockReturnValue(hookResult([], []));
    render(<ResponderCoverageTimeline eventId="event-12" />);
    expect(mockUseResponderCoverage).toHaveBeenCalledWith("event-12");
  });
});
