import Sun from "lucide-react/dist/esm/icons/sun";
import Cloud from "lucide-react/dist/esm/icons/cloud";
import CloudRain from "lucide-react/dist/esm/icons/cloud-rain";
import CloudDrizzle from "lucide-react/dist/esm/icons/cloud-drizzle";
import CloudLightning from "lucide-react/dist/esm/icons/cloud-lightning";
import Snowflake from "lucide-react/dist/esm/icons/snowflake";
import CloudFog from "lucide-react/dist/esm/icons/cloud-fog";
import CloudOff from "lucide-react/dist/esm/icons/cloud-off";
import type { WeatherConditionCode } from "./types";

/**
 * Lucide icon name for each weather condition bucket. We pick names
 * from lucide-react (already in the project) so the widget needs no
 * new icon dependency.
 *
 * Kept as a small mapping function (not a full icon component) so
 * tests can assert on the icon *name* without rendering React.
 */
export type WeatherIconName =
  | "Sun"
  | "CloudSun"
  | "Cloud"
  | "CloudRain"
  | "CloudDrizzle"
  | "CloudLightning"
  | "Snowflake"
  | "CloudFog"
  | "CloudOff";

/**
 * Lucide component map for each icon name. The widget uses this to
 * resolve a name to a renderable component without coupling the
 * visual layer to the data layer.
 */
export const WEATHER_ICON_COMPONENT = {
  Sun,
  CloudSun: Cloud,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  Snowflake,
  CloudFog,
  CloudOff,
} as const;

/**
 * Map a WeatherConditionCode to a Lucide icon name.
 *
 * Returns "CloudOff" for the unknown bucket so a missing provider
 * value still renders something — the fail-open UI from the issue
 * spec edge case.
 */
export function getWeatherIcon(code: WeatherConditionCode): WeatherIconName {
  switch (code) {
    case "clear":
      return "Sun";
    case "clouds":
      return "Cloud";
    case "rain":
      return "CloudRain";
    case "drizzle":
      return "CloudDrizzle";
    case "thunderstorm":
      return "CloudLightning";
    case "snow":
      return "Snowflake";
    case "mist":
      return "CloudFog";
    case "unknown":
    default:
      return "CloudOff";
  }
}

/**
 * Tailwind color hint per condition — used by the widget's icon
 * background so a sunny day looks different from a rainy one.
 */
export function getWeatherAccent(code: WeatherConditionCode): string {
  switch (code) {
    case "clear":
      return "text-amber-500";
    case "clouds":
      return "text-gray-500";
    case "rain":
    case "drizzle":
      return "text-sky-600";
    case "thunderstorm":
      return "text-violet-600";
    case "snow":
      return "text-sky-300";
    case "mist":
      return "text-slate-400";
    case "unknown":
    default:
      return "text-gray-400";
  }
}
