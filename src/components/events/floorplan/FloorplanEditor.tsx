// =============================================================================
// Component: FloorplanEditor
// Issue: #4145 - Interactive "Event Layout" Floorplan Builder
// Description: Organizer-facing editor. Palette chips can be dragged onto the
// grid (or clicked) to add tables/stages/exits. A selection inspector edits
// labels, sizes and sponsor assignments. Saves the layout to
// events.floorplan_json and can export the raw JSON contract.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { toast } from "sonner";
import Save from "lucide-react/dist/esm/icons/save";
import Download from "lucide-react/dist/esm/icons/download";
import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert";

import { FloorplanCanvas } from "./FloorplanCanvas";
import {
  AssetKind,
  ASSET_DEFAULTS,
  FloorplanAsset,
  VenueBounds,
} from "../../../lib/floorplan/types";
import { describeAssignment, toFloorplanState } from "../../../lib/floorplan/serialize";

const PALETTE_KINDS: AssetKind[] = [
  "rect_table",
  "round_table",
  "stage",
  "speaker",
  "chair_row",
  "exit",
];

interface FloorplanEditorProps {
  eventId: string;
  venue: VenueBounds;
  assets: FloorplanAsset[];
  collidingIds: Set<string>;
  isSaving: boolean;
  onAdd: (kind: AssetKind, at?: { x: number; y: number }) => void;
  onMove: (id: string, x: number, y: number) => void;
  onUpdate: (id: string, patch: Partial<Omit<FloorplanAsset, "id" | "kind">>) => void;
  onRemove: (id: string) => void;
  onVenueSize: (widthFt: number, heightFt: number) => void;
  onSave: () => Promise<boolean>;
}

function PaletteChip({ kind, onClick }: { kind: AssetKind; onClick: (kind: AssetKind) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `palette-${kind}`,
    data: { kind, isPalette: true },
  });

  const d = ASSET_DEFAULTS[kind];

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 }
          : undefined
      }
      onClick={() => onClick(kind)}
      data-testid={`palette-chip-${kind}`}
      aria-label={`Add ${d.label}`}
      className="neu-border flex cursor-grab touch-none flex-col items-start gap-0.5 bg-white p-2 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_0_#000] transition-transform hover:-translate-y-0.5 active:cursor-grabbing"
    >
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: d.color }} />
        {d.label}
      </span>
      <span className="font-normal normal-case text-gray-500">
        {d.width}×{d.height} ft · drag or click
      </span>
    </button>
  );
}

