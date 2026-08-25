import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isWideWidget, WIDGET_REGISTRY } from "./registry";
import { normalizeWidgetsConfig } from "./types";
import type { WidgetConfig } from "./types";

interface WidgetRendererProps {
  /** Raw `clubs.widgets_config` value from the DB. */
  widgets?: unknown;
  className?: string;
}

function WidgetCard({ widget }: { widget: WidgetConfig }) {
  const meta = WIDGET_REGISTRY[widget.type];
  if (!meta) return null;

  const { Component } = meta;
  return (
    <div className={isWideWidget(widget.type) ? "md:col-span-2" : undefined}>
      <ErrorBoundary
        fallback={
          <div className="neu-border bg-red-50 p-4 font-mono text-xs text-red-600">
            This widget failed to load. Other widgets are unaffected.
          </div>
        }
      >
        <Component params={widget as Record<string, unknown>} />
      </ErrorBoundary>
    </div>
  );
}

/**
 * Renders the enabled widgets from a club's `widgets_config` array using
 * the component registry. Renders nothing when no widgets are configured
 * so clubs without widgets look exactly as before.
 */
export function WidgetRenderer({ widgets, className = "" }: WidgetRendererProps) {
  const configs = normalizeWidgetsConfig(widgets);
  const enabled = configs.filter((widget) => widget.enabled);
  if (enabled.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>
      {enabled.map((widget) => (
        <WidgetCard key={widget.id} widget={widget} />
      ))}
    </div>
  );
}

export default WidgetRenderer;
