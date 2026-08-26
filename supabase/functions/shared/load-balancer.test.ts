// @ts-nocheck
import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ConsistentHashRing,
  NodeHealthTracker,
  buildAffinityCookie,
  buildRing,
  fnv1a,
  geoFromRequest,
  parseGeoMap,
  parseNodeRegistry,
  readAffinityCookie,
  selectNode,
} from "./load-balancer.ts";

function testNodes() {
  return parseNodeRegistry(
    "us-east=https://us-east.replica.supabase.co:2,eu-west=https://eu-west.replica.supabase.co,ap-south=https://ap-south.replica.supabase.co",
  );
}

function makeRequest(headers: Record<string, string> = {}, path = "/route"): Request {
  return new Request(`https://router.supabase.co${path}`, { headers });
}

// --- fnv1a ----------------------------------------------------------------

Deno.test("fnv1a - is deterministic and 32-bit unsigned", () => {
  assertEquals(fnv1a("client-1"), fnv1a("client-1"));
  assert(fnv1a("client-1") >= 0);
  assert(fnv1a("client-1") <= 0xffffffff);
  assert(fnv1a("client-1") !== fnv1a("client-2"));
});

// --- ConsistentHashRing ---------------------------------------------------

Deno.test("ring - same key always maps to the same node", () => {
  const ring = buildRing(testNodes(), 256);
  const first = ring.getNode("client-1");
  for (let i = 0; i < 50; i++) {
    assertEquals(ring.getNode("client-1"), first);
  }
  assert(first !== null);
});

Deno.test("ring - removing a node only remaps a small fraction of keys", () => {
  const ring = buildRing(testNodes(), 256);
  const keys = Array.from({ length: 2000 }, (_, i) => `client-${i}`);
  const before = new Map(keys.map((k) => [k, ring.getNode(k)]));

  ring.removeNode("ap-south");
  let remapped = 0;
  for (const k of keys) {
    if (ring.getNode(k) !== before.get(k)) remapped++;
  }
  // With 3 nodes, ~1/3 of keys should move when one is removed.
  assert(remapped / keys.length < 0.6, `remapped ${remapped}/${keys.length}`);
});

Deno.test("ring - keys are distributed across all nodes", () => {
  const ring = buildRing(testNodes(), 256);
  const counts: Record<string, number> = {};
  for (let i = 0; i < 3000; i++) {
    const node = ring.getNode(`key-${i}`);
    counts[node] = (counts[node] ?? 0) + 1;
  }
  assertEquals(Object.keys(counts).length, 3);
  for (const count of Object.values(counts)) {
    assert(count > 300, `node received only ${count} keys`);
  }
});

Deno.test("ring - getOrder returns primary then all successors (failover chain)", () => {
  const ring = buildRing(testNodes(), 256);
  const order = ring.getOrder("client-42");
  assertEquals(order.length, 3);
  assertEquals(order[0], ring.getNode("client-42"));
  assert(new Set(order).size === 3);
});

Deno.test("ring - successor becomes primary after node removal", () => {
  const ring = buildRing(testNodes(), 256);
  const key = "sticky-client";
  const primary = ring.getNode(key);
  const order = ring.getOrder(key);
  ring.removeNode(primary);
  assertEquals(ring.getNode(key), order[1]);
});

// --- geoFromRequest -------------------------------------------------------

Deno.test("geo - parses cf-connecting-ip and cf-ipcountry", () => {
  const req = makeRequest({
    "cf-connecting-ip": "203.0.113.10",
    "cf-ipcountry": "in",
  });
  assertEquals(geoFromRequest(req), { ip: "203.0.113.10", country: "IN" });
});

