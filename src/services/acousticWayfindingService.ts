/**
 * Acoustic Wayfinding Service
 * 
 * Generates spatial audio guidance sequences to lead visually impaired
 * users from their current location to safety during emergencies.
 */

import { WayfindingRoute, EmergencyAudioSequence, AudioWaypoint, AcousticZone } from '../types/acousticWayfinding';
import { speakerCoordinationService } from './speakerCoordinationService';
import { db } from '../lib/db';

export class AcousticWayfindingService {
  /**
   * Calculate shortest path from start zone to exit zone
   */
  async calculateWayfindingRoute(
    venueId: number,
    startZoneId: number,
    exitZoneId: number
  ): Promise<WayfindingRoute | null> {
    try {
      // Look for pre-calculated route
      const result = await db.query(
        `SELECT * FROM wayfinding_routes 
         WHERE venue_id = $1 AND start_zone_id = $2 AND end_zone_id = $3 AND is_active = true`,
        [venueId, startZoneId, exitZoneId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // If no pre-calculated route, could implement graph search algorithm here
      // For now, return null
      return null;
    } catch (error) {
      console.error('Error calculating wayfinding route:', error);
      return null;
    }
  }

  /**
   * Generate audio waypoints from route
   */
  private async generateAudioWaypoints(
    route: WayfindingRoute
  ): Promise<AudioWaypoint[]> {
    const waypoints: AudioWaypoint[] = [];
    const speakerSequence = route.speakerSequence || [];

    for (let i = 0; i < speakerSequence.length; i++) {
      const speakerId = speakerSequence[i];
      
      const result = await db.query(
        `SELECT * FROM venue_speakers WHERE id = $1`,
        [speakerId]
      );

      if (result.rows[0]) {
        const speaker = result.rows[0];
        waypoints.push({
          speakerId: speaker.id,
          speakerName: speaker.speaker_name,
          sequenceOrder: i,
          delayMs: i * route.intervalBetweenPingsMs,
          audioFrequencyHz: route.audioFrequencyHz,
          latitude: speaker.latitude,
          longitude: speaker.longitude,
        });
      }
    }

    return waypoints;
  }

  /**
   * Activate emergency wayfinding guidance
   */
  async activateEmergencyGuidance(
    emergencyEventId: number,
    venueId: number,
    startZoneId: number,
    exitZoneId: number
  ): Promise<{ success: boolean; sequenceId?: number; message: string }> {
    try {
      // Step 1: Find best route
      const route = await this.calculateWayfindingRoute(venueId, startZoneId, exitZoneId);
      if (!route) {
        return { success: false, message: 'No wayfinding route found' };
      }

      // Step 2: Mute alarms in affected zones
      await speakerCoordinationService.muteZone(startZoneId, true);

      // Step 3: Create emergency sequence record
      const sequenceResult = await db.query(
        `INSERT INTO emergency_audio_sequences 
         (emergency_event_id, venue_id, sequence_type, status, speaker_sequence, audio_frequency_hz, activated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id`,
        [
          emergencyEventId,
          venueId,
          'evacuation_path',
          'active',
          route.speakerSequence,
          route.audioFrequencyHz,
        ]
      );

      const sequenceId = sequenceResult.rows[0].id;

      // Step 4: Generate and play audio sequence
      const waypoints = await this.generateAudioWaypoints(route);
      const playResult = await speakerCoordinationService.playSpatialAudioSequence(
        waypoints,
        route.audioFrequencyHz,
        route.audioDurationMs,
        route.intervalBetweenPingsMs
      );

      // Update sequence status
      const finalStatus = playResult.success ? 'completed' : 'failed';
      await db.query(
        `UPDATE emergency_audio_sequences 
         SET status = $1, completed_at = NOW()
         WHERE id = $2`,
        [finalStatus, sequenceId]
      );

      return {
        success: playResult.success,
        sequenceId,
        message: `Activated wayfinding with ${playResult.playedWaypoints} speakers`,
      };
    } catch (error) {
      console.error('Error activating emergency guidance:', error);
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Test wayfinding route (for training/setup)
   */
  async testWayfindingRoute(routeId: number): Promise<{ success: boolean; message: string }> {
    try {
      const result = await db.query(
        `SELECT * FROM wayfinding_routes WHERE id = $1`,
        [routeId]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'Route not found' };
      }

      const route: WayfindingRoute = result.rows[0];
      const waypoints = await this.generateAudioWaypoints(route);

      const playResult = await speakerCoordinationService.playSpatialAudioSequence(
        waypoints,
        route.audioFrequencyHz,
        route.audioDurationMs,
        route.intervalBetweenPingsMs,
        60 // Quieter volume for testing
      );

      return {
        success: playResult.success,
        message: `Tested route: played ${playResult.playedWaypoints} waypoints`,
      };
    } catch (error) {
      console.error('Error testing wayfinding route:', error);
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Get all zones in a venue with accessibility info
   */
  async getAccessibleZones(venueId: number): Promise<AcousticZone[]> {
    const result = await db.query(
      `SELECT * FROM acoustic_zones WHERE venue_id = $1 ORDER BY zone_name`,
      [venueId]
    );

    return result.rows;
  }
}

export const acousticWayfindingService = new AcousticWayfindingService();