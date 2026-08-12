import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getEventRsvpState } from "@/lib/waitlist";
import { EventSocialProofToasts } from "./EventSocialProofToasts";

// Render framer-motion elements as plain nodes so exit animations (driven by
// requestAnimationFrame) don't keep expired toasts mounted under fake timers.
vi.mock("framer-motion", async () => {
  const { Fragment, createElement } = await import("react");

  const MotionDiv = (props: Record<string, unknown>) => {
    const { children, ...rest } = props;
    return createElement(
      "div",
      rest as React.HTMLAttributes<HTMLDivElement>,
      children as ReactNode,
    );
  };

  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) =>
      createElement(Fragment, null, children),
    motion: { div: MotionDiv },
  };
});

type RsvpPayload = { eventType: string; new: Record<string, unknown> };
type RecentRsvp = { id: string; user_id: string; status: string; rsvp_at: string };

const { supabaseMocks, buildClient } = vi.hoisted(() => {
  const buildClient = () => ({
    channel: () => ({
      on: (_event: string, _cfg: unknown, handler: (payload: RsvpPayload) => void) => {
        supabaseMocks.rsvpHandler = handler;
        return { subscribe: supabaseMocks.subscribe };
      },
      subscribe: supabaseMocks.subscribe,
    }),
    removeChannel: supabaseMocks.removeChannel,
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from,
  });

  return {
    supabaseMocks: {
      rsvpHandler: undefined as undefined | ((payload: RsvpPayload) => void),
      subscribe: vi.fn(),
      removeChannel: vi.fn(),
      getUser: vi.fn(),
      profile: null as { full_name: string | null } | null,
      profileByUser: {} as Record<string, { full_name: string | null }>,
      recentRsvps: [] as RecentRsvp[],
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: (_col: string, userId: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: supabaseMocks.profileByUser[userId] ?? supabaseMocks.profile,
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: supabaseMocks.recentRsvps, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }),
    },
    buildClient,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: buildClient,
  supabase: buildClient(),
}));

vi.mock("@/lib/waitlist", () => ({
  getEventRsvpState: vi.fn(),
}));

const mockedGetEventRsvpState = vi.mocked(getEventRsvpState);

const defaultCapacityState = {
  max_attendees: 100,
  is_resume_required: false,
  attending_count: 10,
  waitlist_count: 0,
  is_full: false,
  user_status: null,
  user_waitlist_position: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  supabaseMocks.rsvpHandler = undefined;
  supabaseMocks.profile = { full_name: "Alex" };
  supabaseMocks.profileByUser = {};
  supabaseMocks.recentRsvps = [];
  supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "current-user" } }, error: null });
  mockedGetEventRsvpState.mockResolvedValue(defaultCapacityState);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const fireRsvp = (id: string, userId: string) => {
  supabaseMocks.rsvpHandler?.({
    eventType: "INSERT",
    new: { id, user_id: userId, status: "attending", rsvp_at: "2026-08-12T10:00:00.000Z" },
  });
};

