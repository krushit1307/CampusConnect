import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildRing,
  NodeHealthTracker,
  parseGeoMap,
  parseNodeRegistry,
  selectNode,
} from "../shared/load-balancer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lb-node",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const LB_NODES = Deno.env.get("LB_NODES") ?? "";
const nodes = parseNodeRegistry(LB_NODES);
const geoMap = parseGeoMap(Deno.env.get("LB_GEO_MAP"));
const ring = buildRing(nodes, Number(Deno.env.get("LB_VIRTUAL_NODES")) || 256);
const health = new NodeHealthTracker({
  failureThreshold: Number(Deno.env.get("LB_FAILURE_THRESHOLD")) || 3,
  successThreshold: Number(Deno.env.get("LB_SUCCESS_THRESHOLD")) || 2,
  cooldownMs: Number(Deno.env.get("LB_COOLDOWN_MS")) || 30_000,
  latencySamples: Number(Deno.env.get("LB_LATENCY_SAMPLES")) || 100,
});
const cookieName = Deno.env.get("LB_COOKIE_NAME") || "_sv_node";
const cookieTtlDays = Number(Deno.env.get("LB_COOKIE_TTL_DAYS")) || 30;

function isWebSocketUpgrade(req: Request): boolean {
  return (req.headers.get("upgrade") ?? "").toLowerCase() === "websocket";
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const t0 = performance.now();

  // Liveness probe for the router itself.
  if (url.pathname === "/healthz" || url.pathname === "/health") {
    return json(
      {
        status: "ok",
        nodesConfigured: nodes.length,
        nodesHealthy: nodes.filter((n) => health.isHealthy(n.id)).length,
      },
      200,
      { "x-lb-took-ms": (performance.now() - t0).toFixed(2) },
    );
  }

  // Node registry / observability endpoint.
  if (url.pathname === "/_lb/nodes" && req.method === "GET") {
    return json(
      {
        nodes: nodes.map((n) => ({
          id: n.id,
          region: n.region,
          url: n.url,
          weight: n.weight,
          ...health.status(n.id),
        })),
      },
      200,
      {},
    );
  }

  // Ops endpoint: manually trip / close the circuit breaker for a node.
  if (url.pathname === "/_lb/nodes" && req.method === "POST") {
    try {
      const body = await req.json();
      const target = nodes.find((n) => n.id === body?.id);
      if (!target) {
        return json({ error: `Unknown node: ${body?.id}` }, 404, {});
      }
      if (body?.action === "fail") health.setOpen(target.id, true);
      if (body?.action === "recover") health.setOpen(target.id, false);
      return json({ id: target.id, ...health.status(target.id) }, 200, {});
    } catch {
      return json({ error: "Invalid JSON body. Expected { id, action: 'fail' | 'recover' }" }, 400, {});
    }
  }

  const selection = selectNode(req, {
    nodes,
    ring,
    health,
    geoMap,
    cookieName,
    cookieTtlDays,
  });

  const headers: Record<string, string> = {
    "x-lb-took-ms": (performance.now() - t0).toFixed(2),
    "x-lb-routing-ms": selection.routingMs.toFixed(2),
    "x-lb-country": selection.country ?? "",
    "x-lb-reason": selection.reason,
    "x-lb-sticky": String(selection.sticky),
    "x-lb-failover": String(selection.failover),
    "x-lb-primary": selection.primaryNodeId ?? "",
  };
  if (selection.setCookie) headers["Set-Cookie"] = selection.setCookie;

  if (selection.node === null) {
    return json(
      {
        error: "No replica nodes configured. Set LB_NODES (e.g. 'us-east=wss://host:2,eu-west=wss://host').",
      },
      503,
      headers,
    );
  }

  headers["x-lb-node"] = selection.node.id;
  headers["x-lb-region"] = selection.node.region;

  const payload = {
    node: selection.node.id,
    region: selection.node.region,
    url: selection.node.url,
    country: selection.country,
    sticky: selection.sticky,
    failover: selection.failover,
    routingMs: Number(selection.routingMs.toFixed(2)),
  };

  // Realtime/WebSocket handshakes: bounce the client to the nearest node so
  // the socket opens directly against the region-scoped endpoint (kept sticky
  // by the affinity cookie).
  if (isWebSocketUpgrade(req) || url.pathname === "/redirect") {
    if (selection.setCookie) headers["Set-Cookie"] = selection.setCookie;
    return new Response(null, {
      status: 307,
      headers: { ...headers, Location: selection.node.url },
    });
  }

  if (url.pathname === "/_lb/latency" && req.method === "POST") {
    // Client-reported connect latency for the node it was routed to, used to
    // keep percentile stats fresh without active probing.
    try {
      const body = await req.json();
      if (body?.node && body?.ms !== undefined) {
        health.recordSuccess(String(body.node), Number(body.ms));
      }
      return json({ ok: true }, 200, {});
    } catch {
      return json({ error: "Invalid JSON body. Expected { node, ms }" }, 400, {});
    }
  }

  return json(payload, 200, headers);
});
