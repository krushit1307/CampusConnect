/**
 * physics.worker.ts
 *
 * Web Worker: Barnes-Hut force-directed graph physics.
 * Runs entirely off the main thread so the UI stays at 60 fps.
 *
 * Message API
 * ───────────
 * IN  { type: 'init',    nodes: NodeData[], edges: EdgeData[], config?: PhysicsConfig }
 * IN  { type: 'tick' }
 * IN  { type: 'config',  config: Partial<PhysicsConfig> }
 * IN  { type: 'pin',     id: string, x: number, y: number }
 * IN  { type: 'unpin',   id: string }
 *
 * OUT { type: 'positions', buffer: ArrayBuffer }  — Float32Array [x0,y0, x1,y1, ...]
 * OUT { type: 'ready' }
 */

export interface NodeData {
  id: string;
  x?: number;
  y?: number;
}

export interface EdgeData {
  source: string;
  target: string;
}

export interface PhysicsConfig {
  /** Barnes-Hut theta: lower = more accurate, higher = faster (default 0.7) */
  theta: number;
  /** Coulomb repulsion constant (default 8000) */
  repulsion: number;
  /** Spring attraction constant (default 0.01) */
  attraction: number;
  /** Velocity damping 0–1 (default 0.85) */
  damping: number;
  /** Max velocity per tick (default 10) */
  maxVelocity: number;
  /** Min energy threshold to auto-stop (default 0.001) */
  minEnergy: number;
}

// ─── Internal state ────────────────────────────────────────────────────────────

interface InternalNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  pinned: boolean;
}

const defaultConfig: PhysicsConfig = {
  theta: 0.7,
  repulsion: 8000,
  attraction: 0.01,
  damping: 0.85,
  maxVelocity: 10,
  minEnergy: 0.001,
};

let cfg: PhysicsConfig = { ...defaultConfig };
let nodes: InternalNode[] = [];
let adjacency: Map<number, number[]> = new Map();
let idToIndex: Map<string, number> = new Map();

// ─── Barnes-Hut QuadTree ───────────────────────────────────────────────────────

interface Quad {
  cx: number;
  cy: number;
  hw: number; // half-width
  mass: number;
  comX: number; // centre-of-mass X
  comY: number;
  children: [Quad | null, Quad | null, Quad | null, Quad | null] | null;
  leafNode: InternalNode | null;
}

function makeQuad(cx: number, cy: number, hw: number): Quad {
  return { cx, cy, hw, mass: 0, comX: 0, comY: 0, children: null, leafNode: null };
}

function insertNode(q: Quad, n: InternalNode): void {
  if (q.mass === 0) {
    q.mass = 1;
    q.comX = n.x;
    q.comY = n.y;
    q.leafNode = n;
    return;
  }

  // Upgrade leaf → internal
  if (q.leafNode !== null) {
    q.children = [null, null, null, null];
    const old = q.leafNode;
    q.leafNode = null;
    insertIntoChild(q, old);
  }

  // Update centre-of-mass
  q.comX = (q.comX * q.mass + n.x) / (q.mass + 1);
  q.comY = (q.comY * q.mass + n.y) / (q.mass + 1);
  q.mass += 1;

  insertIntoChild(q, n);
}

function insertIntoChild(q: Quad, n: InternalNode): void {
  const right = n.x >= q.cx;
  const bottom = n.y >= q.cy;
  const idx = (bottom ? 2 : 0) + (right ? 1 : 0);
  const hw2 = q.hw / 2;
  const childCx = q.cx + (right ? hw2 : -hw2);
  const childCy = q.cy + (bottom ? hw2 : -hw2);

  if (!q.children![idx]) {
    q.children![idx] = makeQuad(childCx, childCy, hw2);
  }
  insertNode(q.children![idx]!, n);
}

