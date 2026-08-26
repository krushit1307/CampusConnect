import { describe, it, expect } from "vitest";
import { validateBasics, validateTicketing, validateLocation } from "../src/utils/validation";

describe("validation guards", () => {
  it("validateBasics catches empty fields", () => {
    const errors = validateBasics({
      title: "",
      description: "",
      category: "",
      isPaid: false,
      startDate: "",
      endDate: "",
      tags: [],
    });
    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.category).toBeDefined();
  });

  it("validateTicketing requires price and currency if paid", () => {
    const errors = validateTicketing({
      title: "x",
      description: "x",
      category: "x",
      startDate: "x",
      endDate: "x",
      tags: [],
      isPaid: true,
    });
    expect(errors.price).toBeDefined();
    expect(errors.currency).toBeDefined();
  });

  it("validateTicketing ignores price if free", () => {
    const errors = validateTicketing({
      title: "x",
      description: "x",
      category: "x",
      startDate: "x",
      endDate: "x",
      tags: [],
      isPaid: false,
    });
    expect(Object.keys(errors).length).toBe(0);
  });
});
