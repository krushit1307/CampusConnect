/**
 * Unit Tests for Emergency Student Grant Relief Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateEmergencyStudentGrant } from './emergencyStudentGrantUtils';

describe('EmergencyStudentGrantUtils', () => {
  it('should approve housing emergency relief grant up to 1500 USD limit', () => {
    const res = calculateEmergencyStudentGrant('HOUSING', 1200);
    expect(res.approvedGrantAmountUSD).toBe(1200);
    expect(res.reliefType).toBe('HOUSING_RENT_RELIEF');
  });
});
  /**
   * Activate acoustic wayfinding guidance during emergency
   */
  private async activateAcousticWayfinding(venueId: number, emergencyEventId: number): Promise<void> {
    try {
      // Query primary assembly/exit zone for venue
      const exitZoneResult = await db.query(
        `SELECT id FROM acoustic_zones 
         WHERE venue_id = $1 AND zone_type = 'exit' AND is_emergency_exit = true
         LIMIT 1`,
        [venueId]
      );

      if (exitZoneResult.rows.length === 0) {
        console.warn(`No emergency exit zone configured for venue ${venueId}`);
        return;
      }

      const exitZoneId = exitZoneResult.rows[0].id;

      // Get all zones in venue that might have occupants
      const occupiedZones = await db.query(
        `SELECT DISTINCT az.id FROM acoustic_zones az
         WHERE az.venue_id = $1 AND az.zone_type IN ('room', 'hallway')`,
        [venueId]
      );

      // For each occupied zone, establish wayfinding to exit
      for (const zone of occupiedZones.rows) {
        console.log(
          `Activating acoustic wayfinding from zone ${zone.id} to exit ${exitZoneId}`
        );

        // Non-blocking activation (fire and forget)
        acousticWayfindingService
          .activateEmergencyGuidance(
            emergencyEventId,
            venueId,
            zone.id,
            exitZoneId
          )
          .catch((error) => {
            console.error(`Failed to activate wayfinding for zone ${zone.id}:`, error);
          });
      }
    } catch (error) {
      console.error('Error activating acoustic wayfinding:', error);
      // Don't throw - emergency dispatch should continue even if audio fails
    }
  }