import { useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SortableList } from "@/components/ui/SortableList";
import { WIDGET_CATALOG, WIDGET_REGISTRY } from "./registry";
import { normalizeWidgetsConfig } from "./types";
import type { WidgetConfig, WidgetType } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

interface WidgetConfigEditorProps {
  clubId: string;
  initialWidgets?: unknown;
}

function createWidget(type: WidgetType): WidgetConfig {
  const meta = WIDGET_REGISTRY[type];
  return {
    id: `widget-${Math.random().toString(36).slice(2, 10)}`,
    type,
    enabled: true,
    ...meta.defaultConfig,
  };
}

type SaveState = "idle" | "saving" | "saved";

/**
 * Admin UI for a club's homepage widgets: add, configure, toggle, remove
 * and drag-and-drop reorder the widget list. Every change persists the
 * `clubs.widgets_config` column automatically (debounced), mirroring the
 * `ClubSocialLinksEditor` auto-save behaviour.
 */
export function WidgetConfigEditor({ clubId, initialWidgets }: WidgetConfigEditorProps) {
  const supabase = createClient();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() =>
    normalizeWidgetsConfig(initialWidgets),
  );
  const [pendingType, setPendingType] = useState<WidgetType>("weather");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const persist = (next: WidgetConfig[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveState("saving");
    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("clubs")
        .update({ widgets_config: next as never })
        .eq("id", clubId);
      setSaveState(error ? "idle" : "saved");
      if (error) toast.error("Failed to save widgets");
    }, 500);
  };

  const commit = (next: WidgetConfig[]) => {
    setWidgets(next);
    persist(next);
  };

  const addWidget = () => {
    commit([...widgets, createWidget(pendingType)]);
  };

  const removeWidget = (id: string) => {
    commit(widgets.filter((widget) => widget.id !== id));
  };

  const toggleWidget = (id: string) => {
    commit(
      widgets.map((widget) =>
        widget.id === id ? { ...widget, enabled: !widget.enabled } : widget,
      ),
    );
  };

  const updateWidgetParam = (id: string, key: string, value: string) => {
    commit(
      widgets.map((widget) =>
        widget.id === id ? ({ ...widget, [key]: value } as WidgetConfig) : widget,
      ),
    );
  };

  const handleReorder = (ids: string[]) => {
    const byId = new Map(widgets.map((widget) => [widget.id, widget]));
    commit(
      ids.map((id) => byId.get(id)).filter((widget): widget is WidgetConfig => Boolean(widget)),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block font-mono text-sm font-bold uppercase">Add a widget</label>
          <select
            value={pendingType}
            onChange={(e) => setPendingType(e.target.value as WidgetType)}
            className="neu-border w-full p-2 font-mono text-sm"
          >
            {WIDGET_CATALOG.map((meta) => (
              <option key={meta.type} value={meta.type}>
                {meta.label} — {meta.description}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={addWidget}
          className="neu-border neu-press flex items-center gap-2 bg-lime px-4 py-2 font-mono text-xs font-bold uppercase transition-transform hover:-translate-y-1"
        >
          <Plus size={14} /> Add Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="border-2 border-dashed border-black p-8 text-center font-mono text-sm text-gray-500">
          No widgets configured yet. Add one above to start customizing your club homepage.
        </div>
      ) : (
        <SortableList
          ids={widgets.map((widget) => widget.id)}
          onReorder={handleReorder}
          renderItem={(id, dragHandleProps) => {
            const widget = widgets.find((w) => w.id === id);
            if (!widget) return null;
            const meta = WIDGET_REGISTRY[widget.type];
            const Icon = meta.icon;
            return (
              <div className="neu-border bg-white p-4 dark:bg-zinc-900">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={`Drag to reorder ${meta.label} widget`}
                    className="shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
                    {...dragHandleProps}
                  >
                    <GripVertical className="h-5 w-5 text-gray-400" />
                  </button>
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-[var(--theme-primary)]" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-display text-sm font-bold uppercase tracking-tight">
                        {meta.label}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleWidget(id)}
                          className="neu-border flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase"
                        >
                          {widget.enabled ? (
                            <Eye size={12} aria-hidden="true" />
                          ) : (
                            <EyeOff size={12} aria-hidden="true" />
                          )}
                          {widget.enabled ? "Visible" : "Hidden"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(id)}
                          className="neu-border flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase text-red-600"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </div>

                    <div
                      className={
                        widget.enabled ? "space-y-3" : "pointer-events-none space-y-3 opacity-50"
                      }
                    >
                      {meta.paramFields.map((field) => (
                        <div key={field.key}>
                          <label className="mb-1 block font-mono text-[11px] font-bold uppercase">
                            {field.label}
                          </label>
                          <input
                            type={field.type ?? "text"}
                            value={
                              typeof widget[field.key as keyof WidgetConfig] === "string"
                                ? String(widget[field.key as keyof WidgetConfig])
                                : ""
                            }
                            onChange={(e) => updateWidgetParam(id, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="neu-border w-full p-2 font-mono text-sm"
                          />
                          {field.hint && (
                            <p className="mt-1 font-mono text-[10px] text-gray-500">{field.hint}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}

      <div className="flex items-center justify-between font-mono text-xs text-gray-500">
        <p>Drag the grip handle to reorder. Changes save automatically.</p>
        <p aria-live="polite">
          {saveState === "saving" && "Saving..."}
          {saveState === "saved" && "All changes saved."}
        </p>
      </div>

      {widgets.some((widget) => widget.enabled) && (
        <div className="border-t-2 border-black pt-4">
          <h4 className="mb-3 font-display text-sm font-bold uppercase">Preview</h4>
          <WidgetRenderer widgets={widgets} />
        </div>
      )}
    </div>
  );
}

export default WidgetConfigEditor;
