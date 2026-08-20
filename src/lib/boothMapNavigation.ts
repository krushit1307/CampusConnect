export interface BoothNode {
  id: string;
  eventId: string;
  clubId?: string;
  clubName?: string;
  clubCategory?: string;
  boothLabel: string;
  posX: number; // 0.0 to 100.0
  posY: number; // 0.0 to 100.0
  status: "AVAILABLE" | "BUSY" | "CLOSED";
}

export interface HighlightedBoothResult {
  booth: BoothNode;
  isPulsingHighlight: boolean;
  statusColor: string; // e.g., '#22c55e' (green), '#ef4444' (red/busy), '#6b7280' (gray)
}

export const STATUS_COLOR_MAP = {
  AVAILABLE: "#22c55e", // Green
  BUSY: "#ef4444", // Red
  CLOSED: "#6b7280", // Gray
};

/**
 * Searches floorplan booth nodes by club name, category, or booth label.
 */
export function searchBoothsInMap(booths: BoothNode[], query: string): BoothNode[] {
  if (!query || query.trim() === "") return booths;

  const q = query.toLowerCase().trim();
  return booths.filter((b) => {
    const matchName = b.clubName?.toLowerCase().includes(q);
    const matchCategory = b.clubCategory?.toLowerCase().includes(q);
    const matchLabel = b.boothLabel.toLowerCase().includes(q);
    return matchName || matchCategory || matchLabel;
  });
}

/**
 * Formats a selected booth node with pulsing CSS highlight parameters and status color.
 */
export function getHighlightedBoothNode(
  booths: BoothNode[],
  selectedClubIdOrLabel: string,
): HighlightedBoothResult | null {
  const target = booths.find(
    (b) =>
      b.clubId === selectedClubIdOrLabel ||
      b.boothLabel.toLowerCase() === selectedClubIdOrLabel.toLowerCase(),
  );

  if (!target) return null;

  return {
    booth: target,
    isPulsingHighlight: true,
    statusColor: STATUS_COLOR_MAP[target.status] || STATUS_COLOR_MAP.AVAILABLE,
  };
}

/**
 * Toggles a club booth's live operational status (e.g. marking "BUSY" during heavy queue times).
 */
export function toggleBoothBusyStatus(
  booth: BoothNode,
  newStatus: "AVAILABLE" | "BUSY" | "CLOSED",
): BoothNode {
  return {
    ...booth,
    status: newStatus,
  };
}
