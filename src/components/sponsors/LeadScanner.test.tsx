import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LeadScanner from "./LeadScanner";
import { Html5Qrcode } from "html5-qrcode";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
  })),
}));

// Mock Audio Beep
vi.mock("@/lib/audio/beep", () => ({
  playSuccessBeep: vi.fn(),
}));

// Mock Html5Qrcode
vi.mock("html5-qrcode", () => {
  return {
    Html5Qrcode: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

// Add getCameras static method
(Html5Qrcode as any).getCameras = vi.fn().mockResolvedValue([
  { id: "cam1", label: "Front Camera" },
  { id: "cam2", label: "Back Camera" },
]);

describe("LeadScanner Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the start button initially", async () => {
    render(<LeadScanner eventId="e1" sponsorId="s1" />);

    // Should show title
    expect(screen.getByText("Booth Lead Scanner")).toBeInTheDocument();

    // Should load cameras and show start button
    await waitFor(() => {
      expect(screen.getByText("Start Camera")).toBeInTheDocument();
    });
  });
});