describe("EventSocialProofToasts", () => {
  it("shows a toast with the attendee's name when a new RSVP arrives", async () => {
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => fireRsvp("rsvp-1", "user-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});

    expect(screen.getByText("Alex just RSVP'd!")).toBeInTheDocument();
  });

  it("aggregates a burst of RSVPs into a single toast", async () => {
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => {
      fireRsvp("rsvp-1", "user-1");
      fireRsvp("rsvp-2", "user-2");
      fireRsvp("rsvp-3", "user-3");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});

    expect(screen.getByText("3 people just RSVP'd!")).toBeInTheDocument();
  });

  it("deduplicates replayed RSVP events by row id", async () => {
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => fireRsvp("rsvp-1", "user-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});
    expect(screen.getByText("Alex just RSVP'd!")).toBeInTheDocument();

    // Let the toast expire, then replay the same row — nothing should appear.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(screen.queryByText("Alex just RSVP'd!")).not.toBeInTheDocument();

    act(() => fireRsvp("rsvp-1", "user-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});
    expect(screen.queryByText("Alex just RSVP'd!")).not.toBeInTheDocument();
  });

  it("falls back to an anonymous message when a profile cannot be resolved", async () => {
    supabaseMocks.profile = null;
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => fireRsvp("rsvp-1", "user-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});

    expect(screen.getByText("Someone just RSVP'd!")).toBeInTheDocument();
  });

  it("does not toast the current user's own RSVP", async () => {
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => fireRsvp("rsvp-me", "current-user"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});

    expect(screen.queryByText("Alex just RSVP'd!")).not.toBeInTheDocument();
  });

  it("shows queued toasts one at a time, in order", async () => {
    supabaseMocks.profileByUser = {
      "user-1": { full_name: "Alex" },
      "user-2": { full_name: "Riley" },
    };
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => fireRsvp("rsvp-1", "user-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    await act(async () => {});
    expect(screen.getByText("Alex just RSVP'd!")).toBeInTheDocument();

    // A second RSVP arrives while the first toast is still on screen.
    act(() => fireRsvp("rsvp-2", "user-2"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {});
    expect(screen.queryByText("Riley just RSVP'd!")).not.toBeInTheDocument();

    // The first toast expires, then the queued one takes its place.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    await act(async () => {});
    expect(screen.queryByText("Alex just RSVP'd!")).not.toBeInTheDocument();
    expect(screen.getByText("Riley just RSVP'd!")).toBeInTheDocument();
  });

  it("clears the capacity warning when cancellations free up spots", async () => {
    mockedGetEventRsvpState
      .mockResolvedValueOnce({
        ...defaultCapacityState,
        max_attendees: 10,
        attending_count: 7,
      })
      .mockResolvedValueOnce({
        ...defaultCapacityState,
        max_attendees: 10,
        attending_count: 3,
      });
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});
    expect(screen.getByText("Only 3 spots left!")).toBeInTheDocument();

    act(() => {
      supabaseMocks.rsvpHandler?.({
        eventType: "DELETE",
        new: null,
        old: { id: "rsvp-cancelled", user_id: "user-1", status: "attending" },
      });
    });
    await act(async () => {});
    expect(screen.queryByText("Only 3 spots left!")).not.toBeInTheDocument();
    expect(screen.queryByText(/spots left/)).not.toBeInTheDocument();
  });

  it("shows a persistent warning when few spots remain", async () => {
    mockedGetEventRsvpState.mockResolvedValue({
      ...defaultCapacityState,
      max_attendees: 10,
      attending_count: 7,
    });
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    expect(screen.getByText("Only 3 spots left!")).toBeInTheDocument();
  });

  it("does not show a warning when plenty of spots remain", async () => {
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    expect(screen.queryByText("Only 3 spots left!")).not.toBeInTheDocument();
  });

  it("replays recent RSVPs on a stagger when there is no live activity", async () => {
    supabaseMocks.recentRsvps = [
      {
        id: "rsvp-old-1",
        user_id: "user-old-1",
        status: "attending",
        rsvp_at: "2026-08-12T09:30:00.000Z",
      },
      {
        id: "rsvp-old-2",
        user_id: "user-old-2",
        status: "attending",
        rsvp_at: "2026-08-12T09:45:00.000Z",
      },
    ];
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    // 5s grace period elapses with no live activity -> first fallback toast.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    await act(async () => {});
    expect(screen.getByText("Alex just RSVP'd!")).toBeInTheDocument();

    // +10s -> second fallback toast (the first one has expired after 4s).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    await act(async () => {});
    expect(screen.getByText("Alex just RSVP'd!")).toBeInTheDocument();
  });

  it("skips the fallback replay once live RSVP activity arrives", async () => {
    supabaseMocks.recentRsvps = [
      {
        id: "rsvp-old-1",
        user_id: "user-old-1",
        status: "attending",
        rsvp_at: "2026-08-12T09:30:00.000Z",
      },
    ];
    render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    act(() => fireRsvp("rsvp-live", "user-live"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    await act(async () => {});
    // The live toast is still on screen at this point; the fallback must not add more.
    expect(screen.getByText("Alex just RSVP'd!")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    await act(async () => {});
    expect(screen.queryByText("Alex just RSVP'd!")).not.toBeInTheDocument();
  });

  it("removes the realtime channel on unmount", async () => {
    const { unmount } = render(<EventSocialProofToasts eventId="evt-1" />);
    await act(async () => {});

    unmount();

    expect(supabaseMocks.removeChannel).toHaveBeenCalled();
  });
});
