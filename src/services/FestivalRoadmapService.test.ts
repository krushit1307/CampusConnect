import { describe, it, expect } from 'vitest';
import { FestivalRoadmapService } from '../../backend/src/services/FestivalRoadmapService';

describe('FestivalRoadmapService', () => {
  it('should fetch festival multi-track sessions', () => {
    const sessions = FestivalRoadmapService.getSessions();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].capacityLimit).toBeGreaterThan(0);
  });

  it('should detect schedule conflicts correctly', () => {
    const session = FestivalRoadmapService.getSessions()[0];
    FestivalRoadmapService.bookmarkSession('USER-99', session.sessionId);

    // Overlapping session test
    const conflict = FestivalRoadmapService.checkScheduleConflict('USER-99', session);
    expect(conflict).toBe(true);
  });

  it('should generate valid RFC 5545 iCalendar (.ics) export format', () => {
    const session = FestivalRoadmapService.getSessions()[0];
    FestivalRoadmapService.bookmarkSession('USER-101', session.sessionId);

    const icsContent = FestivalRoadmapService.generateICalendarExport('USER-101');
    expect(icsContent).toContain('BEGIN:VCALENDAR');
    expect(icsContent).toContain('END:VCALENDAR');
    expect(icsContent).toContain('SUMMARY:');
  });
});
