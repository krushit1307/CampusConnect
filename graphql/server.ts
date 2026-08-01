import { createSchema, createYoga } from "graphql-yoga";
import {
  typeDefs,
  resolvers,
  pubsub,
  publishNotification,
  publishMentionNotification,
  publishEventUpdateNotification,
} from "./resolvers";
import { authDirectiveTypeDefs, authDirectiveTransformer } from "./directives/authDirective";
import { createClient } from "../src/lib/supabase/client";
import { closePool } from "./db";
import { requestLoggingPlugin } from "./request-logging";
import { openTelemetryPlugin, initializeBackendTracing } from "./tracing";

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

    return { user };
  },
  plugins: [requestLoggingPlugin(), openTelemetryPlugin()],
});

// Re-export for use by server-side event producers (mention handlers, etc.)
export { pubsub, publishNotification };

/**
 * Graceful shutdown: release all pooled Postgres connections when the
 * process receives a termination signal (e.g. during deploys/restarts),
 * so connections aren't left dangling on the Supavisor/pgBouncer side.
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[server] Received ${signal}, closing Postgres pool...`);
  try {
    await closePool();
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
