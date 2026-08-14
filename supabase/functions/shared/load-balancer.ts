/**
 * Geo-aware consistent-hash load balancer for Supabase Edge Functions.
 *
 * Maps inbound WebSocket/realtime traffic to the nearest geographic replica
 * node while keeping stateful connections sticky to a single node through a
 * signed affinity cookie. Unhealthy nodes are skipped gracefully by walking
 * the hash ring clockwise (ring-hash failover semantics).
 *
 * Environment configuration (all optional, except LB_NODES for routing):
 * - LB_NODES:      comma separated "id=url[:weight]" entries, e.g.
 *                  "us-east=https://us-east.replica.supabase.co:2,eu-west=wss://eu-west.replica.supabase.co"
 * - LB_GEO_MAP:    comma separated "COUNTRY=nodeId" entries, e.g.
 *                  "US=us-east,GB=eu-west,IN=ap-south"
 * - LB_COOKIE_NAME:        affinity cookie name (default: _sv_node)
 * - LB_COOKIE_SECRET:      secret used to sign the affinity cookie
 * - LB_COOKIE_TTL_DAYS:    affinity cookie lifetime (default: 30)
 * - LB_VIRTUAL_NODES:      virtual nodes per ring entry (default: 256)
 * - LB_FAILURE_THRESHOLD:  consecutive failures before a node trips (default: 3)
 * - LB_SUCCESS_THRESHOLD:  successes in half-open state to close the circuit (default: 2)
 * - LB_COOLDOWN_MS:        circuit breaker cooldown (default: 30000)
 * - LB_LATENCY_SAMPLES:    latency samples kept per node (default: 100)
 */

export interface LbNode {
  id: string;
  region: string;
  url: string;
  weight: number;
}

export interface GeoInfo {
  ip: string;
  country: string | null;
}

export type LbSelectionReason = "cookie" | "explicit" | "geo" | "ring" | "none";

export interface LbSelection {
  node: LbNode | null;
  sticky: boolean;
  reason: LbSelectionReason;
  failover: boolean;
  country: string | null;
  primaryNodeId: string | null;
  routingMs: number;
  setCookie: string | null;
  nodeOrder: string[];
}

export const LB_COOKIE_DEFAULT_NAME = "_sv_node";

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash. Deterministic and fast enough for edge runtimes. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function lowerBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  if (sorted[hi] < value) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Consistent hash ring (ring hash with virtual nodes)
// ---------------------------------------------------------------------------

export class ConsistentHashRing {
  private ring = new Map<number, string>();
  private points: number[] = [];
  private weights = new Map<string, number>();
  private nodeIds = new Set<string>();
  readonly virtualNodes: number;

  constructor(virtualNodes = 256) {
    this.virtualNodes = Math.max(1, Math.floor(virtualNodes));
  }

  addNode(nodeId: string, weight = 1): void {
    const w = Math.max(1, Math.floor(weight));
    for (let i = 0; i < this.virtualNodes * w; i++) {
      const point = fnv1a(`${nodeId}#${i}`);
      if (!this.ring.has(point)) {
        this.ring.set(point, nodeId);
        this.points.push(point);
      }
    }
    this.points.sort((a, b) => a - b);
    this.weights.set(nodeId, w);
    this.nodeIds.add(nodeId);
  }

  removeNode(nodeId: string): void {
    const w = this.weights.get(nodeId);
    if (w === undefined) return;
    for (let i = 0; i < this.virtualNodes * w; i++) {
      this.ring.delete(fnv1a(`${nodeId}#${i}`));
    }
    this.points = this.points.filter((p) => this.ring.has(p));
    this.weights.delete(nodeId);
    this.nodeIds.delete(nodeId);
  }

  hasNode(nodeId: string): boolean {
    return this.nodeIds.has(nodeId);
  }

  get size(): number {
    return this.nodeIds.size;
  }

