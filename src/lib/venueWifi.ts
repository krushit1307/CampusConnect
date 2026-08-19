export interface VenueWifiMetrics {
  id: string;
  name: string;
  building?: string | null;
  capacity?: number | null;
  avg_wifi_speed_mbps?: number | null;
  max_device_capacity?: number | null;
  wifi_report_count?: number | null;
  last_wifi_tested_at?: string | null;
}

export const TECH_HEAVY_TAGS = ["Hackathon", "Tech", "Workshop", "Coding"] as const;
export const WIFI_WARNING_THRESHOLD_MBPS = 50;

const TECH_HEAVY_TERMS = [
  ...TECH_HEAVY_TAGS,
  "technology",
  "programming",
  "robotics",
  "lan",
  "data science",
  "game jam",
  "cybersecurity",
];

export function isTechHeavyEvent(tags: string[] = [], category = "", title = "", description = "") {
  const haystack = ` ${[category, title, description, ...tags]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")} `;
  return TECH_HEAVY_TERMS.some((term) => haystack.includes(` ${term.toLowerCase()} `));
}

export function sortVenuesForEvent<T extends VenueWifiMetrics>(
  venues: T[],
  techHeavy: boolean,
  attendeeCount?: number,
) {
  if (!techHeavy) return venues;

  return [...venues].sort((left, right) => {
    const leftCapacity = left.max_device_capacity ?? 0;
    const rightCapacity = right.max_device_capacity ?? 0;
    const leftSuitable = attendeeCount == null || leftCapacity >= attendeeCount;
    const rightSuitable = attendeeCount == null || rightCapacity >= attendeeCount;

    if (leftSuitable !== rightSuitable) return leftSuitable ? -1 : 1;
    if (leftCapacity !== rightCapacity) return rightCapacity - leftCapacity;
    return (right.avg_wifi_speed_mbps ?? 0) - (left.avg_wifi_speed_mbps ?? 0);
  });
}

export function getVenueWifiWarning(
  venue: VenueWifiMetrics | null | undefined,
  techHeavy: boolean,
  attendeeCount?: number,
) {
  if (!venue || !techHeavy) return null;
  const limit = venue.max_device_capacity;
  const count = attendeeCount ?? 0;

  if (limit && count > limit) {
    return `This venue historically drops connections with > ${limit} people. Consider booking the Library instead.`;
  }

  if (limit && count > 100 && limit <= 100) {
    return `This venue historically drops connections with > ${limit} people. Consider booking the Library instead.`;
  }

  if (
    venue.avg_wifi_speed_mbps != null &&
    venue.avg_wifi_speed_mbps < WIFI_WARNING_THRESHOLD_MBPS
  ) {
    return `This venue's average Wi-Fi speed is ${formatWifiSpeed(venue.avg_wifi_speed_mbps)}; tech-heavy events may experience dropped connections. Consider booking the Library instead.`;
  }

  return null;
}

export function getWifiSpeedTone(speed?: number | null) {
  if (speed == null) return "neutral" as const;
  if (speed >= 100) return "good" as const;
  if (speed >= WIFI_WARNING_THRESHOLD_MBPS) return "caution" as const;
  return "slow" as const;
}

export function formatWifiSpeed(speed?: number | null) {
  if (speed == null) return "No recent test";
  return `${Number(speed).toFixed(speed % 1 === 0 ? 0 : 1)} Mbps avg.`;
}
