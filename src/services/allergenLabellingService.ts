/**
 * Module: Allergen and Labelling Register
 * File: src/services/allergenLabellingService.ts
 * Scope: Resolves the regulated allergen set transitively through composite
 *        recipes, keeps declared ingredients separate from precautionary
 *        cross-contamination advice, binds every printed label to an immutable
 *        recipe version, and refuses to issue a label the sale format, the
 *        kitchen, or an unresolved component makes unsafe (#5012).
 *
 * A dietary preference and an allergen declaration are not the same object.
 * "Vegetarian" is a choice the caterer accommodates; sesame is a statutory
 * declaration attached to the food itself, true whether or not anybody at the
 * event has said anything. Held in one free-text field on an RSVP, the second
 * one is only ever as accurate as the guest list — and the person who buys a
 * brownie at the door is not on the guest list.
 *
 * The hazard that this module exists for is the sub-recipe. The curry contains
 * a paste and the paste contains fish sauce; the cake contains a frosting and
 * the frosting contains a flavouring that contains soya. A one-level ingredient
 * list is exactly how anchovies end up in a dish sold as vegetarian, so the
 * allergen set is resolved through composite components until it terminates —
 * and a cycle in that graph is refused rather than followed until the stack
 * runs out.
 *
 * "May contain" is not an allergen. Precautionary advice and a declared
 * ingredient are different claims with different consequences, and collapsing
 * them produces both failures at once: a coeliac told a naturally gluten-free
 * item is unsafe, and a genuine wheat ingredient buried under a precautionary
 * label nobody reads. They are separate fields here with separate provenance —
 * one from the recipe, one from the room it was made in.
 *
 * A recipe changes and the label does not. The supplier substitutes the
 * margarine for one containing milk; the label printed a fortnight ago is now
 * wrong and looks exactly as authoritative as it did when it was right. So a
 * label is bound to a version, publishing freezes that version, and amending a
 * recipe invalidates every label printed against the old one — including labels
 * for the dishes that merely *contain* the amended recipe, which is the case
 * that gets missed.
 *
 * And a free-from claim is a stronger statement than an absent allergen. "Does
 * not contain gluten" describes the recipe; "gluten-free" describes the recipe
 * and the process. An item made on shared equipment cannot carry the second
 * claim regardless of what its ingredients say, so the claim is refused at
 * issuance rather than left to a committee member with a tick box.
 */

/** The fourteen regulated allergens. Not a preference list, and not extensible by a caller. */
export type Allergen =
  | "CEREALS_CONTAINING_GLUTEN"
  | "CRUSTACEANS"
  | "EGGS"
  | "FISH"
  | "PEANUTS"
  | "SOYBEANS"
  | "MILK"
  | "NUTS"
  | "CELERY"
  | "MUSTARD"
  | "SESAME"
  | "SULPHUR_DIOXIDE"
  | "LUPIN"
  | "MOLLUSCS";

export const REGULATED_ALLERGENS: readonly Allergen[] = [
  "CEREALS_CONTAINING_GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOYBEANS",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHUR_DIOXIDE",
  "LUPIN",
  "MOLLUSCS",
];

/**
 * How the food reaches the person eating it. This — not what it is — decides
 * which labelling requirement applies.
 */
export type SaleFormat =
  /** Made and wrapped on site, sold from the same premises. The strict case. */
  | "PREPACKED_FOR_DIRECT_SALE"
  /** Arrived already labelled by whoever made it. */
  | "PREPACKED_BY_THIRD_PARTY"
  /** Ladled out of an urn, handed over unwrapped. */
  | "MADE_TO_ORDER_LOOSE";

export type LabelRequirement =
  | "FULL_INGREDIENT_LIST_WITH_EMPHASIS"
  | "MANUFACTURER_LABEL_SUFFICIENT"
  | "ALLERGEN_INFORMATION_ON_REQUEST";

export type ResolutionOutcome =
  "RESOLVED" | "UNKNOWN_RECIPE" | "NO_PUBLISHED_VERSION" | "CYCLIC_COMPONENT_GRAPH";

export type LabelOutcome =
  | "ISSUED"
  | "REFUSED_UNKNOWN_ITEM"
  | "REFUSED_UNKNOWN_RECIPE"
  | "REFUSED_VERSION_NOT_PUBLISHED"
  | "REFUSED_VERSION_SUPERSEDED"
  | "REFUSED_UNRESOLVED_COMPONENT"
  | "REFUSED_CYCLIC_COMPONENTS"
  | "REFUSED_UNKNOWN_ENVIRONMENT"
  | "REFUSED_FREE_FROM_DECLARED_ALLERGEN"
  | "REFUSED_FREE_FROM_SHARED_EQUIPMENT";

export type LabelState = "VALID" | "INVALIDATED_BY_AMENDMENT";

