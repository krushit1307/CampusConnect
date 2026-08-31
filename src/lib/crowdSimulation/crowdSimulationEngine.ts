import {
  BottleneckState,
  CrowdSimConfig,
  DEFAULT_SIM_CONFIG,
  SimNode,
  SimNodeType,
} from "./crowdSimulationTypes";

export class CrowdSimulationEngine {
  private config: CrowdSimConfig;
  private nodes: SimNode[] = [];

  // Particle Data: Float32Array packed per particle: [x, y, vx, vy, active, stateTime]
  // 6 floats per particle
  private particles: Float32Array;
  private activeCount: number = 0;
  private isRunning: boolean = false;
  private spawnTimer: number = 0;
  private bottleneckState: BottleneckState = {
    detected: false,
    zoneId: null,
    zoneLabel: null,
    density: 0,
    recommendation: null,
    contributingNodeLabel: null,
  };

  constructor(config: Partial<CrowdSimConfig> = {}) {
    this.config = { ...DEFAULT_SIM_CONFIG, ...config };
    this.particles = new Float32Array(500 * 6);
  }

  public setConfig(configPatch: Partial<CrowdSimConfig>) {
    this.config = { ...this.config, ...configPatch };
  }

  public getConfig(): CrowdSimConfig {
    return { ...this.config };
  }

  public setNodes(nodes: SimNode[]) {
    this.nodes = nodes;
  }

  public getNodes(): SimNode[] {
    return [...this.nodes];
  }

  /**
   * Converts generic venue layout elements (from mapBuilderStore or FloorplanAssets) into SimNodes.
   */
  public loadFromLayoutElements(
    elements: Array<{
      id: string;
      type?: string;
      kind?: string;
      x: number;
      y: number;
      width: number;
      height: number;
      label?: string;
    }>,
  ) {
    const simNodes: SimNode[] = elements.map((el) => {
      const rawType = (el.type || el.kind || "").toLowerCase();
      let simType: SimNodeType = "obstacle";
      let attractionWeight = 0;

      if (rawType.includes("entrance")) {
        simType = "entrance";
        attractionWeight = 0.2;
      } else if (rawType.includes("exit")) {
        simType = "exit";
        attractionWeight = 1.5;
      } else if (rawType.includes("stage")) {
        simType = "stage";
        attractionWeight = 0.6;
      } else if (
        rawType.includes("table") ||
        rawType.includes("booth") ||
        rawType.includes("sponsor")
      ) {
        simType = "food_table";
        attractionWeight = 1.0;
      } else {
        simType = "obstacle";
        attractionWeight = 0;
      }

      return {
        id: el.id,
        type: simType,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        attractionWeight,
        label: el.label || el.id,
      };
    });

    this.setNodes(simNodes);
  }

  public start() {
    this.isRunning = true;
  }

  public pause() {
    this.isRunning = false;
  }

