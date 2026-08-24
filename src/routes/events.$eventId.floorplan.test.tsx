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
      assignment: { sponsorId: "42", companyName: "TacoCorp" },
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
  ],
  venue: { width_ft: 100, height_ft: 60, fire_exits: [] },
  updatedAt: "2026-08-01T00:00:00Z",
};

const sb = vi.hoisted(() => ({
  eventsMaybeSingle: vi.fn(),
  updateEq: vi.fn(),
}));

let updatePayload: unknown;

// Mock Supabase client before importing anything that pulls it in
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

  return {
    createClient: () => ({
      from: mockFrom,
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "organizer-1" } }, error: null }),
      },
    }),
  };
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

    // Saving persists the whole document into events.floorplan_json
    fireEvent.click(screen.getByTestId("floorplan-save"));
    await waitFor(() => {
      expect(sb.updateEq).toHaveBeenCalled();
    });
    expect(updatePayload).toMatchObject({
      floorplan_json: expect.objectContaining({
        venue: expect.objectContaining({ width_ft: 100, height_ft: 60 }),
        assets: expect.arrayContaining([
          expect.objectContaining({ id: "asset_1", type: "rect_table" }),
        ]),
      }),
    });
    const [calledColumn, calledId] = sb.updateEq.mock.calls[0];
    expect(calledColumn).toBe("id");
    expect(calledId).toBe("event-123");
  });
});
