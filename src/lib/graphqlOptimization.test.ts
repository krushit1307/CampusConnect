import { describe, it, expect } from "vitest";
import { processGraphQLDirectives, mergeIncrementalChunk } from "./graphqlOptimization";

describe("GraphQL @defer and @stream Optimization Suite (#2221)", () => {
  it("detects @defer and @stream directives and minifies query string", () => {
    const rawQuery = `
      query GetFeed {
        feed {
          id
          title
          ... @defer(label: "comments") {
            comments @stream(initialCount: 5) {
              id
              text
            }
          }
        }
      }
    `;

    const processed = processGraphQLDirectives(rawQuery);
    expect(processed.hasDefer).toBe(true);
    expect(processed.hasStream).toBe(true);
    expect(processed.optimizedQuery).not.toContain("\n");
  });

  it("correctly merges deferred incremental chunk into base payload", () => {
    const baseData = {
      feed: {
        id: "1",
        title: "Campus Announcement",
      },
    };

    const chunk = {
      label: "comments",
      path: ["feed", "comments"],
      data: [{ id: "c1", text: "Great news!" }],
      hasNext: false,
    };

    const merged = mergeIncrementalChunk(baseData, chunk);

    expect(merged.feed).toHaveProperty("comments");
    expect((merged.feed as Record<string, unknown>).comments).toEqual([
      { id: "c1", text: "Great news!" },
    ]);
  });
});