/** A leaf: something bought in, with the allergens it declares. */
export interface IngredientComponent {
  kind: "INGREDIENT";
  ingredientId: string;
  label: string;
  declaredAllergens: Allergen[];
}

/** A branch: another recipe used inside this one. The reason resolution is transitive. */
export interface CompositeComponent {
  kind: "COMPOSITE";
  componentRecipeId: string;
  label: string;
}

export type RecipeComponent = IngredientComponent | CompositeComponent;

export interface RecipeVersion {
  recipeId: string;
  version: number;
  components: RecipeComponent[];
  /** Null until published. A draft is not something a label may be printed against. */
  publishedAt: Date | null;
}

export interface Recipe {
  recipeId: string;
  name: string;
  versions: RecipeVersion[];
}

export interface KitchenEnvironment {
  environmentId: string;
  label: string;
  /** Present anywhere in the kitchen. */
  handledAllergens: Allergen[];
  /**
   * Present on equipment this item's batch shares. This, not the room, is what
   * defeats a free-from claim.
   */
  sharedEquipmentAllergens: Allergen[];
}

export interface FoodItem {
  itemId: string;
  name: string;
  recipeId: string;
  saleFormat: SaleFormat;
}

export interface AllergenResolution {
  outcome: ResolutionOutcome;
  /** Empty unless the outcome is RESOLVED. A partial set is worse than no set. */
  allergens: Allergen[];
  /** The component chain that failed, so a refusal names the paste rather than the curry. */
  failedPath: string[];
  failedRecipeId: string | null;
}

export interface IssuedLabel {
  labelId: string;
  itemId: string;
  recipeId: string;
  recipeVersion: number;
  environmentId: string;
  saleFormat: SaleFormat;
  requirement: LabelRequirement;
  /** From the recipe. Emphasised on the pack. */
  declaredAllergens: Allergen[];
  /** From the room. Never promoted into the line above. */
  precautionaryAllergens: Allergen[];
  freeFromClaims: Allergen[];
  issuedAt: Date;
  state: LabelState;
  invalidatedAt: Date | null;
  invalidatedBecause: string | null;
}

export interface LabelIssueRequest {
  labelId: string;
  itemId: string;
  environmentId: string;
  /** The version being printed against. Omitted means the current published one. */
  recipeVersion?: number;
  freeFromClaims?: Allergen[];
  issuedAt: Date;
}

export interface LabelIssueResult {
  outcome: LabelOutcome;
  label: IssuedLabel | null;
  reason: string;
  /** Which allergen defeated a free-from claim, where one did. */
  offendingAllergen: Allergen | null;
}

const REQUIREMENT_BY_FORMAT: Record<SaleFormat, LabelRequirement> = {
  // Made here, wrapped here, sold here: a full ingredient list with the
  // regulated allergens emphasised, on the pack. Not a card next to the tray.
  PREPACKED_FOR_DIRECT_SALE: "FULL_INGREDIENT_LIST_WITH_EMPHASIS",
  PREPACKED_BY_THIRD_PARTY: "MANUFACTURER_LABEL_SUFFICIENT",
  MADE_TO_ORDER_LOOSE: "ALLERGEN_INFORMATION_ON_REQUEST",
};

function sortAllergens(values: Iterable<Allergen>): Allergen[] {
  const seen = new Set(values);
  return REGULATED_ALLERGENS.filter((allergen) => seen.has(allergen));
}

export class AllergenLabellingService {
  private readonly recipes = new Map<string, Recipe>();
  private readonly environments = new Map<string, KitchenEnvironment>();
  private readonly items = new Map<string, FoodItem>();
  private readonly labels = new Map<string, IssuedLabel>();

  registerRecipe(recipeId: string, name: string, components: RecipeComponent[]): RecipeVersion {
    const version: RecipeVersion = {
      recipeId,
      version: 1,
      components: components.map((component) => ({ ...component })),
      publishedAt: null,
    };
    this.recipes.set(recipeId, { recipeId, name, versions: [version] });
    return { ...version };
  }

  registerEnvironment(environment: KitchenEnvironment): void {
    this.environments.set(environment.environmentId, {
      ...environment,
      handledAllergens: [...environment.handledAllergens],
      sharedEquipmentAllergens: [...environment.sharedEquipmentAllergens],
    });
  }

  registerItem(item: FoodItem): void {
    this.items.set(item.itemId, { ...item });
  }

  /** Publishing freezes the version. Nothing may be printed against a draft. */
  publishRecipeVersion(recipeId: string, version: number, at: Date): boolean {
    const recipe = this.recipes.get(recipeId);
    const target = recipe?.versions.find((candidate) => candidate.version === version);
    if (!target || target.publishedAt) return false;
    target.publishedAt = at;
    return true;
  }

