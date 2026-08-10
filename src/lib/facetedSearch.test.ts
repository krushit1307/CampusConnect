import { describe, it, expect } from "vitest";
import { parseFilterParams, serializeFilterParams, filterEvents, EventItem } from "./facetedSearch";

describe("Faceted Event Search Suite (#2679)", () => {
  const mockEvents: EventItem[] = [
    {
      id: "1",
      title: "Tech Club Hackathon",
      category: "Tech",
      hasFreeFood: true,
      startTime: "2026-09-01T10:00:00Z",
    },
    {
      id: "2",
      title: "Networking Dinner",
      category: "Social",
      hasFreeFood: true,
      startTime: "2026-09-05T18:00:00Z",
    },
    {
      id: "3",
      title: "Math Lecture",
      category: "Academic",
      hasFreeFood: false,
      startTime: "2026-09-10T14:00:00Z",
    },
  ];

  it("parses URL search parameters into structured filter state", () => {
    const params = new URLSearchParams("?q=hackathon&category=Tech,Social&hasFood=true");
    const parsed = parseFilterParams(params);

    expect(parsed.searchQuery).toBe("hackathon");
    expect(parsed.categories).toEqual(["Tech", "Social"]);
    expect(parsed.hasFreeFood).toBe(true);
  });

  it("serializes filter state to canonical URL search string", () => {
    const urlString = serializeFilterParams({
      categories: ["Tech"],
      hasFreeFood: true,
    });

    expect(urlString).toBe("?category=Tech&hasFood=true");
  });

  it("filters event items across multiple criteria (category & free food)", () => {
    const filtered = filterEvents(mockEvents, {
      hasFreeFood: true,
      categories: ["Tech"],
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe("Tech Club Hackathon");
  });
});
