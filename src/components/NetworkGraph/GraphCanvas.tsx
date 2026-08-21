import { useEffect, useRef, useState, useCallback } from "react";
import { GraphRenderer, type RendererNode, type RendererEdge } from "./GraphRenderer";
import { type NodeData, type EdgeData, type PhysicsConfig } from "./physics.worker";
import { createClient } from "@/lib/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  handle: string;
  avatarUrl: string | null;
  clubCount: number;
}

interface GraphStats {
  nodes: number;
  edges: number;
  fps: number;
}

// ─── Colour palette (deterministic per node index) ─────────────────────────────

const PALETTE: [number, number, number][] = [
  [0.39, 0.58, 0.93], // blue
  [0.3, 0.85, 0.64], // teal
  [0.95, 0.61, 0.33], // orange
  [0.87, 0.4, 0.6], // rose
  [0.6, 0.5, 0.93], // violet
  [0.4, 0.8, 0.4], // green
  [0.9, 0.75, 0.35], // gold
];

function nodeColor(idx: number): [number, number, number] {
  return PALETTE[idx % PALETTE.length];
}

// ─── Supabase data fetcher ─────────────────────────────────────────────────────

async function fetchGraphData(): Promise<{
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
}> {
  const supabase = createClient();

  // Fetch profiles
  const { data: profiles, error: profError } = await supabase
    .from("profiles")
    .select("id, handle, avatar_url")
    .limit(2000);

  if (profError) throw profError;

  // Fetch club memberships to build edges (shared club = connection)
  const { data: memberships, error: memError } = await supabase
    .from("club_memberships")
    .select("user_id, club_id")
    .limit(10000);

  if (memError) throw memError;

  // Build per-club member lists
  const clubMembers = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    if (!clubMembers.has(m.club_id)) clubMembers.set(m.club_id, []);
    clubMembers.get(m.club_id)!.push(m.user_id);
  }

  // Count clubs per user
  const userClubCount = new Map<string, number>();
  for (const [, members] of clubMembers) {
    for (const uid of members) {
      userClubCount.set(uid, (userClubCount.get(uid) ?? 0) + 1);
    }
  }

  const nodes: GraphNode[] = (profiles ?? []).map((p) => ({
    id: p.id,
    handle: p.handle ?? p.id.slice(0, 8),
    avatarUrl: p.avatar_url,
    clubCount: userClubCount.get(p.id) ?? 0,
  }));

  // Edges: connect members who share a club (capped per club to avoid O(n²) explosion)
  const edgeSet = new Set<string>();
  const edges: { source: string; target: string }[] = [];
  const MAX_EDGES_PER_CLUB = 30;

  for (const [, members] of clubMembers) {
    const limit = Math.min(members.length, MAX_EDGES_PER_CLUB);
    for (let i = 0; i < limit; i++) {
      for (let j = i + 1; j < limit; j++) {
        const key =
          members[i] < members[j] ? `${members[i]}:${members[j]}` : `${members[j]}:${members[i]}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: members[i], target: members[j] });
        }
      }
    }
  }

  return { nodes, edges };
}

// ─── Synthetic data generator (dev / no-auth fallback) ────────────────────────

function generateSyntheticGraph(nodeCount = 500, avgDegree = 4) {
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node-${i}`,
    handle: `user_${i}`,
    avatarUrl: null,
    clubCount: Math.floor(Math.random() * 5),
  }));

  const edges: { source: string; target: string }[] = [];
  const edgeSet = new Set<string>();

  for (let i = 0; i < nodeCount; i++) {
    const degree = Math.floor(Math.random() * avgDegree * 2) + 1;
    for (let d = 0; d < degree; d++) {
      const j = Math.floor(Math.random() * nodeCount);
      if (i === j) continue;
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: `node-${i}`, target: `node-${j}` });
      }
    }
  }
  return { nodes, edges };
}

// ─── GraphCanvas Component ─────────────────────────────────────────────────────

const PHYSICS_CONFIG: Partial<PhysicsConfig> = {
  theta: 0.7,
  repulsion: 10000,
  attraction: 0.008,
  damping: 0.88,
  maxVelocity: 12,
};

