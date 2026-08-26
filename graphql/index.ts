import http from "http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import express from "express";
import { yoga, schema, pubsub } from "./server";
import { createClient } from "../src/lib/supabase/client";
import { handleImpersonation } from "./impersonation";
const app = express();

app.use(express.json());
import { handleImpersonation } from "./impersonation";
// Bind GraphQL Yoga as middleware
app.use(yoga.graphqlEndpoint, yoga);
const server = http.createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({
  noServer: true, // we handle the upgrade manually
});

interface ConnectionParams {
  Authorization?: string;
  authorization?: string;
}

// Use graphql-ws server configuration
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      const connectionParams = ctx.connectionParams as ConnectionParams | undefined;
      const authHeader = connectionParams?.Authorization || connectionParams?.authorization;
      let user = null;
      if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser(token);
        const authUser = authData?.user;

        if (authUser) {
          user = { id: authUser.id, role: "USER" };
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
  },
  wss,
);

// Upgrade logic
server.on("upgrade", (request, socket, head) => {
  if (request.url?.startsWith(yoga.graphqlEndpoint)) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Heartbeat / ping logic to reap zombie sockets
const interval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      console.warn("[WebSocket] Reaping zombie client connection");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("connection", (ws: any) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
});

wss.on("close", () => {
  clearInterval(interval);
});

// Setup Supabase Realtime client PG bridge to listen to new posts and publish via Redis pubsub
const supabaseClient = createClient();
supabaseClient
  .channel("announcements-graphql-bridge")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "posts",
    },
    (payload) => {
      const newPost = payload.new;
      if (newPost && newPost.club_id) {
        // Publish via Redis
        pubsub.publish("ANNOUNCEMENT_CREATED", newPost.club_id, newPost).catch((err) => {
          console.error("Failed to publish to Redis PubSub:", err);
        });
      }
    },
  )
  .subscribe();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.warn(`[GraphQL Server] Listening on http://localhost:${PORT}${yoga.graphqlEndpoint}`);
  console.warn(
    `[GraphQL Server] Subscriptions ready over WebSockets (ws://localhost:${PORT}${yoga.graphqlEndpoint})`,
  );
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.warn("[server] SIGTERM received, shutting down...");
  clearInterval(interval);
  await serverCleanup.dispose();
  server.close(() => {
    process.exit(0);
  });
});
