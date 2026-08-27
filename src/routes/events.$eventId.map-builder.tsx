import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Save from "lucide-react/dist/esm/icons/save";
import RotateCw from "lucide-react/dist/esm/icons/rotate-cw";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import Layout from "lucide-react/dist/esm/icons/layout";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useMapBuilderStore, MapBuilderElement } from "@/stores/mapBuilderStore";
import {
  ACCESSIBILITY_NODE_LABELS,
  isAccessibilityNode,
  type MapNodeType,
} from "@/lib/accessibilityMap";

// Snap coordinates helper
const snapToGrid = (val: number, gridSize: number): number => {
  return Math.round(val / gridSize) * gridSize;
};

// Check if two elements overlap
const checkOverlap = (el1: MapBuilderElement, el2: MapBuilderElement): boolean => {
  return (
    el1.x < el2.x + el2.width &&
    el1.x + el1.width > el2.x &&
    el1.y < el2.y + el2.height &&
    el1.y + el1.height > el2.y
  );
};

// Draggable item for palette
function PaletteItem({
  type,
  label,
  defaultWidth,
  defaultHeight,
}: {
  type: MapNodeType;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `palette-${type}`,
    data: { type, defaultWidth, defaultHeight, isPalette: true },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 9999,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="border-2 border-black p-3.5 bg-white font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] cursor-grab hover:bg-cream active:cursor-grabbing hover:-translate-y-0.5 transition-transform"
    >
      {label}
      <div className="text-[10px] text-gray-500 normal-case font-normal mt-1">
        Size: {defaultWidth}x{defaultHeight}px
      </div>
    </div>
  );
}

// Draggable canvas element wrapper
function CanvasElement({ element }: { element: MapBuilderElement }) {
  const { elements, selectedElementId, updateElement, selectElement, removeElement, gridSize } =
    useMapBuilderStore();
  const isSelected = selectedElementId === element.id;

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: element.id,
    data: { id: element.id, isPalette: false },
  });

  // Calculate if this element overlaps with any other element
  const hasOverlap = elements.some(
    (other) => other.id !== element.id && checkOverlap(element, other),
  );

  const style = {
    position: "absolute" as const,
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isSelected ? 1000 : element.zIndex || 10,
  };

  const colors: Record<MapNodeType, string> = {
    table: "bg-amber-100",
    stage: "bg-indigo-100",
    boundary: "bg-red-50",
    booth: "bg-emerald-100",
    sponsor: "bg-emerald-200",
    entrance: "bg-blue-100",
    elevator: "bg-blue-200",
    ramp: "bg-blue-300",
    restroom: "bg-cyan-200",
  };

  const borders: Record<MapNodeType, string> = {
    table: "border-amber-400",
    stage: "border-indigo-400",
    boundary: "border-red-400 border-dashed",
    booth: "border-emerald-400",
    sponsor: "border-emerald-600",
    entrance: "border-blue-700",
    elevator: "border-blue-800",
    ramp: "border-blue-900",
    restroom: "border-cyan-800",
  };

  // Custom mouse resize handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startWidth = element.width;
    const startHeight = element.height;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Snap size to grid
      const newWidth = Math.max(gridSize * 2, snapToGrid(startWidth + deltaX, gridSize));
      const newHeight = Math.max(gridSize * 2, snapToGrid(startHeight + deltaY, gridSize));

      updateElement(element.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`canvas-element-${element.id}`}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id);
      }}
      aria-label={`${element.label}, ${ACCESSIBILITY_NODE_LABELS[element.type] || element.type}`}
      className={`relative select-none border-2 border-black flex flex-col items-center justify-center p-2 text-center transition-shadow shadow-[2px_2px_0_0_#000] ${
        colors[element.type]
      } ${isSelected ? "ring-2 ring-black" : ""} ${hasOverlap ? "border-dashed border-red-500 bg-red-100/40" : ""}`}
    >
      {/* Rotation Visual Indicator */}
      <div
        className="w-full h-full flex flex-col items-center justify-center"
        style={{ transform: `rotate(${element.rotation}deg)` }}
      >
        <span className="font-mono text-[10px] font-extrabold uppercase leading-none break-all p-1">
          {element.label}
        </span>
        <span className="font-mono text-[8px] opacity-75 mt-0.5 uppercase tracking-wider leading-none">
          {element.type}
        </span>
      </div>

      {/* Drag handle overlay */}
      <div
        {...listeners}
        {...attributes}
        className="absolute inset-0 cursor-grab active:cursor-grabbing opacity-0 hover:opacity-10"
      />

      {/* Resize Handle */}
      {isSelected && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 cursor-se-resize w-3.5 h-3.5 border-r-2 border-b-2 border-black m-0.5 z-[1100]"
          title="Drag to Resize"
        >
          <Maximize2 className="w-2.5 h-2.5 absolute bottom-0 right-0 text-black shrink-0" />
        </div>
      )}

      {/* Overlap Indicator */}
      {hasOverlap && (
        <div
          className="absolute top-1 right-1 bg-red-500 border border-black w-2.5 h-2.5 rounded-full"
          title="Overlapping element"
        />
      )}
    </div>
  );
}

