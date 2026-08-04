import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "graphql";
import { createGraphQLSecurityPlugin, getQueryDepth, clearRateLimitStore } from "./security";
import { createSchema, createYoga } from "graphql-yoga";

function createTestSchema() {
  return createSchema({
    typeDefs: `
      type Query {
        user: User
        events: [Event]
        ping: String
      }
      type User {
        id: String
        name: String
        friend: User
      }
      type Event {
        id: String
      }
      type Mutation {
        createPost: String
      }
    `,
    resolvers: {
      Query: {
        user: () => ({ id: "1", name: "tester", friend: null }),
        events: () => [{ id: "e1" }],
        ping: () => "pong",
      },
      Mutation: { createPost: () => "created" },
    },
  });
}

describe("GraphQL Security Plugin", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("calculates query depth accurately", () => {
    const doc = parse(`
      query {
        events {
          id
          title
          creator {
            id
            profile {
              bio
            }
          }
        }
      }
    `);
    const op = doc.definitions[0];
    if (op.kind === "OperationDefinition") {
      const depth = getQueryDepth(op.selectionSet);
      expect(depth).toBe(5);
    }
  });

  it("rejects queries that exceed max depth", async () => {
    const yoga = createYoga({
      schema: createTestSchema(),
      plugins: [createGraphQLSecurityPlugin({ maxDepth: 3 })],
    });

    const query = `
      query DeepQuery {
        user {
          friend {
            friend {
              friend {
                id
              }
            }
          }
        }
      }
    `;

    const response = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain("Query exceeds maximum allowed depth of 3");
  });

  it("rejects deeply nested recursive queries built with fragments", async () => {
    const yoga = createYoga({
      schema: createTestSchema(),
      plugins: [createGraphQLSecurityPlugin({ maxDepth: 3 })],
    });

    // Classic recursive attack: the fragment spreads itself through `friend`.
    // Without fragment resolution the depth of this query would be computed
    // as 2 (the spread node carries no selection set of its own).
    const query = `
      query FragmentDepthAttack {
        user {
          friend {
            ...UserRecursive
          }
        }
      }
      fragment UserRecursive on User {
        id
        name
        friend {
          ...UserRecursive
        }
      }
    `;

    const response = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain("Query exceeds maximum allowed depth of 3");
  });

  it("enforces IP-based rate limits on all requests and returns HTTP 429", async () => {
    const yoga = createYoga({
      schema: createTestSchema(),
      plugins: [createGraphQLSecurityPlugin({ rateLimit: { maxRequests: 3, windowMs: 60000 } })],
    });

    const request = (ip: string) =>
      yoga.fetch("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ query: "{ ping }" }),
      });

    // 3 requests within the window - success
    expect((await request("203.0.113.10")).status).toBe(200);
    expect((await request("203.0.113.10")).status).toBe(200);
    expect((await request("203.0.113.10")).status).toBe(200);

    // 4th request from the same IP - blocked with 429 + Retry-After
    const blocked = await request("203.0.113.10");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();

    const result = await blocked.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].extensions.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(result.errors[0].message).toContain("Rate limit exceeded");

    // A different IP is unaffected (per-IP isolation)
    expect((await request("198.51.100.7")).status).toBe(200);
  });

  it("does not count CORS preflight requests against the limit", async () => {
    const yoga = createYoga({
      schema: createTestSchema(),
      plugins: [createGraphQLSecurityPlugin({ rateLimit: { maxRequests: 2, windowMs: 60000 } })],
    });

    const ip = "203.0.113.99";
    const preflight = () =>
      yoga.fetch("http://localhost/graphql", {
        method: "OPTIONS",
        headers: { "x-forwarded-for": ip },
      });

    expect((await preflight()).status).toBe(200);
    expect((await preflight()).status).toBe(200);

    // Both real requests still fit within the 2-request budget.
    const post = () =>
      yoga.fetch("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ query: "{ ping }" }),
      });

    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
  });

  it("enforces mutation rate limits and returns meaningful error message", async () => {
    const yoga = createYoga({
      schema: createTestSchema(),
      context: ({ request }) => ({ request, user: { id: "test-user-123" } }),
      plugins: [
        createGraphQLSecurityPlugin({
          maxDepth: 5,
          rateLimit: { maxRequests: 100, maxMutations: 2, windowMs: 60000 },
        }),
      ],
    });

    const mutation = `mutation { createPost }`;

    // 1st mutation - success
    const res1 = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation }),
    });
    expect(res1.status).toBe(200);

    // 2nd mutation - success
    const res2 = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation }),
    });
    expect(res2.status).toBe(200);

    // 3rd mutation - should exceed the mutation rate limit
    const res3 = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation }),
    });
    const result3 = await res3.json();

    expect(result3.errors).toBeDefined();
    expect(result3.errors[0].message).toContain("Rate limit exceeded for GraphQL mutations");
  });
});