  public reset() {
    this.particles.fill(0);
    this.activeCount = 0;
    this.spawnTimer = 0;
    this.isRunning = false;
    this.bottleneckState = {
      detected: false,
      zoneId: null,
      zoneLabel: null,
      density: 0,
      recommendation: null,
      contributingNodeLabel: null,
    };
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getParticles(): Float32Array {
    return this.particles;
  }

  public getBottleneckState(): BottleneckState {
    return { ...this.bottleneckState };
  }

  /**
   * Advances the simulation by dt seconds.
   */
  public step(dt: number = 0.016) {
    const entranceNodes = this.nodes.filter((n) => n.type === "entrance");
    const exitNodes = this.nodes.filter((n) => n.type === "exit");
    const attractionNodes = this.nodes.filter((n) => n.type === "food_table" || n.type === "stage");
    const obstacleNodes = this.nodes.filter((n) => n.type === "obstacle");

    // Spawn logic
    if (this.isRunning && this.activeCount < this.config.maxCapacity) {
      this.spawnTimer += dt;
      const spawnInterval = 1 / Math.max(1, this.config.spawnRate);

      if (this.spawnTimer >= spawnInterval) {
        this.spawnTimer = 0;
        this.spawnParticle(entranceNodes);
      }
    }

    // Default entrance / exit centers if none defined in layout
    const defaultEntrance =
      entranceNodes.length > 0
        ? {
            x: entranceNodes[0].x + entranceNodes[0].width / 2,
            y: entranceNodes[0].y + entranceNodes[0].height / 2,
          }
        : { x: 50, y: 50 };

    const defaultExit =
      exitNodes.length > 0
        ? {
            x: exitNodes[0].x + exitNodes[0].width / 2,
            y: exitNodes[0].y + exitNodes[0].height / 2,
          }
        : { x: this.config.canvasWidth - 50, y: this.config.canvasHeight - 50 };

    // Update active particles
    let currentActive = 0;
    const speed = this.config.particleSpeed;

    for (let i = 0; i < 500; i++) {
      const idx = i * 6;
      if (this.particles[idx + 4] === 0) continue; // inactive

      const px = this.particles[idx];
      const py = this.particles[idx + 1];
      let pvx = this.particles[idx + 2];
      let pvy = this.particles[idx + 3];
      const stateTime = this.particles[idx + 5] + dt;

      // Determine target destination based on attraction & progression
      // Stage 1 (0-8s): Move toward high attraction node (Food Table or Stage) if present
      // Stage 2 (>8s or reached attraction): Move toward Exit
      let targetX = defaultExit.x;
      let targetY = defaultExit.y;

      if (attractionNodes.length > 0 && stateTime < 8.0) {
        // Select nearest or weighted attraction node
        let bestScore = -Infinity;
        let selectedNode = attractionNodes[0];

        for (const node of attractionNodes) {
          const cx = node.x + node.width / 2;
          const cy = node.y + node.height / 2;
          const dist = Math.hypot(cx - px, cy - py);
          const score = node.attractionWeight * 300 - dist;
          if (score > bestScore) {
            bestScore = score;
            selectedNode = node;
          }
        }

        targetX = selectedNode.x + selectedNode.width / 2;
        targetY = selectedNode.y + selectedNode.height / 2;
      }

      // Calculate directional attraction vector
      const dx = targetX - px;
      const dy = targetY - py;
      const dist = Math.hypot(dx, dy);

      if (dist > 2) {
        const targetVx = (dx / dist) * speed;
        const targetVy = (dy / dist) * speed;

        // Fluid momentum blending (smooth steering)
        pvx = pvx * 0.85 + targetVx * 0.15;
        pvy = pvy * 0.85 + targetVy * 0.15;
      }

      // Predict new position
      let nx = px + pvx * dt;
      let ny = py + pvy * dt;

      // Collision avoidance with obstacles & non-walkable layout items
      for (const obs of obstacleNodes) {
        if (
          nx > obs.x - 5 &&
          nx < obs.x + obs.width + 5 &&
          ny > obs.y - 5 &&
          ny < obs.y + obs.height + 5
        ) {
          // Push particle out along nearest edge
          const distLeft = Math.abs(nx - (obs.x - 5));
          const distRight = Math.abs(nx - (obs.x + obs.width + 5));
          const distTop = Math.abs(ny - (obs.y - 5));
          const distBottom = Math.abs(ny - (obs.y + obs.height + 5));

          const minDist = Math.min(distLeft, distRight, distTop, distBottom);

          if (minDist === distLeft) {
            nx = obs.x - 5;
            pvx = -Math.abs(pvx) * 0.5;
          } else if (minDist === distRight) {
            nx = obs.x + obs.width + 5;
            pvx = Math.abs(pvx) * 0.5;
          } else if (minDist === distTop) {
            ny = obs.y - 5;
            pvy = -Math.abs(pvy) * 0.5;
          } else {
            ny = obs.y + obs.height + 5;
            pvy = Math.abs(pvy) * 0.5;
          }
        }
      }

      // Canvas boundary constraint
      nx = Math.max(10, Math.min(this.config.canvasWidth - 10, nx));
      ny = Math.max(10, Math.min(this.config.canvasHeight - 10, ny));

      // Reached exit -> recycle particle
      let isNearExit = false;
      for (const ex of exitNodes) {
        if (
          nx >= ex.x - 10 &&
          nx <= ex.x + ex.width + 10 &&
          ny >= ex.y - 10 &&
          ny <= ex.y + ex.height + 10
        ) {
          isNearExit = true;
          break;
        }
      }

      if (isNearExit && stateTime > 3.0) {
        // Recycle to entrance
        this.particles[idx + 4] = 0; // deactivate
        continue;
      }

      // Write updated particle data
      this.particles[idx] = nx;
      this.particles[idx + 1] = ny;
      this.particles[idx + 2] = pvx;
      this.particles[idx + 3] = pvy;
      this.particles[idx + 5] = stateTime;
      currentActive++;
    }

    this.activeCount = currentActive;

    // Evaluate Bottlenecks / Density
    this.evaluateBottleneck(exitNodes, attractionNodes);
  }

  private spawnParticle(entranceNodes: SimNode[]) {
    // Find empty particle slot
    for (let i = 0; i < 500; i++) {
      const idx = i * 6;
      if (this.particles[idx + 4] === 0) {
        let spawnX = 50;
        let spawnY = 50;

        if (entranceNodes.length > 0) {
          const ent = entranceNodes[Math.floor(Math.random() * entranceNodes.length)];
          spawnX = ent.x + Math.random() * ent.width;
          spawnY = ent.y + Math.random() * ent.height;
        } else {
          spawnX = 20 + Math.random() * 40;
          spawnY = 20 + Math.random() * 40;
        }

        // Slight initial velocity spread
        const angle = Math.random() * Math.PI * 2;
        const speed = this.config.particleSpeed * 0.5;

        this.particles[idx] = spawnX;
        this.particles[idx + 1] = spawnY;
        this.particles[idx + 2] = Math.cos(angle) * speed;
        this.particles[idx + 3] = Math.sin(angle) * speed;
        this.particles[idx + 4] = 1; // active
        this.particles[idx + 5] = 0; // state time
        break;
      }
    }
  }

  /**
   * Calculates local density around exit zones and detects dangerous bottlenecks.
   */
  private evaluateBottleneck(exitNodes: SimNode[], attractionNodes: SimNode[]) {
    const criticalRadius = 80;
    const criticalArea = Math.PI * criticalRadius * criticalRadius;

    let maxDensity = 0;
    let worstExit: SimNode | null = null;
    let maxParticlesInZone = 0;

    const monitoredExits =
      exitNodes.length > 0
        ? exitNodes
        : [
            {
              id: "exit-default",
              type: "exit" as SimNodeType,
              x: this.config.canvasWidth - 100,
              y: this.config.canvasHeight - 100,
              width: 80,
              height: 60,
              attractionWeight: 1.5,
              label: "Main Exit",
            },
          ];

    for (const exitNode of monitoredExits) {
      const exitCx = exitNode.x + exitNode.width / 2;
      const exitCy = exitNode.y + exitNode.height / 2;
      let count = 0;

      for (let i = 0; i < 500; i++) {
        const idx = i * 6;
        if (this.particles[idx + 4] === 0) continue;

        const px = this.particles[idx];
        const py = this.particles[idx + 1];

        if (Math.hypot(px - exitCx, py - exitCy) <= criticalRadius) {
          count++;
        }
      }

      const density = count / criticalArea;
      if (density > maxDensity) {
        maxDensity = density;
        worstExit = exitNode;
        maxParticlesInZone = count;
      }
    }

    // Bottleneck threshold check: density > criticalDensityThreshold or count >= 8 particles in exit zone
    const isBottleneck =
      maxDensity >= this.config.criticalDensityThreshold || maxParticlesInZone >= 8;

    if (isBottleneck && worstExit) {
      // Identify contributing attraction node placed near exit
      const exitCx = worstExit.x + worstExit.width / 2;
      const exitCy = worstExit.y + worstExit.height / 2;

      let nearestAttractor: SimNode | null = null;
      let minDist = Infinity;

      for (const attr of attractionNodes) {
        const attrCx = attr.x + attr.width / 2;
        const attrCy = attr.y + attr.height / 2;
        const dist = Math.hypot(attrCx - exitCx, attrCy - exitCy);
        if (dist < minDist) {
          minDist = dist;
          nearestAttractor = attr;
        }
      }

      let recommendation = "Move the Food Table.";
      let contributorLabel = "Food Table";

      if (nearestAttractor) {
        contributorLabel = nearestAttractor.label || "Food Table";
        if (
          nearestAttractor.type === "food_table" ||
          contributorLabel.toLowerCase().includes("food") ||
          contributorLabel.toLowerCase().includes("table")
        ) {
          recommendation = "Move the Food Table.";
        } else {
          recommendation = `Move the ${contributorLabel}.`;
        }
      }

      this.bottleneckState = {
        detected: true,
        zoneId: worstExit.id,
        zoneLabel: worstExit.label || "Exit Zone",
        density: Math.round(maxDensity * 10000) / 10000,
        recommendation,
        contributingNodeLabel: contributorLabel,
      };
    } else {
      this.bottleneckState = {
        detected: false,
        zoneId: null,
        zoneLabel: null,
        density: Math.round(maxDensity * 10000) / 10000,
        recommendation: null,
        contributingNodeLabel: null,
      };
    }
  }
}
