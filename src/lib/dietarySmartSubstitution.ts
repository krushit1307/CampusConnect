export interface SpecialMealRequest {
  id?: string;
  eventId: string;
  userId: string;
  rsvpId: string;
  restrictionType: string;
  alternativeMealName: string;
  pricePremium: number;
}

export interface CatererExportManifest {
  eventId: string;
  eventTitle: string;
  baseOrderSummary: string;
  totalBaseQuantity: number;
  specialRequests: Array<{
    userUuid: string;
    restrictionType: string;
    requestedMeal: string;
    pricePremium: number;
  }>;
  totalAdjustedBudgetCost: number;
}

export const MEAL_SUBSTITUTION_PREMIUMS: Record<string, { mealName: string; premium: number }> = {
  vegan: { mealName: "Vegan Pizza (Dairy-Free Cheese)", premium: 3.5 },
  "gluten-free": { mealName: "Gluten-Free Crust Pizza", premium: 4.0 },
  halal: { mealName: "Halal Certified Meat Pizza", premium: 2.5 },
  kosher: { mealName: "Kosher Prepared Meal Box", premium: 5.0 },
};

/**
 * Resolves default alternative meal name and price premium for a given restriction.
 */
export function resolveAlternativeMealOption(restrictionType: string): {
  mealName: string;
  premium: number;
} {
  const normalized = restrictionType.trim().toLowerCase();
  return (
    MEAL_SUBSTITUTION_PREMIUMS[normalized] || {
      mealName: `Special Meal (${restrictionType})`,
      premium: 0.0,
    }
  );
}

/**
 * Constructs a consolidated Caterer Export Manifest appending anonymized special requests and calculating budget adjustments.
 */
export function buildCatererExportManifest(
  eventTitle: string,
  eventId: string,
  baseItemName: string,
  totalRsvps: number,
  specialRequests: SpecialMealRequest[],
  baseUnitCost = 15.0,
): CatererExportManifest {
  const baseOrderCount = Math.max(0, totalRsvps - specialRequests.length);
  const totalBaseCost = totalRsvps * baseUnitCost;

  let totalPremiums = 0;
  const mappedRequests = specialRequests.map((req) => {
    totalPremiums += req.pricePremium;
    return {
      userUuid: req.userId,
      restrictionType: req.restrictionType,
      requestedMeal: req.alternativeMealName,
      pricePremium: req.pricePremium,
    };
  });

  return {
    eventId,
    eventTitle,
    baseOrderSummary: `Base Order: ${baseOrderCount} x ${baseItemName}`,
    totalBaseQuantity: totalRsvps,
    specialRequests: mappedRequests,
    totalAdjustedBudgetCost: Number((totalBaseCost + totalPremiums).toFixed(2)),
  };
}
