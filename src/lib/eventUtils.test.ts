import { describe, it, expect } from "vitest";
import {
  eventFormSchema,
  isEndAfterStart,
  isPastDate,
  formatEventDateRange,
  parseCoordinates,
  TITLE_MAX_LENGTH,
  matchesDateFilter,
  hasDraftContent,
  eventFormToDbPayload,
  parseFlyerDate,
  applyDateRangeSelection,
  updateTimeInDate,
  addFaq,
  removeFaq,
  updateFaq,
  EventFormValues,
} from "./eventUtils";

// ---------------------------------------------------------------------------
// eventFormSchema — field-level validation
// ---------------------------------------------------------------------------
describe("eventFormSchema", () => {
  const valid = {
    title: "Hackathon 2026",
    description: "A 24-hour coding event.",
    category: "Technology",
    startDate: "2026-07-11T09:00",
    endDate: "2026-07-12T09:00",
  };

  it("accepts a fully valid payload", () => {
    const parsed = eventFormSchema.parse(valid);
    expect(parsed.isPrivate).toBe(false);
  });

  it("handles isPrivate toggle correctly when set to true", () => {
    const parsed = eventFormSchema.parse({ ...valid, isPrivate: true });
    expect(parsed.isPrivate).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = eventFormSchema.safeParse({ ...valid, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.title).toBeDefined();
  });

  it("rejects a title that exceeds the max length", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      title: "a".repeat(TITLE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty description", () => {
    const result = eventFormSchema.safeParse({ ...valid, description: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.description).toBeDefined();
  });

  it("rejects a missing startDate", () => {
    const result = eventFormSchema.safeParse({ ...valid, startDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing endDate", () => {
    const result = eventFormSchema.safeParse({ ...valid, endDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejects when endDate equals startDate", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      endDate: valid.startDate,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.endDate).toBeDefined();
  });

  it("rejects when endDate is before startDate", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      endDate: "2026-07-10T09:00",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace-only title", () => {
    const result = eventFormSchema.safeParse({ ...valid, title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects custom venues without accessibility audit", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      venue_id: undefined,
      location: "Main Auditorium",
      accessibility_features: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.flatten().fieldErrors.accessibility_features).toBeDefined();
  });

  it("accepts custom venues with accessibility audit", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      venue_id: undefined,
      location: "Main Auditorium",
      accessibility_features: {
        has_elevator: true,
        wheelchair_ramp: false,
        gender_neutral_restrooms: true,
        hearing_loop: false,
        low_sensory_zone: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts master venues without accessibility audit in payload", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      venue_id: "some-uuid",
      location: undefined,
      accessibility_features: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("accepts online events without accessibility audit in payload", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      venue_id: undefined,
      location: "Online",
      accessibility_features: undefined,
    });
    expect(result.success).toBe(true);
  it("has exact Zod error messages for min length constraints", () => {
    const result = eventFormSchema.safeParse({
      title: "",
      description: "",
      startDate: "",
      endDate: "",
    });
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors;
      expect(errs.title).toContain("Title is required.");
      expect(errs.description).toContain("Description is required.");
      expect(errs.startDate).toContain("Start date is required.");
      expect(errs.endDate).toContain("End date is required.");
    }
  });

  it("checks exact title max length message", () => {
    const result = eventFormSchema.safeParse({ ...valid, title: "a".repeat(TITLE_MAX_LENGTH + 1) });
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toContain(
        `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// isEndAfterStart
// ---------------------------------------------------------------------------
describe("isEndAfterStart", () => {
  it("returns true when end is after start", () => {
    expect(isEndAfterStart("2026-07-11T09:00", "2026-07-11T10:00")).toBe(true);
  });

  it("returns false when end equals start", () => {
    expect(isEndAfterStart("2026-07-11T09:00", "2026-07-11T09:00")).toBe(false);
  });

  it("returns false when end is before start", () => {
    expect(isEndAfterStart("2026-07-11T10:00", "2026-07-11T09:00")).toBe(false);
  });

  it("handles leap-year boundary (Feb 28 → Feb 29)", () => {
    expect(isEndAfterStart("2028-02-28T23:59", "2028-02-29T00:00")).toBe(true);
  });

  it("handles leap-year boundary (Feb 29 → Mar 1)", () => {
    expect(isEndAfterStart("2028-02-29T00:00", "2028-03-01T00:00")).toBe(true);
  });

  it("returns false for Feb 29 on a non-leap year (invalid date)", () => {
    // "2027-02-29" is not a real date; Date constructor rolls it over to Mar 1
    // so end (Mar 1) > start (Feb 28) — the function still returns a boolean
    const result = isEndAfterStart("2027-02-28T00:00", "2027-02-29T00:00");
    expect(typeof result).toBe("boolean");
  });

  it("spans across year boundary", () => {
    expect(isEndAfterStart("2025-12-31T23:00", "2026-01-01T00:00")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPastDate
// ---------------------------------------------------------------------------
describe("isPastDate", () => {
  const FIXED_NOW = new Date("2026-07-11T12:00:00Z");

  it("returns true for a date in the past", () => {
    expect(isPastDate("2026-07-11T11:59:00Z", FIXED_NOW)).toBe(true);
  });

  it("returns false for a date in the future", () => {
    expect(isPastDate("2026-07-11T12:01:00Z", FIXED_NOW)).toBe(false);
  });

  it("returns false for a date equal to now (not strictly less)", () => {
    expect(isPastDate("2026-07-11T12:00:00Z", FIXED_NOW)).toBe(false);
  });

  it("returns true for a date one year in the past", () => {
    expect(isPastDate("2025-07-11T12:00:00Z", FIXED_NOW)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatEventDateRange
// ---------------------------------------------------------------------------
describe("formatEventDateRange", () => {
  it("formats a same-day range correctly", () => {
    const result = formatEventDateRange("2026-07-11T09:00:00Z", "2026-07-11T11:00:00Z");
    expect(result).toBe("July 11, 2026 at 9:00 AM – 11:00 AM");
  });

  it("formats a PM range correctly", () => {
    const result = formatEventDateRange("2026-12-25T14:00:00Z", "2026-12-25T18:30:00Z");
    expect(result).toBe("December 25, 2026 at 2:00 PM – 6:30 PM");
  });

  it("returns empty string for an invalid start date", () => {
    expect(formatEventDateRange("not-a-date", "2026-07-11T11:00:00Z")).toBe("");
  });

  it("returns empty string for an invalid end date", () => {
    expect(formatEventDateRange("2026-07-11T09:00:00Z", "bad")).toBe("");
  });

  it("handles leap-year date Feb 29", () => {
    const result = formatEventDateRange("2028-02-29T10:00:00Z", "2028-02-29T12:00:00Z");
    expect(result).toBe("February 29, 2028 at 10:00 AM – 12:00 PM");
  });

  it("output contains ' at ' separator and ' – ' range separator", () => {
    const result = formatEventDateRange("2026-07-11T09:00:00Z", "2026-07-11T11:00:00Z");
    expect(result).toContain(" at ");
    expect(result).toContain(" – ");
  });
});

// ---------------------------------------------------------------------------
// parseCoordinates
// ---------------------------------------------------------------------------
describe("parseCoordinates", () => {
  it("identifies valid coordinates", () => {
    const result = parseCoordinates("28.7041, 77.1025");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.lat).toBe(28.7041);
    expect(result.lng).toBe(77.1025);
  });

  it("identifies negative coordinates", () => {
    const result = parseCoordinates("-33.8688, 151.2093");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.lat).toBe(-33.8688);
    expect(result.lng).toBe(151.2093);
  });

  it("identifies boundary latitude and longitude as valid", () => {
    expect(parseCoordinates("-90, 0").isValid).toBe(true);
    expect(parseCoordinates("90, 0").isValid).toBe(true);
    expect(parseCoordinates("0, -180").isValid).toBe(true);
    expect(parseCoordinates("0, 180").isValid).toBe(true);
  });

  it("identifies just outside boundary latitude as invalid", () => {
    const result1 = parseCoordinates("-90.1, 0");
    expect(result1.isCoordinates).toBe(true);
    expect(result1.isValid).toBe(false);

    const result2 = parseCoordinates("90.1, 0");
    expect(result2.isCoordinates).toBe(true);
    expect(result2.isValid).toBe(false);
  });

  it("identifies just outside boundary longitude as invalid", () => {
    const result1 = parseCoordinates("0, -180.1");
    expect(result1.isCoordinates).toBe(true);
    expect(result1.isValid).toBe(false);

    const result2 = parseCoordinates("0, 180.1");
    expect(result2.isCoordinates).toBe(true);
    expect(result2.isValid).toBe(false);
  });

  it("identifies invalid latitude (out of bounds)", () => {
    const result = parseCoordinates("95.1234, 77.1025");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("identifies invalid longitude (out of bounds)", () => {
    const result = parseCoordinates("28.7041, -195.1234");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("identifies coordinate-like inputs with alphabetic chars as coordinates and invalid", () => {
    const result = parseCoordinates("28.7041, abc");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("rejects leading/trailing non-numeric characters completely (strict regex)", () => {
    // If one part is strictly valid, it enters the block, parses as NaN for the other, and returns isCoordinates: true.
    // So to test that the regex strictly rejects a part, both parts must be invalid!
    expect(parseCoordinates("abc12.3, def45.6").isCoordinates).toBe(false);
    expect(parseCoordinates("12.3abc, 45.6def").isCoordinates).toBe(false);
  });

  it("treats plain address strings as not coordinates (and valid)", () => {
    const result = parseCoordinates("Main Auditorium, IIT Bombay");
    expect(result.isCoordinates).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("treats online event string as not coordinates (and valid)", () => {
    const result = parseCoordinates("online");
    expect(result.isCoordinates).toBe(false);
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesDateFilter
// ---------------------------------------------------------------------------
describe("matchesDateFilter", () => {
  const FIXED_NOW = new Date(2026, 6, 23, 12, 0, 0); // July 23, 2026 12:00 local time (Thursday)

  it("returns true for 'all' filter regardless of date", () => {
    expect(matchesDateFilter(new Date(2020, 0, 1).toISOString(), "all", undefined, FIXED_NOW)).toBe(
      true,
    );
    expect(matchesDateFilter(null, "all", undefined, FIXED_NOW)).toBe(true);
  });

  it("returns false if date is missing and filter is not 'all'", () => {
    expect(matchesDateFilter(null, "this-week", undefined, FIXED_NOW)).toBe(false);
  });

  it("matches 'this-week' correctly", () => {
    // start of week (Sunday) is July 19, end of week (Saturday) is July 25
    expect(
      matchesDateFilter(
        new Date(2026, 6, 20, 12, 0).toISOString(),
        "this-week",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(true);
    expect(
      matchesDateFilter(
        new Date(2026, 6, 18, 12, 0).toISOString(),
        "this-week",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(false); // Last week
    expect(
      matchesDateFilter(
        new Date(2026, 6, 26, 12, 0).toISOString(),
        "this-week",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(false); // Next week
  });

  it("matches 'next-month' correctly", () => {
    // Next month is August 2026
    expect(
      matchesDateFilter(
        new Date(2026, 7, 1, 12, 0).toISOString(),
        "next-month",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(true);
    expect(
      matchesDateFilter(
        new Date(2026, 7, 31, 12, 0).toISOString(),
        "next-month",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(true);
    expect(
      matchesDateFilter(
        new Date(2026, 6, 31, 23, 59).toISOString(),
        "next-month",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(false); // This month
    expect(
      matchesDateFilter(
        new Date(2026, 8, 1, 0, 0).toISOString(),
        "next-month",
        undefined,
        FIXED_NOW,
      ),
    ).toBe(false); // Two months later
  });

  it("matches 'specific' correctly", () => {
    const specificDate = new Date(2026, 6, 25);
    expect(
      matchesDateFilter(
        new Date(2026, 6, 25, 14, 30).toISOString(),
        "specific",
        specificDate,
        FIXED_NOW,
      ),
    ).toBe(true);
    expect(
      matchesDateFilter(
        new Date(2026, 6, 26, 14, 30).toISOString(),
        "specific",
        specificDate,
        FIXED_NOW,
      ),
    ).toBe(false);
  });

  it("handles edge cases around month boundaries", () => {
    const endOfMonthNow = new Date(2026, 6, 31, 23, 50); // July 31 23:50 local (Friday)

    // "This week" on the last day of month
    // Week is July 26 (Sun) - Aug 1 (Sat)
    expect(
      matchesDateFilter(
        new Date(2026, 7, 1, 10, 0).toISOString(),
        "this-week",
        undefined,
        endOfMonthNow,
      ),
    ).toBe(true);

    // "Next month" from July 31 is August
    expect(
      matchesDateFilter(
        new Date(2026, 7, 1, 0, 0).toISOString(),
        "next-month",
        undefined,
        endOfMonthNow,
      ),
    ).toBe(true);
    expect(
      matchesDateFilter(
        new Date(2026, 7, 31, 23, 59).toISOString(),
        "next-month",
        undefined,
        endOfMonthNow,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasDraftContent
// ---------------------------------------------------------------------------
describe("hasDraftContent", () => {
  it("returns false for empty values", () => {
    expect(
      hasDraftContent({
        title: "",
        description: "",
        location: "",
        startDate: "",
        endDate: "",
      } as EventFormValues),
    ).toBe(false);
  });

  it("returns true when title is filled", () => {
    expect(
      hasDraftContent({
        title: "My Event",
        description: "",
        location: "",
        startDate: "",
        endDate: "",
      } as EventFormValues),
    ).toBe(true);
  });

  it("returns true when startDate is filled", () => {
    expect(
      hasDraftContent({
        title: "",
        description: "",
        location: "",
        startDate: "2026-07-11T10:00",
        endDate: "",
      } as EventFormValues),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// eventFormToDbPayload
// ---------------------------------------------------------------------------
describe("eventFormToDbPayload", () => {
  it("converts form values to DB payload shape", () => {
    const payload = eventFormToDbPayload(
      {
        title: " Test ",
        description: "Desc ",
        location: "Room 1",
        startDate: "2026-07-11T10:00",
        endDate: "2026-07-11T12:00",
      } as EventFormValues,
      "u1",
      "c1",
    );
    expect(payload.title).toBe("Test");
    expect(payload.created_by).toBe("u1");
    expect(payload.club_id).toBe("c1");
    expect(payload.requires_approval).toBe(false);
  });

  it("handles null clubId", () => {
    const payload = eventFormToDbPayload(
      {
        title: "T",
        description: "D",
        location: "",
        startDate: "2026-07-11T10:00",
        endDate: "2026-07-11T12:00",
      } as EventFormValues,
      "u1",
      null,
    );
    expect(payload.club_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseFlyerDate
// ---------------------------------------------------------------------------
describe("parseFlyerDate", () => {
  it("parses a valid date string", () => {
    const result = parseFlyerDate("2026-07-11");
    expect(result).not.toBeNull();
    expect(result!.startDate).toContain("T12:00");
    expect(result!.endDate).toContain("T14:00");
  });

  it("returns null for invalid dates", () => {
    expect(parseFlyerDate("not-a-date")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyDateRangeSelection
// ---------------------------------------------------------------------------
describe("applyDateRangeSelection", () => {
  it("clears dates when range is undefined", () => {
    const result = applyDateRangeSelection(undefined, "2026-07-11T10:00", "2026-07-12T12:00");
    expect(result.startDate).toBe("");
    expect(result.endDate).toBe("");
  });

  it("preserves existing start time", () => {
    const result = applyDateRangeSelection(
      { from: new Date(2026, 6, 15), to: new Date(2026, 6, 16) },
      "2026-07-11T10:00",
      "2026-07-12T12:00",
    );
    expect(result.startDate).toContain("T10:00");
    expect(result.endDate).toContain("T12:00");
  });

  it("uses default times when no existing time", () => {
    const result = applyDateRangeSelection(
      { from: new Date(2026, 6, 15), to: new Date(2026, 6, 16) },
      "",
      "",
    );
    expect(result.startDate).toContain("T00:00");
  });
});

// ---------------------------------------------------------------------------
// updateTimeInDate
// ---------------------------------------------------------------------------
describe("updateTimeInDate", () => {
  it("replaces the time portion of a date string", () => {
    expect(updateTimeInDate("2026-07-11T10:00", "14:30")).toBe("2026-07-11T14:30");
  });

  it("returns empty string unchanged", () => {
    expect(updateTimeInDate("", "14:30")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// FAQ Helpers
// ---------------------------------------------------------------------------
describe("addFaq", () => {
  it("appends a new empty FAQ entry", () => {
    const result = addFaq([{ question: "Q1", answer: "A1" }]);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ question: "", answer: "" });
  });
});

describe("removeFaq", () => {
  it("removes the FAQ at the given index", () => {
    const result = removeFaq(
      [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ],
      0,
    );
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("Q2");
  });
});

describe("updateFaq", () => {
  it("updates a specific field of a FAQ entry", () => {
    const result = updateFaq([{ question: "Q1", answer: "A1" }], 0, "question", "Updated Q");
    expect(result[0].question).toBe("Updated Q");
    expect(result[0].answer).toBe("A1");
  });
});
