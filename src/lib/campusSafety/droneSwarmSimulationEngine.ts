/**
 * Campus Safety Drone Swarm Decoy Deployment Engine (#5352)
 * Purely virtual, deterministic software simulation for campus safety response.
 */

export type SimulatedDroneStatus =
  "available" | "deploying" | "deployed" | "returning" | "complete";

export interface SimulatedDrone {
  id: string;
  name: string;
  status: SimulatedDroneStatus;
  batteryPercent: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  homeX: number;
  homeY: number;
  routeWaypoints: Array<{ x: number; y: number }>;
}

export interface ThreatEntity {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: "DETECTED" | "ACTIVE" | "REDIRECTED";
  radius: number;
}

export interface StudentZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  density: "HIGH" | "MEDIUM" | "LOW";
  studentCount: number;
}

export interface DroneSwarmSimulationState {
  threat: ThreatEntity;
  drones: SimulatedDrone[];
  studentZones: StudentZone[];
  responseZoneActive: boolean;
  responseZoneCenter: { x: number; y: number } | null;
  responseZoneRadius: number;
  criticalAlert: boolean;
  criticalAlertMessage: string | null;
  simulationStatus: "IDLE" | "DEPLOYED" | "COMPLETE";
}

export const DEFAULT_STUDENT_ZONES: StudentZone[] = [
  {
    id: "zone-student-center",
    name: "Student Union Center",
    x: 200,
    y: 280,
    width: 140,
    height: 90,
    density: "HIGH",
    studentCount: 350,
  },
  {
    id: "zone-engineering",
    name: "Engineering Quad",
    x: 120,
    y: 100,
    width: 100,
    height: 80,
    density: "HIGH",
    studentCount: 220,
  },
  {
    id: "zone-library",
    name: "Main Library Quad",
    x: 450,
    y: 320,
    width: 110,
    height: 80,
    density: "HIGH",
    studentCount: 180,
  },
];

export class DroneSwarmSimulationEngine {
  private state: DroneSwarmSimulationState;
  private canvasWidth: number = 640;
  private canvasHeight: number = 460;
  private stepCount: number = 0;

