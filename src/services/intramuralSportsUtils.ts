/**
 * Student Intramural Sports League & Match Schedule Telemetry Utilities
 */

export interface IntramuralLeagueStandings {
  teamName: string;
  winsCount: number;
  lossesCount: number;
  winPercentage: number;
  playoffQualified: boolean;
}

/**
 * Calculates intramural team win percentage and playoff qualification status.
 */
export function calculateIntramuralTeamStandings(
  teamName: string,
  wins: number,
  losses: number
): IntramuralLeagueStandings {
  const total = wins + losses;
  const pct = total > 0 ? Math.round((wins / total) * 100.0 * 10) / 10 : 0;
  const playoff = pct >= 60.0 && total >= 5;

  return {
    teamName,
    winsCount: wins,
    lossesCount: losses,
    winPercentage: pct,
    playoffQualified: playoff,
  };
}
