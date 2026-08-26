import { describe, expect, it } from "vitest";

import { buildAnnouncementToastOptions } from "./sse";

describe("buildAnnouncementToastOptions", () => {
  it("parses structured announcement payloads", () => {
    expect(
      buildAnnouncementToastOptions(
        JSON.stringify({ title: "Campus update", message: "Library closes at 8pm", type: "info" }),
      ),
    ).toEqual({
      title: "Campus update",
      description: "Library closes at 8pm",
      type: "info",
    });
  });

  it("falls back to a plain string message", () => {
    expect(buildAnnouncementToastOptions("Maintenance window started")).toEqual({
      title: "Live announcement",
      description: "Maintenance window started",
      type: "info",
    });
  });

  it("handles invalid JSON safely", () => {
    expect(buildAnnouncementToastOptions("{not valid json}")).toEqual({
      title: "Live announcement",
      description: "{not valid json}",
      type: "info",
    });
  });
});
