// src/components/__tests__/NewsletterEditor.test.tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsletterEditor } from "../Editor/NewsletterEditor";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/services/newsletterService", () => ({
  NewsletterService: {
    compileDesignToHtml: () => "<div>Mock Compiled HTML</div>",
    saveNewsletterDraft: vi.fn(),
    dispatchNewsletter: vi.fn(),
  },
}));

describe("NewsletterEditor Component", () => {
  it("renders editor toolbar, subject input, and action buttons", () => {
    render(<NewsletterEditor clubId="club-100" />);

    expect(screen.getByText(/Newsletter Template Builder/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. August 2026 Monthly Digest/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. 📢 Important Updates/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Draft/i)).toBeInTheDocument();
    expect(screen.getByText(/Send Newsletter/i)).toBeInTheDocument();
  });

  it("renders content block selection toolbar buttons", () => {
    render(<NewsletterEditor clubId="club-100" />);

    expect(screen.getByText(/Heading/i)).toBeInTheDocument();
    expect(screen.getByText(/Paragraph/i)).toBeInTheDocument();
    expect(screen.getByText(/Image/i)).toBeInTheDocument();
    expect(screen.getByText(/Event Card/i)).toBeInTheDocument();
    expect(screen.getByText(/Button/i)).toBeInTheDocument();
  });
});
