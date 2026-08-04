import { renderHook, act } from "@testing-library/react";
import { useEventTasks } from "./useEventTasks";
import { QueryClientProvider, queryClient } from "./useReactQueryReplacement";
import React from "react";

// Mock Supabase Client
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            event_id: "evt-123",
            name: "Book Venue",
            start_date: "2026-08-01T00:00:00Z",
            end_date: "2026-08-03T00:00:00Z",
            progress: 50,
            dependencies: [],
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
        ],
        error: null,
      }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    }),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useEventTasks Hook", () => {
  it("initializes and fetches event tasks", async () => {
    const { result } = renderHook(() => useEventTasks("evt-123"), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });
});
