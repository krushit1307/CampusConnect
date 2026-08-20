import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import SettingsPage from "./settings";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "senior@student.edu" } } }),
      getSession: () => Promise.resolve({ data: { session: null } })
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  id: "user-1",
                  first_name: "Senior",
                  last_name: "Grad",
                  handle: "senior_g",
                  role: "student",
                  expected_graduation_date: "2026-05-15"
                },
                error: null
              })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null })
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null })
        })
      };
    }
  })
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: (opts: any) => {
    if (opts.queryKey[0] === "profile") {
      return {
        data: {
          id: "user-1",
          first_name: "Senior",
          last_name: "Grad",
          handle: "senior_g",
          role: "student",
          expected_graduation_date: "2026-05-15"
        },
        isLoading: false
      };
    }
    return { data: null, isLoading: false };
  }
}));

describe("Automated Alumni Transition expected_graduation_date UI (#3613)", () => {
  it("renders Expected Graduation Date input field and loads values in Settings profile forms", async () => {
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );

    // Verify graduation date label is in the form
    await waitFor(() => {
      expect(screen.getByText("Expected Graduation Date")).toBeInTheDocument();
    });

    // Verify default value populated from query
    const input = screen.getByLabelText("Expected Graduation Date") as HTMLInputElement;
    expect(input.value).toBe("2026-05-15");
  });
});
