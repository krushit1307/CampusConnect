import { describe, it, expect, vi } from "vitest";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { authDirectiveTransformer } from "./authDirective";

const typeDefs = /* GraphQL */ `
  directive @auth(requires: Role = ADMIN) on OBJECT | FIELD_DEFINITION
  enum Role {
    USER
    ADMIN
    SUPERADMIN
  }
  type User {
    id: ID!
    name: String!
    ssn: String @auth(requires: ADMIN)
  }
  type Query {
    me: User
    adminData: String @auth(requires: ADMIN)
  }
`;

const resolvers = {
  Query: {
    me: () => ({ id: "1", name: "John Doe", ssn: "123-45-6789" }),
    adminData: () => "Secret Admin Data",
  },
};

describe("authDirectiveTransformer", () => {
  it("allows access when user role meets requirement", async () => {
    let schema = makeExecutableSchema({ typeDefs, resolvers });
    schema = authDirectiveTransformer(schema, "auth");

    const query = `{ adminData }`;
    const contextValue = { user: { id: "1", role: "ADMIN" } };

    const result = await graphql({ schema, source: query, contextValue });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ adminData: "Secret Admin Data" });
  });

  it("returns null for field-level violation without crashing the entire query", async () => {
    let schema = makeExecutableSchema({ typeDefs, resolvers });
    schema = authDirectiveTransformer(schema, "auth");

    // Requesting both allowed (name) and restricted (ssn) fields
    const query = `{ me { id, name, ssn } }`;
    const contextValue = { user: { id: "1", role: "USER" } };

    const result = await graphql({ schema, source: query, contextValue });

    // No hard errors should be thrown
    expect(result.errors).toBeUndefined();
    // Authorized fields resolve, unauthorized field gracefully returns null
    expect(result.data).toEqual({
      me: {
        id: "1",
        name: "John Doe",
        ssn: null,
      },
    });
  });

  it("blocks access when user is unauthenticated", async () => {
    let schema = makeExecutableSchema({ typeDefs, resolvers });
    schema = authDirectiveTransformer(schema, "auth");

    const query = `{ adminData }`;
    const contextValue = { user: null }; // Unauthenticated

    const result = await graphql({ schema, source: query, contextValue });
    expect(result.errors).toBeUndefined(); // Graceful null return
    expect(result.data).toEqual({ adminData: null });
  });
});
