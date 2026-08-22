import { describe, it, expect } from "vitest";
import {
  getModalCloseButtonA11yProps,
  getCloseIconSvgA11yProps,
  DEFAULT_CLOSE_ARIA_LABEL,
} from "./modalA11yProps";

describe("Add 'aria-label' to Close Modal (X) Button Suite (#3829)", () => {
  it("defaults to 'Close modal' aria-label when no title is provided", () => {
    const props = getModalCloseButtonA11yProps();

    expect(props["aria-label"]).toBe(DEFAULT_CLOSE_ARIA_LABEL);
    expect(props.type).toBe("button");
    expect(props.role).toBe("button");
  });

  it("dynamically generates context-aware aria-label when modal title is supplied", () => {
    const props = getModalCloseButtonA11yProps({ modalTitle: "RSVP Confirmation" });

    expect(props["aria-label"]).toBe("Close RSVP Confirmation dialog");
  });

  it("respects explicit custom aria-label overrides", () => {
    const props = getModalCloseButtonA11yProps({ customAriaLabel: "Dismiss window" });

    expect(props["aria-label"]).toBe("Dismiss window");
  });

  it("marks decorative SVG icon as aria-hidden=true and focusable=false", () => {
    const svgProps = getCloseIconSvgA11yProps();

    expect(svgProps["aria-hidden"]).toBe(true);
    expect(svgProps.focusable).toBe(false);
  });
});
