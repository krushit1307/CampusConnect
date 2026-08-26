// =============================================================================
// Dietary Restriction Allergen Collision (#4421)
// Cross-references a user's dietary_restrictions with an event menu's known
// allergens. Absolute collision = the selected menu has no safe dish.
// =============================================================================

export interface MenuAllergenItem {
  is_vegan: boolean;
  is_gluten_free: boolean;
  contains_nuts: boolean;
  contains_dairy: boolean;
}

export type AllergenKey = "gluten" | "vegan" | "nuts" | "dairy";

export interface AllergenCollisionResult {
  hasAbsoluteCollision: boolean;
  servedAllergens: string[];
  warningMessage: string | null;
}

const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  gluten: "Gluten",
  vegan: "Non-Vegan food",
  nuts: "Nuts",
  dairy: "Dairy",
};

function normalizeRestriction(tag: string): AllergenKey | null {
  const value = tag.toLowerCase().trim().replace(/[_-]+/g, " ");
  if (!value || value === "none") return null;
  if (
    value.includes("celiac") ||
    value.includes("coeliac") ||
    value.includes("gluten")
  ) {
    return "gluten";
  }
  if (value.includes("vegan")) return "vegan";
  if (value.includes("nut") || value.includes("peanut")) return "nuts";
  if (value.includes("dairy") || value.includes("lactose") || value.includes("milk")) {
    return "dairy";
  }
  return null;
}

function itemIsSafeFor(item: MenuAllergenItem, key: AllergenKey): boolean {
  switch (key) {
    case "gluten":
      return item.is_gluten_free;
    case "vegan":
      return item.is_vegan;
    case "nuts":
      return !item.contains_nuts;
    case "dairy":
      return !item.contains_dairy;
  }
}

function formatAllergenList(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/**
 * Returns an absolute collision when a caterer/menu is selected and every
 * dish conflicts with the user's dietary profile.
 */
export function detectAbsoluteAllergenCollision(
  dietaryRestrictions: string[] | null | undefined,
  menuItems: MenuAllergenItem[] | null | undefined,
): AllergenCollisionResult {
  const empty: AllergenCollisionResult = {
    hasAbsoluteCollision: false,
    servedAllergens: [],
    warningMessage: null,
  };

  if (!menuItems || menuItems.length === 0) return empty;

  const keys = [
    ...new Set((dietaryRestrictions ?? []).map(normalizeRestriction).filter(Boolean)),
  ] as AllergenKey[];
  if (keys.length === 0) return empty;

  const hasSafeDish = menuItems.some((item) => keys.every((key) => itemIsSafeFor(item, key)));
  if (hasSafeDish) return empty;

  const servedAllergens = keys
    .filter((key) => !menuItems.some((item) => itemIsSafeFor(item, key)))
    .map((key) => ALLERGEN_LABELS[key]);

  const warningMessage =
    servedAllergens.length > 0
      ? `WARNING: This event only serves ${formatAllergenList(servedAllergens)}. There are no safe food options available for your dietary profile. Do you still wish to attend?`
      : "WARNING: There are no safe food options available for your dietary profile. Do you still wish to attend?";

  return {
    hasAbsoluteCollision: true,
    servedAllergens,
    warningMessage,
  };
}
