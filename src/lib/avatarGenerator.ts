/**
 * Deterministic Geometric SVG Avatar Generator
 * Issue #3327: Eliminates generic gray silhouettes by creating deterministic,
 * vibrant geometric pattern avatars based on userId, email, or name seed.
 */

// Curated vibrant gradient and color palettes
const COLOR_PALETTES = [
  { bg1: "#4F46E5", bg2: "#06B6D4", shape1: "#F43F5E", shape2: "#FBBF24" },
  { bg1: "#8B5CF6", bg2: "#EC4899", shape1: "#10B981", shape2: "#3B82F6" },
  { bg1: "#3B82F6", bg2: "#10B981", shape1: "#F59E0B", shape2: "#8B5CF6" },
  { bg1: "#EC4899", bg2: "#F59E0B", shape1: "#6366F1", shape2: "#14B8A6" },
  { bg1: "#10B981", bg2: "#3B82F6", shape1: "#EC4899", shape2: "#F97316" },
  { bg1: "#6366F1", bg2: "#D946EF", shape1: "#06B6D4", shape2: "#EAB308" },
  { bg1: "#0F172A", bg2: "#334155", shape1: "#38BDF8", shape2: "#818CF8" },
  { bg1: "#059669", bg2: "#0284C7", shape1: "#F43F5E", shape2: "#FDE047" },
  { bg1: "#7C3AED", bg2: "#2563EB", shape1: "#F472B6", shape2: "#34D399" },
  { bg1: "#DC2626", bg2: "#EA580C", shape1: "#FDE047", shape2: "#60A5FA" },
];

/**
 * Deterministic 32-bit FNV-1a hash algorithm
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

export interface GeneratedAvatarData {
  svg: string;
  dataUrl: string;
  palette: (typeof COLOR_PALETTES)[number];
}

/**
 * Generates a deterministic, colorful geometric SVG string and data URL from any input seed
 */
export function generateDeterministicAvatarSvg(seed: string, size = 80): GeneratedAvatarData {
  const cleanSeed = (seed || "campus-user").trim().toLowerCase();
  const hash = hashString(cleanSeed);

  const paletteIndex = hash % COLOR_PALETTES.length;
  const palette = COLOR_PALETTES[paletteIndex];

  // Derive geometric layout variables from seed hash
  const shapeType = (hash >> 3) % 4; // 0: Dual Circles, 1: Polygon Triangles, 2: Rounded Squares, 3: Radial Rings
  const angle = (hash >> 5) % 360;
  const cx1 = 20 + ((hash >> 2) % 40);
  const cy1 = 20 + ((hash >> 4) % 40);
  const r1 = 18 + ((hash >> 6) % 24);

  const cx2 = 30 + ((hash >> 7) % 35);
  const cy2 = 30 + ((hash >> 9) % 35);
  const r2 = 12 + ((hash >> 11) % 20);

  const gradientId = `grad_${hash}`;

  let shapesSvg = "";
  switch (shapeType) {
    case 0:
      // Dual intersecting circles
      shapesSvg = `
        <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${palette.shape1}" opacity="0.85" />
        <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="${palette.shape2}" opacity="0.75" />
      `;
      break;
    case 1:
      // Geometric modern facets
      shapesSvg = `
        <polygon points="${cx1},${cy1} ${cx2 + 20},${cy2} ${cx1 - 15},${cy2 + 30}" fill="${palette.shape1}" opacity="0.8" />
        <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="${palette.shape2}" opacity="0.85" />
      `;
      break;
    case 2:
      // Rounded overlapping tiles
      shapesSvg = `
        <rect x="${cx1 - 15}" y="${cy1 - 15}" width="${r1 * 1.5}" height="${r1 * 1.5}" rx="12" fill="${palette.shape1}" opacity="0.8" transform="rotate(${angle % 45} ${cx1} ${cy1})" />
        <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="${palette.shape2}" opacity="0.75" />
      `;
      break;
    default:
      // Modern concentric bubbles
      shapesSvg = `
        <circle cx="40" cy="40" r="30" fill="${palette.shape1}" opacity="0.6" />
        <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${palette.shape2}" opacity="0.85" />
        <circle cx="${cx2}" cy="${cy2}" r="${r2 * 0.7}" fill="#FFFFFF" opacity="0.9" />
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="${size}" height="${size}">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
        <stop offset="0%" stop-color="${palette.bg1}" />
        <stop offset="100%" stop-color="${palette.bg2}" />
      </linearGradient>
      <clipPath id="avatar-clip-${hash}">
        <rect width="80" height="80" rx="40" />
      </clipPath>
    </defs>
    <g clip-path="url(#avatar-clip-${hash})">
      <rect width="80" height="80" fill="url(#${gradientId})" />
      ${shapesSvg}
    </g>
  </svg>`;

  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return { svg, dataUrl, palette };
}