function applyRepulsion(q: Quad, n: InternalNode): void {
  if (q.mass === 0) return;

  const dx = n.x - q.comX;
  const dy = n.y - q.comY;
  const dist2 = dx * dx + dy * dy;
  if (dist2 < 1e-6) return;

  const dist = Math.sqrt(dist2);
  const size = q.hw * 2;

  // Barnes-Hut criterion
  if (q.children === null || size / dist < cfg.theta) {
    // Treat subtree as single body
    const force = (cfg.repulsion * q.mass) / dist2;
    n.fx += force * (dx / dist);
    n.fy += force * (dy / dist);
  } else {
    // Recurse into children
    for (const child of q.children) {
      if (child) applyRepulsion(child, n);
    }
  }
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

function tick(): Float32Array {
  if (nodes.length === 0) return new Float32Array(0);

  // Build QuadTree
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const hw = Math.max(maxX - minX, maxY - minY) / 2 + 1;

  const root = makeQuad(cx, cy, hw);
  for (const n of nodes) insertNode(root, n);

  // Reset forces — include a gentle gravity toward centre
  for (const n of nodes) {
    n.fx = (cx - n.x) * 0.002;
    n.fy = (cy - n.y) * 0.002;
  }

  // Repulsion (Barnes-Hut)
  for (const n of nodes) {
    if (!n.pinned) applyRepulsion(root, n);
  }

  // Attraction (spring forces along edges)
  adjacency.forEach((neighbours, idx) => {
    const a = nodes[idx];
    for (const nIdx of neighbours) {
      const b = nodes[nIdx];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = cfg.attraction * dist;
      const fx = (force * dx) / dist;
      const fy = (force * dy) / dist;
      a.fx += fx;
      a.fy += fy;
      b.fx -= fx;
      b.fy -= fy;
    }
  });

  // Integrate (Velocity Verlet)
  const { damping, maxVelocity } = cfg;
  for (const n of nodes) {
    if (n.pinned) continue;
    n.vx = (n.vx + n.fx) * damping;
    n.vy = (n.vy + n.fy) * damping;

    const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
    if (speed > maxVelocity) {
      n.vx *= maxVelocity / speed;
      n.vy *= maxVelocity / speed;
    }

    n.x += n.vx;
    n.y += n.vy;
  }

  // Pack positions into Float32Array [x0,y0, x1,y1, ...]
  const buf = new Float32Array(nodes.length * 2);
  for (let i = 0; i < nodes.length; i++) {
    buf[i * 2] = nodes[i].x;
    buf[i * 2 + 1] = nodes[i].y;
  }
  return buf;
}

// ─── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; [key: string]: unknown };

  switch (msg.type) {
    case "init": {
      const rawNodes = msg.nodes as NodeData[];
      const rawEdges = msg.edges as EdgeData[];
      cfg = { ...defaultConfig, ...((msg.config as Partial<PhysicsConfig>) ?? {}) };

      idToIndex = new Map();
      adjacency = new Map();

      nodes = rawNodes.map((n, i) => {
        idToIndex.set(n.id, i);
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(i + 1) * 20;
        return {
          id: n.id,
          x: n.x ?? Math.cos(angle) * radius,
          y: n.y ?? Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          fx: 0,
          fy: 0,
          pinned: false,
        };
      });

      for (let i = 0; i < nodes.length; i++) adjacency.set(i, []);

      for (const edge of rawEdges) {
        const si = idToIndex.get(edge.source);
        const ti = idToIndex.get(edge.target);
        if (si !== undefined && ti !== undefined) {
          adjacency.get(si)!.push(ti);
        }
      }

      self.postMessage({ type: "ready" });
      break;
    }

    case "tick": {
      const buffer = tick();
      self.postMessage({ type: "positions", buffer: buffer.buffer }, [buffer.buffer]);
      break;
    }

    case "config": {
      cfg = { ...cfg, ...((msg.config as Partial<PhysicsConfig>) ?? {}) };
      break;
    }

    case "pin": {
      const idx = idToIndex.get(msg.id as string);
      if (idx !== undefined) {
        nodes[idx].pinned = true;
        nodes[idx].x = msg.x as number;
        nodes[idx].y = msg.y as number;
        nodes[idx].vx = 0;
        nodes[idx].vy = 0;
      }
      break;
    }

    case "unpin": {
      const idx = idToIndex.get(msg.id as string);
      if (idx !== undefined) nodes[idx].pinned = false;
      break;
    }
  }
};
