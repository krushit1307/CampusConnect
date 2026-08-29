import { describe, it, expect } from "vitest";
import { detectAbsoluteAllergenCollision, type MenuAllergenItem } from "./dietaryAllergenCollision";

const pizza: MenuAllergenItem = {
  is_vegan: false,
  is_gluten_free: false,
  contains_nuts: false,
  contains_dairy: true,
};

const glutenFreeSalad: MenuAllergenItem = {
  is_vegan: true,
  is_gluten_free: true,
  contains_nuts: false,
  contains_dairy: false,
};

describe("Dietary Restriction Allergen Collision (#4421)", () => {
  it("does not warn when the organizer has not selected a menu", () => {
    const result = detectAbsoluteAllergenCollision(["Celiac"], []);
    expect(result.hasAbsoluteCollision).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("does not warn when the user has no dietary restrictions", () => {
    const result = detectAbsoluteAllergenCollision([], [pizza]);
    expect(result.hasAbsoluteCollision).toBe(false);
  });

  it("detects an absolute collision for Celiac vs a gluten-only pizza menu", () => {
    const result = detectAbsoluteAllergenCollision(["Celiac"], [pizza]);
    expect(result.hasAbsoluteCollision).toBe(true);
    expect(result.servedAllergens).toEqual(["Gluten"]);
    expect(result.warningMessage).toBe(
      "WARNING: This event only serves Gluten. There are no safe food options available for your dietary profile. Do you still wish to attend?",
    );
  });

  it("does not collide when at least one menu item is safe", () => {
    const result = detectAbsoluteAllergenCollision(["Celiac"], [pizza, glutenFreeSalad]);
    expect(result.hasAbsoluteCollision).toBe(false);
  });

  it("detects a collision when combined restrictions have no overlapping safe dish", () => {
    const gfPizza: MenuAllergenItem = {
      is_vegan: false,
      is_gluten_free: true,
      contains_nuts: false,
      contains_dairy: true,
    };
    const veganPasta: MenuAllergenItem = {
      is_vegan: true,
      is_gluten_free: false,
      contains_nuts: false,
      contains_dairy: false,
    };
    const result = detectAbsoluteAllergenCollision(["gluten-free", "vegan"], [gfPizza, veganPasta]);
    expect(result.hasAbsoluteCollision).toBe(true);
  });
});
