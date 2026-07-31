import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentScrollSpy, extractHeadingsFromDOM } from "./DocumentScrollSpy";
import { ClubConstitutionViewer, defaultConstitutionHeadings } from "./ClubConstitutionViewer";

describe("DocumentScrollSpy Component (#1969)", () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts headings from DOM container accurately", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <h2>Article I: Overview</h2>
      <h3>Section 1.1: Name</h3>
      <h2>Article II: Rules</h2>
    `;

    const headings = extractHeadingsFromDOM(container);
    expect(headings.length).toBe(3);
    expect(headings[0].text).toBe("Article I: Overview");
    expect(headings[0].level).toBe(2);
    expect(headings[1].text).toBe("Section 1.1: Name");
    expect(headings[1].level).toBe(3);
  });

  it("renders desktop sticky Table of Contents and links", () => {
    render(<DocumentScrollSpy headings={defaultConstitutionHeadings} />);

    expect(screen.getAllByText("Table of Contents").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Article I: Name & Purpose/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Article V: Constitutional Amendments/i).length).toBeGreaterThan(0);
  });

  it("smoothly scrolls to heading when clicked", () => {
    const scrollIntoViewMock = vi.fn();
    const headingEl = document.createElement("div");
    headingEl.id = "article-5-amendments";
    headingEl.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(headingEl);

    render(<DocumentScrollSpy headings={defaultConstitutionHeadings} />);

    const link = screen.getAllByText(/Article V: Constitutional Amendments/i)[0];
    fireEvent.click(link);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    document.body.removeChild(headingEl);
  });

  it("renders full ClubConstitutionViewer with integrated ScrollSpy", () => {
    render(<ClubConstitutionViewer />);

    expect(screen.getByText(/Official Governance Document/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Article I: Name & Purpose/i).length).toBeGreaterThan(0);
  });
});
