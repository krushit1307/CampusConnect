import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import SettingsPage from "./settings";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "test@campus.edu" } } }),
      getSession: () => Promise.resolve({ data: { session: { access_token: "token-1" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "user-1" } }),
          maybeSingle: () => Promise.resolve({ data: { user_id: "user-1", birth_date: "2000-01-01", share_birthday: true } }),
        }),
      }),
    }),
  }),
}));

// Mock useTheme hook
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "profile") {
      return { data: { id: "user-1", first_name: "John", last_name: "Doe" }, isLoading: false, refetch: vi.fn() };
    }
    if (queryKey[0] === "user_private_details") {
      return { data: { user_id: "user-1", birth_date: "2000-01-01", share_birthday: true }, isLoading: false, refetch: vi.fn() };
    }
    return { data: null, isLoading: false, refetch: vi.fn() };
  },
}));

describe("SettingsPage - Birthday Privacy Settings (#3276)", () => {
  it("renders birthday settings panel and options correctly", async () => {
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    // Wait for the component to render and find the Birthday Settings panel
    expect(await screen.findByText("Birthday Settings (Privacy Controls)")).toBeInTheDocument();
    expect(screen.getByText("Birth Date")).toBeInTheDocument();
    expect(screen.getByText("Opt-In to Share")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Birthday Settings" })).toBeInTheDocument();
  });
});
