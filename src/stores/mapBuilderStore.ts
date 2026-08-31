import { create } from "zustand";
import type { MapNodeType } from "@/lib/accessibilityMap";

export interface MapBuilderElement {
  id: string;
  type: MapNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees: 0, 90, 180, 270
  label: string;
  accessibilityNotes?: string;
  zIndex?: number;
  requiredTicketTierId?: string;
}

interface MapBuilderState {
  elements: MapBuilderElement[];
  selectedElementId: string | null;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
  setElements: (elements: MapBuilderElement[]) => void;
  addElement: (element: MapBuilderElement) => void;
  updateElement: (id: string, updates: Partial<MapBuilderElement>) => void;
  removeElement: (id: string) => void;
  selectElement: (id: string | null) => void;
}

export const useMapBuilderStore = create<MapBuilderState>((set) => ({
  elements: [],
  selectedElementId: null,
  gridSize: 20, // Snapping grid size
  canvasWidth: 800,
  canvasHeight: 600,
  setElements: (elements) => set({ elements }),
  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      selectedElementId: element.id,
    })),
  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
    })),
  removeElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    })),
  selectElement: (id) => set({ selectedElementId: id }),
}));
