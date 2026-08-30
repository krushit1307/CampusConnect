// ============================================================
// CampusConnect – Content Warning Analyzer
// src/services/contentWarningService.ts
// Issue #3679: Automated Content Warning Tagging
// ============================================================

export type WarningCategory =
  | "Violence"
  | "Mental Health"
  | "Substance Abuse"
  | "Sexual Content"
  | "Eating Disorders"
  | "Self-Harm"
  | "Discrimination";

export interface ContentWarningResult {
  hasWarning: boolean;
  categories: WarningCategory[];
  matchedTerms: string[];
}

// ── Sensitive Topic Dictionary ───────────────────────────────

const SENSITIVE_TERMS: Record<WarningCategory, string[]> = {
  Violence: [
    "violence", "violent", "assault", "abuse", "abusive", "trauma",
    "traumatic", "war", "combat", "shooting", "stabbing", "murder",
    "homicide", "blood", "bloody", "gore", "gory", "weapon", "gun",
    "firearm", "knife", "attack", "beating", "torture",
    "domestic violence", "physical abuse", "sexual assault", "rape",
    "molestation",
  ],
  "Mental Health": [
    "depression", "anxiety", "panic attack", "ptsd", "post-traumatic",
    "bipolar", "schizophrenia", "psychosis", "psychotic", "suicidal",
    "suicide", "self-harm", "self harm", "cutting", "eating disorder",
    "anorexia", "bulimia", "body dysmorphia", "mental breakdown",
    "nervous breakdown", "therapy", "psychiatrist", "psychologist",
    "mental health", "counseling", "trauma recovery", "trauma healing",
    "emotional abuse", "psychological abuse", "gaslighting",
    "ptsd recovery", "trauma-informed",
  ],
  "Substance Abuse": [
    "substance abuse", "drug abuse", "drug addiction", "alcoholism",
    "alcohol abuse", "alcohol addiction", "opioid", "opioid crisis",
    "heroin", "cocaine", "meth", "methamphetamine",
    "addiction recovery", "substance use disorder", "overdose",
    "narcan", "naloxone", "rehab", "rehabilitation", "sober",
    "sobriety", "intoxication", "withdrawal",
  ],
  "Sexual Content": [
    "sexual", "sexuality", "sexual health", "sexual violence",
    "sexual harassment", "consent", "std", "sti", "hiv", "aids",
    "reproductive health", "abortion", "miscarriage",
    "sexual orientation", "gender identity", "intercourse",
    "intimate partner violence",
  ],
  "Eating Disorders": [
    "anorexia", "bulimia", "binge eating", "body image",
    "body dysmorphia", "eating disorder", "disordered eating",
    "purging", "restrictive eating", "calorie restriction",
    "diet culture", "thin ideal",
  ],
  "Self-Harm": [
    "self-harm", "self harm", "cutting", "self-injury",
    "self injury", "self-mutilation", "suicidal", "suicide",
    "suicide attempt", "suicidal ideation", "end my life",
    "kill myself", "hurt myself",
  ],
  Discrimination: [
    "racism", "racial", "discrimination", "prejudice", "bigotry",
    "xenophobia", "homophobia", "transphobia", "sexism", "sexist",
    "ableism", "islamophobia", "antisemitism", "anti-semitism",
    "hate crime", "hate speech", "white supremacy", "racial slur",
    "microaggression", "systemic racism", "police brutality",
    "racial profiling",
  ],
};

interface TermEntry {
  term: string;
  category: WarningCategory;
  regex: RegExp;
}

const COMPILED_TERMS: TermEntry[] = Object.entries(SENSITIVE_TERMS).flatMap(
  ([category, terms]) =>
    terms.map((term) => ({
      term,
      category: category as WarningCategory,
      regex: term.includes(" ")
        ? new RegExp(escapeRegex(term), "gi")
        : new RegExp(`\\b${escapeRegex(term)}\\b`, "gi"),
    })),
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Public API ───────────────────────────────────────────────

export function analyzeContentWarning(
  title: string,
  description: string,
): ContentWarningResult {
  const fullText = `${title || ""} ${description || ""}`.toLowerCase();
  const matchedCategories = new Set<WarningCategory>();
  const matchedTerms: string[] = [];

  for (const entry of COMPILED_TERMS) {
    const matches = fullText.match(entry.regex);
    if (matches && matches.length > 0) {
      matchedCategories.add(entry.category);
      matchedTerms.push(entry.term);
    }
  }

  return {
    hasWarning: matchedCategories.size > 0,
    categories: Array.from(matchedCategories),
    matchedTerms: [...new Set(matchedTerms)],
  };
}

export function formatWarningCategories(
  categories: WarningCategory[],
): string {
  return categories.join(", ");
}

export function getWarningDescription(
  categories: WarningCategory[],
): string {
  const descriptions: Record<WarningCategory, string> = {
    Violence: "This event discusses violence, trauma, or abuse.",
    "Mental Health": "This event discusses mental health topics that may be distressing.",
    "Substance Abuse": "This event discusses substance abuse or addiction.",
    "Sexual Content": "This event discusses sexual content or sexual health topics.",
    "Eating Disorders": "This event discusses eating disorders or body image issues.",
    "Self-Harm": "This event discusses self-harm or suicidal ideation.",
    Discrimination: "This event discusses discrimination, racism, or hate speech.",
  };
  return categories.map((c) => descriptions[c]).join(" ");
}
