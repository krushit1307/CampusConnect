import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NoticeBoardOccupancy } from "./NoticeBoardOccupancy";
import {
  DEFAULT_PERMIT_POLICY,
  buildOccupancy,
  clubTakedownRecords,
  overdueTakedowns,
  peakOccupancyWindow,
  utilisationRate,
  type NoticeBoard,
  type PosterPermit,
} from "@/lib/noticeBoardPermits";

const mockUseNoticeBoardPermits = vi.fn();

vi.mock("@/hooks/useNoticeBoardPermits", () => ({
  useNoticeBoardPermits: (...args: unknown[]) => mockUseNoticeBoardPermits(...args),
  todayString: () => "2026-06-10",
}));

const RANGE_START = "2026-06-05";
const RANGE_END = "2026-06-14";
const TODAY = new Date("2026-06-10T09:00:00.000Z");

const BOARD: NoticeBoard = {
  id: "b1",
  name: "Canteen board",
  building: "Main block",
  locationDetail: "Outside the servery",
  slotCapacity: 3,
  isActive: true,
  requiresApproval: true,
};

function permit(
  id: string,
  startsOn: string,
  endsOn: string,
  overrides: Partial<PosterPermit> = {},
): PosterPermit {
  return {
    id,
    boardId: "b1",
    clubId: "club-a",
    clubName: "Debate Society",
    title: `Poster ${id}`,
    startsOn,
    endsOn,
    slotsRequested: 1,
    status: "approved",
    takedownOwnerName: "Meera Iyer",
    takenDownAt: null,
    ...overrides,
  };
}

function hookResult(permits: PosterPermit[] = [], overrides: Record<string, unknown> = {}) {
  const occupancy = buildOccupancy(BOARD, permits, RANGE_START, RANGE_END);
  return {
    board: BOARD,
    policy: DEFAULT_PERMIT_POLICY,
    permits,
    occupancy,
    pendingQueue: permits.filter((p) => p.status === "pending"),
    overdue: overdueTakedowns(permits, TODAY, DEFAULT_PERMIT_POLICY),
    clubRecords: clubTakedownRecords(permits, TODAY, DEFAULT_PERMIT_POLICY),
    peakWindow: peakOccupancyWindow(occupancy),
    utilisation: utilisationRate(occupancy),
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    checkRequest: vi.fn(),
    recordTakedown: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseNoticeBoardPermits.mockReset();
});

describe("NoticeBoardOccupancy", () => {
  it("shows a loading state", () => {
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([], { isLoading: true }));
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/Loading board occupancy/i)).toBeTruthy();
  });

  it("surfaces an error with a retry", async () => {
    const refresh = vi.fn();
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([], { error: "board missing", refresh }));
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);

    expect(screen.getByText(/board missing/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("handles a board that does not exist", () => {
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([], { board: null }));
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/This notice board could not be found/i)).toBeTruthy();
  });

  it("names the board with its location and capacity", () => {
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([]));
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);

    expect(screen.getByText("Canteen board")).toBeTruthy();
    expect(screen.getByText(/Main block · Outside the servery · 3 slots/)).toBeTruthy();
  });

  it("warns when the board is closed to new postings", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([], { board: { ...BOARD, isActive: false } }),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/not currently accepting postings/i)).toBeTruthy();
  });

  it("renders a daily occupancy strip labelled for assistive technology", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([permit("p1", "2026-06-06", "2026-06-09")]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByLabelText(/Daily occupancy for Canteen board/i)).toBeTruthy();
  });

  it("reports the busiest stretch of the range", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([
        permit("p1", "2026-06-06", "2026-06-12", { slotsRequested: 2 }),
        permit("p2", "2026-06-07", "2026-06-08", { slotsRequested: 1 }),
      ]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/Busiest stretch/)).toBeTruthy();
    expect(screen.getByText(/at 3 of 3 slots/)).toBeTruthy();
  });

  it("lists posters past their permit with the responsible owner", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([permit("stale", "2026-05-20", "2026-06-05")]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/1 poster past its permit/i)).toBeTruthy();
    expect(screen.getByText(/Meera Iyer to remove/)).toBeTruthy();
  });

  it("states that anything not listed is authorised to stay up", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([permit("stale", "2026-05-20", "2026-06-05")]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/Everything not on this list is authorised to stay up/i)).toBeTruthy();
  });

  it("records a takedown when the manager marks a poster removed", async () => {
    const recordTakedown = vi.fn();
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([permit("stale", "2026-05-20", "2026-06-05")], {
        recordTakedown,
      }),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);

    fireEvent.click(screen.getByRole("button", { name: /mark removed/i }));
    await waitFor(() => expect(recordTakedown).toHaveBeenCalledWith("stale"));
  });

  it("raises no overdue alert when every poster is current", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([permit("p1", "2026-06-06", "2026-06-20")]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the pending request queue with dates and slots", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([
        permit("req", "2026-06-12", "2026-06-14", {
          status: "pending",
          title: "Debate finals",
          slotsRequested: 2,
        }),
      ]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);

    expect(screen.getByText("Debate finals")).toBeTruthy();
    expect(screen.getByText(/Debate Society ·.*· 2 slots/)).toBeTruthy();
  });

  it("says plainly when nothing is awaiting a decision", () => {
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([]));
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/No requests are waiting for a decision/i)).toBeTruthy();
  });

  it("states the board's duration and concurrency limits", () => {
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([]));
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);
    expect(screen.getByText(/Permits run for at most 21 days/)).toBeTruthy();
  });

  it("surfaces a club with poor takedown compliance", () => {
    mockUseNoticeBoardPermits.mockReturnValue(
      hookResult([
        permit("late", "2026-04-01", "2026-04-10", {
          clubId: "bad",
          clubName: "Film Society",
        }),
      ]),
    );
    render(<NoticeBoardOccupancy boardId="b1" rangeStart={RANGE_START} rangeEnd={RANGE_END} />);

    expect(screen.getByText(/Takedown compliance/)).toBeTruthy();
    expect(screen.getByText(/Film Society has removed 0%/)).toBeTruthy();
  });

  it("passes the board and range through to the hook", () => {
    mockUseNoticeBoardPermits.mockReturnValue(hookResult([]));
    render(
      <NoticeBoardOccupancy boardId="board-9" rangeStart={RANGE_START} rangeEnd={RANGE_END} />,
    );
    expect(mockUseNoticeBoardPermits).toHaveBeenCalledWith("board-9", RANGE_START, RANGE_END);
  });
});
