// =============================================================================
// Utility: Badge Composer Types & Whitelist Validation
// Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
// Description: Defines the strict JSON schema used to compose badges (shape +
// gradient + icon + ribbon text). Badges are NEVER stored or rendered as raw
// SVG/XML strings - only this whitelisted JSON shape is accepted, which the
// DynamicBadge component turns into real JSX/SVG elements.
// =============================================================================

export const BADGE_SHAPES = ["shield", "circle", "star"] as const;
export type BadgeShape = (typeof BADGE_SHAPES)[number];

export const BADGE_ICONS = [
    "zap",
    "star",
    "award",
    "shield",
    "trophy",
    "flame",
    "heart",
    "target",
] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export interface BadgeComposition {
    shape: BadgeShape;
    gradientFrom: string;
    gradientTo: string;
    icon: BadgeIcon;
    ribbonText: string;
}

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_BADGE_COMPOSITION: BadgeComposition = {
    shape: "shield",
    gradientFrom: "#6366f1",
    gradientTo: "#8b5cf6",
    icon: "star",
    ribbonText: "",
};

/**
 * Strictly validates and normalizes an arbitrary JSON value into a safe
 * BadgeComposition. Anything that doesn't match the whitelist falls back to
 * a safe default instead of being trusted - this is what prevents a
 * malformed/malicious payload from ever reaching the renderer.
 */
export function sanitizeBadgeComposition(raw: unknown): BadgeComposition {
    const input = (raw && typeof raw === "object" ? raw : {}) as Partial<BadgeComposition>;

    const shape = BADGE_SHAPES.includes(input.shape as BadgeShape)
        ? (input.shape as BadgeShape)
        : DEFAULT_BADGE_COMPOSITION.shape;

    const icon = BADGE_ICONS.includes(input.icon as BadgeIcon)
        ? (input.icon as BadgeIcon)
        : DEFAULT_BADGE_COMPOSITION.icon;

    const gradientFrom = HEX_COLOR_REGEX.test(input.gradientFrom || "")
        ? (input.gradientFrom as string)
        : DEFAULT_BADGE_COMPOSITION.gradientFrom;

    const gradientTo = HEX_COLOR_REGEX.test(input.gradientTo || "")
        ? (input.gradientTo as string)
        : DEFAULT_BADGE_COMPOSITION.gradientTo;

    // Ribbon text is rendered as a plain SVG <text> child (never dangerouslySetInnerHTML),
    // so React escapes it automatically. We still cap the length for layout safety.
    const ribbonText = typeof input.ribbonText === "string" ? input.ribbonText.slice(0, 24) : "";

    return { shape, gradientFrom, gradientTo, icon, ribbonText };
}