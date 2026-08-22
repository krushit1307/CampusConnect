import { describe, it, expect } from "vitest";
import { resolveClubWebsiteLink } from "./clubWebsiteGuard";

describe("Hide Website Link If Club URL Is Empty Suite (#3833)", () => {
  it("returns null for null, undefined, or empty/whitespace URL strings", () => {
    expect(resolveClubWebsiteLink("")).toBeNull();
    expect(resolveClubWebsiteLink("   ")).toBeNull();
    expect(resolveClubWebsiteLink(null)).toBeNull();
    expect(resolveClubWebsiteLink(undefined)).toBeNull();
  });

  it("resolves valid website link props when a URL is provided", () => {
    const props = resolveClubWebsiteLink("https://robotics.campusconnect.edu");

    expect(props).not.toBeNull();
    expect(props?.shouldRender).toBe(true);
    expect(props?.sanitizedUrl).toBe("https://robotics.campusconnect.edu");
    expect(props?.displayLabel).toBe("Visit Website");
  });

  it("prepends https:// protocol scheme if missing from domain input", () => {
    const props = resolveClubWebsiteLink("chessclub.org");

    expect(props?.sanitizedUrl).toBe("https://chessclub.org");
  });
});
