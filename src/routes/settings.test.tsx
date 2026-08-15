import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "./settings";
import { MemoryRouter } from "react-router-dom";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-123", email: "student@univ.edu" } } }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "user-123",
                    first_name: "Alex",
                    last_name: "Rivera",
                    handle: "alexr",
                    avatar_theme: "peach",
                    skills: ["React"],
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "user_preferences") {
        return {
          select: () => ({
            eq: () => ({
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
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    },
  }),
}));

describe("SettingsPage Quiet Hours Preferences", () => {
  it("renders timezone and quiet hours fields and submits updates", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
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
        <SettingsPage />
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
