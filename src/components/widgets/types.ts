/**
 * Pluggable Club Homepage Widgets (issue #2737)
 *
 * The `clubs.widgets_config` column stores a JSON array of widget
 * descriptors. Each descriptor is a flat object that matches the shape
 * proposed in the issue:
 *
 *   [{ type: 'weather', location: 'London' },
 *    { type: 'countdown', target: '2026-10-10' }]
 *
 * We additionally store a stable `id` (so drag-and-drop reordering has a
 * stable key) and an `enabled` flag so admins can hide a widget without
 * deleting its configuration.
 */

export const WIDGET_TYPES = ["weather", "countdown", "spotify", "youtube"] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export interface WidgetConfig {
  /** Stable per-instance id used as the drag-and-drop key. */
  id: string;
  type: WidgetType;
  enabled: boolean;
  /** Weather widget: city/place query passed to the weather proxy. */
  location?: string;
  /** Countdown widget: target ISO date. */
  target?: string;
  /** Countdown widget: optional heading. */
  title?: string;
  /** Spotify widget: open.spotify.com URL. */
  url?: string;
  /** YouTube widget: 11-character video id. */
  videoId?: string;
}

function createWidgetId(): string {
  return `widget-${Math.random().toString(36).slice(2, 10)}`;
}

/** Coerce an arbitrary persisted row into a valid WidgetConfig (or null). */
export function normalizeWidgetConfig(raw: unknown): WidgetConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (!WIDGET_TYPES.includes(candidate.type as WidgetType)) return null;

  const config: WidgetConfig = {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : createWidgetId(),
    type: candidate.type as WidgetType,
    enabled: candidate.enabled !== false,
  };

  for (const key of ["location", "target", "title", "url", "videoId"] as const) {
    if (typeof candidate[key] === "string" && candidate[key]) {
      config[key] = candidate[key] as string;
    }
  }

  return config;
}

/** Coerce the raw `widgets_config` column into a normalized array. */
export function normalizeWidgetsConfig(raw: unknown): WidgetConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeWidgetConfig).filter((widget): widget is WidgetConfig => widget !== null);
}
