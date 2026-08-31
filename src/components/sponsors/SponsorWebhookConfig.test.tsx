import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SponsorWebhookConfig } from "./SponsorWebhookConfig";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SponsorWebhookConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loader initially", () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    render(<SponsorWebhookConfig eventId="event-1" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("loads and displays existing webhook config", async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: "sponsor-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "webhook-1",
          webhook_url: "https://example.com/hook",
          is_active: true,
          field_mappings: { crm_name: "first_name" },
        },
        error: null,
      });

    // For logs
    const mockOrder = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValueOnce({
      data: [],
      error: null,
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "event_sponsors") {
        return { select: mockSelect, eq: mockEq, single: mockSingle };
      }
      if (table === "sponsor_crm_webhooks") {
        return { select: mockSelect, eq: mockEq, single: mockSingle };
      }
      if (table === "sponsor_crm_webhook_logs") {
        return { select: mockSelect, eq: mockEq, order: mockOrder, limit: mockLimit };
      }
      return { select: mockSelect };
    });

    render(<SponsorWebhookConfig eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://example.com/hook")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("crm_name")).toBeInTheDocument();
  });

  it("shows validation error on invalid url save", async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    // Simulate no existing webhook
    const mockSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: "sponsor-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "event_sponsors") return { select: mockSelect, eq: mockEq, single: mockSingle };
      if (table === "sponsor_crm_webhooks")
        return { select: mockSelect, eq: mockEq, single: mockSingle };
      return { select: mockSelect };
    });

    render(<SponsorWebhookConfig eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByText("CRM Webhook Configuration")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("https://hooks.yourcrm.com/...");
    fireEvent.change(input, { target: { value: "invalid-url" } });

    const saveBtn = screen.getByText("Save Configuration");
    fireEvent.click(saveBtn);

    expect(toast.error).toHaveBeenCalledWith("Please enter a valid HTTP(S) URL");
  });
});
