import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClubOnboardingWizard from "./ClubOnboardingWizard";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: () => Promise.resolve({ data: { path: "mock-path" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://mock-storage.com/pdf.pdf" } }),
      }),
    },
    from: (table: string) => ({
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));

// Mock CascadingCategorySelect to avoid rendering full dropdown logic in test
vi.mock("@/components/Clubs/CascadingCategorySelect", () => ({
  CascadingCategorySelect: ({ onChange }: any) => (
    <select onChange={(e) => onChange(e.target.value)} data-testid="category-select">
      <option value="">Select Category</option>
      <option value="cat-1">Engineering</option>
    </select>
  ),
}));

// Mock ImageCropUpload
vi.mock("@/components/ImageCropUpload", () => ({
  ImageCropUpload: ({ onUploaded }: any) => (
    <button onClick={() => onUploaded("https://mock-image.com/img.png")} data-testid="upload-btn">
      Upload Image
    </button>
  ),
}));

describe("ClubOnboardingWizard", () => {
  const mockClub = {
    id: "club-123",
    name: "Robotics Club",
    slug: "robotics-club",
    description: "",
    logo_url: "",
    banner_url: "",
    category_id: "",
  };

  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders Step 1 logo and banner assets on mount", () => {
    render(<ClubOnboardingWizard club={mockClub} onComplete={mockOnComplete} />);

    expect(screen.getByText("Logo & Banner Assets")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  });

  it("restores step and form progress from localStorage on mount", async () => {
    const savedState = {
      step: 2,
      logo_url: "logo.png",
      banner_url: "banner.png",
      description: "Robotics and engineering club.",
      category_id: "cat-1",
      constitution_url: "",
      invites: [],
      stripeConnected: false,
      stripeAccountId: "",
    };
    localStorage.setItem(`club_onboarding_state_${mockClub.id}`, JSON.stringify(savedState));

    render(<ClubOnboardingWizard club={mockClub} onComplete={mockOnComplete} />);

    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Bio & Categories")).toBeInTheDocument();
  });

  it("advances to Step 2 when assets are uploaded", async () => {
    render(<ClubOnboardingWizard club={mockClub} onComplete={mockOnComplete} />);

    // Upload mock logo and banner images
    const uploadButtons = screen.getAllByTestId("upload-btn");
    fireEvent.click(uploadButtons[0]); // logo
    fireEvent.click(uploadButtons[1]); // banner

    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);

    // Verify progression
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Bio & Categories")).toBeInTheDocument();
  });
});
