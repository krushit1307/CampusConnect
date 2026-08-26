import type { ComponentType } from "react";
import { CloudSun, Music2, PlaySquare, Timer, type LucideIcon } from "lucide-react";
import type { WidgetType } from "./types";
import { WeatherWidget } from "./WeatherWidget";
import { CountdownWidget } from "./CountdownWidget";
import { SpotifyWidget } from "./SpotifyWidget";
import { YouTubeWidget } from "./YouTubeWidget";

export interface WidgetComponentProps {
  params: Record<string, unknown>;
}

export interface WidgetParamField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "date" | "url";
  required?: boolean;
  hint?: string;
}

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultConfig: Record<string, string>;
  paramFields: WidgetParamField[];
  Component: ComponentType<WidgetComponentProps>;
}

/**
 * Central registry mapping a widget type to its React component and the
 * metadata the admin panel needs to configure it. Adding a new widget
 * type means adding an entry here (plus a component) — the renderer and
 * the admin editor pick it up automatically.
 */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  weather: {
    type: "weather",
    label: "Weather",
    description: "Live conditions for a city or campus location.",
    icon: CloudSun,
    defaultConfig: { location: "" },
    paramFields: [
      {
        key: "location",
        label: "Location",
        placeholder: "London",
        required: true,
        hint: "Fetched through the secure weather Edge Function proxy — no API key is exposed.",
      },
    ],
    Component: WeatherWidget,
  },
  countdown: {
    type: "countdown",
    label: "Countdown",
    description: "Live countdown to a target date (hackathon kickoff, deadline, ...).",
    icon: Timer,
    defaultConfig: { title: "Countdown", target: "" },
    paramFields: [
      { key: "title", label: "Title", placeholder: "Hackathon starts in" },
      {
        key: "target",
        label: "Target date",
        placeholder: "2026-10-10",
        type: "date",
        required: true,
      },
    ],
    Component: CountdownWidget,
  },
  spotify: {
    type: "spotify",
    label: "Spotify",
    description: "Embed a Spotify playlist, album, or track.",
    icon: Music2,
    defaultConfig: { url: "" },
    paramFields: [
      {
        key: "url",
        label: "Spotify URL",
        placeholder: "https://open.spotify.com/playlist/...",
        type: "url",
        required: true,
        hint: "Only open.spotify.com links are allowed. Rendered in a sandboxed iframe.",
      },
    ],
    Component: SpotifyWidget,
  },
  youtube: {
    type: "youtube",
    label: "YouTube",
    description: "Embed a YouTube video (privacy-enhanced player).",
    icon: PlaySquare,
    defaultConfig: { videoId: "" },
    paramFields: [
      {
        key: "videoId",
        label: "Video ID",
        placeholder: "dQw4w9WgXcQ",
        required: true,
        hint: "The 11-character ID from the watch URL (v=...). Rendered in a sandboxed iframe.",
      },
    ],
    Component: YouTubeWidget,
  },
};

export const WIDGET_CATALOG: WidgetMeta[] = Object.values(WIDGET_REGISTRY);

/** Wide widgets stretch across both grid columns on the profile page. */
export function isWideWidget(type: WidgetType): boolean {
  return type === "spotify" || type === "youtube";
}
