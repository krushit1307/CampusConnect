import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VaultFileGrid } from "./VaultFileGrid";

// Mock Supabase client
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://supabase.campusconnect.edu/storage/v1/object/sign/club_vaults/test.pdf?token=abc" },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        download: vi.fn(),
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

const mockFiles = [
  {
    id: "doc-1",
    file_name: "meeting_minutes.pdf",
    file_path: "club-1/meeting_minutes.pdf",
    file_size: 1024 * 150, // 150 KB
    mime_type: "application/pdf",
    category: "Meeting Minutes",
    uploaded_at: "2026-08-17T12:00:00Z",
    profiles: {
      first_name: "Sarah",
      last_name: "Backer",
    },
  },
];

describe("Secure File Access Expiration UI (#3457)", () => {
  it("renders VaultFileGrid and opens Share Document Dialog with 48h expiration warning notice", async () => {
    const onFileChanged = vi.fn();
    render(<VaultFileGrid files={mockFiles} loading={false} onFileChanged={onFileChanged} />);

    // Verify item title renders
    expect(screen.getByText("meeting_minutes.pdf")).toBeInTheDocument();
    // Verify file size formats correctly
    expect(screen.getByText("150 KB")).toBeInTheDocument();

    // Trigger actions menu click
    const menuBtn = screen.getByRole("button");
    fireEvent.click(menuBtn);

    // Click "Share Document" item
    const shareBtn = screen.getByText("Share Document");
    fireEvent.click(shareBtn);

    // Verify createSignedUrl was called with 172800 (48 hours)
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("club-1/meeting_minutes.pdf", 172800);

    // Wait for the modal dialog to be rendered
    await waitFor(() => {
      expect(screen.getByText("This link will automatically self-destruct in 48 hours.")).toBeInTheDocument();
    });
  });
});
