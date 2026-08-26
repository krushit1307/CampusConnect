/**
 * Deterministic Fixed-Point Math & 2D Physics Engine with Spatial Hash Grid
 * Eliminates cross-browser floating-point divergence for sync step simulations.
 */

// Fixed-Point scale factor (16.16 fixed-point arithmetic)
const SHIFT = 16;
export const MULTIPLIER = 1 << SHIFT; // 65536

export function toFixed(n: number): number {
  return Math.round(n * MULTIPLIER);
}

export function toFloat(f: number): number {
  return f / MULTIPLIER;
}

export function mulFixed(a: number, b: number): number {
  return Math.floor((a * b) / MULTIPLIER);
}

export function divFixed(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.floor((a * MULTIPLIER) / b);
}

export interface Vector2Fixed {
  x: number; // fixed-point
  y: number; // fixed-point
}

export interface PhysicsAvatar {
  id: string;
  pos: Vector2Fixed;
  vel: Vector2Fixed;
  radius: number; // fixed-point
  mass: number; // fixed-point
  restitution: number; // fixed-point (0..1)
}

export class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, string[]>;

  constructor(cellSizeFloat: number) {
    this.cellSize = toFixed(cellSizeFloat);
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  private getKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(avatar: PhysicsAvatar) {
    const key = this.getKey(avatar.pos.x, avatar.pos.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(avatar.id);
  }

  getBroadphasePairs(avatars: Map<string, PhysicsAvatar>): [PhysicsAvatar, PhysicsAvatar][] {
    const pairs: [PhysicsAvatar, PhysicsAvatar][] = [];
    const checked = new Set<string>();

    for (const [, avatar] of avatars) {
      const gx = Math.floor(avatar.pos.x / this.cellSize);
      const gy = Math.floor(avatar.pos.y / this.cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const neighborKey = `${gx + dx},${gy + dy}`;
          const neighborIds = this.grid.get(neighborKey);
          if (!neighborIds) continue;

          for (const otherId of neighborIds) {
            if (avatar.id >= otherId) continue;
            const pairKey = `${avatar.id}:${otherId}`;
            if (checked.has(pairKey)) continue;
            checked.add(pairKey);

            const other = avatars.get(otherId);
            if (other) {
              pairs.push([avatar, other]);
            }
          }
        }
      }
    }

    return pairs;
  }
}

export class DeterministicPhysicsWorld {
  public avatars: Map<string, PhysicsAvatar> = new Map();
  private grid: SpatialHashGrid;
  public boundsWidth: number; // fixed-point
  public boundsHeight: number; // fixed-point

  constructor(widthFloat: number, heightFloat: number) {
    this.boundsWidth = toFixed(widthFloat);
    this.boundsHeight = toFixed(heightFloat);
    this.grid = new SpatialHashGrid(64);
  }

  addAvatar(avatar: PhysicsAvatar) {
    this.avatars.set(avatar.id, avatar);
  }

  removeAvatar(id: string) {
    this.avatars.delete(id);
  }

  stepFixed(inputs: Map<string, { dx: number; dy: number }>) {
    // 1. Apply inputs & integrate velocities
    const speed = toFixed(2);
    for (const [id, avatar] of this.avatars) {
      const input = inputs.get(id) || { dx: 0, dy: 0 };
      avatar.vel.x += input.dx * speed;
      avatar.vel.y += input.dy * speed;

      // Apply drag/friction
      avatar.vel.x = mulFixed(avatar.vel.x, toFixed(0.92));
      avatar.vel.y = mulFixed(avatar.vel.y, toFixed(0.92));

      // Update position
      avatar.pos.x += avatar.vel.x;
      avatar.pos.y += avatar.vel.y;

      // Boundary collision
      if (avatar.pos.x - avatar.radius < 0) {
        avatar.pos.x = avatar.radius;
        avatar.vel.x = -mulFixed(avatar.vel.x, avatar.restitution);
      } else if (avatar.pos.x + avatar.radius > this.boundsWidth) {
        avatar.pos.x = this.boundsWidth - avatar.radius;
        avatar.vel.x = -mulFixed(avatar.vel.x, avatar.restitution);
      }

      if (avatar.pos.y - avatar.radius < 0) {
        avatar.pos.y = avatar.radius;
        avatar.vel.y = -mulFixed(avatar.vel.y, avatar.restitution);
      } else if (avatar.pos.y + avatar.radius > this.boundsHeight) {
        avatar.pos.y = this.boundsHeight - avatar.radius;
        avatar.vel.y = -mulFixed(avatar.vel.y, avatar.restitution);
      }
    }

    // 2. Spatial Hash Grid Broadphase
    this.grid.clear();
    for (const [, avatar] of this.avatars) {
      this.grid.insert(avatar);
    }

    // 3. Narrowphase Resolution
    const pairs = this.grid.getBroadphasePairs(this.avatars);
    for (const [a, b] of pairs) {
      this.resolveCollision(a, b);
    }
  }

  private resolveCollision(a: PhysicsAvatar, b: PhysicsAvatar) {
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const distSq = mulFixed(dx, dx) + mulFixed(dy, dy);
    const minDist = a.radius + b.radius;
    const minDistSq = mulFixed(minDist, minDist);

    if (distSq < minDistSq && distSq > 0) {
      const dist = toFixed(Math.sqrt(toFloat(distSq)));
      const nx = divFixed(dx, dist);
      const ny = divFixed(dy, dist);

      const overlap = minDist - dist;
      // Positional separation
      const sepX = mulFixed(nx, divFixed(overlap, toFixed(2)));
      const sepY = mulFixed(ny, divFixed(overlap, toFixed(2)));
      a.pos.x -= sepX;
      a.pos.y -= sepY;
      b.pos.x += sepX;
      b.pos.y += sepY;

      // Impulse resolution
      const kx = a.vel.x - b.vel.x;
      const ky = a.vel.y - b.vel.y;
      const p =
        mulFixed(toFixed(2), mulFixed(nx, kx) + mulFixed(ny, ky)) / toFloat(a.mass + b.mass);

      a.vel.x -= mulFixed(toFixed(p), mulFixed(b.mass, nx));
      a.vel.y -= mulFixed(toFixed(p), mulFixed(b.mass, ny));
      b.vel.x += mulFixed(toFixed(p), mulFixed(a.mass, nx));
      b.vel.y += mulFixed(toFixed(p), mulFixed(a.mass, ny));
    }
  }
}