  currentPublishedVersion(recipeId: string): RecipeVersion | null {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return null;
    const published = recipe.versions.filter((version) => version.publishedAt !== null);
    if (published.length === 0) return null;
    return published.reduce((latest, version) =>
      version.version > latest.version ? version : latest,
    );
  }

  /**
   * Amending a recipe creates a new version rather than editing the old one,
   * and invalidates every label printed against a superseded version —
   * including labels for dishes that merely contain this recipe, which is the
   * case that gets missed when the paste changes and the curry does not.
   */
  amendRecipe(
    recipeId: string,
    components: RecipeComponent[],
    at: Date,
    note = "recipe amended",
  ): RecipeVersion | null {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return null;

    const nextNumber =
      recipe.versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
    const next: RecipeVersion = {
      recipeId,
      version: nextNumber,
      components: components.map((component) => ({ ...component })),
      publishedAt: at,
    };
    recipe.versions.push(next);

    const affected = this.recipesContaining(recipeId);
    for (const label of this.labels.values()) {
      if (label.state !== "VALID") continue;
      const boundToAmended = label.recipeId === recipeId && label.recipeVersion < nextNumber;
      const containsAmended = affected.has(label.recipeId);
      if (!boundToAmended && !containsAmended) continue;

      label.state = "INVALIDATED_BY_AMENDMENT";
      label.invalidatedAt = at;
      label.invalidatedBecause = boundToAmended
        ? `${note}: bound to superseded version ${label.recipeVersion}`
        : `${note}: contains amended component recipe ${recipeId}`;
    }

    return { ...next };
  }

  /** Every recipe that reaches `recipeId` through published composite components. */
  private recipesContaining(recipeId: string): Set<string> {
    const containers = new Set<string>();
    for (const recipe of this.recipes.values()) {
      if (recipe.recipeId === recipeId) continue;
      if (this.reaches(recipe.recipeId, recipeId, new Set())) containers.add(recipe.recipeId);
    }
    return containers;
  }

  private reaches(fromRecipeId: string, targetRecipeId: string, visiting: Set<string>): boolean {
    if (visiting.has(fromRecipeId)) return false;
    visiting.add(fromRecipeId);

    const version = this.currentPublishedVersion(fromRecipeId);
    if (!version) return false;

    for (const component of version.components) {
      if (component.kind !== "COMPOSITE") continue;
      if (component.componentRecipeId === targetRecipeId) return true;
      if (this.reaches(component.componentRecipeId, targetRecipeId, visiting)) return true;
    }
    return false;
  }

  /**
   * Walk the component graph and return the union of declared allergens, or
   * fail. A partial set is more dangerous than no set at all, so an unresolved
   * component or a cycle returns an empty set with the path that broke.
   */
  resolveAllergens(recipeId: string, version?: number): AllergenResolution {
    const found = new Set<Allergen>();
    const path: string[] = [];
    const visiting = new Set<string>();

    const walk = (currentRecipeId: string, wantedVersion?: number): ResolutionOutcome => {
      const recipe = this.recipes.get(currentRecipeId);
      if (!recipe) return "UNKNOWN_RECIPE";

      if (visiting.has(currentRecipeId)) return "CYCLIC_COMPONENT_GRAPH";
      visiting.add(currentRecipeId);
      path.push(recipe.name);

      const target =
        wantedVersion === undefined
          ? this.currentPublishedVersion(currentRecipeId)
          : (recipe.versions.find(
              (candidate) => candidate.version === wantedVersion && candidate.publishedAt !== null,
            ) ?? null);

      if (!target) return "NO_PUBLISHED_VERSION";

      for (const component of target.components) {
        if (component.kind === "INGREDIENT") {
          for (const allergen of component.declaredAllergens) found.add(allergen);
          continue;
        }
        const nested = walk(component.componentRecipeId);
        if (nested !== "RESOLVED") return nested;
      }

      visiting.delete(currentRecipeId);
      path.pop();
      return "RESOLVED";
    };

    const outcome = walk(recipeId, version);
    return {
      outcome,
      allergens: outcome === "RESOLVED" ? sortAllergens(found) : [],
      failedPath: outcome === "RESOLVED" ? [] : [...path],
      failedRecipeId: outcome === "RESOLVED" ? null : path.length > 0 ? recipeId : null,
    };
  }

  /**
   * Advice from the room rather than the recipe. Anything already declared is
   * excluded: telling someone a dish "may contain" milk when milk is an
   * ingredient is how precautionary labelling stopped being read.
   */
  precautionaryFor(declared: Allergen[], environment: KitchenEnvironment): Allergen[] {
    const declaredSet = new Set(declared);
    return sortAllergens(
      environment.sharedEquipmentAllergens.filter((allergen) => !declaredSet.has(allergen)),
    );
  }

