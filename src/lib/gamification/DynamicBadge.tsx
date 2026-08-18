// =============================================================================
// Component: DynamicBadge
// Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
// Description: Renders a badge purely from its whitelisted JSON composition
// (shape + gradient + icon + ribbon text) as real, responsive SVG/JSX. Never
// executes or injects raw SVG/XML strings, so a malicious payload cannot run
// script or markup - unknown values are sanitized back to safe defaults.
// =============================================================================

import Zap from "lucide-react/dist/esm/icons/zap";
import Star from "lucide-react/dist/esm/icons/star";
import Award from "lucide-react/dist/esm/icons/award";
import Shield from "lucide-react/dist/esm/icons/shield";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import Flame from "lucide-react/dist/esm/icons/flame";
import Heart from "lucide-react/dist/esm/icons/heart";
import Target from "lucide-react/dist/esm/icons/target";
import { sanitizeBadgeComposition, BadgeIcon } from "@/lib/gamification/badgeComposer";

const ICON_COMPONENTS: Record<BadgeIcon, React.ComponentType<{ size?: number }>> = {
    zap: Zap,
    star: Star,
    award: Award,
    shield: Shield,
    trophy: Trophy,
    flame: Flame,
    heart: Heart,
    target: Target,
};

interface DynamicBadgeProps {
    payload: unknown;
    title?: string;
    size?: number;
}

export function DynamicBadge({ payload, title, size = 96 }: DynamicBadgeProps) {
    const { shape, gradientFrom, gradientTo, icon, ribbonText } = sanitizeBadgeComposition(payload);
    const gradientId = `badge-gradient-${shape}-${icon}-${gradientFrom.slice(1)}-${gradientTo.slice(1)}`;
    const Icon = ICON_COMPONENTS[icon];

    return (
        <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            role="img"
            aria-label={title || "Badge"}
            className="max-w-full h-auto"
        >
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={gradientFrom} />
                    <stop offset="100%" stopColor={gradientTo} />
                </linearGradient>
            </defs>

            {shape === "circle" && <circle cx="50" cy="50" r="45" fill={`url(#${gradientId})`} />}
            {shape === "shield" && (
                <path
                    d="M50 5 L90 20 V50 C90 75 72 90 50 95 C28 90 10 75 10 50 V20 Z"
                    fill={`url(#${gradientId})`}
                />
            )}
            {shape === "star" && (
                <path
                    d="M50 5 L61 38 H96 L67 58 L78 91 L50 71 L22 91 L33 58 L4 38 H39 Z"
                    fill={`url(#${gradientId})`}
                />
            )}

            <g transform="translate(32, 28)" color="#ffffff">
                <Icon size={36} />
            </g>

            {ribbonText && (
                <text x="50" y="88" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">
                    {ribbonText}
                </text>
            )}
        </svg>
    );
}