Deno.test("geo - falls back to x-forwarded-for and x-real-ip", () => {
  const viaXff = makeRequest({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" });
  assertEquals(geoFromRequest(viaXff).ip, "198.51.100.7");
  const viaReal = makeRequest({ "x-real-ip": "192.0.2.5" });
  assertEquals(geoFromRequest(viaReal).ip, "192.0.2.5");
});

Deno.test("geo - defaults when no headers are present", () => {
  assertEquals(geoFromRequest(makeRequest()).ip, "0.0.0.0");
  assertEquals(geoFromRequest(makeRequest()).country, null);
});

// --- Registry / geo map parsing ------------------------------------------

Deno.test("registry - parses id=url[:weight] entries and skips malformed ones", () => {
  const nodes = parseNodeRegistry(
    "us-east=https://a.example.com:2, eu-west|wss://b.example.com, ,garbage",
  );
  assertEquals(nodes.length, 2);
  assertEquals(nodes[0], {
    id: "us-east",
    region: "us-east",
    url: "https://a.example.com",
    weight: 2,
  });
  assertEquals(nodes[1], {
    id: "eu-west",
    region: "eu-west",
    url: "wss://b.example.com",
    weight: 1,
  });
});

Deno.test("registry - empty input returns empty list", () => {
  assertEquals(parseNodeRegistry(""), []);
  assertEquals(parseNodeRegistry(null), []);
});

Deno.test("geo map - parses COUNTRY=nodeId pairs", () => {
  const map = parseGeoMap("US=us-east,GB=eu-west,in=ap-south");
  assertEquals(map.get("US"), "us-east");
  assertEquals(map.get("GB"), "eu-west");
  assertEquals(map.get("IN"), "ap-south");
});

// --- Affinity cookie ------------------------------------------------------

Deno.test("affinity - cookie roundtrips and sticks to the node", () => {
  const cookie = buildAffinityCookie("us-east", "203.0.113.10", "_sv_node", 30);
  const req = makeRequest({ cookie });
  assertEquals(readAffinityCookie(req, "203.0.113.10", "_sv_node"), "us-east");
});

Deno.test("affinity - cookie minted for another IP is rejected", () => {
  const cookie = buildAffinityCookie("us-east", "203.0.113.10", "_sv_node", 30);
  const req = makeRequest({ cookie });
  assertEquals(readAffinityCookie(req, "198.51.100.7", "_sv_node"), null);
});

Deno.test("affinity - malformed or tampered cookie is rejected", () => {
  const req = makeRequest({ cookie: "_sv_node=us-east" });
  assertEquals(readAffinityCookie(req, "203.0.113.10", "_sv_node"), null);
  const tampered = makeRequest({ cookie: "_sv_node=us-east.deadbeef" });
  assertEquals(readAffinityCookie(tampered, "203.0.113.10", "_sv_node"), null);
});

// --- selectNode -----------------------------------------------------------

function makeSelector(overrides: Partial<Parameters<typeof selectNode>[1]> = {}) {
  const nodes = testNodes();
  const ring = buildRing(nodes, 256);
  const health = new NodeHealthTracker({
    failureThreshold: 3,
    successThreshold: 2,
    cooldownMs: 10_000,
  });
  return {
    opts: {
      nodes,
      ring,
      health,
      geoMap: parseGeoMap("IN=ap-south,US=us-east,GB=eu-west"),
      cookieName: "_sv_node",
      cookieTtlDays: 30,
      ...overrides,
    },
    health,
  };
}

Deno.test("selectNode - routes first-contact traffic to nearest geo replica", () => {
  const { opts } = makeSelector();
  const req = makeRequest({ "cf-connecting-ip": "49.207.0.1", "cf-ipcountry": "IN" });
  const result = selectNode(req, opts);
  assertEquals(result.node.id, "ap-south");
  assertEquals(result.reason, "geo");
  assertEquals(result.sticky, false);
  assert(result.setCookie !== null);
});

Deno.test("selectNode - affinity cookie keeps the socket sticky to its node", () => {
  const { opts } = makeSelector();
  const req = makeRequest({
    "cf-connecting-ip": "203.0.113.10",
    "cf-ipcountry": "GB",
    cookie: buildAffinityCookie("us-east", "203.0.113.10", "_sv_node", 30),
  });
  const result = selectNode(req, opts);
  assertEquals(result.node.id, "us-east");
  assertEquals(result.sticky, true);
  assertEquals(result.reason, "cookie");
  assertEquals(result.setCookie, null);
});

Deno.test("selectNode - healthy node falls back to next ring successor on failover", () => {
  const { opts, health } = makeSelector();
  const req = makeRequest({ "cf-connecting-ip": "203.0.113.10", "cf-ipcountry": "GB" });
  const first = selectNode(req, opts);
  const primary = first.node.id;
  const failoverTarget = first.nodeOrder[1];

  for (let i = 0; i < 3; i++) health.recordFailure(primary);
  assert(!health.isHealthy(primary));

  const second = selectNode(req, opts);
  assertEquals(second.node.id, failoverTarget);
  assertEquals(second.failover, true);
});

Deno.test("selectNode - unhealthy sticky node is replaced and cookie is refreshed", () => {
  const { opts, health } = makeSelector();
  for (let i = 0; i < 3; i++) health.recordFailure("us-east");

  const req = makeRequest({
    "cf-connecting-ip": "203.0.113.10",
    "cf-ipcountry": "US",
    cookie: buildAffinityCookie("us-east", "203.0.113.10", "_sv_node", 30),
  });
  const result = selectNode(req, opts);
  assert(result.node.id !== "us-east");
  assertEquals(result.failover, true);
  assertEquals(result.sticky, true);
  assert(result.setCookie !== null);
});

Deno.test("selectNode - fails open when every node is unhealthy", () => {
  const { opts, health } = makeSelector();
  for (const node of opts.nodes) {
    for (let i = 0; i < 3; i++) health.recordFailure(node.id);
  }
  const req = makeRequest({ "cf-connecting-ip": "203.0.113.10" });
  const result = selectNode(req, opts);
  assert(result.node !== null);
  assertEquals(result.failover, true);
});

Deno.test("selectNode - explicit x-lb-node pinning is honored", () => {
  const { opts } = makeSelector();
  const req = makeRequest({ "cf-connecting-ip": "203.0.113.10", "x-lb-node": "eu-west" });
  const result = selectNode(req, opts);
  assertEquals(result.node.id, "eu-west");
  assertEquals(result.reason, "explicit");
});

// --- NodeHealthTracker ----------------------------------------------------

Deno.test("health - circuit trips after failure threshold and reopens on success", () => {
  const health = new NodeHealthTracker({ failureThreshold: 2, successThreshold: 2, cooldownMs: 1 });
  assert(health.isHealthy("n1"));
  health.recordFailure("n1");
  assert(health.isHealthy("n1"));
  health.recordFailure("n1");
  assert(!health.isHealthy("n1")); // open

  const status = health.status("n1");
  assertEquals(status.open, true);
  assert(status.openForMs <= 1);

  // Wait for the cooldown to expire → half-open probe.
  health.recordSuccess("n1", 5);
  health.recordSuccess("n1", 6);
  assert(health.isHealthy("n1"));
});

Deno.test("health - half-open probe failure re-trips the circuit", () => {
  const health = new NodeHealthTracker({ failureThreshold: 1, successThreshold: 1, cooldownMs: 1 });
  health.recordFailure("n1");
  assert(!health.isHealthy("n1"));
  health.recordFailure("n1"); // probe failure while half-open
  assert(!health.isHealthy("n1"));
  assertEquals(health.status("n1").open, true);
});
