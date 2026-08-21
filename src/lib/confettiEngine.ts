export type ConfettiShape = "square" | "circle" | "star" | "heart" | "ribbon";

export interface ConfettiOrigin {
  x: number; // 0 to 1 (0 = left, 1 = right)
  y: number; // 0 to 1 (0 = top, 1 = bottom)
}

export interface ConfettiOptions {
  particleCount?: number;
  angle?: number; // In degrees, e.g., 90 is straight up
  spread?: number; // In degrees, e.g., 70
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: ConfettiOrigin;
  colors?: string[];
  shapes?: ConfettiShape[];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
}

export const BRAND_CONFETTI_COLORS = [
  "#26ccff", // Bright Electric Cyan
  "#a25afd", // Vivid Purple
  "#ff5e7e", // Vibrant Coral Pink
  "#88ff5a", // Neon Lime Green
  "#ffbe26", // Warm Gold / Amber
  "#10b981", // Emerald
  "#6366f1", // Indigo
];

class ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  size: number;
  color: string;
  shape: ConfettiShape;
  opacity: number;
  decay: number;
  gravity: number;
  drift: number;
  totalTicks: number;
  currentTick: number = 0;

  constructor(
    startX: number,
    startY: number,
    angleDeg: number,
    spreadDeg: number,
    startVelocity: number,
    decay: number,
    gravity: number,
    drift: number,
    ticks: number,
    colors: string[],
    shapes: ConfettiShape[],
    scalar: number,
  ) {
    this.x = startX;
    this.y = startY;

    // Calculate initial trajectory velocity vectors from angle & spread
    const radAngle = (angleDeg * Math.PI) / 180;
    const radSpread = (spreadDeg * Math.PI) / 180;
    const particleAngle = radAngle + (Math.random() - 0.5) * radSpread;
    const velocity = startVelocity * (0.6 + Math.random() * 0.8) * scalar;

    this.vx = Math.cos(particleAngle) * velocity;
    this.vy = -Math.sin(particleAngle) * velocity; // Upwards speed

    this.angle = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.2;

    this.wobble = Math.random() * 10;
    this.wobbleSpeed = 0.05 + Math.random() * 0.08;

    this.size = (6 + Math.random() * 6) * scalar;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.shape = shapes[Math.floor(Math.random() * shapes.length)];
    this.opacity = 1;
    this.decay = decay;
    this.gravity = gravity * 0.4;
    this.drift = drift;
    this.totalTicks = ticks;
  }

  update(): boolean {
    this.currentTick++;
    if (this.currentTick >= this.totalTicks || this.opacity <= 0) {
      return false;
    }

    // Apply physics forces: air drag decay, gravity, and wind drift
    this.vx *= this.decay;
    this.vy *= this.decay;
    this.vy += this.gravity;
    this.vx += this.drift;

    this.x += this.vx;
    this.y += this.vy;

    this.rotation += this.rotationSpeed;
    this.wobble += this.wobbleSpeed;

    // Fade out towards the end of lifecycle
    if (this.currentTick > this.totalTicks * 0.6) {
      this.opacity = Math.max(
        0,
        1 - (this.currentTick - this.totalTicks * 0.6) / (this.totalTicks * 0.4),
      );
    }

    return true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(Math.cos(this.wobble), 1);
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;

    switch (this.shape) {
      case "circle":
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "star":
        this.drawStar(ctx, 5, this.size / 2, this.size / 4);
        break;
      case "heart":
        this.drawHeart(ctx, this.size);
        break;
      case "ribbon":
        ctx.fillRect(-this.size / 2, -this.size * 1.5, this.size / 2, this.size * 3);
        break;
      case "square":
      default:
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        break;
    }

    ctx.restore();
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    points: number,
    outerRadius: number,
    innerRadius: number,
  ): void {
    let rotation = (Math.PI / 2) * 3;
    const step = Math.PI / points;

    ctx.beginPath();
    ctx.moveTo(0, -outerRadius);

    for (let i = 0; i < points; i++) {
      let x = Math.cos(rotation) * outerRadius;
      let y = Math.sin(rotation) * outerRadius;
      ctx.lineTo(x, y);
      rotation += step;

      x = Math.cos(rotation) * innerRadius;
      y = Math.sin(rotation) * innerRadius;
      ctx.lineTo(x, y);
      rotation += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, size: number): void {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(0, s / 4);
    ctx.bezierCurveTo(0, 0, -s, -s / 2, -s, s / 4);
    ctx.bezierCurveTo(-s, s, 0, s * 1.5, 0, s * 1.8);
    ctx.bezierCurveTo(0, s * 1.8, s, s, s, s / 4);
    ctx.bezierCurveTo(s, -s / 2, 0, 0, 0, s / 4);
    ctx.closePath();
    ctx.fill();
  }
}

let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
let particles: ConfettiParticle[] = [];
let animationFrameId: number | null = null;

/**
 * Checks system accessibility settings for reduced motion
 */
export function checkPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Main engine trigger to fire digital confetti particles
 */
export function fireConfetti(options: ConfettiOptions = {}): boolean {
  const {
    particleCount = 100,
    angle = 90,
    spread = 70,
    startVelocity = 45,
    decay = 0.9,
    gravity = 1,
    drift = 0,
    ticks = 200,
    origin = { x: 0.5, y: 0.5 },
    colors = BRAND_CONFETTI_COLORS,
    shapes = ["square", "circle", "star"],
    scalar = 1,
    zIndex = 99999,
    disableForReducedMotion = true,
  } = options;

  // ACCESSIBILITY GUARD: Exit immediately if user prefers reduced motion!
  if (disableForReducedMotion && checkPrefersReducedMotion()) {
    return false;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // Ensure canvas overlay exists
  if (!activeCanvas) {
    activeCanvas = document.createElement("canvas");
    activeCanvas.style.position = "fixed";
    activeCanvas.style.top = "0";
    activeCanvas.style.left = "0";
    activeCanvas.style.width = "100vw";
    activeCanvas.style.height = "100vh";
    activeCanvas.style.pointerEvents = "none";
    activeCanvas.style.zIndex = zIndex.toString();
    document.body.appendChild(activeCanvas);
  }

  activeCanvas.width = window.innerWidth;
  activeCanvas.height = window.innerHeight;
  activeCtx = activeCanvas.getContext("2d");

  if (!activeCtx) return false;

  const startX = origin.x * activeCanvas.width;
  const startY = origin.y * activeCanvas.height;

  // Spawn new particles into active array
  for (let i = 0; i < particleCount; i++) {
    particles.push(
      new ConfettiParticle(
        startX,
        startY,
        angle,
        spread,
        startVelocity,
        decay,
        gravity,
        drift,
        ticks,
        colors,
        shapes,
        scalar,
      ),
    );
  }

  // Start 60 FPS animation loop if not already running
  if (!animationFrameId) {
    animationLoop();
  }

  return true;
}

function animationLoop(): void {
  if (!activeCanvas || !activeCtx) return;

  activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

  // Update and draw each particle
  particles = particles.filter((particle) => {
    const isAlive = particle.update();
    if (isAlive && activeCtx) {
      particle.draw(activeCtx);
    }
    return isAlive;
  });

  if (particles.length > 0) {
    animationFrameId = requestAnimationFrame(animationLoop);
  } else {
    // Clean up canvas element when all particles disappear
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (activeCanvas && activeCanvas.parentNode) {
      activeCanvas.parentNode.removeChild(activeCanvas);
      activeCanvas = null;
      activeCtx = null;
    }
  }
}
