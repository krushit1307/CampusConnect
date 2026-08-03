import { createSchema, createYoga, createGraphQLError, type Plugin } from "graphql-yoga";
import {
  typeDefs,
  resolvers,
  pubsub,
  publishNotification,
  publishMentionNotification,
  publishEventUpdateNotification,
  createProfileLoader,
  createClubLoader,
  createCommentsByPostLoader,
} from "./resolvers";
import { authDirectiveTypeDefs, authDirectiveTransformer } from "./directives/authDirective";
import { createClient } from "../src/lib/supabase/client";
import { closePool } from "./db";
import { requestLoggingPlugin } from "./request-logging";
import { openTelemetryPlugin, initializeBackendTracing } from "./tracing";

import { createGraphQLSecurityPlugin } from "./security";

// Initialize OpenTelemetry backend tracing provider on server startup
initializeBackendTracing();

const supabase = createClient();

let schema = createSchema({
  typeDefs: [authDirectiveTypeDefs, typeDefs],
  resolvers,
});

// Apply the @auth directive transformer
schema = authDirectiveTransformer(schema, "auth");

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
  context: async ({ request }) => {
    let user = null;
    const authHeader = request.headers.get("authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: authData } = await supabase.auth.getUser(token);
      const authUser = authData?.user;

      if (authUser) {
        user = { id: authUser.id, role: "USER" };
        // Fetch role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authUser.id)
          .single();

        user.role = profile?.role || "USER";
      }
    }


    const profileLoader = createProfileLoader();
    const clubLoader = createClubLoader();
    const commentsByPostLoader = createCommentsByPostLoader();

    return {
      user,
      profileLoader,
      clubLoader,
      commentsByPostLoader,
    };

    return { user, request };

  },
  plugins: [
    requestLoggingPlugin(),
    openTelemetryPlugin(),
    createGraphQLSecurityPlugin({ maxDepth: 5, rateLimit: { maxMutations: 10, windowMs: 60000 } }),
  ],
});



/**
 * Graceful shutdown: release all pooled Postgres connections when the
 * process receives a termination signal (e.g. during deploys/restarts),
 * so connections aren't left dangling on the Supavisor/pgBouncer side.
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;


  console.warn(`[server] Received ${signal}, closing Postgres pool...`);
  try {
    await closePool();
    console.warn("[server] Postgres pool closed cleanly.");

  // eslint-disable-next-line no-console
  console.log(`[server] Received ${signal}, closing Postgres pool...`);
  try {
    await closePool();
    // eslint-disable-next-line no-console
    console.log("[server] Postgres pool closed cleanly.");

  } catch (err) {
    console.error("[server] Error while closing Postgres pool:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
export {
  schema,
  pubsub,
  publishNotification,
  publishMentionNotification,
  publishEventUpdateNotification,
};
