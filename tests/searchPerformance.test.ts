import { describe, it } from "vitest";

describe("Search Performance", () => {
  it.todo("should use GIN index on search_vector");
  it.todo("should execute within 100ms for common terms");
  it.todo("should respect LIMIT 50 correctly to prevent full table ranking");
});
