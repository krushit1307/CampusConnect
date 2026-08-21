// =============================================================================
// Service: RoomCapacityService
// Issue: #3239 - Real-Time Capacity Heatmaps for Multi-Room Events
// Description: API helper service for room occupancy check-in/out, calibration,
// and heatmap color calculations.
// =============================================================================

import { createClient } from "../lib/supabase/client";

export interface EventRoom {
  id: string;
  event_id: string;
  room_name: string;
  max_capacity: number;
  current_occupancy: number;
  svg_polygon_coords?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OccupancyResult {
  success: boolean;
  room_id?: string;
  room_name?: string;
  current_occupancy?: number;
  max_capacity?: number;
  capacity_warning?: boolean;
  calibrated?: boolean;
  error?: string;
}

/**
 * Calculates SVG polygon/room fill color based on capacity percentage.
 */
export function getHeatmapColor(occupancy: number, maxCapacity: number): string {
  if (!maxCapacity || maxCapacity <= 0) return "#e0f2fe";
  const percentage = (occupancy / maxCapacity) * 100;

  if (percentage >= 95) return "#ef4444"; // Red (Over capacity / bottleneck warning)
  if (percentage >= 75) return "#f97316"; // Orange (High density)
  if (percentage >= 50) return "#f59e0b"; // Amber (Moderate density)
  if (percentage >= 25) return "#3b82f6"; // Blue (Low density)
  return "#e0f2fe"; // Light blue (Empty / minimal)
}

/**
 * Fetches all rooms and current occupancy for an event.
 */
export async function fetchEventRooms(eventId: string): Promise<EventRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_rooms")
    .select("*")
    .eq("event_id", eventId)
    .order("room_name", { ascending: true });

  if (error) {
    console.error("Error fetching event rooms:", error);
    return [];
  }

  return data as EventRoom[];
}

/**
 * Increments (+1) or decrements (-1) room occupancy via RPC.
 */
export async function updateRoomOccupancy(roomId: string, delta: number): Promise<OccupancyResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_room_occupancy", {
    p_room_id: roomId,
    p_delta: delta,
  });

  if (error) {
    console.error("Error updating room occupancy:", error);
    return { success: false, error: error.message };
  }

  return data as OccupancyResult;
}

/**
 * Manually calibrates actual room headcount to fix drift when attendees leave without checking out.
 */
export async function calibrateRoomOccupancy(
  roomId: string,
  manualCount: number,
): Promise<OccupancyResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("calibrate_room_occupancy", {
    p_room_id: roomId,
    p_manual_count: manualCount,
  });

  if (error) {
    console.error("Error calibrating room occupancy:", error);
    return { success: false, error: error.message };
  }

  return data as OccupancyResult;
}
