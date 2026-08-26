export interface BracketMatch {
  id: string;
  eventId: string;
  roundNumber: number;
  matchNumber: number;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  winnerName?: string | null;
  status: "pending" | "live" | "completed";
}

export interface ObsOverlayConfig {
  isTransparent: boolean;
  theme: "lower-thirds" | "full-bracket";
  customCssClasses: string;
}

/**
 * Returns CSS style rules required for OBS/vMix browser source integration.
 */
export function getObsOverlayContainerStyles(): Record<string, string> {
  return {
    background: "transparent",
    backgroundColor: "transparent",
    margin: "0",
    padding: "0",
    overflow: "hidden",
  };
}

/**
 * Generates Tailwind CSS classes for high-contrast broadcast lower-thirds styling.
 */
export function getMatchLowerThirdsCss(status: BracketMatch["status"]): string {
  const base =
    "px-4 py-2 flex items-center justify-between text-white font-black tracking-wider shadow-2xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] rounded-md border";

  if (status === "live") {
    return `${base} bg-gradient-to-r from-red-900/90 via-black/90 to-red-900/90 border-red-500 animate-pulse`;
  }
  if (status === "completed") {
    return `${base} bg-black/85 border-gray-700 opacity-90`;
  }

  return `${base} bg-black/80 border-gray-800`;
}

/**
 * Organizes raw bracket matches into structured round columns for OBS overlay display.
 */
export function groupBracketMatchesByRound(
  matches: BracketMatch[],
): Record<number, BracketMatch[]> {
  const rounds: Record<number, BracketMatch[]> = {};

  const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);

  for (const m of sorted) {
    if (!rounds[m.roundNumber]) {
      rounds[m.roundNumber] = [];
    }
    rounds[m.roundNumber].push(m);
  }

  return rounds;
}

/**
 * Formats live WebSocket update payload for instant stream updates.
 */
export function buildRealtimeMatchUpdatePayload(match: BracketMatch) {
  return {
    eventId: match.eventId,
    matchId: match.id,
    displayString: `${match.player1Name} [${match.player1Score}] VS [${match.player2Score}] ${match.player2Name}`,
    isLive: match.status === "live",
  };
}
