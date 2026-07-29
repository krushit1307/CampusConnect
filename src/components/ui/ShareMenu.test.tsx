import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ShareMenu } from "./ShareMenu";
import { toast } from "sonner";
import * as webShareModule from "@/hooks/useWebShare";

const defaultProps = {
  url: "https://example.com/event/1",
  title: "Test Event",
  text: "Check out: Test Event",
};

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockShare = vi.fn<(...args: unknown[]) => Promise<webShareModule.ShareResult>>();
const mockCopyToClipboard = vi.fn<(...args: unknown[]) => Promise<boolean>>();

vi.mock("@/hooks/useWebShare", () => ({
  useWebShare: () => ({
    canShare: false,
    share: mockShare,
    copyToClipboard: mockCopyToClipboard,
    copied: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShareMenu", () => {
  it("renders the share button with default label", () => {
    render(<ShareMenu {...defaultProps} />);
    expect(screen.getByRole("button", { name: /share test event/i })).toBeInTheDocument();
  });

  it("renders with custom children", () => {
    render(
      <ShareMenu {...defaultProps}>
        <button type="button" aria-label="Custom share">
          Custom
        </button>
      </ShareMenu>,
    );
    expect(screen.getByRole("button", { name: /custom share/i })).toBeInTheDocument();
  });

  it("opens the dialog with sharing options", () => {
    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/share event/i)).toBeInTheDocument();
    expect(screen.getByText(/copy link/i)).toBeInTheDocument();
    expect(screen.getByText(/whatsapp/i)).toBeInTheDocument();
    expect(screen.getByText(/twitter\/x/i)).toBeInTheDocument();
    expect(screen.getByText(/linkedin/i)).toBeInTheDocument();
  });

  it("copies link to clipboard when Copy Link is clicked", () => {
    mockCopyToClipboard.mockResolvedValue(true);

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));
    fireEvent.click(screen.getByText(/copy link/i));

    expect(mockCopyToClipboard).toHaveBeenCalledWith("https://example.com/event/1");
    expect(toast.success).toHaveBeenCalledWith("Link copied!");
  });

  it("shows copied state after copying link", () => {
    mockCopyToClipboard.mockResolvedValue(true);

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));
    fireEvent.click(screen.getByText(/copy link/i));

    expect(screen.getByText(/link copied/i)).toBeInTheDocument();
  });

  it("shows error toast when clipboard fails", () => {
    mockCopyToClipboard.mockResolvedValue(false);

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));
    fireEvent.click(screen.getByText(/copy link/i));

    expect(toast.error).toHaveBeenCalledWith("Failed to copy link.");
  });

  it("calls navigator.share when canShare is true", () => {
    vi.mocked(webShareModule).useWebShare = vi.fn().mockReturnValue({
      canShare: true,
      share: mockShare.mockResolvedValue({ kind: "success" }),
      copyToClipboard: mockCopyToClipboard,
      copied: false,
    });

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    expect(mockShare).toHaveBeenCalledWith({
      title: "Test Event",
      text: "Check out: Test Event",
      url: "https://example.com/event/1",
    });
  });

  it("shows success toast when share succeeds", async () => {
    vi.mocked(webShareModule).useWebShare = vi.fn().mockReturnValue({
      canShare: true,
      share: mockShare.mockResolvedValue({ kind: "success" }),
      copyToClipboard: mockCopyToClipboard,
      copied: false,
    });

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Shared successfully!");
    });
  });

  it("opens dialog when share returns unavailable", () => {
    vi.mocked(webShareModule).useWebShare = vi.fn().mockReturnValue({
      canShare: true,
      share: mockShare.mockResolvedValue({ kind: "unavailable" }),
      copyToClipboard: mockCopyToClipboard,
      copied: false,
    });

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows error toast and opens dialog when share errors", () => {
    vi.mocked(webShareModule).useWebShare = vi.fn().mockReturnValue({
      canShare: true,
      share: mockShare.mockResolvedValue({ kind: "error", error: new Error("Share failed") }),
      copyToClipboard: mockCopyToClipboard,
      copied: false,
    });

    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    expect(toast.error).toHaveBeenCalledWith("Error sharing.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("whatsapp link includes encoded url and text", () => {
    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    const whatsappLink = screen.getByText(/whatsapp/i).closest("a");
    expect(whatsappLink).toHaveAttribute("href", expect.stringContaining("wa.me"));
    expect(whatsappLink?.getAttribute("href")).toContain(
      encodeURIComponent("https://example.com/event/1"),
    );
  });

  it("twitter link includes encoded url and text", () => {
    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    const twitterLink = screen.getByText(/twitter\/x/i).closest("a");
    expect(twitterLink).toHaveAttribute(
      "href",
      expect.stringContaining("twitter.com/intent/tweet"),
    );
  });

  it("linkedin link includes encoded url", () => {
    render(<ShareMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /share test event/i }));

    const linkedinLink = screen.getByText(/linkedin/i).closest("a");
    expect(linkedinLink).toHaveAttribute(
      "href",
      expect.stringContaining("linkedin.com/sharing/share-offsite"),
    );
  });
});
