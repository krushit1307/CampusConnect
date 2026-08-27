/**
 * GraphRenderer.ts
 *
 * Raw WebGL2 renderer for force-directed graphs.
 * Handles:
 *  - Shader compilation & program linking
 *  - Two VBOs: nodes (circles via gl_PointSize) and edges (LINES)
 *  - Camera: pan + zoom via orthographic projection uniform
 *  - Buffer upload from physics worker positions each frame
 */

// ─── GLSL Shaders ─────────────────────────────────────────────────────────────

const NODE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2  a_position;
in float a_radius;
in vec3  a_color;

uniform mat3 u_proj;

out vec3 v_color;

void main() {
  vec3 clip = u_proj * vec3(a_position, 1.0);
  gl_Position  = vec4(clip.xy, 0.0, 1.0);
  gl_PointSize = a_radius * 2.0;
  v_color      = a_color;
}
`;

const NODE_FRAG = /* glsl */ `#version 300 es
precision mediump float;

in  vec3 v_color;
out vec4 fragColor;

void main() {
  vec2  coord = gl_PointCoord - 0.5;
  float d     = length(coord);
  if (d > 0.5) discard;

  // Soft anti-aliased edge
  float alpha = 1.0 - smoothstep(0.42, 0.5, d);

  // Subtle rim highlight
  float rim   = smoothstep(0.35, 0.42, d);
  vec3  col   = mix(v_color, v_color * 1.6, rim);

  fragColor = vec4(col, alpha);
}
`;

const EDGE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_position;

uniform mat3 u_proj;

void main() {
  vec3 clip  = u_proj * vec3(a_position, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
`;

const EDGE_FRAG = /* glsl */ `#version 300 es
precision mediump float;

out vec4 fragColor;

void main() {
  fragColor = vec4(0.5, 0.55, 0.65, 0.25);
}
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RendererNode {
  id: string;
  radius?: number;
  /** RGB 0–1 */
  color?: [number, number, number];
}

export interface RendererEdge {
  source: number; // index into nodes array
  target: number;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, src: string, type: number): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${info}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error:\n${info}`);
  }
  return prog;
}

/** Build a column-major 3×3 orthographic matrix mapping world → clip space. */
function orthoMatrix(cx: number, cy: number, zoom: number, w: number, h: number): Float32Array {
  const sx = (2 * zoom) / w;
  const sy = (2 * zoom) / h;
  const tx = -cx * sx;
  const ty = -cy * sy;
  // prettier-ignore
  return new Float32Array([
    sx,  0,  0,
     0, sy,  0,
    tx, ty,  1,
  ]);
}

// ─── GraphRenderer ─────────────────────────────────────────────────────────────

