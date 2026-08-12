export type EventStatus = "draft" | "active" | "cancelled" | "expired";

export interface ActiveEventMapData {
  id: string;
  lat: number;
  lng: number;
  rsvpCount: number;
  status: EventStatus;
}

export type HeatmapPoint = [number, number, number]; // [lat, lng, weight]

export interface HeatmapOptions {
  radius?: number;
  blur?: number;
  maxZoom?: number;
  gradient?: {
    [key: string]: string;
  };
}
