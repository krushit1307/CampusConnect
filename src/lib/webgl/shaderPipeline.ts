/**
 * Custom WebGL Shader Pipeline for Audio-Reactive Visualizations (#1053)
 * Provides GLSL fragment shaders and WebGL context orchestration driven by Fast Fourier Transform (FFT) audio data.
 */

export interface AudioData {
  bass: number; // 0.0 - 1.0 (Low frequencies)
  mid: number; // 0.0 - 1.0 (Mid frequencies)
  treble: number; // 0.0 - 1.0 (High frequencies)
  fftArray: Float32Array | Uint8Array; // Raw FFT bins
}

export type ShaderPreset = "neonPulse" | "cyberTunnel" | "plasmaWaves" | "audioGrid";

export const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADERS: Record<ShaderPreset, string> = {
  neonPulse: `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_bass;
    uniform float u_mid;
    uniform float u_treble;
    uniform float u_sensitivity;
    varying vec2 v_uv;

    void main() {
      vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
      float dist = length(st);
      
      float bassFactor = u_bass * u_sensitivity * 1.5;
      float midFactor = u_mid * u_sensitivity;
      float trebleFactor = u_treble * u_sensitivity;

      float wave = sin(dist * 12.0 - u_time * 3.0 + bassFactor * 4.0);
      float ring = smoothstep(0.02, 0.0, abs(wave - 0.5 * sin(st.x * 5.0)));

      vec3 color = vec3(0.1 + bassFactor * 0.6, 0.2 + midFactor * 0.8, 0.4 + trebleFactor * 0.9);
      color += vec3(1.0, 0.4, 0.8) * ring;

      float glow = 0.05 / (dist - 0.2 * bassFactor + 0.1);
      color += vec3(0.2, 0.8, 1.0) * glow;

      gl_FragColor = vec4(color, 0.95);
    }
  `,

  cyberTunnel: `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_bass;
    uniform float u_mid;
    uniform float u_treble;
    uniform float u_sensitivity;
    varying vec2 v_uv;

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
      float a = atan(p.y, p.x);
      float r = length(p);

      float speed = u_time * (0.8 + u_bass * u_sensitivity * 1.2);
      vec2 uv = vec2(0.3 / r + speed, a / 3.14159265);

      float col1 = sin(uv.x * 20.0 + sin(uv.y * 10.0));
      float col2 = cos(uv.y * 15.0 + u_treble * 5.0);

      vec3 color = vec3(
        0.5 + 0.5 * sin(uv.x * 10.0 + u_bass * 3.0),
        0.2 + 0.4 * cos(uv.y * 12.0 + u_mid * 4.0),
        0.7 + 0.3 * sin(speed + u_treble * 2.0)
      );

      color *= smoothstep(0.0, 0.8, r);
      color += vec3(0.9, 0.2, 0.5) * (col1 * col2 * u_sensitivity);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  plasmaWaves: `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_bass;
    uniform float u_mid;
    uniform float u_treble;
    uniform float u_sensitivity;
    varying vec2 v_uv;

    void main() {
      vec2 p = gl_FragCoord.xy / u_resolution.xy;
      float t = u_time * 0.5;

      float v1 = sin(p.x * 10.0 + t + u_bass * 5.0 * u_sensitivity);
      float v2 = sin(p.y * 10.0 + t + u_mid * 5.0 * u_sensitivity);
      float v3 = sin((p.x + p.y) * 10.0 + t + u_treble * 5.0 * u_sensitivity);

      vec3 col = vec3(
        sin(v1 + v2 + t) * 0.5 + 0.5,
        cos(v2 + v3 + t) * 0.5 + 0.5,
        sin(v1 + v3 + t) * 0.5 + 0.5
      );

      col += vec3(u_bass * 0.4, u_mid * 0.3, u_treble * 0.5) * u_sensitivity;
      gl_FragColor = vec4(col, 0.9);
    }
  `,

  audioGrid: `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_bass;
    uniform float u_mid;
    uniform float u_treble;
    uniform float u_sensitivity;
    varying vec2 v_uv;

    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution;
      vec2 grid = fract(st * 20.0);
      vec2 id = floor(st * 20.0);

      float idVal = sin(id.x * 0.5 + id.y * 0.5 + u_time * 2.0);
      float bassInfluence = u_bass * u_sensitivity * step(15.0, id.y);
      float midInfluence = u_mid * u_sensitivity * step(8.0, id.y) * (1.0 - step(15.0, id.y));
      float trebleInfluence = u_treble * u_sensitivity * (1.0 - step(8.0, id.y));

      float intensity = bassInfluence + midInfluence + trebleInfluence;

      float box = step(0.1, grid.x) * step(0.1, grid.y) * step(grid.x, 0.9) * step(grid.y, 0.9);
      vec3 color = vec3(0.2, 0.4, 0.9) * box * (0.3 + intensity * 1.5 + idVal * 0.2);

      color.r += bassInfluence * 0.8;
      color.g += midInfluence * 0.8;
      color.b += trebleInfluence * 0.8;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class ShaderPipeline {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private startTime: number = Date.now();

  private uniforms: {
    resolution?: WebGLUniformLocation | null;
    time?: WebGLUniformLocation | null;
    bass?: WebGLUniformLocation | null;
    mid?: WebGLUniformLocation | null;
    treble?: WebGLUniformLocation | null;
    sensitivity?: WebGLUniformLocation | null;
  } = {};

  constructor(private canvas: HTMLCanvasElement) {
    this.initWebGL();
  }

  private initWebGL() {
    this.gl =
      this.canvas.getContext("webgl") ||
      (this.canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!this.gl) {
      console.warn("WebGL not supported on this context");
      return;
    }

    // Set up full-screen quad buffer
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
  }

  public setPreset(preset: ShaderPreset) {
    if (!this.gl) return;

    const fragmentSource = FRAGMENT_SHADERS[preset] || FRAGMENT_SHADERS.neonPulse;
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return;

    const program = this.gl.createProgram();
    if (!program) return;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Program link error:", this.gl.getProgramInfoLog(program));
      return;
    }

    if (this.program) {
      this.gl.deleteProgram(this.program);
    }

    this.program = program;
    this.gl.useProgram(this.program);

    // Cache uniform locations
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, "u_resolution"),
      time: this.gl.getUniformLocation(this.program, "u_time"),
      bass: this.gl.getUniformLocation(this.program, "u_bass"),
      mid: this.gl.getUniformLocation(this.program, "u_mid"),
      treble: this.gl.getUniformLocation(this.program, "u_treble"),
      sensitivity: this.gl.getUniformLocation(this.program, "u_sensitivity"),
    };

    // Bind position attribute
    const positionLoc = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public render(audioData: AudioData, sensitivity: number = 1.0) {
    if (!this.gl || !this.program) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.gl.viewport(0, 0, width, height);

    const currentTime = (Date.now() - this.startTime) / 1000.0;

    if (this.uniforms.resolution) this.gl.uniform2f(this.uniforms.resolution, width, height);
    if (this.uniforms.time) this.gl.uniform1f(this.uniforms.time, currentTime);
    if (this.uniforms.bass) this.gl.uniform1f(this.uniforms.bass, audioData.bass);
    if (this.uniforms.mid) this.gl.uniform1f(this.uniforms.mid, audioData.mid);
    if (this.uniforms.treble) this.gl.uniform1f(this.uniforms.treble, audioData.treble);
    if (this.uniforms.sensitivity) this.gl.uniform1f(this.uniforms.sensitivity, sensitivity);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  public destroy() {
    if (!this.gl) return;

    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }

    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }

    this.gl = null;
  }
}
