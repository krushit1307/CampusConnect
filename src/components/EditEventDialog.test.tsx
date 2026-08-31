import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { EditEventDialog } from "./EditEventDialog";

// Mock Supabase client
const mockSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "event_categories") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: "cat-1", name: "Tech" }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSingle }),
          }),
          update: mockUpdate,
        };
      }
      return {};
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      track: vi.fn(),
      presenceState: vi.fn().mockReturnValue({}),
    }),
  }),
}));

vi.mock("@/components/events/CollaborativeDescriptionEditor", () => ({
  default: ({ onChange }: any) => (
    <textarea
      placeholder="Event description"
      onChange={(e) => onChange(e.target.value)}
      data-testid="mock-collab-editor"
    />
  ),
}));

const mockUser = { id: "user-1" } as User;

const baseEvent = {
  id: "evt-1",
  title: "Hackathon 2024",
  description: "Original description",
  category_id: "cat-1",
  location: "Main Auditorium",
  start_date: "2026-09-15T10:00:00.000Z",
  end_date: "2026-09-15T11:00:00.000Z",
  tags: [] as string[],
  version: 1,
  version_vector: {},
};

function renderDialog() {
  return render(
    <QueryClientProvider client={queryClient}>
      <EditEventDialog event={baseEvent} user={mockUser} onSuccess={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("EditEventDialog Optimistic Concurrency Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a stale save (0 rows updated) and shows the merge conflict modal with the new DB state", async () => {
    // Pre-save merge fetch: server still on version 1 (no field conflict yet)
    mockSingle.mockResolvedValueOnce({
      data: { ...baseEvent, version: 1 },
      error: null,
    });

    // Capture the OCC predicates used on the UPDATE
    const predicates: { key: string; value: unknown }[] = [];
    mockUpdate.mockReturnValue({
      eq: vi.fn((key: string, value: unknown) => {
        predicates.push({ key, value });
        return {
          eq: vi.fn((key2: string, value2: unknown) => {
            predicates.push({ key: key2, value: value2 });
            return {
              select: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }),
        };
      }),
    });

    // UI recovery fetch: another admin already bumped the version to 2
    mockSingle.mockResolvedValueOnce({
      data: { ...baseEvent, description: "Server edited description", version: 2 },
      error: null,
    });

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Edit Event" }));
    fireEvent.change(await screen.findByPlaceholderText("Event description"), {
      target: { value: "My local edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    // The UPDATE must be guarded by id + version (optimistic locking)
    await waitFor(() => {
      expect(predicates).toContainEqual({ key: "version", value: 1 });
      expect(predicates).toContainEqual({ key: "id", value: "evt-1" });
    });

    // Conflict modal pops up showing exactly what the other admin changed
    await waitFor(() => {
      expect(screen.getByText("Concurrent Edit Conflict Detected")).toBeInTheDocument();
    });
    expect(screen.getByText("Server edited description")).toBeInTheDocument();
    expect(screen.getAllByText("My local edit").length).toBeGreaterThan(0);
  });

  it("saves successfully when the submitted version still matches the database", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...baseEvent, version: 1 },
      error: null,
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: "evt-1", version: 2 }],
            error: null,
          }),
        }),
      }),
    });

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Edit Event" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save Changes" }));

    // The save must write the next version (2) atomically in the update payload
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Hackathon 2024",
          description: "Original description",
          version: 2,
        }),
      );
    });

    // Dialog closes on success
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
    });
  });
});
