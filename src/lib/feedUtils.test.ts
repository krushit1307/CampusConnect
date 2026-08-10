import { describe, it, expect } from "vitest";
import {
  timeAgo,
  combinePosts,
  filterPostsBySearch,
  buildCommentTree,
  computeReaction,
} from "./feedUtils";

describe("timeAgo", () => {
  it("returns minutes for recent dates", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(recent)).toMatch(/minute/);
  });

  it("returns hours for dates a few hours ago", () => {
    const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(hoursAgo)).toMatch(/hour/);
  });

  it("returns days for older dates", () => {
    const daysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(daysAgo)).toMatch(/day/);
  });
});

describe("combinePosts", () => {
  const makePost = (id: string, isPinned: boolean) => ({
    id,
    content: "",
    created_at: "",
    club_id: "",
    is_pinned: isPinned,
    profiles: null,
    clubs: null,
    comments: null,
    post_reactions: null,
  });

  it("merges prepended and fetched posts, deduplicating by id", () => {
    const prepended = [makePost("p1", false)];
    const fetched = [makePost("p2", false), makePost("p1", false)];
    const result = combinePosts(prepended, fetched);
    expect(result).toHaveLength(2);
  });

  it("sorts pinned posts first", () => {
    const prepended = [makePost("p1", false)];
    const fetched = [makePost("p2", true)];
    const result = combinePosts(prepended, fetched);
    expect(result[0].id).toBe("p2");
  });
});

describe("filterPostsBySearch", () => {
  const makePost = (overrides: Record<string, unknown> = {}) => ({
    id: "1",
    content: "Hello world",
    created_at: "",
    club_id: "",
    is_pinned: false,
    profiles: { id: "u1", full_name: "Alice" },
    clubs: { id: "c1", name: "Tech Club", club_members: null },
    comments: null,
    post_reactions: null,
    ...overrides,
  });

  it("returns all posts when query is empty", () => {
    expect(filterPostsBySearch([makePost()], "")).toHaveLength(1);
  });

  it("matches post content", () => {
    expect(filterPostsBySearch([makePost({ content: "Hello World" })], "hello")).toHaveLength(1);
  });

  it("matches author name", () => {
    expect(filterPostsBySearch([makePost()], "alice")).toHaveLength(1);
  });

  it("matches club name", () => {
    expect(filterPostsBySearch([makePost()], "tech")).toHaveLength(1);
  });

  it("does not match unrelated query", () => {
    expect(filterPostsBySearch([makePost()], "xyzzy")).toHaveLength(0);
  });
});

describe("buildCommentTree", () => {
  const makeComment = (id: string, parentCommentId?: string) => ({
    id,
    content: "",
    created_at: "",
    deleted_at: null,
    parent_comment_id: parentCommentId ?? null,
    profiles: null,
  });

  it("builds a flat list when no parent IDs", () => {
    const tree = buildCommentTree([makeComment("c1"), makeComment("c2")]);
    expect(tree).toHaveLength(2);
  });

  it("nests children under their parent", () => {
    const tree = buildCommentTree([makeComment("c1"), makeComment("c2", "c1")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
  });

  it("handles empty input", () => {
    expect(buildCommentTree([])).toEqual([]);
  });
});

describe("computeReaction", () => {
  it("returns count and reacted state", () => {
    const reactions = [
      { emoji: "👍", user_id: "u1" },
      { emoji: "👍", user_id: "u2" },
    ];
    const result = computeReaction(reactions, "👍", undefined, "u1");
    expect(result.count).toBe(2);
    expect(result.isReacted).toBe(true);
  });

  it("applies optimistic offset", () => {
    const result = computeReaction([], "👍", { countOffset: 1, userReacted: true }, "u1");
    expect(result.count).toBe(1);
    expect(result.isReacted).toBe(true);
  });

  it("never returns negative count", () => {
    const result = computeReaction([], "👍", { countOffset: -5, userReacted: false }, "u1");
    expect(result.count).toBe(0);
  });

  it("handles null reactions", () => {
    expect(computeReaction(null, "👍", undefined, "u1").count).toBe(0);
  });
});
