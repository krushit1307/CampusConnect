export interface ScoreData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: "not_started" | "in_progress" | "paused" | "finished";
  updatedAt: string;
}
