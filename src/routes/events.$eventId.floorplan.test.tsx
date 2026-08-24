import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const savedDoc = {
  assets: [
    {
      id: "asset_1",
      type: "rect_table",
      label: "Table 12",
      x: 2,
      y: 2,
      width: 6,
      height: 3,
      assignment: {
        sponsorId: "42",
        companyName: "TacoCorp",
        hiring_tags: ["Internship", "Software Engineer"],
      },
    },
    {
      id: "asset_2",
      type: "stage",
      label: "Stage 1",
      x: 40,
      y: 24,
      width: 20,
      height: 12,
      assignment: null,
    },
    {
      id: "asset_3",
      type: "round_table",
      label: "Table 30",
      x: 60,
      y: 8,
      width: 5,
      height: 5,
      assignment: {
        sponsorId: "99",
        companyName: "BitWorks",
        hiring_tags: ["Full-time", "Data Analyst"],
      },
    },
  ],
  venue: { width_ft: 100, height_ft: 60, fire_exits: [] },
  updatedAt: "2026-08-01T00:00:00Z",
};

const sb = vi.hoisted(() => ({
  eventsMaybeSingle: vi.fn(),
  updateEq: vi.fn(),
  rpc: vi.fn(),
}));

let updatePayload: unknown;

// Mock Supabase client before importing anything that pulls it in.
// A single client object backs both `createClient()` and the named `supabase`
// export (used by EventCapacityThermalMap, rendered in organizer mode).
vi.mock("@/lib/supabase/client", () => {
  const mockFrom = (table: string) => {
    if (table === "events") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: sb.eventsMaybeSingle,
          }),
        }),
        update: (payload: unknown) => {
          updatePayload = payload;
          return { eq: sb.updateEq };
        },
      };
    }
    return {
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    };
  };

  const channelChain = () => {
    const chain = {
      on: () => chain,
      subscribe: () => ({ unsubscribe: () => Promise.resolve("ok") }),
    };
    return chain;
  };

  const client = {
    from: mockFrom,
    rpc: sb.rpc,
    channel: channelChain,
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "organizer-1" } }, error: null }),
    },
  };

  return { createClient: () => client, supabase: client };
});

vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-site-shell">{children}</div>
  ),
}));

