import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
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

// 1. Create base executable schema using makeExecutableSchema
let schema = makeExecutableSchema({
  typeDefs: [authDirectiveTypeDefs, typeDefs],
  resolvers,
});

// 2. Apply the @auth directive transformer
schema = authDirectiveTransformer(schema, "auth");

/**
 * GraphQL Yoga server instance.
 * Subscriptions are served via Server-Sent Events (SSE).
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
  user = {
    id: authUser.id,
    role: "USER",
    is_impersonated: false,
    admin_id: null,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authUser.id)
    .single();

  user.role = profile?.role || "USER";
}    }

    const profileLoader = createProfileLoader();
    const clubLoader = createClubLoader();
    const commentsByPostLoader = createCommentsByPostLoader();

    return {
      request,
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
    createGraphQLSecurityPlugin({
      maxDepth: 5,
      rateLimit: { maxRequests: 100, maxMutations: 10, windowMs: 60000 },
    }),
  ],
});

/**
 * Graceful shutdown: release all pooled Postgres connections when the
 * process receives a termination signal.
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

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

export default yoga;
