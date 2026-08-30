/**
 * Test suite: Allergen and Labelling Register (#5012)
 * File: tests/services/allergenLabellingService.test.ts
 *
 * The cases worth writing down are the ones a one-level ingredient list and a
 * committee member with a tick box both pass: anchovies two components deep in
 * something sold as vegetarian, a label that was right when it was printed and
 * is wrong now because the paste changed, a "may contain" that swallowed a real
 * ingredient, and a gluten-free claim on a recipe with no gluten in it made on
 * a bench that had flour on it an hour earlier.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  AllergenLabellingService,
  REGULATED_ALLERGENS,
  type Allergen,
  type RecipeComponent,
} from "../../src/services/allergenLabellingService";

const PUBLISHED_AT = new Date("2028-05-04T09:00:00.000Z");
const ISSUED_AT = new Date("2028-05-04T11:30:00.000Z");
const AMENDED_AT = new Date("2028-05-11T08:00:00.000Z");

const MAIN_KITCHEN = "kitchen-union-main";
const DEDICATED_BENCH = "kitchen-dedicated-bench";

function ingredient(
  ingredientId: string,
  label: string,
  declaredAllergens: Allergen[],
): RecipeComponent {
  return { kind: "INGREDIENT", ingredientId, label, declaredAllergens };
}

function composite(componentRecipeId: string, label: string): RecipeComponent {
  return { kind: "COMPOSITE", componentRecipeId, label };
}

function build(): AllergenLabellingService {
  const service = new AllergenLabellingService();

  // The curry contains a paste, and the paste contains fish sauce.
  service.registerRecipe("recipe-paste", "House curry paste", [
    ingredient("ing-fish-sauce", "Fish sauce", ["FISH"]),
    ingredient("ing-chilli", "Red chilli", []),
  ]);
  service.registerRecipe("recipe-curry", "Society curry", [
    composite("recipe-paste", "House curry paste"),
    ingredient("ing-coconut", "Coconut milk", []),
    ingredient("ing-peanut", "Crushed peanut garnish", ["PEANUTS"]),
  ]);

  // The cake contains a frosting, and the frosting contains a flavouring that
  // contains soya. Three levels, because two is where people stop looking.
  service.registerRecipe("recipe-flavouring", "Vanilla flavouring", [
    ingredient("ing-lecithin", "Soya lecithin", ["SOYBEANS"]),
  ]);
  service.registerRecipe("recipe-frosting", "Buttercream frosting", [
    composite("recipe-flavouring", "Vanilla flavouring"),
    ingredient("ing-butter", "Butter", ["MILK"]),
  ]);
  service.registerRecipe("recipe-cake", "Bake sale sponge", [
    composite("recipe-frosting", "Buttercream frosting"),
    ingredient("ing-flour", "Plain flour", ["CEREALS_CONTAINING_GLUTEN"]),
    ingredient("ing-egg", "Egg", ["EGGS"]),
  ]);

  // Nothing regulated in it at all, which is what makes the free-from cases
  // turn entirely on the kitchen.
  service.registerRecipe("recipe-flapjack", "Gluten-free flapjack", [
    ingredient("ing-gf-oats", "Certified gluten-free oats", []),
    ingredient("ing-syrup", "Golden syrup", []),
  ]);

  service.registerRecipe("recipe-crisps", "Bought-in crisps", [
    ingredient("ing-potato", "Potato", []),
  ]);

  // Somebody has made the paste contain the curry.
  service.registerRecipe("recipe-loop-a", "Marinade", [composite("recipe-loop-b", "Glaze")]);
  service.registerRecipe("recipe-loop-b", "Glaze", [composite("recipe-loop-a", "Marinade")]);

  // A sub-recipe nobody ever published, used by something that was.
  service.registerRecipe("recipe-draft-sauce", "Draft sauce", [
    ingredient("ing-mustard", "Mustard", ["MUSTARD"]),
  ]);
  service.registerRecipe("recipe-uses-draft", "Dish using an unpublished sauce", [
    composite("recipe-draft-sauce", "Draft sauce"),
  ]);

  for (const recipeId of [
    "recipe-paste",
    "recipe-curry",
    "recipe-flavouring",
    "recipe-frosting",
    "recipe-cake",
    "recipe-flapjack",
    "recipe-crisps",
    "recipe-loop-a",
    "recipe-loop-b",
    "recipe-uses-draft",
  ]) {
    service.publishRecipeVersion(recipeId, 1, PUBLISHED_AT);
  }

  service.registerEnvironment({
    environmentId: MAIN_KITCHEN,
    label: "Union main kitchen",
    handledAllergens: ["CEREALS_CONTAINING_GLUTEN", "MILK", "EGGS", "NUTS"],
    // Flour and butter go over the same bench and the same mixer.
    sharedEquipmentAllergens: ["CEREALS_CONTAINING_GLUTEN", "MILK"],
  });

  service.registerEnvironment({
    environmentId: DEDICATED_BENCH,
    label: "Dedicated free-from bench",
    // Flour exists in the room. It does not touch this equipment.
    handledAllergens: ["CEREALS_CONTAINING_GLUTEN"],
    sharedEquipmentAllergens: [],
  });

  service.registerItem({
    itemId: "item-curry",
    name: "Curry, served from the urn",
    recipeId: "recipe-curry",
    saleFormat: "MADE_TO_ORDER_LOOSE",
  });
  service.registerItem({
    itemId: "item-cake",
    name: "Sponge slice, wrapped",
    recipeId: "recipe-cake",
    saleFormat: "PREPACKED_FOR_DIRECT_SALE",
  });
  service.registerItem({
    itemId: "item-flapjack",
    name: "Flapjack, wrapped",
    recipeId: "recipe-flapjack",
    saleFormat: "PREPACKED_FOR_DIRECT_SALE",
  });
  service.registerItem({
    itemId: "item-crisps",
    name: "Crisps",
    recipeId: "recipe-crisps",
    saleFormat: "PREPACKED_BY_THIRD_PARTY",
  });
  service.registerItem({
    itemId: "item-looped",
    name: "Marinated thing",
    recipeId: "recipe-loop-a",
    saleFormat: "PREPACKED_FOR_DIRECT_SALE",
  });
  service.registerItem({
    itemId: "item-uses-draft",
    name: "Dish using an unpublished sauce",
    recipeId: "recipe-uses-draft",
    saleFormat: "PREPACKED_FOR_DIRECT_SALE",
  });

  return service;
}

describe("AllergenLabellingService — transitive resolution", () => {
  let service: AllergenLabellingService;

  beforeEach(() => {
    service = build();
  });

  test("the fourteen regulated allergens are a closed set", () => {
    expect(REGULATED_ALLERGENS).toHaveLength(14);
  });

  test("an allergen two components deep is still an allergen", () => {
    const resolution = service.resolveAllergens("recipe-curry");

    expect(resolution.outcome).toBe("RESOLVED");
    // Nobody reading the curry's own ingredient list would find the fish sauce.
    expect(resolution.allergens).toContain("FISH");
    expect(resolution.allergens).toContain("PEANUTS");
  });

  test("three levels deep resolves and deduplicates in a stable order", () => {
    const resolution = service.resolveAllergens("recipe-cake");

    expect(resolution.outcome).toBe("RESOLVED");
    expect(resolution.allergens).toEqual(["CEREALS_CONTAINING_GLUTEN", "EGGS", "SOYBEANS", "MILK"]);
  });

  test("a cycle is refused rather than followed until the stack runs out", () => {
    const resolution = service.resolveAllergens("recipe-loop-a");

    expect(resolution.outcome).toBe("CYCLIC_COMPONENT_GRAPH");
    expect(resolution.allergens).toEqual([]);
    expect(resolution.failedPath.length).toBeGreaterThan(1);
  });

  test("an unpublished component fails the whole resolution rather than returning a partial set", () => {
    const resolution = service.resolveAllergens("recipe-uses-draft");

    expect(resolution.outcome).toBe("NO_PUBLISHED_VERSION");
    // The mustard is real and is not reported, which is why this must refuse.
    expect(resolution.allergens).toEqual([]);
  });
});

describe("AllergenLabellingService — declared versus precautionary", () => {
  let service: AllergenLabellingService;

  beforeEach(() => {
    service = build();
  });

  test("the kitchen adds precautionary advice and never a declared allergen", () => {
    const result = service.issueLabel({
      labelId: "label-flapjack-1",
      itemId: "item-flapjack",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("ISSUED");
    // The recipe has nothing regulated in it, and the bench does not change that.
    expect(result.label?.declaredAllergens).toEqual([]);
    expect(result.label?.precautionaryAllergens).toEqual(["CEREALS_CONTAINING_GLUTEN", "MILK"]);
  });

  test("precautionary advice does not repeat something already declared", () => {
    const result = service.issueLabel({
      labelId: "label-cake-1",
      itemId: "item-cake",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.label?.declaredAllergens).toContain("MILK");
    expect(result.label?.declaredAllergens).toContain("CEREALS_CONTAINING_GLUTEN");
    // Both are ingredients here, so neither belongs in a "may contain" line.
    expect(result.label?.precautionaryAllergens).toEqual([]);
  });
});

describe("AllergenLabellingService — sale format decides the requirement", () => {
  let service: AllergenLabellingService;

  beforeEach(() => {
    service = build();
  });

  test("wrapped on the premises needs a full emphasised ingredient list", () => {
    const result = service.issueLabel({
      labelId: "label-cake-2",
      itemId: "item-cake",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.label?.requirement).toBe("FULL_INGREDIENT_LIST_WITH_EMPHASIS");
  });

  test("ladled out of an urn needs allergen information on request", () => {
    const result = service.issueLabel({
      labelId: "label-curry-1",
      itemId: "item-curry",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.label?.requirement).toBe("ALLERGEN_INFORMATION_ON_REQUEST");
    expect(result.label?.declaredAllergens).toContain("FISH");
  });

  test("something bought in already labelled keeps the manufacturer's label", () => {
    const result = service.issueLabel({
      labelId: "label-crisps-1",
      itemId: "item-crisps",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.label?.requirement).toBe("MANUFACTURER_LABEL_SUFFICIENT");
  });
});

describe("AllergenLabellingService — free-from claims", () => {
  let service: AllergenLabellingService;

  beforeEach(() => {
    service = build();
  });

  test("a clean recipe cannot carry a free-from claim off shared equipment", () => {
    const result = service.issueLabel({
      labelId: "label-flapjack-2",
      itemId: "item-flapjack",
      environmentId: MAIN_KITCHEN,
      freeFromClaims: ["CEREALS_CONTAINING_GLUTEN"],
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_FREE_FROM_SHARED_EQUIPMENT");
    expect(result.offendingAllergen).toBe("CEREALS_CONTAINING_GLUTEN");
    expect(result.label).toBeNull();
  });

  test("the same claim stands on a dedicated bench in the same room as flour", () => {
    const result = service.issueLabel({
      labelId: "label-flapjack-3",
      itemId: "item-flapjack",
      environmentId: DEDICATED_BENCH,
      freeFromClaims: ["CEREALS_CONTAINING_GLUTEN"],
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("ISSUED");
    expect(result.label?.freeFromClaims).toEqual(["CEREALS_CONTAINING_GLUTEN"]);
  });

  test("a claim against a declared ingredient is refused for a different reason", () => {
    const result = service.issueLabel({
      labelId: "label-cake-3",
      itemId: "item-cake",
      environmentId: DEDICATED_BENCH,
      freeFromClaims: ["MILK"],
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_FREE_FROM_DECLARED_ALLERGEN");
    expect(result.offendingAllergen).toBe("MILK");
  });
});

describe("AllergenLabellingService — version binding and invalidation", () => {
  let service: AllergenLabellingService;

  beforeEach(() => {
    service = build();
  });

  test("amending a recipe invalidates the labels printed against it", () => {
    const issued = service.issueLabel({
      labelId: "label-cake-4",
      itemId: "item-cake",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });
    expect(issued.label?.state).toBe("VALID");

    service.amendRecipe(
      "recipe-cake",
      [
        composite("recipe-frosting", "Buttercream frosting"),
        ingredient("ing-flour", "Plain flour", ["CEREALS_CONTAINING_GLUTEN"]),
        ingredient("ing-egg", "Egg", ["EGGS"]),
        ingredient("ing-sesame", "Sesame seed topping", ["SESAME"]),
      ],
      AMENDED_AT,
      "sesame topping added",
    );

    const label = service.getLabel("label-cake-4");
    expect(label?.state).toBe("INVALIDATED_BY_AMENDMENT");
    expect(label?.invalidatedAt).toEqual(AMENDED_AT);
    expect(service.invalidLabels().map((l) => l.labelId)).toContain("label-cake-4");
  });

  test("amending a sub-recipe invalidates the labels of everything containing it", () => {
    service.issueLabel({
      labelId: "label-cake-5",
      itemId: "item-cake",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    // The flavouring supplier changed. The cake's own recipe did not change at
    // all, and its label is now wrong.
    service.amendRecipe(
      "recipe-flavouring",
      [ingredient("ing-lecithin-nut", "Nut-derived flavour base", ["NUTS"])],
      AMENDED_AT,
      "flavouring reformulated",
    );

    const label = service.getLabel("label-cake-5");
    expect(label?.state).toBe("INVALIDATED_BY_AMENDMENT");
    expect(label?.invalidatedBecause).toContain("recipe-flavouring");
  });

  test("an unrelated recipe's amendment leaves a label alone", () => {
    service.issueLabel({
      labelId: "label-cake-6",
      itemId: "item-cake",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    service.amendRecipe(
      "recipe-paste",
      [ingredient("ing-chilli", "Red chilli", [])],
      AMENDED_AT,
      "fish sauce removed",
    );

    expect(service.getLabel("label-cake-6")?.state).toBe("VALID");
    expect(service.validLabels().map((l) => l.labelId)).toContain("label-cake-6");
  });

  test("a superseded version cannot be printed again", () => {
    service.amendRecipe(
      "recipe-cake",
      [ingredient("ing-flour", "Plain flour", ["CEREALS_CONTAINING_GLUTEN"])],
      AMENDED_AT,
    );

    const result = service.issueLabel({
      labelId: "label-cake-7",
      itemId: "item-cake",
      environmentId: MAIN_KITCHEN,
      recipeVersion: 1,
      issuedAt: AMENDED_AT,
    });

    expect(result.outcome).toBe("REFUSED_VERSION_SUPERSEDED");
  });

  test("the amended version resolves to the new allergen set", () => {
    service.amendRecipe(
      "recipe-flavouring",
      [ingredient("ing-lecithin-nut", "Nut-derived flavour base", ["NUTS"])],
      AMENDED_AT,
    );

    const resolution = service.resolveAllergens("recipe-cake");
    expect(resolution.allergens).toContain("NUTS");
    expect(resolution.allergens).not.toContain("SOYBEANS");
  });
});

describe("AllergenLabellingService — issuance refusals name the rule", () => {
  let service: AllergenLabellingService;

  beforeEach(() => {
    service = build();
  });

  test("a draft recipe cannot be printed against", () => {
    service.registerRecipe("recipe-unpublished", "Never published", [
      ingredient("ing-celery", "Celery salt", ["CELERY"]),
    ]);
    service.registerItem({
      itemId: "item-unpublished",
      name: "Draft dish",
      recipeId: "recipe-unpublished",
      saleFormat: "PREPACKED_FOR_DIRECT_SALE",
    });

    const result = service.issueLabel({
      labelId: "label-draft",
      itemId: "item-unpublished",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_VERSION_NOT_PUBLISHED");
  });

  test("an unresolved component refuses rather than printing what it did find", () => {
    const result = service.issueLabel({
      labelId: "label-uses-draft",
      itemId: "item-uses-draft",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_UNRESOLVED_COMPONENT");
    expect(result.label).toBeNull();
  });

  test("a cyclic component graph refuses at issuance too", () => {
    const result = service.issueLabel({
      labelId: "label-looped",
      itemId: "item-looped",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_CYCLIC_COMPONENTS");
  });

  test("a label cannot be issued without knowing which kitchen made it", () => {
    const result = service.issueLabel({
      labelId: "label-no-kitchen",
      itemId: "item-cake",
      environmentId: "kitchen-does-not-exist",
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_UNKNOWN_ENVIRONMENT");
  });

  test("an unknown item is refused", () => {
    const result = service.issueLabel({
      labelId: "label-nothing",
      itemId: "item-does-not-exist",
      environmentId: MAIN_KITCHEN,
      issuedAt: ISSUED_AT,
    });

    expect(result.outcome).toBe("REFUSED_UNKNOWN_ITEM");
  });
});