  /** Primary node for a key (clockwise successor on the ring). */
  getNode(key: string): string | null {
    if (this.points.length === 0) return null;
    const idx = lowerBound(this.points, fnv1a(key));
    return this.ring.get(this.points[idx]) ?? null;
  }

  /**
   * Clockwise node order starting at the key's ring position: the primary
   * first, then every other node in successor order (deduplicated). This is
   * the failover chain for a given client key.
   */
  getOrder(key: string): string[] {
    const order: string[] = [];
    if (this.points.length === 0) return order;
    const seen = new Set<string>();
    const start = lowerBound(this.points, fnv1a(key));
    const n = this.points.length;
    for (let i = 0; i < n && seen.size < this.nodeIds.size; i++) {
      const nodeId = this.ring.get(this.points[(start + i) % n]);
      if (nodeId !== undefined && !seen.has(nodeId)) {
        seen.add(nodeId);
        order.push(nodeId);
      }
    }
    return order;
  }
}

export function buildRing(nodes: LbNode[], virtualNodes: number): ConsistentHashRing {
  const ring = new ConsistentHashRing(virtualNodes);
  for (const node of nodes) {
    ring.addNode(node.id, node.weight);
  }
  return ring;
}

// ---------------------------------------------------------------------------
// Client geo info (Cloudflare / proxy headers)
// ---------------------------------------------------------------------------

export function geoFromRequest(req: Request): GeoInfo {
  const cfIp = req.headers.get("cf-connecting-ip");
  const xff = req.headers.get("x-forwarded-for");
  const xRealIp = req.headers.get("x-real-ip");
  const ip = cfIp || (xff ? xff.split(",")[0].trim() : "") || xRealIp || "0.0.0.0";

  const countryHeader = req.headers.get("cf-ipcountry") || req.headers.get("x-country");
  const country = countryHeader ? countryHeader.toUpperCase().trim() : null;

  return { ip, country };
}

// ---------------------------------------------------------------------------
// Node registry + geo map parsing
// ---------------------------------------------------------------------------

/**
 * Parses the LB_NODES environment value.
 * Expected format: "id=url[:weight],id2=url2" (weight defaults to 1).
 */
export function parseNodeRegistry(raw?: string | null): LbNode[] {
  if (!raw) return [];
  const nodes: LbNode[] = [];
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const sepIdx = entry.indexOf("=") !== -1 ? entry.indexOf("=") : entry.indexOf("|");
    if (sepIdx === -1) continue;
    const id = entry.slice(0, sepIdx).trim();
    const rest = entry.slice(sepIdx + 1).trim();
    if (!id || !rest) continue;

    let url = rest;
    let weight = 1;
    const lastColon = rest.lastIndexOf(":");
    if (lastColon !== -1) {
      const maybe = Number(rest.slice(lastColon + 1));
      if (Number.isFinite(maybe) && maybe >= 1) {
        weight = Math.floor(maybe);
        url = rest.slice(0, lastColon);
      }
    }
    nodes.push({ id, region: id, url, weight });
  }
  return nodes;
}

/** Parses LB_GEO_MAP: "COUNTRY=nodeId,COUNTRY2=nodeId2". */
export function parseGeoMap(raw?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const country = part.slice(0, eq).trim().toUpperCase();
    const nodeId = part.slice(eq + 1).trim();
    if (country && nodeId) map.set(country, nodeId);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Session affinity cookie (signed with the client IP to prevent hijacking)
// ---------------------------------------------------------------------------

function affinitySecret(): string {
  return Deno.env.get("LB_COOKIE_SECRET") ?? "";
}

function signAffinity(nodeId: string, ip: string): string {
  return fnv1a(`${nodeId}|${ip}|${affinitySecret()}`).toString(36);
}

/**
 * Reads and validates the affinity cookie. Returns the pinned node id, or
 * null when the cookie is missing, malformed, or was minted for another IP.
 */
export function readAffinityCookie(req: Request, ip: string, cookieName: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const chunk of header.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq === -1) continue;
    if (chunk.slice(0, eq).trim() !== cookieName) continue;
    const value = chunk.slice(eq + 1).trim();
    const dot = value.lastIndexOf(".");
    if (dot === -1 || dot === 0 || dot === value.length - 1) return null;
    const nodeId = value.slice(0, dot);
    if (signAffinity(nodeId, ip) !== value.slice(dot + 1)) return null;
    return nodeId;
  }
  return null;
}