  requirementFor(saleFormat: SaleFormat): LabelRequirement {
    return REQUIREMENT_BY_FORMAT[saleFormat];
  }

  getLabel(labelId: string): IssuedLabel | undefined {
    const label = this.labels.get(labelId);
    return label ? { ...label } : undefined;
  }

  /**
   * The only place any of this can be enforced. Everything above is invisible
   * on a wrapped brownie on a table at two in the afternoon, so issuance is an
   * operation that can be refused, and a refusal names which rule refused it.
   */
  issueLabel(request: LabelIssueRequest): LabelIssueResult {
    const refuse = (outcome: LabelOutcome, reason: string, allergen: Allergen | null = null) => ({
      outcome,
      label: null,
      reason,
      offendingAllergen: allergen,
    });

    const item = this.items.get(request.itemId);
    if (!item) return refuse("REFUSED_UNKNOWN_ITEM", "No such food item.");

    const recipe = this.recipes.get(item.recipeId);
    if (!recipe)
      return refuse("REFUSED_UNKNOWN_RECIPE", "Item references a recipe that does not exist.");

    const environment = this.environments.get(request.environmentId);
    if (!environment) {
      return refuse(
        "REFUSED_UNKNOWN_ENVIRONMENT",
        "Cross-contamination advice cannot be derived without the kitchen the batch was made in.",
      );
    }

    const current = this.currentPublishedVersion(item.recipeId);
    if (!current) {
      return refuse(
        "REFUSED_VERSION_NOT_PUBLISHED",
        "Recipe has no published version to print against.",
      );
    }

    const wanted = request.recipeVersion ?? current.version;
    const target = recipe.versions.find((candidate) => candidate.version === wanted);
    if (!target) return refuse("REFUSED_UNKNOWN_RECIPE", `Recipe has no version ${wanted}.`);
    if (!target.publishedAt) {
      return refuse("REFUSED_VERSION_NOT_PUBLISHED", `Version ${wanted} is a draft.`);
    }
    if (wanted < current.version) {
      return refuse(
        "REFUSED_VERSION_SUPERSEDED",
        `Version ${wanted} was superseded by version ${current.version}.`,
      );
    }

    const resolution = this.resolveAllergens(item.recipeId, wanted);
    if (resolution.outcome === "CYCLIC_COMPONENT_GRAPH") {
      return refuse(
        "REFUSED_CYCLIC_COMPONENTS",
        `Component graph is cyclic via ${resolution.failedPath.join(" > ")}.`,
      );
    }
    if (resolution.outcome !== "RESOLVED") {
      return refuse(
        "REFUSED_UNRESOLVED_COMPONENT",
        `Cannot resolve components under ${resolution.failedPath.join(" > ")}: ${resolution.outcome}.`,
      );
    }

    const declared = resolution.allergens;
    const claims = request.freeFromClaims ?? [];

    for (const claim of claims) {
      if (declared.includes(claim)) {
        return refuse(
          "REFUSED_FREE_FROM_DECLARED_ALLERGEN",
          `Cannot claim free from ${claim}: it is a declared ingredient.`,
          claim,
        );
      }
      // The recipe is clean and the claim is still unsupportable, because the
      // claim is about the process as well as the ingredients.
      if (environment.sharedEquipmentAllergens.includes(claim)) {
        return refuse(
          "REFUSED_FREE_FROM_SHARED_EQUIPMENT",
          `Cannot claim free from ${claim}: the batch was made on equipment shared with it.`,
          claim,
        );
      }
    }

    const label: IssuedLabel = {
      labelId: request.labelId,
      itemId: item.itemId,
      recipeId: item.recipeId,
      recipeVersion: wanted,
      environmentId: environment.environmentId,
      saleFormat: item.saleFormat,
      requirement: REQUIREMENT_BY_FORMAT[item.saleFormat],
      declaredAllergens: declared,
      precautionaryAllergens: this.precautionaryFor(declared, environment),
      freeFromClaims: sortAllergens(claims),
      issuedAt: request.issuedAt,
      state: "VALID",
      invalidatedAt: null,
      invalidatedBecause: null,
    };

    this.labels.set(label.labelId, label);
    return {
      outcome: "ISSUED",
      label: { ...label },
      reason: "Label issued.",
      offendingAllergen: null,
    };
  }

  /** Labels that must be pulled off the shelf. */
  invalidLabels(): IssuedLabel[] {
    return [...this.labels.values()]
      .filter((label) => label.state === "INVALIDATED_BY_AMENDMENT")
      .map((label) => ({ ...label }));
  }

  validLabels(): IssuedLabel[] {
    return [...this.labels.values()]
      .filter((label) => label.state === "VALID")
      .map((label) => ({ ...label }));
  }
}
