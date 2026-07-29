import { createSchema, createYoga } from "graphql-yoga";
import { typeDefs, resolvers, pubsub, publishNotification } from "./resolvers";

export const schema = createSchema({
  typeDefs,
  resolvers,
});

/**
 * GraphQL Yoga server instance.
 *
 * Subscriptions are served via Server-Sent Events (SSE) — the default
 * transport in GraphQL Yoga v5. Clients connect to /api/graphql using
 * the multipart SSE protocol supported by graphql-sse.
 *
 * No extra WebSocket configuration is required; Yoga handles SSE natively.
 */
export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

// Re-export for use by server-side event producers (mention handlers, etc.)
export { pubsub, publishNotification };
