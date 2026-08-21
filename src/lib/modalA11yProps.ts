export const DEFAULT_CLOSE_ARIA_LABEL = "Close modal";

export interface ModalCloseButtonA11yOptions {
  modalTitle?: string;
  customAriaLabel?: string;
}

export interface ModalCloseButtonAttributes {
  "aria-label": string;
  type: "button";
  role: "button";
  "aria-hidden"?: boolean;
}

/**
 * Resolves accessible attributes for modal close (X) icon buttons.
 */
export function getModalCloseButtonA11yProps(
  options: ModalCloseButtonA11yOptions = {},
): ModalCloseButtonAttributes {
  if (options.customAriaLabel && options.customAriaLabel.trim().length > 0) {
    return {
      "aria-label": options.customAriaLabel.trim(),
      type: "button",
      role: "button",
    };
  }

  if (options.modalTitle && options.modalTitle.trim().length > 0) {
    return {
      "aria-label": `Close ${options.modalTitle.trim()} dialog`,
      type: "button",
      role: "button",
    };
  }

  return {
    "aria-label": DEFAULT_CLOSE_ARIA_LABEL,
    type: "button",
    role: "button",
  };
}

/**
 * Attributes for the decorative X icon SVG inside the close button.
 */
export function getCloseIconSvgA11yProps(): { "aria-hidden": boolean; focusable: boolean } {
  return {
    "aria-hidden": true,
    focusable: false,
  };
}
