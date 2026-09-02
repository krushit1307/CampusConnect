import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WifiProvisioningWidget } from "./WifiProvisioningWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "cert-123",
                    target_campus: "MIT",
                    cert_serial: "CC-CERT-99998888",
                    expires_at: new Date().toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }),
  };
});

describe("WifiProvisioningWidget", () => {
  it("renders active certificate serial and target campus details", async () => {
    render(<WifiProvisioningWidget targetCampus="MIT" userId="user-123" />);

    expect(screen.getByTestId("wifi-provisioning-widget")).toBeInTheDocument();

    // Verify mock certificate details render
    expect(await screen.findByText(/Serial: CC-CERT-99998888/i)).toBeInTheDocument();
    expect(screen.getByTestId("provision-wifi-btn")).toBeInTheDocument();
  });
});
