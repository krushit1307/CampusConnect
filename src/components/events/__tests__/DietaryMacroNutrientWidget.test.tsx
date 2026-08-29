import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DietaryMacroNutrientWidget } from "../DietaryMacroNutrientWidget";

describe("DietaryMacroNutrientWidget Component", () => {
  it("renders widget header, health score, and preset dish buttons", () => {
    render(<DietaryMacroNutrientWidget initialDishName="quinoa-power-bowl" />);

    expect(screen.getByTestId("dietary-macro-nutrient-widget")).toBeDefined();
    expect(screen.getByText(/Dietary Restriction & Macro-Nutrient Analyzer/i)).toBeDefined();
    expect(screen.getByTestId("health-score-value")).toBeDefined();
    expect(screen.getByTestId("compliance-verdict-banner")).toBeDefined();
  });

  it("updates active dish when preset dish button is clicked", () => {
    render(<DietaryMacroNutrientWidget initialDishName="quinoa-power-bowl" />);

    const chickenBtn = screen.getByTestId("preset-dish-btn-grilled-chicken-salad");
    fireEvent.click(chickenBtn);

    expect(screen.getByText("Herb Grilled Chicken & Avocado Salad")).toBeDefined();
  });

  it("toggles user dietary preference restriction and updates compliance verdict", () => {
    render(<DietaryMacroNutrientWidget initialDishName="quinoa-power-bowl" />);

    // Toggle Keto preference (54g carbs in Quinoa bowl -> should trigger warning)
    const ketoBtn = screen.getByTestId("toggle-pref-ketoOnly");
    fireEvent.click(ketoBtn);

    expect(screen.getByText(/DIETARY RESTRICTION WARNING/i)).toBeDefined();
  });
});
