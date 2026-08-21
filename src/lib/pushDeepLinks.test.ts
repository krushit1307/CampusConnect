import { describe, expect, it } from "vitest";
import {
  createNotificationLaunchUrl,
  getDeepLinkParentRoute,
  normalizePushTargetRoute,
} from "./pushDeepLinks";

describe("push deep-link routing", () => {
  it("keeps a forum post's query string and gives it the forum index as its parent", () => {
    const target = normalizePushTargetRoute("/forum/post/123?highlight=comment456");

    expect(target).toBe("/forum/post/123?highlight=comment456");
    expect(getDeepLinkParentRoute(target!)).toBe("/forum");
  });

  it("rejects external and protocol-relative targets", () => {
    expect(normalizePushTargetRoute("https://example.com/account")).toBeNull();
    expect(normalizePushTargetRoute("//example.com/account")).toBeNull();
  });

  it("encodes a cold-start notification target on the app origin", () => {
    expect(createNotificationLaunchUrl("/events/abc", "https://campus.example")).toBe(
      "https://campus.example/?notification_route=%2Fevents%2Fabc",
    );
  });
});
