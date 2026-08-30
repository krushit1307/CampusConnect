// ============================================================
// CampusConnect – Content Warning Banner Tests
// src/components/ContentWarningBanner.test.tsx
// Issue #3679
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContentWarningBanner } from "./ContentWarningBanner";

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="alert-icon" />,
  Eye: () => <svg data-testid="eye-icon" />,
  EyeOff: () => <svg data-testid="eyeoff-icon" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(" "),
}));

describe("ContentWarningBanner", () => {
  it("renders children directly when no warning tags", () => {
    render(
      <ContentWarningBanner warningTags={[]}>
        <p>This is the event description.</p>
      </ContentWarningBanner>,
    );
    expect(screen.getByText("This is the event description.")).toBeInTheDocument();
    expect(screen.queryByText(/Content Warning/)).not.toBeInTheDocument();
  });

  it("renders warning banner when warning tags exist", () => {
    render(
      <ContentWarningBanner warningTags={["Violence", "Mental Health"]}>
        <p>This is the event description.</p>
      </ContentWarningBanner>,
    );
    expect(screen.getByText(/Content Warning/)).toBeInTheDocument();
    expect(screen.getByText(/Violence, Mental Health/)).toBeInTheDocument();
  });

  it("blurs description content by default", () => {
    render(
      <ContentWarningBanner warningTags={["Violence"]}>
        <p data-testid="content">Sensitive description</p>
      </ContentWarningBanner>,
    );
    const content = screen.getByTestId("content").parentElement;
    expect(content?.className).toContain("blur-sm");
  });

  it("reveals content when 'I understand' button is clicked", () => {
    render(
      <ContentWarningBanner warningTags={["Violence"]}>
        <p data-testid="content">Sensitive description</p>
      </ContentWarningBanner>,
    );
    const content = screen.getByTestId("content").parentElement;
    expect(content?.className).toContain("blur-sm");
    fireEvent.click(screen.getByText("I understand, reveal description"));
    const contentAfter = screen.getByTestId("content").parentElement;
    expect(contentAfter?.className).not.toContain("blur-sm");
  });

  it("shows 'Hide description' button after revealing", () => {
    render(
      <ContentWarningBanner warningTags={["Violence"]}>
        <p>Description</p>
      </ContentWarningBanner>,
    );
    fireEvent.click(screen.getByText("I understand, reveal description"));
    expect(screen.getByText("Hide description")).toBeInTheDocument();
  });

  it("re-blurs content when 'Hide description' is clicked", () => {
    render(
      <ContentWarningBanner warningTags={["Violence"]}>
        <p data-testid="content">Description</p>
      </ContentWarningBanner>,
    );
    fireEvent.click(screen.getByText("I understand, reveal description"));
    let content = screen.getByTestId("content").parentElement;
    expect(content?.className).not.toContain("blur-sm");
    fireEvent.click(screen.getByText("Hide description"));
    content = screen.getByTestId("content").parentElement;
    expect(content?.className).toContain("blur-sm");
  });

  it("displays warning description text", () => {
    render(
      <ContentWarningBanner warningTags={["Self-Harm"]}>
        <p>Description</p>
      </ContentWarningBanner>,
    );
    expect(screen.getByText(/self-harm/i)).toBeInTheDocument();
  });

  it("handles undefined warning tags gracefully", () => {
    render(
      <ContentWarningBanner warningTags={undefined as any}>
        <p>Description</p>
      </ContentWarningBanner>,
    );
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.queryByText(/Content Warning/)).not.toBeInTheDocument();
  });
});