// Droppable Canvas Container
function DroppableCanvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  const { canvasWidth, canvasHeight, selectElement } = useMapBuilderStore();

  return (
    <div
      ref={setNodeRef}
      onClick={() => selectElement(null)}
      className={`relative border-4 border-black bg-white shadow-[6px_6px_0_0_#000] overflow-hidden transition-colors ${
        isOver ? "bg-cream/40" : ""
      }`}
      style={{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        backgroundImage: "radial-gradient(#000 8%, transparent 9%)",
        backgroundSize: "20px 20px",
      }}
    >
      {children}
    </div>
  );
}

export default function CampusMapBuilder() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();

  const {
    elements,
    selectedElementId,
    gridSize,
    canvasWidth,
    canvasHeight,
    setElements,
    addElement,
    updateElement,
    removeElement,
    selectElement,
  } = useMapBuilderStore();

  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load layout from database (relational tables: venue_maps and map_nodes)
  useEffect(() => {
    if (!eventId) return;

    const loadData = async () => {
      try {
        // Fetch event title
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("title")
          .eq("id", eventId)
          .single();

        if (eventError) throw eventError;
        setEventTitle(eventData?.title || "Event Builder");

        // Fetch venue map details
        const { data: mapData, error: mapError } = await supabase
          .from("venue_maps")
          .select("id, background_image_url")
          .eq("event_id", eventId)
          .maybeSingle();

        if (mapError) throw mapError;

        if (mapData) {
          // Fetch map nodes
          const { data: nodesData, error: nodesError } = await supabase
            .from("map_nodes")
            .select(
              "id, entity_name, type, x_coord, y_coord, width, height, rotation, accessibility_notes",
            )
            .eq("map_id", mapData.id);

          if (nodesError) throw nodesError;

          // Convert relative percentage coordinates back to absolute pixels for the editor's 800x600 grid
          const loadedElements: MapBuilderElement[] = (nodesData || []).map((node) => ({
            id: node.id,
            type: node.type as MapNodeType,
            label: node.entity_name || "",
            x: Math.round((Number(node.x_coord) / 100) * 800),
            y: Math.round((Number(node.y_coord) / 100) * 600),
            width: Math.round((Number(node.width) / 100) * 800),
            height: Math.round((Number(node.height) / 100) * 600),
            rotation: node.rotation,
            accessibilityNotes: node.accessibility_notes || "",
          }));

          setElements(loadedElements);
        } else {
          setElements([]);
        }
      } catch (err) {
        console.error("Failed to load map layout:", err);
        toast.error("Failed to fetch map builder layout");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId, setElements]);

  // Handle key listeners for Keyboard arrow movements & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElementId) return;

      const element = elements.find((el) => el.id === selectedElementId);
      if (!element) return;

      let deltaX = 0;
      let deltaY = 0;

      if (e.key === "ArrowLeft") {
        deltaX = -gridSize;
      } else if (e.key === "ArrowRight") {
        deltaX = gridSize;
      } else if (e.key === "ArrowUp") {
        deltaY = -gridSize;
      } else if (e.key === "ArrowDown") {
        deltaY = gridSize;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        removeElement(selectedElementId);
        return;
      } else if (e.key.toLowerCase() === "r") {
        const nextRotation = (element.rotation + 90) % 360;
        updateElement(selectedElementId, { rotation: nextRotation });
        return;
      } else {
        return;
      }

      e.preventDefault();

      // Bounds checking
      const nextX = Math.max(0, Math.min(element.x + deltaX, canvasWidth - element.width));
      const nextY = Math.max(0, Math.min(element.y + deltaY, canvasHeight - element.height));

      updateElement(selectedElementId, { x: nextX, y: nextY });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedElementId,
    elements,
    gridSize,
    canvasWidth,
    canvasHeight,
    updateElement,
    removeElement,
  ]);

  // Handle DragEnd events from dnd-kit context
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || over.id !== "canvas") return;

    const delta = event.delta;
    const isPalette = active.data.current?.isPalette;

    if (isPalette) {
      // Get element position relative to canvas container
      const containerElement = document.querySelector('[ref="setNodeRef"]');
      const rect = containerElement?.getBoundingClientRect();

      const startX = active.rect.current.translated?.left || 0;
      const startY = active.rect.current.translated?.top || 0;

      const relativeX = rect ? startX - rect.left : 100;
      const relativeY = rect ? startY - rect.top : 100;

      const snappedX = snapToGrid(relativeX, gridSize);
      const snappedY = snapToGrid(relativeY, gridSize);

      const type = active.data.current?.type as MapNodeType | undefined;
      if (!type) return;
      const width = active.data.current?.defaultWidth || 80;
      const height = active.data.current?.defaultHeight || 60;

      // Bounded placement
      const boundedX = Math.max(0, Math.min(snappedX, canvasWidth - width));
      const boundedY = Math.max(0, Math.min(snappedY, canvasHeight - height));

      const newElement: MapBuilderElement = {
        id: `${type}-${Date.now()}`,
        type,
        x: boundedX,
        y: boundedY,
        width,
        height,
        rotation: 0,
        label:
          type === "entrance"
            ? "MAIN ENTRANCE"
            : `${ACCESSIBILITY_NODE_LABELS[type as MapNodeType] || type.toUpperCase()} #${elements.length + 1}`,
      };

      addElement(newElement);
    } else {
      // Moving an existing element
      const elementId = active.id as string;
      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      const newX = element.x + delta.x;
      const newY = element.y + delta.y;

      const snappedX = snapToGrid(newX, gridSize);
      const snappedY = snapToGrid(newY, gridSize);

      // Bounds checking
      const boundedX = Math.max(0, Math.min(snappedX, canvasWidth - element.width));
      const boundedY = Math.max(0, Math.min(snappedY, canvasHeight - element.height));

      updateElement(elementId, { x: boundedX, y: boundedY });
    }
  };

  // Save layout state back to the database (relational tables: venue_maps and map_nodes)
  const saveLayoutToDatabase = async () => {
    if (!eventId) return;

    // Check for collisions (overlap) before saving
    let hasCollision = false;
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        if (checkOverlap(elements[i], elements[j])) {
          hasCollision = true;
          break;
        }
      }
      if (hasCollision) break;
    }

    if (hasCollision) {
      toast.error("Cannot save: Some elements are overlapping. Please resolve all collisions.");
      return;
    }

    try {
      let mapId: string;

      // 1. Fetch or create a venue map record for this event
      const { data: existingMap, error: findError } = await supabase
        .from("venue_maps")
        .select("id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (findError) throw findError;

      if (existingMap) {
        mapId = existingMap.id;
      } else {
        const { data: newMap, error: insertError } = await supabase
          .from("venue_maps")
          .insert({ event_id: eventId })
          .select("id")
          .single();

        if (insertError) throw insertError;
        mapId = newMap.id;
      }

      // 2. Clear old nodes for this venue map
      const { error: deleteError } = await supabase.from("map_nodes").delete().eq("map_id", mapId);

      if (deleteError) throw deleteError;

      // 3. Bulk insert new nodes converted to relative percentage dimensions
      if (elements.length > 0) {
        const nodesToInsert = elements.map((el) => ({
          map_id: mapId,
          entity_name: el.label,
          type: el.type,
          x_coord: (el.x / 800) * 100,
          y_coord: (el.y / 600) * 100,
          width: (el.width / 800) * 100,
          height: (el.height / 600) * 100,
          rotation: el.rotation,
          accessibility_notes: el.accessibilityNotes || null,
        }));

        const { error: insertNodesError } = await supabase.from("map_nodes").insert(nodesToInsert);

        if (insertNodesError) throw insertNodesError;
      }

      toast.success("Layout configuration saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save layout configuration");
    }
  };

  // Rotation handler for selected element
  const handleRotateSelected = () => {
    if (!selectedElementId) return;
    const element = elements.find((el) => el.id === selectedElementId);
    if (element) {
      const nextRotation = (element.rotation + 90) % 360;
      updateElement(selectedElementId, { rotation: nextRotation });
    }
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="flex h-[50vh] items-center justify-center">
          <div
            role="status"
            className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"
          />
        </div>
      </SiteShell>
    );
  }

  const selectedElement = elements.find((el) => el.id === selectedElementId);

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="font-display text-2xl font-black uppercase md:text-3xl">
                  Layout Builder
                </h1>
                <p className="font-mono text-xs text-gray-600">{eventTitle}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveLayoutToDatabase}
                className="flex items-center gap-2 border-2 border-black bg-lime px-4 py-2 font-mono text-sm font-bold uppercase shadow-[3px_3px_0_0_#000] hover:bg-emerald-400 active:translate-x-0.5 active:translate-y-0.5"
              >
                <Save size={16} /> Save Configuration
              </button>
            </div>
          </div>

          <DndContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
              {/* Sidebar Palette */}
              <div className="flex flex-col gap-5 lg:col-span-1">
                <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
                  <h3 className="font-display text-sm font-bold uppercase border-b-2 border-black pb-2 mb-3 flex items-center gap-1.5">
                    <Layout className="w-4 h-4" /> Elements Palette
                  </h3>
                  <div className="flex flex-col gap-3">
                    <PaletteItem
                      type="table"
                      label="Table / Booth"
                      defaultWidth={80}
                      defaultHeight={60}
                    />
                    <PaletteItem
                      type="stage"
                      label="Main Stage"
                      defaultWidth={160}
                      defaultHeight={100}
                    />
                    <PaletteItem
                      type="boundary"
                      label="Boundary / Wall"
                      defaultWidth={120}
                      defaultHeight={20}
                    />
                    <PaletteItem
                      type="booth"
                      label="Small Counter"
                      defaultWidth={60}
                      defaultHeight={60}
                    />
                    <div className="border-t-2 border-black pt-3 font-mono text-[10px] font-black uppercase text-blue-900">
                      Accessibility layer
                    </div>
                    <PaletteItem
                      type="sponsor"
                      label="Sponsor Booth"
                      defaultWidth={80}
                      defaultHeight={60}
                    />
                    <PaletteItem
                      type="entrance"
                      label="Main Entrance"
                      defaultWidth={50}
                      defaultHeight={50}
                    />
                    <PaletteItem
                      type="elevator"
                      label="Elevator"
                      defaultWidth={50}
                      defaultHeight={50}
                    />
                    <PaletteItem
                      type="ramp"
                      label="Accessible Ramp"
                      defaultWidth={80}
                      defaultHeight={30}
                    />
                    <PaletteItem
                      type="restroom"
                      label="Accessible Restroom"
                      defaultWidth={60}
                      defaultHeight={60}
                    />
                  </div>
                </div>

                {/* Hotkeys Information panel */}
                <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] font-mono text-[10px] text-gray-700 space-y-2">
                  <h4 className="font-bold uppercase text-black flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-500" /> Controls Guide
                  </h4>
                  <p>• Drag items from palette onto the grid canvas</p>
                  <p>• Click items on canvas to select them</p>
                  <p>
                    • Move selected item with <b>Arrow Keys</b>
                  </p>
                  <p>
                    • Press <b>R</b> to rotate selected elements
                  </p>
                  <p>
                    • Press <b>Delete</b> to remove selected elements
                  </p>
                  <p>• Drag bottom-right corner of selected items to resize</p>
                </div>

                {/* Editor control tools */}
                {selectedElement && (
                  <div className="border-2 border-black bg-amber-50 p-4 shadow-[4px_4px_0_0_#000] space-y-3">
                    <h4 className="font-display text-xs font-bold uppercase border-b border-black pb-1">
                      🛠️ Selection Tools
                    </h4>
                    <div className="space-y-2 font-mono text-[11px]">
                      <div>
                        <span className="font-bold">Label:</span>
                        <input
                          type="text"
                          value={selectedElement.label}
                          onChange={(e) =>
                            updateElement(selectedElement.id, { label: e.target.value })
                          }
                          className="w-full mt-1 border-2 border-black p-1 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="font-bold">Grid Position:</span> {selectedElement.x},{" "}
                        {selectedElement.y}
                      </div>
                      {isAccessibilityNode(selectedElement.type) && (
                        <label className="block">
                          <span className="font-bold">Accessibility notes:</span>
                          <textarea
                            value={selectedElement.accessibilityNotes || ""}
                            onChange={(e) =>
                              updateElement(selectedElement.id, {
                                accessibilityNotes: e.target.value,
                              })
                            }
                            rows={3}
                            maxLength={240}
                            placeholder="e.g. Use the west entrance; automatic door is 10 feet south."
                            className="mt-1 w-full border-2 border-black bg-white p-1 text-xs"
                          />
                        </label>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleRotateSelected}
                          className="flex items-center gap-1 border border-black bg-white px-2 py-1 text-xs font-bold uppercase hover:bg-gray-100"
                        >
                          <RotateCw className="w-3.5 h-3.5" /> Rotate
                        </button>
                        <button
                          onClick={() => removeElement(selectedElement.id)}
                          className="flex items-center gap-1 border border-black bg-red-100 text-red-700 px-2 py-1 text-xs font-bold uppercase hover:bg-red-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Grid Canvas Area */}
              <div className="flex flex-col items-center justify-start lg:col-span-3">
                <DroppableCanvas>
                  {elements.map((element) => (
                    <CanvasElement key={element.id} element={element} />
                  ))}
                </DroppableCanvas>

                <div className="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-gray-500 uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span>Interactive Mapsnapping Grid (Snaps elements to 20px grid spacing)</span>
                </div>
              </div>
            </div>
          </DndContext>
        </div>
      </div>
    </SiteShell>
  );
}
