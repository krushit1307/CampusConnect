import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import format from "date-fns/format";
import addDays from "date-fns/addDays";
import startOfWeek from "date-fns/startOfWeek";
import isSameDay from "date-fns/isSameDay";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Eraser from "lucide-react/dist/esm/icons/eraser";
import PaintBucket from "lucide-react/dist/esm/icons/paint-bucket";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface HeatmapCalendarProps {
  /**
   * Any date within the target week. Defaults to the current week.
   * The grid always renders Monday through Sunday for that week.
   */
  weekOf?: Date;
  /**
   * ISO timestamps (start-of-hour) that should be pre-painted green,
   * e.g. when an admin is editing a previously saved availability set.
   */
  initialSelected?: string[];
  /**
   * Fired on every paint/erase so a parent can show a live "N slots selected"
   * indicator or autosave a draft. Not required for the component to function.
   */
  onChange?: (selected: string[]) => void;
  /**
   * Fired when the admin clicks "Save Availability". Receives the final
   * Set serialized into an array of ISO timestamps, sorted chronologically.
   */
  onSubmit?: (selected: string[]) => void;
  /** Disables the save button / shows a saving state while a request is in flight. */
  isSaving?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_INDICES = Array.from({ length: 7 }, (_, i) => i);

/** Builds the canonical slot ID for a given day/hour. We use the slot's own
 * ISO timestamp as its ID, which means "serializing the Set" for the backend
 * is just `Array.from(selectedSlots)` — no separate encode/decode step needed. */
function slotId(weekStart: Date, dayIndex: number, hour: number): string {
  const d = addDays(weekStart, dayIndex);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * When2Meet-style availability grid. Click-and-drag paints a swath of hour
 * slots green; dragging back over already-green slots erases them instead.
 *
 * Toggle physics: the mode (paint vs erase) for an entire drag stroke is
 * decided once, from the state of the very first cell the mouse went down
 * on — it does NOT re-evaluate per cell. Otherwise a stroke that crosses
 * both empty and filled cells would flicker between painting and erasing
 * every time it entered a new cell, which is not how When2Meet (or any
 * sane paint tool) behaves.
 */
export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({
  weekOf = new Date(),
  initialSelected = [],
  onChange,
  onSubmit,
  isSaving = false,
}) => {
  const weekStart = useMemo(() => startOfWeek(weekOf, { weekStartsOn: 1 }), [weekOf]);
  const weekDays = useMemo(() => DAY_INDICES.map((i) => addDays(weekStart, i)), [weekStart]);

  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => new Set(initialSelected));

  // Mirrors `selectedSlots` without being a hook dependency, so the mousedown
  // handler can read the *current* state without being recreated on every
  // paint/erase (which would otherwise thrash 168 cell event handlers).
  const selectedSlotsRef = useRef(selectedSlots);
  useEffect(() => {
    selectedSlotsRef.current = selectedSlots;
    onChange?.(Array.from(selectedSlots).sort());
  }, [selectedSlots, onChange]);

  // Locked for the duration of a single drag stroke. null = not dragging.
  const dragModeRef = useRef<"paint" | "erase" | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyToSlot = useCallback((id: string, mode: "paint" | "erase") => {
    setSelectedSlots((prev) => {
      const alreadyHasIt = prev.has(id);
      if (mode === "paint" && alreadyHasIt) return prev;
      if (mode === "erase" && !alreadyHasIt) return prev;

      const next = new Set(prev);
      if (mode === "paint") {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const beginStroke = useCallback(
    (id: string) => {
      // Sample the initial square BEFORE mutating anything, then lock the
      // whole stroke to that mode.
      const mode: "paint" | "erase" = selectedSlotsRef.current.has(id) ? "erase" : "paint";
      dragModeRef.current = mode;
      setIsDragging(true);
      applyToSlot(id, mode);
    },
    [applyToSlot],
  );

  const continueStroke = useCallback(
    (id: string) => {
      if (!dragModeRef.current) return;
      applyToSlot(id, dragModeRef.current);
    },
    [applyToSlot],
  );

  const endStroke = useCallback(() => {
    dragModeRef.current = null;
    setIsDragging(false);
  }, []);

  // Attach mouseup to window (not just the grid) so a drag that ends outside
  // the calendar — over the header, the page background, even outside the
  // browser tab — still cleanly terminates the stroke.
  useEffect(() => {
    window.addEventListener("mouseup", endStroke);
    return () => window.removeEventListener("mouseup", endStroke);
  }, [endStroke]);

  // Touch support mirrors the mouse flow: touchstart samples + locks mode,
  // touchmove looks up whatever cell is currently under the finger via
  // elementFromPoint (touchmove doesn't naturally fire per-element enter
  // events the way mouseenter does), touchend/cancel terminate the stroke.
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragModeRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const id = el?.dataset.slotId;
      if (id) continueStroke(id);
    },
    [continueStroke],
  );

  const handleClear = useCallback(() => {
    setSelectedSlots(new Set());
  }, []);

  const handleSave = useCallback(() => {
    onSubmit?.(Array.from(selectedSlots).sort());
  }, [selectedSlots, onSubmit]);

  return (
    <div
      className="border rounded-lg overflow-hidden bg-background shadow-sm"
      data-testid="heatmap-calendar"
    >
      <header className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Availability
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {selectedSlots.size} slot{selectedSlots.size === 1 ? "" : "s"} selected
          </span>
          <Button variant="outline" size="sm" onClick={handleClear} data-testid="clear-slots">
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-availability"
          >
            {isSaving ? "Saving..." : "Save Availability"}
          </Button>
        </div>
      </header>

      <p className="px-4 pt-3 text-xs text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1">
          <PaintBucket className="w-3.5 h-3.5" /> Drag over empty slots to mark available
        </span>
        <span className="flex items-center gap-1">
          <Eraser className="w-3.5 h-3.5" /> Drag starting on a green slot to erase
        </span>
      </p>

      <div
        className={cn("grid select-none", isDragging && "cursor-crosshair")}
        style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
        // Prevent native drag-select ghosting: without this, some browsers
        // interpret a mousedown+move over adjacent elements as a text/image
        // drag operation instead of a sequence of mouseenter events, which
        // silently breaks the painting interaction mid-stroke.
        onDragStart={(e) => e.preventDefault()}
        onTouchMove={handleTouchMove}
        onTouchEnd={endStroke}
        onTouchCancel={endStroke}
        data-testid="heatmap-grid"
      >
        {/* Header row */}
        <div className="p-2 text-xs font-medium text-muted-foreground border-b border-r bg-muted/10" />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="p-2 text-xs font-medium text-center border-b border-r last:border-r-0 bg-muted/10"
          >
            <div>{format(day, "EEE")}</div>
            <div className={cn("text-sm", isSameDay(day, new Date()) && "text-primary font-bold")}>
              {format(day, "d")}
            </div>
          </div>
        ))}

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <React.Fragment key={hour}>
            <div className="h-8 border-b border-r px-2 text-[11px] text-muted-foreground flex items-center justify-end">
              {format(new Date().setHours(hour, 0, 0, 0), "h a")}
            </div>
            {DAY_INDICES.map((dayIndex) => {
              const id = slotId(weekStart, dayIndex, hour);
              const isSelected = selectedSlots.has(id);
              return (
                <div
                  key={id}
                  data-slot-id={id}
                  data-testid={`slot-${dayIndex}-${hour}`}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`${format(addDays(weekStart, dayIndex), "EEEE")} ${format(
                    new Date().setHours(hour, 0, 0, 0),
                    "h a",
                  )}${isSelected ? ", available" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    beginStroke(id);
                  }}
                  onMouseEnter={() => continueStroke(id)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    beginStroke(id);
                  }}
                  className={cn(
                    "h-8 border-b border-r last:border-r-0 transition-colors cursor-pointer",
                    isSelected ? "bg-green-500 hover:bg-green-600" : "hover:bg-accent/50",
                  )}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default HeatmapCalendar;
