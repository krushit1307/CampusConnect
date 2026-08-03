import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "graphql";
import { createGraphQLSecurityPlugin, getQueryDepth, clearRateLimitStore } from "./security";
import { createSchema, createYoga } from "graphql-yoga";

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
    const typeDefs = `
      type Query {
        user: User
      }
      type User {
        id: String
        friend: User
      }
    `;

    const schema = createSchema({
      typeDefs,
      resolvers: {
        Query: { user: () => ({ id: "1", friend: null }) },
      },
    });

    const yoga = createYoga({
      schema,
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

  it("enforces mutation rate limits and returns meaningful error message", async () => {
    const typeDefs = `
      type Query { ping: String }
      type Mutation { createPost: String }
    `;

    const schema = createSchema({
      typeDefs,
      resolvers: {
        Query: { ping: () => "pong" },
        Mutation: { createPost: () => "created" },
      },
    });

    const yoga = createYoga({
      schema,
      context: ({ request }) => ({ request, user: { id: "test-user-123" } }),
      plugins: [
        createGraphQLSecurityPlugin({
          maxDepth: 5,
          rateLimit: { maxMutations: 2, windowMs: 60000 },
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

    // 3rd mutation - should exceed rate limit
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