export class GraphRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private rafId = 0;

  // Programs
  private nodeProg!: WebGLProgram;
  private edgeProg!: WebGLProgram;

  // Node VAO / VBOs
  private nodeVao!: WebGLVertexArrayObject;
  private nodePosBuffer!: WebGLBuffer; // [x, y] per node — updated each frame
  private nodeAttrBuffer!: WebGLBuffer; // [radius, r, g, b] per node — static

  // Edge VAO / VBO
  private edgeVao!: WebGLVertexArrayObject;
  private edgePosBuffer!: WebGLBuffer; // [x1,y1, x2,y2] per edge — updated each frame

  // Camera state
  private camera: Camera = { x: 0, y: 0, zoom: 1 };
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };

  // Graph data
  private nodeCount = 0;
  private edgeCount = 0;
  private edges: RendererEdge[] = [];

  // Latest positions from physics worker
  private positions: Float32Array = new Float32Array(0);
  private positionsDirty = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 is not supported in this browser.");
    this.gl = gl;
    this.initPrograms();
    this.initEvents();
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  private initPrograms() {
    const gl = this.gl;

    // Node program
    const nv = compileShader(gl, NODE_VERT, gl.VERTEX_SHADER);
    const nf = compileShader(gl, NODE_FRAG, gl.FRAGMENT_SHADER);
    this.nodeProg = linkProgram(gl, nv, nf);
    gl.deleteShader(nv);
    gl.deleteShader(nf);

    // Edge program
    const ev = compileShader(gl, EDGE_VERT, gl.VERTEX_SHADER);
    const ef = compileShader(gl, EDGE_FRAG, gl.FRAGMENT_SHADER);
    this.edgeProg = linkProgram(gl, ev, ef);
    gl.deleteShader(ev);
    gl.deleteShader(ef);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private initEvents() {
    const c = this.canvas;
    c.addEventListener("mousedown", this.onMouseDown);
    c.addEventListener("mousemove", this.onMouseMove);
    c.addEventListener("mouseup", this.onMouseUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("touchstart", this.onTouchStart, { passive: true });
    c.addEventListener("touchmove", this.onTouchMove, { passive: false });
    c.addEventListener("touchend", this.onMouseUp);
  }

  // ─── Graph data ────────────────────────────────────────────────────────────

  setGraph(nodes: RendererNode[], edges: RendererEdge[]) {
    const gl = this.gl;
    this.nodeCount = nodes.length;
    this.edgeCount = edges.length;
    this.edges = edges;

    // ── Node position VBO (updated each frame) ──
    if (this.nodeVao) gl.deleteVertexArray(this.nodeVao);
    this.nodeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.nodeVao);

    this.nodePosBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, nodes.length * 2 * 4, gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(this.nodeProg, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // ── Node attr VBO (radius + colour — static) ──
    const attrData = new Float32Array(nodes.length * 4);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      attrData[i * 4 + 0] = n.radius ?? 6;
      attrData[i * 4 + 1] = n.color?.[0] ?? 0.39;
      attrData[i * 4 + 2] = n.color?.[1] ?? 0.58;
      attrData[i * 4 + 3] = n.color?.[2] ?? 0.93;
    }
    this.nodeAttrBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeAttrBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, attrData, gl.STATIC_DRAW);
    const radLoc = gl.getAttribLocation(this.nodeProg, "a_radius");
    const colLoc = gl.getAttribLocation(this.nodeProg, "a_color");
    gl.enableVertexAttribArray(radLoc);
    gl.vertexAttribPointer(radLoc, 1, gl.FLOAT, false, 4 * 4, 0);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 4 * 4, 4);

    gl.bindVertexArray(null);

    // ── Edge VBO ──
    if (this.edgeVao) gl.deleteVertexArray(this.edgeVao);
    this.edgeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.edgeVao);

    this.edgePosBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, edges.length * 4 * 4, gl.DYNAMIC_DRAW);
    const ePosLoc = gl.getAttribLocation(this.edgeProg, "a_position");
    gl.enableVertexAttribArray(ePosLoc);
    gl.vertexAttribPointer(ePosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    this.positions = new Float32Array(nodes.length * 2);
    this.positionsDirty = true;
  }

  /** Called by GraphCanvas each time the physics worker posts new positions. */
  updatePositions(buffer: ArrayBuffer) {
    this.positions = new Float32Array(buffer);
    this.positionsDirty = true;
  }

  // ─── Render loop ───────────────────────────────────────────────────────────

  start() {
    const loop = () => {
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  private draw() {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.05, 0.06, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.nodeCount === 0) return;

    const proj = orthoMatrix(this.camera.x, this.camera.y, this.camera.zoom, width, height);

    if (this.positionsDirty) {
      this.uploadPositions();
      this.positionsDirty = false;
    }

    // Draw edges first (behind nodes)
    this.drawEdges(proj);
    this.drawNodes(proj);
  }

  private uploadPositions() {
    const gl = this.gl;
    const pos = this.positions;

    // Upload node positions
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePosBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);

    // Rebuild edge endpoint buffer from current positions
    const edgeBuf = new Float32Array(this.edgeCount * 4);
    for (let i = 0; i < this.edges.length; i++) {
      const { source, target } = this.edges[i];
      edgeBuf[i * 4 + 0] = pos[source * 2];
      edgeBuf[i * 4 + 1] = pos[source * 2 + 1];
      edgeBuf[i * 4 + 2] = pos[target * 2];
      edgeBuf[i * 4 + 3] = pos[target * 2 + 1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePosBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, edgeBuf);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private drawEdges(proj: Float32Array) {
    if (this.edgeCount === 0) return;
    const gl = this.gl;
    gl.useProgram(this.edgeProg);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProg, "u_proj"), false, proj);
    gl.bindVertexArray(this.edgeVao);
    gl.drawArrays(gl.LINES, 0, this.edgeCount * 2);
    gl.bindVertexArray(null);
  }

  private drawNodes(proj: Float32Array) {
    const gl = this.gl;
    gl.useProgram(this.nodeProg);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.nodeProg, "u_proj"), false, proj);
    gl.bindVertexArray(this.nodeVao);
    gl.drawArrays(gl.POINTS, 0, this.nodeCount);
    gl.bindVertexArray(null);
  }

  // ─── Camera ────────────────────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.camera.x -= dx / this.camera.zoom;
    this.camera.y += dy / this.camera.zoom;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = () => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(0.02, Math.min(20, this.camera.zoom * factor));
  };

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDragging) {
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.camera.x -= dx / this.camera.zoom;
      this.camera.y += dy / this.camera.zoom;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  resetCamera() {
    this.camera = { x: 0, y: 0, zoom: 1 };
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  private resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
  };

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.resize);
    const c = this.canvas;
    c.removeEventListener("mousedown", this.onMouseDown);
    c.removeEventListener("mousemove", this.onMouseMove);
    c.removeEventListener("mouseup", this.onMouseUp);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("touchstart", this.onTouchStart);
    c.removeEventListener("touchmove", this.onTouchMove);
    c.removeEventListener("touchend", this.onMouseUp);
    const gl = this.gl;
    if (this.nodeVao) gl.deleteVertexArray(this.nodeVao);
    if (this.edgeVao) gl.deleteVertexArray(this.edgeVao);
    if (this.nodePosBuffer) gl.deleteBuffer(this.nodePosBuffer);
    if (this.nodeAttrBuffer) gl.deleteBuffer(this.nodeAttrBuffer);
    if (this.edgePosBuffer) gl.deleteBuffer(this.edgePosBuffer);
    if (this.nodeProg) gl.deleteProgram(this.nodeProg);
    if (this.edgeProg) gl.deleteProgram(this.edgeProg);
  }
}
