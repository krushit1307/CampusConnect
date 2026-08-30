/**
 * Unit Tests for Intramural Sports Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateIntramuralTeamStandings } from './intramuralSportsUtils';

describe('IntramuralSportsUtils', () => {
  it('should calculate intramural team win percentage and playoff qualification', () => {
    const res = calculateIntramuralTeamStandings('Engineering Titans', 6, 2);
    expect(res.winPercentage).toBe(75.0);
    expect(res.playoffQualified).toBe(true);
  });
});
