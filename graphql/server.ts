import { createSchema, createYoga } from "graphql-yoga";
import { typeDefs, resolvers } from "./resolvers";

export const schema = createSchema({
  typeDefs,
  resolvers,
});

export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});