export function buildAffinityCookie(
  nodeId: string,
  ip: string,
  cookieName: string,
  ttlDays: number,
): string {
  const maxAge = Math.floor(Math.max(1, ttlDays) * 86400);
  return `${cookieName}=${nodeId}.${signAffinity(nodeId, ip)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`;
}

// ---------------------------------------------------------------------------
// Node health tracking (circuit breaker + latency percentiles)
// ---------------------------------------------------------------------------

export interface HealthOptions {
  failureThreshold: number;
  successThreshold: number;
  cooldownMs: number;
  latencySamples: number;
}

export interface NodeStatus {
  nodeId: string;
  healthy: boolean;
  open: boolean;
  halfOpen: boolean;
  openForMs: number;
  failures: number;
  samples: number;
  p50: number | null;
  p95: number | null;
}

export class NodeHealthTracker {
  private failures = new Map<string, number>();
  private openUntil = new Map<string, number>();
  private latency = new Map<string, number[]>();
  readonly options: HealthOptions;

  constructor(options: Partial<HealthOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 3,
      successThreshold: options.successThreshold ?? 2,
      cooldownMs: options.cooldownMs ?? 30_000,
      latencySamples: options.latencySamples ?? 100,
    };
  }

  recordSuccess(nodeId: string, latencyMs?: number): void {
    const now = Date.now();
    const until = this.openUntil.get(nodeId) ?? 0;
    if (until !== 0 && until <= now) {
      // Half-open probe succeeded: close the circuit.
      this.openUntil.delete(nodeId);
      this.failures.delete(nodeId);
    } else if (until === 0) {
      this.failures.delete(nodeId);
    }

    if (typeof latencyMs === "number" && Number.isFinite(latencyMs)) {
      const samples = this.latency.get(nodeId) ?? [];
      samples.push(Math.max(0, latencyMs));
      if (samples.length > this.options.latencySamples) samples.shift();
      this.latency.set(nodeId, samples);
    }
  }

  recordFailure(nodeId: string): void {
    const now = Date.now();
    const until = this.openUntil.get(nodeId) ?? 0;
    if (until > now) return; // Already tripped, keep it open.
    if (until !== 0) {
      // Half-open probe failed: trip the circuit again.
      this.openUntil.set(nodeId, now + this.options.cooldownMs);
      return;
    }
    const f = (this.failures.get(nodeId) ?? 0) + 1;
    if (f >= this.options.failureThreshold) {
      this.openUntil.set(nodeId, now + this.options.cooldownMs);
      this.failures.delete(nodeId);
    } else {
      this.failures.set(nodeId, f);
    }
  }

  isHealthy(nodeId: string): boolean {
    const now = Date.now();
    const until = this.openUntil.get(nodeId) ?? 0;
    if (until > now) return false;
    if (until !== 0) return true; // Half-open: allow a probe request.
    return (this.failures.get(nodeId) ?? 0) < this.options.failureThreshold;
  }

  status(nodeId: string): NodeStatus {
    const now = Date.now();
    const until = this.openUntil.get(nodeId) ?? 0;
    const samples = this.latency.get(nodeId) ?? [];
    const sorted = [...samples].sort((a, b) => a - b);
    const pct = (p: number): number | null => {
      if (sorted.length === 0) return null;
      const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
      return sorted[idx];
    };
    return {
      nodeId,
      healthy: this.isHealthy(nodeId),
      open: until > now,
      halfOpen: until !== 0 && until <= now,
      openForMs: until > now ? until - now : 0,
      failures: this.failures.get(nodeId) ?? 0,
      samples: samples.length,
      p50: pct(50),
      p95: pct(95),
    };
  }

  /** Force-manually opens or closes the circuit for a node (ops endpoint). */
  setOpen(nodeId: string, open: boolean): void {
    if (open) {
      this.openUntil.set(nodeId, Date.now() + this.options.cooldownMs);
    } else {
      this.openUntil.delete(nodeId);
      this.failures.delete(nodeId);
    }
  }
}

