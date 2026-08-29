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
  venue: {
    width_ft: 100,
    height_ft: 60,
    fire_exits: [],
    // #4420 static accessibility features authored by the venue manager
    accessibility_pois: [
      { id: "poi_ramp", kind: "ramp", label: "North Ramp", x_ft: 20, y_ft: 2 },
      { id: "poi_stairs", kind: "stairs", label: "Grand Stairs", x_ft: 50, y_ft: 0 },
    ],
  },
  updatedAt: "2026-08-01T00:00:00Z",
};

const sb = vi.hoisted(() => ({
  eventsMaybeSingle: vi.fn(),
  profilesMaybeSingle: vi.fn(),
  updateEq: vi.fn(),
  rpc: vi.fn(),
  corporateSponsorships: vi.fn(),
  sponsorTableBids: vi.fn(),
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
    if (table === "profiles") {
      // #4420: requires_wheelchair_access drives the accessibility overlay
      return {
        select: () => ({
          eq: () => ({ maybeSingle: sb.profilesMaybeSingle }),
        }),
      };
    }
    if (table === "corporate_sponsorships") {
      return {
        select: () => ({
          eq: sb.corporateSponsorships,
        }),
      };
    }
    if (table === "sponsor_table_bids") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: sb.sponsorTableBids,
              }),
            }),
          }),
        }),
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
    // #4420: default profile has no accessibility flag
    sb.profilesMaybeSingle.mockResolvedValue({ data: null, error: null });
    sb.updateEq.mockResolvedValue({ error: null });
    sb.corporateSponsorships.mockResolvedValue({ data: [], error: null });
    sb.sponsorTableBids.mockResolvedValue({ data: null, error: null });
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

describe("EventFloorplanPage accessibility overlay (#4420)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePayload = undefined;
    sb.eventsMaybeSingle.mockResolvedValue({
      data: { title: "Engineering Career Fair", floorplan_json: savedDoc },
      error: null,
    });
    sb.profilesMaybeSingle.mockResolvedValue({ data: null, error: null });
    sb.updateEq.mockResolvedValue({ error: null });
    sb.rpc.mockImplementation((fn: string) =>
      fn === "is_event_organizer"
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: [], error: null }),
    );
  });

  it("hides POIs for attendees until accessible routes are enabled", async () => {
    await loadPage();

    await screen.findByTestId("floorplan-asset-asset_1");
    // Toggle starts off; no blue markers on the attendee map
    expect(screen.getByTestId("a11y-mode-toggle")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("a11y-poi-poi_ramp")).not.toBeInTheDocument();

    // Enabling the view reveals POIs and dims the stairs
    fireEvent.click(screen.getByTestId("a11y-mode-toggle"));
    const ramp = await screen.findByTestId("a11y-poi-poi_ramp");
    expect(ramp).toHaveAttribute("data-accessible", "true");
    expect(ramp).not.toHaveAttribute("data-dimmed");
    const stairs = screen.getByTestId("a11y-poi-poi_stairs");
    expect(stairs).toHaveAttribute("data-accessible", "false");
    expect(stairs).toHaveAttribute("data-dimmed", "true");
  });

  it("auto-enables for requires_wheelchair_access profiles and routes to a searched booth", async () => {
    // profiles.requires_wheelchair_access = true (#4044 column)
    sb.profilesMaybeSingle.mockResolvedValue({
      data: { requires_wheelchair_access: true },
      error: null,
    });
    await loadPage();

    const toggle = await screen.findByTestId("a11y-mode-toggle");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    // No target yet -> the panel explains what is missing
    expect(await screen.findByTestId("a11y-empty-note")).toBeInTheDocument();

    // Searching isolates TacoCorp's table and draws the street->ramp->booth polyline
    fireEvent.change(screen.getByTestId("floorplan-search"), {
      target: { value: "internship" },
    });
    const route = await screen.findByTestId("a11y-route");
    expect(route).toHaveTextContent("STREET");

    const summary = screen.getByTestId("a11y-route-summary");
    expect(summary).toHaveTextContent(/via your ramp/i);
    expect(summary).not.toHaveTextContent(/not mapped yet/i);
  });

  it("#4420: lets organizers place accessibility POIs and persist them in the venue JSON", async () => {
    await loadPage();

    fireEvent.click(await screen.findByTestId("floorplan-edit-toggle"));
    await screen.findByTestId("floorplan-palette");

    // The dedicated accessibility palette exists with all four kinds
    expect(screen.getByTestId("a11y-palette")).toBeInTheDocument();
    expect(screen.getByTestId("palette-chip-ramp")).toBeInTheDocument();
    expect(screen.getByTestId("palette-chip-elevator")).toBeInTheDocument();
    expect(screen.getByTestId("palette-chip-ada_bathroom")).toBeInTheDocument();
    expect(screen.getByTestId("palette-chip-stairs")).toBeInTheDocument();

    // Existing fixture POIs render in editor mode and are selectable
    fireEvent.pointerDown(screen.getByTestId("a11y-poi-poi_ramp"));
    const inspector = await screen.findByTestId("a11y-poi-inspector");
    expect(inspector).toHaveTextContent(/Accessibility Point — Ramp/i);

    // Dropping another ramp grows the venue JSON on save
    fireEvent.click(screen.getByTestId("palette-chip-ramp"));
    fireEvent.click(screen.getByTestId("floorplan-save"));
    await waitFor(() => {
      expect(sb.updateEq).toHaveBeenCalled();
    });
    const doc = (updatePayload as { floorplan_json: { venue: { accessibility_pois: unknown[] } } })
      .floorplan_json.venue;
    expect(doc.accessibility_pois).toHaveLength(3);
  });

  it("renders the bidding section when an attendee selects a table node", async () => {
    sb.corporateSponsorships.mockResolvedValue({
      data: [
        {
          id: "spon-123",
          company_name: "TacoCorp",
          company_logo_url: "logo.png",
          company_website_url: "taco.com",
        },
      ],
      error: null,
    });
    await loadPage();

    const table = await screen.findByTestId("floorplan-asset-asset_1");
    fireEvent.pointerDown(table);

    expect(await screen.findByTestId("bidding-section")).toBeInTheDocument();
    expect(screen.getByText(/Booth Bidding/i)).toBeInTheDocument();
    expect(screen.getByTestId("bid-amount-input")).toBeInTheDocument();
    expect(screen.getByTestId("place-bid-btn")).toBeInTheDocument();
  });
});
