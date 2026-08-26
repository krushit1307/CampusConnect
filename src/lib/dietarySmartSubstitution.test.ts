import { describe, it, expect } from "vitest";
import {
  resolveAlternativeMealOption,
  buildCatererExportManifest,
  SpecialMealRequest,
} from "./dietarySmartSubstitution";

describe("Develop Dynamic Dietary Restriction Smart Substitution Suite (#4475)", () => {
  it("resolves alternative meal names and price premiums for dietary restrictions", () => {
    const veganOpt = resolveAlternativeMealOption("vegan");
    expect(veganOpt.mealName).toContain("Vegan Pizza");
    expect(veganOpt.premium).toBe(3.5);

    const gfOpt = resolveAlternativeMealOption("gluten-free");
    expect(gfOpt.premium).toBe(4.0);
  });

  it("builds caterer export manifest appending special requests and adjusting budget", () => {
    const requests: SpecialMealRequest[] = [
      {
        eventId: "evt_pizza_night",
        userId: "usr_alice_uuid",
        rsvpId: "rsvp_1",
        restrictionType: "vegan",
        alternativeMealName: "Vegan Pizza (Dairy-Free Cheese)",
        pricePremium: 3.5,
      },
      {
        eventId: "evt_pizza_night",
        userId: "usr_bob_uuid",
        rsvpId: "rsvp_2",
        restrictionType: "gluten-free",
        alternativeMealName: "Gluten-Free Crust Pizza",
        pricePremium: 4.0,
      },
    ];

    const manifest = buildCatererExportManifest(
      "Campus Pizza Party",
      "evt_pizza_night",
      "Standard Cheese Pizza",
      50,
      requests,
      10.0, // $10 per base pizza
    );

    expect(manifest.baseOrderSummary).toBe("Base Order: 48 x Standard Cheese Pizza");
    expect(manifest.specialRequests.length).toBe(2);
    expect(manifest.specialRequests[0].userUuid).toBe("usr_alice_uuid");
    expect(manifest.specialRequests[0].requestedMeal).toContain("Vegan Pizza");

    // Base cost: 50 * $10 = $500. Premiums: $3.50 + $4.00 = $7.50 -> Total: $507.50
    expect(manifest.totalAdjustedBudgetCost).toBe(507.5);
  });
});
