// =============================================================================
// Hook: useSeatingChart
// Issue: #2730 - Implement a Graphical 'Seating Chart' Builder for Gala Events
// Description: Manages the state of the seating chart canvas, including tables,
// chairs, and RSVP assignments. Handles saving to the database with optimistic
// locking to prevent concurrent edit conflicts.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export interface Chair {
  id: string;
  tableId: string;
  x: number; // Relative to table center
  y: number;
  assignedUserId: string | null;
  assignedUserName: string | null;
}

export interface Table {
  id: string;
  type: "round" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  chairs: Chair[];
  label: string;
}

export interface CanvasState {
  tables: Table[];
  zoom: number;
  panX: number;
  panY: number;
}

interface UseSeatingChartReturn {
  canvasState: CanvasState;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  addTable: (type: "round" | "rectangle") => void;
  deleteTable: (tableId: string) => void;
  moveTable: (tableId: string, x: number, y: number) => void;
  assignSeat: (
    chairId: string,
    tableId: string,
    userId: string | null,
    userName: string | null,
  ) => void;
  saveChart: () => Promise<boolean>;
  unassignedRSVPs: Array<{ id: string; full_name: string }>;
}

export function useSeatingChart(eventId: string): UseSeatingChartReturn {
  const [canvasState, setCanvasState] = useState<CanvasState>({
    tables: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbVersion, setDbVersion] = useState(1);
  const [unassignedRSVPs, setUnassignedRSVPs] = useState<Array<{ id: string; full_name: string }>>(
    [],
  );

  // Fetch existing chart and RSVPs on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch Seating Chart
        const { data: chart, error: chartError } = await supabase
          .from("seating_charts")
          .select("*")
          .eq("event_id", eventId)
          .single();

        if (chartError && chartError.code !== "PGRST116") {
          // PGRST116 = No rows found
          throw chartError;
        }

        if (chart) {
          setCanvasState(chart.canvas_state as CanvasState);
          setDbVersion(chart.version);
        }

        // Fetch RSVPs for the event
        const { data: rsvps, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select(
            `
            id,
            profiles:user_id (full_name)
          `,
          )
          .eq("event_id", eventId)
          .eq("checked_in", false);

        if (rsvpError) throw rsvpError;

        // Extract all assigned user IDs from the current canvas state
        const assignedUserIds = new Set<string>();
        if (chart) {
          (chart.canvas_state as CanvasState).tables.forEach((table) => {
            table.chairs.forEach((chair) => {
              if (chair.assignedUserId) {
                assignedUserIds.add(chair.assignedUserId);
              }
            });
          });
        }

        // Filter out already assigned RSVPs
        const unassigned = (rsvps || [])
          .filter((rsvp) => !assignedUserIds.has(rsvp.user_id))
          .map((rsvp) => ({
            id: rsvp.user_id,
            full_name: (rsvp.profiles as any)?.full_name || "Unknown User",
          }));

        setUnassignedRSVPs(unassigned);
      } catch (err: any) {
        setError(err.message || "Failed to load seating chart");
      } finally {
        setIsLoading(false);
      }
    };

    if (eventId) fetchData();
  }, [eventId]);

  const addTable = useCallback(
    (type: "round" | "rectangle") => {
      const newTable: Table = {
        id: `table_${Date.now()}`,
        type,
        x: 200 + Math.random() * 100,
        y: 200 + Math.random() * 100,
        width: type === "round" ? 120 : 180,
        height: type === "round" ? 120 : 80,
        capacity: type === "round" ? 8 : 6,
        label: `Table ${canvasState.tables.length + 1}`,
        chairs: [],
      };

      // Generate chairs around the table
      const chairs: Chair[] = [];
      for (let i = 0; i < newTable.capacity; i++) {
        const angle = (i / newTable.capacity) * 2 * Math.PI;
        const radius = type === "round" ? newTable.width / 2 + 20 : newTable.width / 2 + 15;
        chairs.push({
          id: `chair_${newTable.id}_${i}`,
          tableId: newTable.id,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          assignedUserId: null,
          assignedUserName: null,
        });
      }
      newTable.chairs = chairs;

      setCanvasState((prev) => ({
        ...prev,
        tables: [...prev.tables, newTable],
      }));
    },
    [canvasState.tables.length],
  );

  const deleteTable = useCallback((tableId: string) => {
    setCanvasState((prev) => ({
      ...prev,
      tables: prev.tables.filter((t) => t.id !== tableId),
    }));
  }, []);

  const moveTable = useCallback((tableId: string, x: number, y: number) => {
    setCanvasState((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === tableId ? { ...t, x, y } : t)),
    }));
  }, []);

  const updateTable = useCallback((tableId: string, updates: Partial<Table>) => {
    setCanvasState((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === tableId ? { ...t, ...updates } : t)),
    }));
  }, []);

  const assignSeat = useCallback(
    (chairId: string, tableId: string, userId: string | null, userName: string | null) => {
      setCanvasState((prev) => ({
        ...prev,
        tables: prev.tables.map((t) => {
          if (t.id === tableId) {
            return {
              ...t,
              chairs: t.chairs.map((c) =>
                c.id === chairId ? { ...c, assignedUserId: userId, assignedUserName: userName } : c,
              ),
            };
          }
          // Clear assignment if this user was moved from another table
          if (userId) {
            return {
              ...t,
              chairs: t.chairs.map((c) =>
                c.assignedUserId === userId
                  ? { ...c, assignedUserId: null, assignedUserName: null }
                  : c,
              ),
            };
          }
          return t;
        }),
      }));

      // Update unassigned list
      if (userId) {
        if (userName) {
          // User was assigned, remove from unassigned
          setUnassignedRSVPs((prev) => prev.filter((r) => r.id !== userId));
        }
      } else {
        // User was unassigned, add back to list (would need name lookup in real app)
        // For simplicity, we assume the drag-and-drop handles the list visually
      }
    },
    [],
  );

  const saveChart = async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      const { error: saveError } = await supabase.from("seating_charts").upsert(
        {
          event_id: eventId,
          canvas_state: canvasState,
          version: dbVersion,
        },
        { onConflict: "event_id" },
      );

      if (saveError) {
        if (saveError.message.includes("Optimistic locking failure")) {
          setError("Another admin modified the chart. Please refresh and try again.");
        } else {
          throw saveError;
        }
        return false;
      }

      setDbVersion((prev) => prev + 1);
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to save seating chart");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    canvasState,
    isLoading,
    isSaving,
    error,
    updateTable,
    addTable,
    deleteTable,
    moveTable,
    assignSeat,
    saveChart,
    unassignedRSVPs,
  };
}