  constructor(width: number = 640, height: number = 460) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.state = this.createInitialState();
  }

  private createInitialState(): DroneSwarmSimulationState {
    const homeBaseX = 580;
    const homeBaseY = 80;

    const drones: SimulatedDrone[] = [
      {
        id: "drone-01",
        name: "Drone 01",
        status: "available",
        batteryPercent: 98,
        x: homeBaseX,
        y: homeBaseY,
        targetX: homeBaseX,
        targetY: homeBaseY,
        homeX: homeBaseX,
        homeY: homeBaseY,
        routeWaypoints: [],
      },
      {
        id: "drone-02",
        name: "Drone 02",
        status: "available",
        batteryPercent: 95,
        x: homeBaseX - 25,
        y: homeBaseY + 20,
        targetX: homeBaseX - 25,
        targetY: homeBaseY + 20,
        homeX: homeBaseX - 25,
        homeY: homeBaseY + 20,
        routeWaypoints: [],
      },
      {
        id: "drone-03",
        name: "Drone 03",
        status: "available",
        batteryPercent: 100,
        x: homeBaseX + 25,
        y: homeBaseY + 20,
        targetX: homeBaseX + 25,
        targetY: homeBaseY + 20,
        homeX: homeBaseX + 25,
        homeY: homeBaseY + 20,
        routeWaypoints: [],
      },
    ];

    const threat: ThreatEntity = {
      id: "threat-alpha",
      label: "Simulated Threat Alpha",
      x: 100,
      y: 380,
      vx: 18, // pixels per second moving towards Student Center (200, 280)
      vy: -12,
      status: "DETECTED",
      radius: 40,
    };

    return {
      threat,
      drones,
      studentZones: DEFAULT_STUDENT_ZONES,
      responseZoneActive: false,
      responseZoneCenter: null,
      responseZoneRadius: 75,
      criticalAlert: true,
      criticalAlertMessage:
        "CRITICAL SAFETY ALERT\n\nSimulated threat trajectory intersects a high-density area.\n\nRecommended action:\nMaintain lockdown and await emergency response.",
      simulationStatus: "IDLE",
    };
  }

  public getState(): DroneSwarmSimulationState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public deploy() {
    if (this.state.simulationStatus === "DEPLOYED") return;

    // Calculate response decoy positions around threat predicted target
    const threatTargetX = 250;
    const threatTargetY = 250;

    // Triangular decoy formation surrounding decoy center
    const formationOffsets = [
      { dx: -45, dy: -40 },
      { dx: 45, dy: -40 },
      { dx: 0, dy: 50 },
    ];

    this.state.drones = this.state.drones.map((drone, idx) => {
      const offset = formationOffsets[idx % formationOffsets.length];
      const targetX = threatTargetX + offset.dx;
      const targetY = threatTargetY + offset.dy;

      return {
        ...drone,
        status: "deploying",
        targetX,
        targetY,
        routeWaypoints: [
          { x: drone.homeX, y: drone.homeY },
          {
            x: (drone.homeX + targetX) / 2 + (idx === 1 ? 30 : -30),
            y: (drone.homeY + targetY) / 2,
          },
          { x: targetX, y: targetY },
        ],
      };
    });

    this.state.responseZoneActive = true;
    this.state.responseZoneCenter = { x: threatTargetX, y: threatTargetY };
    this.state.simulationStatus = "DEPLOYED";
    this.state.threat.status = "ACTIVE";
    this.stepCount = 0;
  }

  public reset() {
    this.state = this.createInitialState();
    this.stepCount = 0;
  }

  public step(dt: number = 0.05) {
    this.stepCount++;

    // Move Threat Entity along trajectory
    if (this.state.threat.status !== "REDIRECTED") {
      const nx = this.state.threat.x + this.state.threat.vx * dt;
      const ny = this.state.threat.y + this.state.threat.vy * dt;

      // If response zone active and threat near decoy zone, simulate redirection
      if (this.state.responseZoneActive && this.state.responseZoneCenter) {
        const distToDecoy = Math.hypot(
          nx - this.state.responseZoneCenter.x,
          ny - this.state.responseZoneCenter.y,
        );

        if (distToDecoy < 80) {
          // Threat redirected away from high-density student zone
          this.state.threat.status = "REDIRECTED";
          this.state.threat.vx = 8;
          this.state.threat.vy = 20; // redirect away toward open athletic field
        }
      }

      this.state.threat.x = Math.max(40, Math.min(this.canvasWidth - 40, nx));
      this.state.threat.y = Math.max(40, Math.min(this.canvasHeight - 40, ny));
    } else {
      // Continue along redirected trajectory
      this.state.threat.x = Math.max(
        40,
        Math.min(this.canvasWidth - 40, this.state.threat.x + this.state.threat.vx * dt),
      );
      this.state.threat.y = Math.max(
        40,
        Math.min(this.canvasHeight - 40, this.state.threat.y + this.state.threat.vy * dt),
      );
    }

    // Check intersection with high-density student zones
    this.evaluateTrajectoryIntersection();

    // Update Drones Movement along routes
    if (this.state.simulationStatus === "DEPLOYED") {
      const droneSpeed = 120; // px/s

      this.state.drones = this.state.drones.map((drone) => {
        if (drone.status === "available" || drone.status === "complete") return drone;

        const dx = drone.targetX - drone.x;
        const dy = drone.targetY - drone.y;
        const dist = Math.hypot(dx, dy);

        let newStatus = drone.status;
        let newX = drone.x;
        let newY = drone.y;

        if (dist > 5) {
          newX += (dx / dist) * Math.min(dist, droneSpeed * dt);
          newY += (dy / dist) * Math.min(dist, droneSpeed * dt);

          if (drone.status === "deploying" && dist < 40) {
            newStatus = "deployed";
          }
        } else {
          newX = drone.targetX;
          newY = drone.targetY;

          if (drone.status === "deploying") {
            newStatus = "deployed";
          } else if (drone.status === "returning") {
            newStatus = "complete";
          }
        }

        // Deployed phase auto-transition to returning after step threshold
        if (newStatus === "deployed" && this.stepCount > 120 && drone.targetX !== drone.homeX) {
          newStatus = "returning";
          return {
            ...drone,
            status: newStatus,
            targetX: drone.homeX,
            targetY: drone.homeY,
            x: newX,
            y: newY,
          };
        }

        return {
          ...drone,
          status: newStatus,
          x: newX,
          y: newY,
          batteryPercent: Math.max(80, drone.batteryPercent - 0.02),
        };
      });

      // Check if all drones returned
      const allComplete = this.state.drones.every(
        (d) => d.status === "complete" || d.status === "available",
      );

      if (allComplete && this.stepCount > 130) {
        this.state.simulationStatus = "COMPLETE";
        this.state.responseZoneActive = false;
      }
    }
  }

  private evaluateTrajectoryIntersection() {
    const tx = this.state.threat.x;
    const ty = this.state.threat.y;
    const tvx = this.state.threat.vx;
    const tvy = this.state.threat.vy;

    let intersectsHighDensity = false;

    // Check line segment from threat along velocity vector
    for (const zone of this.state.studentZones) {
      if (zone.density !== "HIGH") continue;

      // Check distance from threat center to zone rectangle
      const zoneCx = zone.x + zone.width / 2;
      const zoneCy = zone.y + zone.height / 2;
      const dist = Math.hypot(tx - zoneCx, ty - zoneCy);

      // Threat ray point predicted in next 5 seconds
      const futureX = tx + tvx * 5;
      const futureY = ty + tvy * 5;
      const futureDist = Math.hypot(futureX - zoneCx, futureY - zoneCy);

      if (dist < 120 || futureDist < 120) {
        intersectsHighDensity = true;
        break;
      }
    }

    this.state.criticalAlert = intersectsHighDensity;
    if (intersectsHighDensity) {
      this.state.criticalAlertMessage =
        "CRITICAL SAFETY ALERT\n\nSimulated threat trajectory intersects a high-density area.\n\nRecommended action:\nMaintain lockdown and await emergency response.";
    } else {
      this.state.criticalAlertMessage = null;
    }
  }
}