// ---------------------------------------------------------------------------
// Routing decision
// ---------------------------------------------------------------------------

export interface SelectorOptions {
  nodes: LbNode[];
  ring: ConsistentHashRing;
  health: NodeHealthTracker;
  geoMap: Map<string, string>;
  cookieName: string;
  cookieTtlDays: number;
}

export function selectNode(req: Request, opts: SelectorOptions): LbSelection {
  const started = performance.now();
  const { nodes, ring, health, geoMap, cookieName, cookieTtlDays } = opts;

  if (nodes.length === 0) {
    return {
      node: null,
      sticky: false,
      reason: "none",
      failover: false,
      country: null,
      primaryNodeId: null,
      routingMs: performance.now() - started,
      setCookie: null,
      nodeOrder: [],
    };
  }

  const geo = geoFromRequest(req);
  const key = geo.ip;
  let order = ring.getOrder(key);

  let reason: LbSelectionReason = "ring";
  let sticky = false;
  let failover = false;

  const promoteToPrimary = (nodeId: string): boolean => {
    if (order.includes(nodeId)) {
      order = [nodeId, ...order.filter((id) => id !== nodeId)];
      return true;
    }
    return false;
  };

  // 1. Signed affinity cookie → sticky routing for stateful connections.
  const cookieNodeId = readAffinityCookie(req, geo.ip, cookieName);
  if (cookieNodeId && promoteToPrimary(cookieNodeId)) {
    sticky = true;
    reason = "cookie";
  } else {
    // 2. Explicit node pinning via x-lb-node header or ?node= query param.
    const url = new URL(req.url);
    const explicit = req.headers.get("x-lb-node") || url.searchParams.get("node");
    if (explicit && promoteToPrimary(explicit)) {
      reason = "explicit";
    } else {
      // 3. First contact: prefer the nearest geographic replica.
      const country = geo.country ?? "";
      if (country && geoMap.has(country)) {
        const geoNode = nodes.find(
          (n) => n.id === geoMap.get(country) || n.region === geoMap.get(country),
        );
        if (geoNode && promoteToPrimary(geoNode.id)) {
          reason = "geo";
        }
      }
    }
  }

  const primaryNodeId = order[0] ?? null;

  // 4. Walk the ring clockwise; skip unhealthy nodes. Fail-open as a last
  //    resort so traffic is never dropped when every node is unhealthy.
  let chosenId: string | null = null;
  for (const id of order) {
    if (health.isHealthy(id)) {
      chosenId = id;
      break;
    }
    failover = true;
  }
  if (chosenId === null) {
    chosenId = order[0] ?? null;
    failover = true;
  }

  const node = chosenId !== null ? (nodes.find((n) => n.id === chosenId) ?? null) : null;

  // Re-mint the cookie when a sticky node failed over so the client stays
  // pinned to the replacement node on subsequent requests.
  const needsCookie = node !== null && (!sticky || node.id !== cookieNodeId);

  return {
    node,
    sticky,
    reason,
    failover,
    country: geo.country,
    primaryNodeId,
    routingMs: performance.now() - started,
    setCookie: needsCookie ? buildAffinityCookie(node.id, geo.ip, cookieName, cookieTtlDays) : null,
    nodeOrder: order,
  };
}