const loadPage = async () => {
  const mod = await import("./events.$eventId.floorplan");
  const EventFloorplanPage = mod.default;
  render(
    <MemoryRouter initialEntries={["/events/event-123/floorplan"]}>
      <Routes>
        <Route path="/events/:eventId/floorplan" element={<EventFloorplanPage />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("EventFloorplanPage (#4145)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePayload = undefined;
    sb.eventsMaybeSingle.mockResolvedValue({
      data: { title: "Engineering Career Fair", floorplan_json: savedDoc },
      error: null,
    });
    sb.updateEq.mockResolvedValue({ error: null });
    // #4375 introduced an organizer RPC check; the mocked user organizes this
    // event. Every other RPC (e.g. the capacity thermal map) returns rows.
    sb.rpc.mockImplementation((fn: string) =>
      fn === "is_event_organizer"
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: [], error: null }),
    );
  });

  it("renders the attendee map with the saved layout and sponsor directory", async () => {
    await loadPage();

    expect(
      await screen.findByRole("heading", { name: /Engineering Career Fair — Floor Plan/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-site-shell")).toBeInTheDocument();
    // Assets from the saved JSON are painted on the canvas
    expect(screen.getByTestId("floorplan-asset-asset_1")).toBeInTheDocument();
    expect(screen.getByTestId("floorplan-asset-asset_2")).toBeInTheDocument();
    // Sponsor directory lists the assigned company
    expect(screen.getByText(/TacoCorp is at Table 12/i)).toBeInTheDocument();
  });

  it("shows the callout when an attendee clicks a table", async () => {
    await loadPage();

    const table = await screen.findByTestId("floorplan-asset-asset_1");
    fireEvent.pointerDown(table);

    await waitFor(() => {
      expect(screen.getByTestId("attendee-callout")).toHaveTextContent(
        /TacoCorp is at Table 12 in the Northwest corner\./,
      );
    });
    expect(screen.getByText(/Sponsor ID: 42/)).toBeInTheDocument();
  });

  it("lets signed-in organizers open the editor with palette and inspector", async () => {
    await loadPage();

    // Organizer is signed in via mocked auth -> edit toggle appears
    const toggle = await screen.findByTestId("floorplan-edit-toggle");
    fireEvent.click(toggle);

    expect(await screen.findByTestId("floorplan-palette")).toBeInTheDocument();
    expect(screen.getByTestId("palette-chip-rect_table")).toBeInTheDocument();
    expect(screen.getByTestId("palette-chip-exit")).toBeInTheDocument();

    // Selecting the table opens the inspector pre-filled with its assignment
    fireEvent.pointerDown(screen.getByTestId("floorplan-asset-asset_1"));
    await waitFor(() => {
      expect(screen.getByTestId("floorplan-inspector")).toBeInTheDocument();
    });
    const nameInput = screen.getByTestId("inspector-sponsor-name") as HTMLInputElement;
    expect(nameInput.value).toBe("TacoCorp");
    const tagsInput = screen.getByTestId("inspector-hiring-tags") as HTMLInputElement;
    expect(tagsInput.value).toBe("Internship, Software Engineer");

    // Saving persists the whole document into events.floorplan_json
    fireEvent.click(screen.getByTestId("floorplan-save"));
    await waitFor(() => {
      expect(sb.updateEq).toHaveBeenCalled();
    });
    expect(updatePayload).toMatchObject({
      floorplan_json: expect.objectContaining({
        venue: expect.objectContaining({ width_ft: 100, height_ft: 60 }),
        assets: expect.arrayContaining([
          expect.objectContaining({
            id: "asset_1",
            type: "rect_table",
            assignment: expect.objectContaining({
              companyName: "TacoCorp",
              hiring_tags: ["Internship", "Software Engineer"],
            }),
          }),
        ]),
      }),
    });
    const [calledColumn, calledId] = sb.updateEq.mock.calls[0];
    expect(calledColumn).toBe("id");
    expect(calledId).toBe("event-123");
  });

  it("#4157: searching dims non-matching booths and pulses matches", async () => {
    await loadPage();

    await screen.findByTestId("floorplan-asset-asset_1");
    expect(screen.queryByTestId("floorplan-search-results")).not.toBeInTheDocument();

    // Typing "internship" should isolate TacoCorp's table...
    fireEvent.change(screen.getByTestId("floorplan-search"), {
      target: { value: "internship" },
    });

    const match = await screen.findByTestId("floorplan-asset-asset_1");
    expect(match).toHaveAttribute("data-pulse", "true");
    expect(match).not.toHaveAttribute("data-dimmed");
    // ...dim every other asset on the map...
    expect(screen.getByTestId("floorplan-asset-asset_2")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("floorplan-asset-asset_3")).toHaveAttribute("data-dimmed", "true");
    // ...and report the hit count.
    expect(screen.getByTestId("floorplan-search-results")).toHaveTextContent(
      /1 booth match .?internship/i,
    );

    // Clearing the query restores the unfiltered map
    fireEvent.change(screen.getByTestId("floorplan-search"), { target: { value: "  " } });
    expect(screen.getByTestId("floorplan-asset-asset_2")).not.toHaveAttribute("data-dimmed");
  });

  it("#4157: selecting a booth shows hiring tags plus Swag Bag and Lead Scanner links", async () => {
    await loadPage();

    const table = await screen.findByTestId("floorplan-asset-asset_3");
    fireEvent.pointerDown(table);

    const callout = await screen.findByTestId("attendee-callout");
    expect(callout).toHaveTextContent(/BitWorks is at Table 30/);

    // Hiring tags surface as chips
    const chips = screen.getAllByTestId("hiring-tag-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["Full-time", "Data Analyst"]);

    // Sponsor action links from #3932 (Swag Bag) and #4055 (Lead Scanner)
    const swag = screen.getByTestId("callout-swag-bag-link");
    expect(swag).toHaveAttribute("href", "/events/event-123/swag-bag?sponsor=99");
    const scanner = screen.getByTestId("callout-lead-scanner-link");
    expect(scanner).toHaveAttribute("href", "/sponsor/events/event-123?sponsor=99");
  });
});