export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const tickingRef = useRef(false);
  const fpsRef = useRef({ frames: 0, last: performance.now() });

  const [stats, setStats] = useState<GraphStats>({ nodes: 0, edges: 0, fps: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // ── FPS counter ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - fpsRef.current.last;
      const fps = Math.round((fpsRef.current.frames * 1000) / elapsed);
      fpsRef.current = { frames: 0, last: now };
      setStats((s) => ({ ...s, fps }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Physics + render bootstrap ──────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let renderer: GraphRenderer;
    let worker: Worker;
    let animating = true;

    async function bootstrap() {
      try {
        // 1. Init WebGL renderer
        renderer = new GraphRenderer(canvas);
        rendererRef.current = renderer;

        // 2. Spawn physics worker
        worker = new Worker(new URL("./physics.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;

        // 3. Load graph data
        let graphData: { nodes: GraphNode[]; edges: { source: string; target: string }[] };
        try {
          graphData = await fetchGraphData();
          if (graphData.nodes.length === 0) throw new Error("empty");
        } catch {
          // Fallback: synthetic demo graph
          graphData = generateSyntheticGraph(600, 5);
        }

        const { nodes, edges } = graphData;
        setStats({ nodes: nodes.length, edges: edges.length, fps: 0 });

        // 4. Build index map for edges
        const idToIdx = new Map(nodes.map((n, i) => [n.id, i]));
        const rendererEdges: RendererEdge[] = edges
          .map((e) => ({
            source: idToIdx.get(e.source) ?? -1,
            target: idToIdx.get(e.target) ?? -1,
          }))
          .filter((e) => e.source >= 0 && e.target >= 0);

        const rendererNodes: RendererNode[] = nodes.map((n, i) => ({
          id: n.id,
          radius: 5 + Math.min(n.clubCount * 1.5, 10),
          color: nodeColor(i),
        }));

        renderer.setGraph(rendererNodes, rendererEdges);

        // 5. Init physics worker
        const workerNodes: NodeData[] = nodes.map((n) => ({ id: n.id }));
        const workerEdges: EdgeData[] = edges;
        worker.postMessage({
          type: "init",
          nodes: workerNodes,
          edges: workerEdges,
          config: PHYSICS_CONFIG,
        });

        // 6. Wire up position updates
        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data as { type: string; buffer?: ArrayBuffer };
          if (msg.type === "ready") {
            setStatus("ready");
            renderer.start();
            tickLoop();
          } else if (msg.type === "positions" && msg.buffer) {
            renderer.updatePositions(msg.buffer);
            fpsRef.current.frames++;
            if (animating) tickLoop();
          }
        };
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      }
    }

    function tickLoop() {
      if (workerRef.current && animating) {
        workerRef.current.postMessage({ type: "tick" });
      }
    }

    bootstrap();

    return () => {
      animating = false;
      renderer?.destroy();
      worker?.terminate();
    };
  }, []);

  const handleReset = useCallback(() => {
    rendererRef.current?.resetCamera();
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full bg-[#0d0f1a] rounded-xl overflow-hidden">
      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full touch-none" style={{ display: "block" }} />

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0d0f1a]/90">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-400 tracking-wide">Initialising graph renderer…</p>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0f1a]/90 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-red-400 text-2xl">⚠</span>
          </div>
          <p className="text-sm text-red-400">
            {errorMsg || "Failed to initialise WebGL renderer."}
          </p>
          <p className="text-xs text-slate-500">Ensure WebGL2 is enabled in your browser.</p>
        </div>
      )}

      {/* HUD — shown only when ready */}
      {status === "ready" && (
        <>
          {/* Stats bar */}
          <div className="absolute top-3 left-3 flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
            <Stat label="Nodes" value={stats.nodes.toLocaleString()} />
            <div className="w-px h-4 bg-white/10" />
            <Stat label="Edges" value={stats.edges.toLocaleString()} />
            <div className="w-px h-4 bg-white/10" />
            <Stat
              label="FPS"
              value={stats.fps.toString()}
              className={stats.fps < 30 ? "text-red-400" : "text-emerald-400"}
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Student Connection Graph</p>
            <p>Node size = club membership count</p>
            <p>Drag to pan · Scroll to zoom</p>
          </div>

          {/* Reset camera button */}
          <button
            onClick={handleReset}
            className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-black/70 transition-colors"
          >
            Reset View
          </button>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className = "text-white",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-mono font-semibold leading-none ${className}`}>{value}</span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}
