export type ButtonSizeVariant = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
  size?: ButtonSizeVariant;
  additionalClasses?: string;
  enforceHigTouchTarget?: boolean;
}

export const HIG_TOUCH_TARGET_CLASS = "min-h-[44px] min-w-[44px]";

export const BUTTON_SIZE_CLASSES: Record<ButtonSizeVariant, string> = {
  sm: "py-2 px-3 text-sm min-h-[44px]",
  md: "py-2.5 px-4 text-base min-h-[44px]",
  lg: "py-3 px-6 text-lg min-h-[48px]",
};

/**
 * Resolves accessible Tailwind CSS class string for buttons complying with Apple HIG touch target sizing.
 */
export function getButtonAccessibilityCssClass(options: ButtonStyleOptions = {}): string {
  const size = options.size || "md";
  const sizeCss = BUTTON_SIZE_CLASSES[size];
  const higCss = options.enforceHigTouchTarget !== false ? HIG_TOUCH_TARGET_CLASS : "";

  const combined =
    `inline-flex items-center justify-center font-medium rounded-md transition-colors ${sizeCss} ${higCss} ${options.additionalClasses || ""}`.trim();
  return Array.from(new Set(combined.split(/\s+/))).join(" ");
}
