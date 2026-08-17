import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "./settings";
import { ThemeProvider } from "@/components/theme-provider";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();

// Mock react-router-dom's useBlocker
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useBlocker: () => ({ state: "unblocked" }),
  };
});

// Mock react-query hook wrapper to return data synchronously and prevent JSDOM test hangs
vi.mock("@/hooks/useReactQueryReplacement", () => {
  return {
    useQuery: ({ queryKey }: { queryKey: any[] }) => {
      if (queryKey[0] === "profile") {
        return {
          data: {
            id: "user-123",
            first_name: "Alex",
            last_name: "Rivera",
            handle: "alexr",
            avatar_theme: "peach",
            skills: ["React"],
            role: "student",
          },
          isLoading: false,
          status: "success",
          fetchStatus: "idle",
        };
      }
      if (queryKey[0] === "user_preferences") {
        return {
          data: {
            user_id: "user-123",
            timezone: "America/New_York",
            quiet_hours_start: "22:00:00",
            quiet_hours_end: "07:00:00",
          },
          isLoading: false,
          status: "success",
          fetchStatus: "idle",
        };
      }
      if (queryKey[0] === "user_badges") {
        return { data: [], isLoading: false, status: "success" };
      }
      if (queryKey[0] === "latest_export_job") {
        return { data: null, isLoading: false, status: "success" };
      }
      return { data: null, isLoading: false, status: "success" };
    },
    useMutation: () => ({
      mutate: () => {},
      isLoading: false,
    }),
    QueryClientProvider: ({ children }: any) => children,
    queryClient: {
      clear: () => {},
      setDefaultOptions: () => {},
    },
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({
      mutate: () => {},
      isLoading: false,
    }),
    useQuery: ({ queryKey }: { queryKey: any[] }) => {
      if (queryKey[0] === "profile") {
        return {
          data: {
            id: "user-123",
            first_name: "Alex",
            last_name: "Rivera",
            handle: "alexr",
            avatar_theme: "peach",
            skills: ["React"],
            role: "student",
          },
          isLoading: false,
          status: "success",
          fetchStatus: "idle",
        };
      }
      if (queryKey[0] === "user_preferences") {
        return {
          data: {
            user_id: "user-123",
            timezone: "America/New_York",
            quiet_hours_start: "22:00:00",
            quiet_hours_end: "07:00:00",
          },
          isLoading: false,
          status: "success",
          fetchStatus: "idle",
        };
      }
      return { data: null, isLoading: false, status: "success" };
    },
    QueryClientProvider: ({ children }: any) => children,
  };
});

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    removeChannel: () => {},
    channel: () => ({
      on: () => ({
        subscribe: () => ({
          unsubscribe: () => {},
        }),
      }),
    }),
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-123", email: "student@univ.edu" } } }),
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: "user-123", email: "student@univ.edu" } } },
        }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: (table: string) => {
      const dummyChain: any = {
        select: () => dummyChain,
        insert: () => Promise.resolve({ error: null }),
        update: () => dummyChain,
        upsert: () => Promise.resolve({ error: null }),
        eq: () => dummyChain,
        order: () => dummyChain,
        limit: () => dummyChain,
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      };

      if (table === "profiles") {
        const profileChain: any = {
          select: () => profileChain,
          eq: () => profileChain,
          single: () =>
            Promise.resolve({
              data: {
                id: "user-123",
                first_name: "Alex",
                last_name: "Rivera",
                handle: "alexr",
                avatar_theme: "peach",
                skills: ["React"],
                role: "student",
              },
              error: null,
            }),
        };
        return profileChain;
      }
      if (table === "user_preferences") {
        const prefsChain: any = {
          select: () => prefsChain,
          eq: () => prefsChain,
          maybeSingle: () =>
            Promise.resolve({
              data: {
                user_id: "user-123",
                timezone: "America/New_York",
                quiet_hours_start: "22:00:00",
                quiet_hours_end: "07:00:00",
              },
              error: null,
            }),
          upsert: () => Promise.resolve({ error: null }),
        };
        return prefsChain;
      }
      return dummyChain;
    },
  }),
}));

describe("SettingsPage Quiet Hours Preferences", () => {
  it("renders timezone and quiet hours fields and submits updates", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SettingsPage />
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Verify timezone dropdown renders with correct selected option
    const tzSelect = await screen.findByLabelText(/timezone/i);
    expect(tzSelect).toBeInTheDocument();
    expect((tzSelect as HTMLSelectElement).value).toBe("America/New_York");

    // Verify quiet hours start time input renders
    const startInput = screen.getByLabelText(/quiet start/i);
    expect(startInput).toBeInTheDocument();
    expect((startInput as HTMLInputElement).value).toBe("22:00");

    // Verify quiet hours end time input renders
    const endInput = screen.getByLabelText(/quiet end/i);
    expect(endInput).toBeInTheDocument();
    expect((endInput as HTMLInputElement).value).toBe("07:00");

    // Change start time and timezone values
    fireEvent.change(tzSelect, { target: { value: "Asia/Kolkata" } });
    fireEvent.change(startInput, { target: { value: "23:00" } });

    expect((tzSelect as HTMLSelectElement).value).toBe("Asia/Kolkata");
    expect((startInput as HTMLInputElement).value).toBe("23:00");

    // Click Save Notification Preferences button
    const savePrefsButton = screen.getByRole("button", { name: /save notification preferences/i });
    expect(savePrefsButton).toBeInTheDocument();
    fireEvent.click(savePrefsButton);

    await waitFor(() => {
      expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
    });
  });
});

describe("SettingsPage Alumni Account Transition", () => {
  it("renders alumni transition panel when role is student and submits new personal email", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SettingsPage />
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const transitionHeading = await screen.findByText("Alumni Account Transition");
    expect(transitionHeading).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/new personal email address/i);
    expect(emailInput).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: "graduated@gmail.com" } });
    expect((emailInput as HTMLInputElement).value).toBe("graduated@gmail.com");

    const submitBtn = screen.getByRole("button", { name: /transition account to alumni/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);
  });
});
