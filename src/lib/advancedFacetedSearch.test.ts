import { describe, it, expect } from "vitest";
import {
  serializeFacetedFiltersToUrl,
  parseFacetedFiltersFromUrl,
  updateFacetedFilter,
  generateIntelligentEmptyStateSuggestion,
  DEFAULT_FACETED_FILTERS,
  FacetedSearchFilterState,
} from "./advancedFacetedSearch";

describe("Advanced Faceted Search & URL Sync (#2973)", () => {
  it("serializes filter state to URL query parameter string omitting default values", () => {
    // Default state -> empty string
    expect(serializeFacetedFiltersToUrl(DEFAULT_FACETED_FILTERS)).toBe("");

    // Custom state
    const customState: FacetedSearchFilterState = {
      query: "Hackathon",
      dateRange: "this_weekend",
      startDate: null,
      endDate: null,
      cost: "free",
      hasFood: true,
      givesPoints: false,
      format: "in_person",
      page: 2,
    };

    const serialized = serializeFacetedFiltersToUrl(customState);
    expect(serialized).toBe("?query=Hackathon&dateRange=this_weekend&cost=free&food=true&format=in_person&page=2");
  });

  it("parses URL query parameters correctly into filter state", () => {
    const searchStr = "?query=Workshop&dateRange=today&cost=free&food=true&points=true&format=virtual&page=3";
    const parsed = parseFacetedFiltersFromUrl(searchStr);

    expect(parsed).toEqual({
      query: "Workshop",
      dateRange: "today",
      startDate: null,
      endDate: null,
      cost: "free",
      hasFood: true,
      givesPoints: true,
      format: "virtual",
      page: 3,
    });
  });

  it("resets page back to 1 whenever a filter parameter changes", () => {
    const initialState: FacetedSearchFilterState = {
      ...DEFAULT_FACETED_FILTERS,
      page: 5,
    };

    // Changing format MUST reset page to 1 (#2973)
    const updated = updateFacetedFilter(initialState, "format", "virtual");
    expect(updated.format).toBe("virtual");
    expect(updated.page).toBe(1);

    // Updating page directly does not reset page
    const pageUpdated = updateFacetedFilter(updated, "page", 3);
    expect(pageUpdated.page).toBe(3);
  });

  it("generates intelligent empty state suggestions when 0 events match criteria", () => {
    // Virtual filter empty state
    const virtualState: FacetedSearchFilterState = {
      ...DEFAULT_FACETED_FILTERS,
      format: "virtual",
    };
    const suggestion1 = generateIntelligentEmptyStateSuggestion(virtualState);
    expect(suggestion1.message).toContain("virtual events");
    expect(suggestion1.relaxKey).toBe("format");

    // Food filter empty state
    const foodState: FacetedSearchFilterState = {
      ...DEFAULT_FACETED_FILTERS,
      hasFood: true,
    };
    const suggestion2 = generateIntelligentEmptyStateSuggestion(foodState);
    expect(suggestion2.message).toContain("food-provided");
    expect(suggestion2.relaxKey).toBe("hasFood");
  });
});
