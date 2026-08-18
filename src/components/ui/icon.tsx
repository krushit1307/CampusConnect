// =============================================================================
// Component: Icon (Sprite Sheet Consumer)
// Issue: #2409 - Consolidate massive SVG assets into a single SVG Sprite Sheet
// Description: Refactored React Icon component to consume the sprite sheet
// using the <use> tag. This ensures all 50+ icons are downloaded in a single
// HTTP request. Supports dynamic color inheritance via currentColor.
// =============================================================================

import React from "react";

interface IconProps {
  name: string; // e.g., 'heart', 'user', 'calendar'
  size?: number | string;
  className?: string;
  color?: string; // Optional override, otherwise inherits text color
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Universal Icon component that references symbols in /public/sprite.svg
 *
 * Usage:
 * <Icon name="heart" size={24} className="text-red-500" />
 *
 * The icon will automatically inherit the text color of its parent container
 * due to fill="currentColor" in the sprite sheet symbols.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  className = "",
  color,
  onClick,
  ariaLabel,
}) => {
  // Construct the href for the <use> tag
  // Points to the sprite.svg file and the specific symbol ID
  const href = `/sprite.svg#icon-${name}`;

  const style: React.CSSProperties = {
    width: typeof size === "number" ? `${size}px` : size,
    height: typeof size === "number" ? `${size}px` : size,
    color: color || "currentColor",
    cursor: onClick ? "pointer" : "inherit",
  };

  return (
    <svg
      style={style}
      className={`inline-block ${className}`}
      onClick={onClick}
      aria-label={ariaLabel || name}
      role="img"
      focusable="false"
    >
      <use href={href} />
    </svg>
  );
};

// Export commonly used icon sizes as constants for consistency
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
} as const;

// Type guard for icon names to enable autocomplete in IDEs
export type IconName =
  | "heart"
  | "user"
  | "calendar"
  | "location"
  | "search"
  | "settings"
  | "notification"
  | "logout"
  | "edit"
  | "delete";
