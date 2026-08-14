import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AdvancedEventFacetedSearch, EventItem } from "./AdvancedEventFacetedSearch";

describe("AdvancedEventFacetedSearch Component (#2973)", () => {
  const sampleEvents: EventItem[] = [
    {
      id: "1",
      title: "Tech Hackathon 2026",
      description: "Code all weekend with free pizza and prizes",
      start_date: "2026-10-01T10:00:00Z",
      is_free: true,
      has_food: true,
      gives_points: true,
      is_virtual: false,
    },
    {
      id: "2",
      title: "Virtual AI Workshop",
      description: "Learn machine learning online from experts",
      start_date: "2026-10-05T14:00:00Z",
      price: 15,
      is_free: false,
      has_food: false,
      gives_points: false,
      is_virtual: true,
    },
  ];

  it("renders search sidebar with facets", () => {
    render(<AdvancedEventFacetedSearch events={sampleEvents} />);

    expect(screen.getByText(/Search & Facets/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search title, details/i)).toBeInTheDocument();
    expect(screen.getByText(/Food Provided 🍕/i)).toBeInTheDocument();
    expect(screen.getByText(/Gamification Points 🏆/i)).toBeInTheDocument();
  });

  it("filters events by Food perk checkbox", () => {
    render(<AdvancedEventFacetedSearch events={sampleEvents} />);

    // Initially 2 events shown
    expect(screen.getByText((_, el) => el?.textContent === "Showing 2 matching events")).toBeInTheDocument();

    // Check "Food Provided 🍕" checkbox
    const foodCheckbox = screen.getByLabelText(/Food Provided 🍕/i);
    fireEvent.click(foodCheckbox);

    // Only 1 event remains (Tech Hackathon)
    expect(screen.getByText((_, el) => el?.textContent === "Showing 1 matching events")).toBeInTheDocument();
    expect(screen.getByText("Tech Hackathon 2026")).toBeInTheDocument();
    expect(screen.queryByText("Virtual AI Workshop")).not.toBeInTheDocument();
  });

  it("displays intelligent empty state suggestion when 0 events match hyper-specific filters", () => {
    render(<AdvancedEventFacetedSearch events={sampleEvents} />);

    // Select Virtual + Free (0 events match because Virtual AI Workshop is paid)
    const formatSelect = screen.getByRole("combobox");
    fireEvent.change(formatSelect, { target: { value: "virtual" } });

    const freeBtn = screen.getByRole("button", { name: /^free$/i });
    fireEvent.click(freeBtn);

    // Should show intelligent empty state
    expect(screen.getByTestId("faceted-empty-state")).toBeInTheDocument();
    expect(screen.getByText(/No virtual events match all criteria/i)).toBeInTheDocument();
  });
});
