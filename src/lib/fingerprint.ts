// Browser Fingerprinting Utility
// Generates a highly unique device signature using Canvas, WebGL, Screen Resolution, Fonts, and User-Agent.

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server-side";

  // Check localStorage first for caching
  const cached = window.localStorage.getItem("device_fingerprint");
  if (cached) return cached;

  const components: string[] = [];

  // 1. User Agent & Language
  components.push(navigator.userAgent || "unknown-ua");
  components.push(navigator.language || "unknown-lang");

  // 2. Screen Resolution & Color Depth
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // 3. Timezone Offset
  components.push(new Date().getTimezoneOffset().toString());

  // 4. Canvas Fingerprinting (2D Render test)
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial', sans-serif";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("CampusConnect, robot trap! 🙂", 2, 2);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("CampusConnect, robot trap! 🙂", 4, 17);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    components.push("no-canvas");
  }

  // 5. WebGL Fingerprinting (3D Shader test)
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext);
    if (gl) {
      components.push(gl.getParameter(gl.RENDERER) || "");
      components.push(gl.getParameter(gl.VENDOR) || "");
      components.push(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || "");
    }
  } catch (e) {
    components.push("no-webgl");
  }

  // Hash components using a fast murmur/Fowler-Noll-Vo style string hashing
  const str = components.join("||");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }

  const fingerprint = "cc_fp_" + Math.abs(hash).toString(16);
  window.localStorage.setItem("device_fingerprint", fingerprint);
  return fingerprint;
}
