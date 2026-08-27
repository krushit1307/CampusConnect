import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ShiftRiskDashboard } from "./ShiftRiskDashboard";

// The dashboard is a thin renderer over useVolunteerReliability. Mocking the
// hook keeps these tests about presentation — the scoring maths has its own
// suite in src/lib/volunteerReliability.test.ts.
const mockUseVolunteerReliability = vi.fn();

vi.mock("@/hooks/useVolunteerReliability", () => ({
  useVolunteerReliability: (...args: unknown[]) => mockUseVolunteerReliability(...args),
}));

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    forecasts: [],
    profiles: new Map(),
    volunteers: [],
    atRiskVolunteers: [],
    understaffedShifts: [],
    totalForecastGap: 0,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  };
}

function forecast(overrides: Record<string, unknown> = {}) {
  return {
    shiftId: "s1",
    shiftTitle: "Registration desk",
    startTime: "2026-06-10T09:00:00.000Z",
    endTime: "2026-06-10T12:00:00.000Z",
    capacity: 4,
    signupCount: 6,
    expectedAttendance: 3.4,
    forecastGap: 0.6,
    risk: "thin",
    recommendedBackups: 1,
    shakyAssigneeIds: ["u2"],
    ...overrides,
  };
}

function volunteer(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u2",
    displayName: "Priya Nair",
    avatarUrl: null,
    profile: {
      userId: "u2",
      score: 0.42,
      band: "at_risk",
      weightedTotal: 4,
      weightedCredit: 1.7,
      counts: {
        attended: 2,
        late: 0,
        no_show: 3,
        excused: 0,
        cancelled_in_time: 0,
      },
      countedOutcomes: 5,
      currentNoShowStreak: 2,
      currentAttendedStreak: 0,
      isProvisional: false,
      lastOutcomeAt: "2026-05-30T00:00:00.000Z",
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockUseVolunteerReliability.mockReset();
});

describe("ShiftRiskDashboard", () => {
  it("shows a loading state while the forecast is being computed", () => {
    mockUseVolunteerReliability.mockReturnValue(baseResult({ isLoading: true }));
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/Forecasting shift attendance/i)).toBeTruthy();
  });

  it("surfaces the error and offers a retry", async () => {
    const refresh = vi.fn();
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({ error: "permission denied", refresh }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);

    expect(screen.getByText(/permission denied/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("renders an empty state when the event has no shifts", () => {
    mockUseVolunteerReliability.mockReturnValue(baseResult());
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/No volunteer shifts have been created/i)).toBeTruthy();
  });

  it("leads with forecast attendance rather than the signup count", () => {
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({
        forecasts: [forecast()],
        understaffedShifts: [forecast()],
        totalForecastGap: 0.6,
      }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);

    expect(screen.getByText("Registration desk")).toBeTruthy();
    expect(screen.getByText("3.4")).toBeTruthy();
    // "6 signed up" appears both in the count column and in the explanation.
    expect(screen.getAllByText(/6 signed up/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Thin/)).toBeTruthy();
  });

  it("tells the coordinator how many backups to recruit", () => {
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({
        forecasts: [forecast({ recommendedBackups: 3 })],
      }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/Recruit 3 backups/i)).toBeTruthy();
  });

  it("uses the singular form for a single backup", () => {
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({ forecasts: [forecast({ recommendedBackups: 1 })] }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/Recruit 1 backup to close/i)).toBeTruthy();
  });

  it("marks a fully staffed shift as needing no action", () => {
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({
        forecasts: [
          forecast({
            risk: "healthy",
            forecastGap: 0,
            recommendedBackups: 0,
            expectedAttendance: 4.2,
          }),
        ],
      }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/No action needed/i)).toBeTruthy();
  });

  it("lists at-risk assignees with their record and streak", () => {
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({
        forecasts: [forecast()],
        volunteers: [volunteer()],
        atRiskVolunteers: [volunteer()],
      }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);

    expect(screen.getByText("Priya Nair")).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText(/2 attended · 3 missed · 2 in a row/)).toBeTruthy();
  });

  it("toggles between at-risk assignees and the full roster", () => {
    const reliable = volunteer({
      userId: "u9",
      displayName: "Arun Mehta",
      profile: { ...volunteer().profile, userId: "u9", score: 0.96, band: "exemplary" },
    });
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({
        forecasts: [forecast()],
        volunteers: [volunteer(), reliable],
        atRiskVolunteers: [volunteer()],
      }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);

    expect(screen.queryByText("Arun Mehta")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show everyone/i }));
    expect(screen.getByText("Arun Mehta")).toBeTruthy();
  });

  it("reassures the coordinator when nobody needs chasing", () => {
    mockUseVolunteerReliability.mockReturnValue(
      baseResult({ forecasts: [forecast({ risk: "healthy" })] }),
    );
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/Every assignee on this event has a solid/i)).toBeTruthy();
  });

  it("states that scores are never shown to volunteers", () => {
    mockUseVolunteerReliability.mockReturnValue(baseResult({ forecasts: [forecast()] }));
    render(<ShiftRiskDashboard eventId="e1" clubId="c1" />);
    expect(screen.getByText(/never shown to the volunteers themselves/i)).toBeTruthy();
  });

  it("passes the event and club through to the hook", () => {
    mockUseVolunteerReliability.mockReturnValue(baseResult());
    render(<ShiftRiskDashboard eventId="event-7" clubId="club-3" />);
    expect(mockUseVolunteerReliability).toHaveBeenCalledWith("event-7", "club-3");
  });
});
