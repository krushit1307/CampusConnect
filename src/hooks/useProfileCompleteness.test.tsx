import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { useProfileCompleteness } from "./useProfileCompleteness";

let mockProfile: Record<string, unknown> | null = {};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        }),
      }),
    })),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderCompleteness = (userId: string | null) =>
  renderHook(() => useProfileCompleteness(userId), { wrapper });

beforeEach(() => {
  queryClient.clear();
  mockProfile = {};
});

describe("useProfileCompleteness (#2389)", () => {
  it("scores 100 when every profile field is filled", async () => {
    mockProfile = {
      avatar_url: "https://example.com/a.png",
      bio: "hello",
      college: "Engineering",
      skills: ["react"],
    };

    const { result } = renderCompleteness("user-1");
    await waitFor(() => expect(result.current.data).toBe(100));
  });

  it("scores partially when only half the fields are filled", async () => {
    mockProfile = { avatar_url: "https://example.com/a.png", bio: "hello" };

    const { result } = renderCompleteness("user-1");
    await waitFor(() => expect(result.current.data).toBe(50));
  });

  it("scores 0 for an empty profile row", async () => {
    const { result } = renderCompleteness("user-1");
    await waitFor(() => expect(result.current.data).toBe(0));
  });

  it("is disabled without a user and never fetches", () => {
    const { result } = renderCompleteness(null);
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("treats an empty skills array as incomplete interests", async () => {
    mockProfile = {
      avatar_url: "https://example.com/a.png",
      bio: "hello",
      college: "Engineering",
      skills: [],
    };

    const { result } = renderCompleteness("user-1");
    await waitFor(() => expect(result.current.data).toBe(75));
  });
});
