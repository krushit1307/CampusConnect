import { createSchema, createYoga, createGraphQLError, type Plugin } from "graphql-yoga";
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

// Rate limiting in-memory map
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of expired rate limit entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000).unref();

function checkRateLimit(contextValue: unknown) {
  const context = contextValue as Record<string, unknown>;
  const request = context.request as Request | undefined;
  const user = context.user as { id?: string } | undefined;

  let ip = request?.headers?.get("x-forwarded-for") || request?.headers?.get("x-real-ip");
  if (!ip) {
    const req = context.req as
      { socket?: { remoteAddress?: string }; info?: { remoteAddress?: string } } | undefined;
    ip = req?.socket?.remoteAddress || req?.info?.remoteAddress || "127.0.0.1";
  }

  const identifier = user?.id ? `user:${user.id}` : `ip:${ip}`;

  const limit = user?.id ? 120 : 30;
  const now = Date.now();

  let record = rateLimitMap.get(identifier);
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + 60000 };
    rateLimitMap.set(identifier, record);
  }

  record.count += 1;

  if (record.count > limit) {
    throw createGraphQLError("Too Many Requests", {
      extensions: {
        http: { status: 429 },
      },
    });
  }
}

function rateLimitPlugin(): Plugin {
  return {
    onExecute({ args }) {
      checkRateLimit(args.contextValue);
    },
    onSubscribe({ args }) {
      checkRateLimit(args.contextValue);
    },
  };
}

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
  plugins: [requestLoggingPlugin(), openTelemetryPlugin(), rateLimitPlugin()],
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
