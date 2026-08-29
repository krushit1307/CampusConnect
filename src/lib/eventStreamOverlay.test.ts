import { describe, it, expect } from "vitest";
import {
  getObsOverlayContainerStyles,
  getMatchLowerThirdsCss,
  groupBracketMatchesByRound,
  buildRealtimeMatchUpdatePayload,
  BracketMatch,
} from "./eventStreamOverlay";

describe("Build Interactive Event Bracket Live Stream Overlay Suite (#4417)", () => {
  const sampleMatches: BracketMatch[] = [
    {
      id: "m1",
      eventId: "evt_esports_2026",
      roundNumber: 1,
      matchNumber: 1,
      player1Name: "Team Alpha",
      player2Name: "Team Beta",
      player1Score: 2,
      player2Score: 1,
      status: "completed",
      winnerName: "Team Alpha",
    },
    {
      id: "m2",
      eventId: "evt_esports_2026",
      roundNumber: 1,
      matchNumber: 2,
      player1Name: "Team Gamma",
      player2Name: "Team Delta",
      player1Score: 0,
      player2Score: 0,
      status: "live",
    },
  ];

  it("provides transparent container styling for OBS browser source compatibility", () => {
    const styles = getObsOverlayContainerStyles();

    expect(styles.background).toBe("transparent");
    expect(styles.backgroundColor).toBe("transparent");
    expect(styles.overflow).toBe("hidden");
  });

  it("applies high-contrast drop-shadow and animated pulse CSS for live matches", () => {
    const liveCss = getMatchLowerThirdsCss("live");
    const completedCss = getMatchLowerThirdsCss("completed");

    expect(liveCss).toContain("drop-shadow");
    expect(liveCss).toContain("animate-pulse");
    expect(completedCss).toContain("bg-black/85");
  });

  it("groups matches chronologically by round number for clean bracket rendering", () => {
    const grouped = groupBracketMatchesByRound(sampleMatches);

    expect(grouped[1].length).toBe(2);
    expect(grouped[1][0].player1Name).toBe("Team Alpha");
  });

  it("builds real-time WebSocket match update payload string for live stream sync", () => {
    const liveMatch = sampleMatches[1];
    const payload = buildRealtimeMatchUpdatePayload(liveMatch);

    expect(payload.eventId).toBe("evt_esports_2026");
    expect(payload.displayString).toBe("Team Gamma [0] VS [0] Team Delta");
    expect(payload.isLive).toBe(true);
  });
});