export const FloorplanEditor: React.FC<FloorplanEditorProps> = ({
  eventId,
  venue,
  assets,
  collidingIds,
  isSaving,
  onAdd,
  onMove,
  onUpdate,
  onRemove,
  onVenueSize,
  onSave,
}) => {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sponsor assignment form state for the selected asset
  const selected = assets.find((a) => a.id === selectedId) ?? null;
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorId, setSponsorId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: "floorplan-canvas" });

  // Keep the inspector form in sync when the selection changes externally
  useEffect(() => {
    if (!selectedId) return;
    const current = assets.find((a) => a.id === selectedId);
    if (!current) setSelectedId(null);
  }, [assets, selectedId]);

  const selectAsset = useCallback((asset: FloorplanAsset) => {
    setSelectedId(asset.id);
    setSponsorName(asset.assignment?.companyName ?? "");
    setSponsorId(asset.assignment?.sponsorId ?? "");
  }, []);

  /** Convert a screen point into feet-space using the live SVG box. */
  const screenToFeet = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = canvasWrapRef.current?.querySelector("svg");
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / Math.max(rect.width, 1)) * venue.width_ft,
        y: ((clientY - rect.top) / Math.max(rect.height, 1)) * venue.height_ft,
      };
    },
    [venue],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const data = event.active.data.current as
        { kind?: AssetKind; isPalette?: boolean } | undefined;
      if (!data?.isPalette || !data.kind || !event.over) return;
      // The activator event is the original pointerdown; add the drag delta
      const activator = event.activatorEvent as PointerEvent;
      const point = screenToFeet(
        activator.clientX + event.delta.x,
        activator.clientY + event.delta.y,
      );
      onAdd(data.kind, point ?? undefined);
    },
    [onAdd, screenToFeet],
  );

  const handleClickAdd = useCallback(
    (kind: AssetKind) => {
      onAdd(kind, { x: venue.width_ft / 2 - 3, y: venue.height_ft / 2 - 2 });
    },
    [onAdd, venue],
  );

  const handleSave = useCallback(async () => {
    const ok = await onSave();
    if (ok) toast.success("Floorplan saved");
    else toast.error("Could not save floorplan. Please try again.");
  }, [onSave]);

  const handleExport = useCallback(() => {
    const doc = toFloorplanState(assets, venue);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floorplan-${eventId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assets, venue, eventId]);

  const applyAssignment = useCallback(() => {
    if (!selected) return;
    if (!sponsorName.trim()) {
      onUpdate(selected.id, { assignment: null });
      toast.info("Sponsor assignment cleared");
      return;
    }
    onUpdate(selected.id, {
      assignment: { sponsorId: sponsorId.trim() || null, companyName: sponsorName.trim() },
    });
    toast.success(`Assigned ${sponsorName.trim()} to ${selected.label}`);
  }, [selected, sponsorId, sponsorName, onUpdate]);

  /** Center the asset when the inspector resizes it past a wall. */
  const resize = useCallback(
    (asset: FloorplanAsset, width: number, height: number) => {
      const w = Math.max(1, Math.min(width, venue.width_ft));
      const h = Math.max(1, Math.min(height, venue.height_ft));
      onUpdate(asset.id, {
        width: w,
        height: h,
        x: Math.min(asset.x, venue.width_ft - w),
        y: Math.min(asset.y, venue.height_ft - h),
      });
    },
    [onUpdate, venue],
  );

  const collidingList = assets.filter((a) => collidingIds.has(a.id));

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Palette */}
        <aside className="space-y-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
            Elements Palette
          </h2>
          <div className="flex flex-wrap gap-2 lg:flex-col" data-testid="floorplan-palette">
            {PALETTE_KINDS.map((kind) => (
              <PaletteChip key={kind} kind={kind} onClick={handleClickAdd} />
            ))}
          </div>

          {/* Venue size controls */}
          <div className="neu-border space-y-2 bg-white p-3 font-mono text-xs shadow-[2px_2px_0_0_#000]">
            <p className="font-bold uppercase">Venue size (ft)</p>
            <label className="flex items-center justify-between gap-2">
              Width
              <input
                type="number"
                min={20}
                max={400}
                value={venue.width_ft}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) onVenueSize(v, venue.height_ft);
                }}
                className="neu-border w-16 px-1 py-0.5 text-right"
                aria-label="Venue width in feet"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Height
              <input
                type="number"
                min={20}
                max={400}
                value={venue.height_ft}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) onVenueSize(venue.width_ft, v);
                }}
                className="neu-border w-16 px-1 py-0.5 text-right"
                aria-label="Venue height in feet"
              />
            </label>
          </div>

          {/* Safety warnings */}
          {collidingList.length > 0 && (
            <div className="neu-border border-red-500 bg-red-50 p-3 font-mono text-xs text-red-700 shadow-[2px_2px_0_0_#000]">
              <p className="flex items-center gap-1 font-bold uppercase">
                <TriangleAlert size={14} /> Fire lane blocked
              </p>
              <ul className="mt-1 list-disc pl-4">
                {collidingList.map((a) => (
                  <li key={a.id}>{a.label}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <div className="space-y-3">
          <div
            ref={(node) => {
              setDropRef(node);
              canvasWrapRef.current = node;
            }}
            className={`rounded-xl transition-shadow ${isOver ? "ring-4 ring-sky-300" : ""}`}
            data-testid="floorplan-canvas-dropzone"
          >
            <FloorplanCanvas
              venue={venue}
              assets={assets}
              collidingIds={collidingIds}
              onMove={onMove}
              onRemove={(id) => {
                onRemove(id);
                setSelectedId(null);
              }}
              selectedId={selectedId}
              onSelect={selectAsset}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="floorplan-save"
              className="neu-border neu-press flex h-10 items-center gap-2 bg-lime px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_#000] disabled:opacity-60"
            >
              <Save size={14} />
              {isSaving ? "Saving…" : "Save layout"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              data-testid="floorplan-export"
              className="neu-border neu-press flex h-10 items-center gap-2 bg-white px-4 font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_#000]"
            >
              <Download size={14} />
              Export JSON
            </button>
            {selected && (
              <span className="font-mono text-[11px] uppercase text-gray-500">
                Selected: {selected.label} — {describeAssignment(selected, venue)}
              </span>
            )}
          </div>

          {/* Selection inspector */}
          {selected && (
            <div
              className="neu-border space-y-3 bg-white p-4 shadow-[2px_2px_0_0_#000]"
              data-testid="floorplan-inspector"
            >
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                Selection Tools
              </h3>

              <label className="block font-mono text-xs">
                Label
                <input
                  value={selected.label}
                  onChange={(e) => onUpdate(selected.id, { label: e.target.value })}
                  className="neu-border mt-1 w-full px-2 py-1 font-sans text-sm"
                />
              </label>

              <div className="flex gap-3 font-mono text-xs">
                <label className="flex-1">
                  Width (ft)
                  <input
                    type="number"
                    min={1}
                    value={selected.width}
                    onChange={(e) => resize(selected, Number(e.target.value), selected.height)}
                    className="neu-border mt-1 w-full px-2 py-1"
                  />
                </label>
                <label className="flex-1">
                  Height (ft)
                  <input
                    type="number"
                    min={1}
                    value={selected.height}
                    onChange={(e) => resize(selected, selected.width, Number(e.target.value))}
                    className="neu-border mt-1 w-full px-2 py-1"
                  />
                </label>
              </div>

              <div className="border-t-2 border-dashed pt-3">
                <p className="font-mono text-xs font-bold uppercase">Sponsor assignment</p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="font-mono text-xs">
                    Company name
                    <input
                      value={sponsorName}
                      onChange={(e) => setSponsorName(e.target.value)}
                      placeholder="TacoCorp"
                      data-testid="inspector-sponsor-name"
                      className="neu-border mt-1 w-40 px-2 py-1 font-sans text-sm"
                    />
                  </label>
                  <label className="font-mono text-xs">
                    Sponsor ID
                    <input
                      value={sponsorId}
                      onChange={(e) => setSponsorId(e.target.value)}
                      placeholder="42"
                      data-testid="inspector-sponsor-id"
                      className="neu-border mt-1 w-24 px-2 py-1 font-sans text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyAssignment}
                    data-testid="inspector-assign-btn"
                    className="neu-border neu-press h-8 bg-lime px-3 font-mono text-[11px] font-bold uppercase shadow-[2px_2px_0_0_#000]"
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSponsorName("");
                      setSponsorId("");
                      onUpdate(selected.id, { assignment: null });
                    }}
                    className="neu-border neu-press h-8 bg-white px-3 font-mono text-[11px] font-bold uppercase shadow-[2px_2px_0_0_#000]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onRemove(selected.id);
                  setSelectedId(null);
                }}
                className="neu-border neu-press h-9 bg-red-500 px-4 font-mono text-xs font-bold uppercase text-white shadow-[2px_2px_0_0_#000]"
              >
                Delete asset
              </button>
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
};
