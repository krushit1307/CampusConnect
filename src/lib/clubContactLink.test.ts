import { describe, it, expect } from "vitest";
import {
  buildClubMailtoHref,
  resolveClubContactMailtoProps,
  DEFAULT_LINK_CLASSES,
} from "./clubContactLink";

describe("Add Mailto Link to Club Contact Email Suite (#3826)", () => {
  it("constructs valid mailto: href string with email address", () => {
    const href = buildClubMailtoHref({ email: "robotics@university.edu" });
    expect(href).toBe("mailto:robotics@university.edu");
  });

  it("appends default club inquiry subject parameter when club name is provided", () => {
    const href = buildClubMailtoHref({
      email: "robotics@university.edu",
      clubName: "Robotics Club",
    });

    expect(href).toContain("mailto:robotics@university.edu?");
    expect(href).toContain("subject=Inquiry+regarding+Robotics+Club");
  });

  it("resolves rendered anchor props and standard blue link CSS classes", () => {
    const props = resolveClubContactMailtoProps({
      email: "chess@university.edu",
      clubName: "Chess Club",
    });

    expect(props.isValid).toBe(true);
    expect(props.displayEmail).toBe("chess@university.edu");
    expect(props.href).toBe("mailto:chess@university.edu?subject=Inquiry+regarding+Chess+Club");
    expect(props.cssClass).toBe(DEFAULT_LINK_CLASSES);
  });

  it("returns invalid state when email is missing or empty", () => {
    const props = resolveClubContactMailtoProps({ email: "" });
    expect(props.isValid).toBe(false);
    expect(props.href).toBe("");
  });
});
