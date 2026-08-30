/**
 * Speaker Coordination Service
 * 
 * Manages networked PA and smart speaker systems.
 * Handles audio routing, muting, and spatial audio playback.
 */

import axios from 'axios';
import { VenueSpeaker, AudioWaypoint } from '../types/acousticWayfinding';
import { db } from '../lib/db';

export class SpeakerCoordinationService {
  /**
   * Send audio command to a single speaker
   */
  async sendAudioToSpeaker(
    speaker: VenueSpeaker,
    audioFrequencyHz: number,
    durationMs: number,
    volumeDb: number = 75
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!speaker.isActive) {
        return { success: false, error: 'Speaker is inactive' };
      }

      // Call speaker API
      const response = await axios.post(
        speaker.apiEndpoint,
        {
          action: 'play_tone',
          frequency_hz: audioFrequencyHz,
          duration_ms: durationMs,
          volume_db: volumeDb,
          device_id: speaker.deviceId,
        },
        {
          headers: {
            Authorization: `Bearer ${speaker.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      if (response.status === 200) {
        return { success: true };
      }

      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error(`Error sending audio to speaker ${speaker.speakerCode}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Mute or reduce volume in a zone
   */
  async muteZone(
    zoneId: number,
    muteAlarms: boolean = true
  ): Promise<{ success: boolean; affectedSpeakers: number }> {
    try {
      const result = await db.query(
        `SELECT speaker_ids FROM acoustic_zones WHERE id = $1`,
        [zoneId]
      );

      if (result.rows.length === 0) {
        return { success: false, affectedSpeakers: 0 };
      }

      const speakerIds = result.rows[0].speaker_ids || [];
      let successCount = 0;

      for (const speakerId of speakerIds) {
        const speaker = await this.getSpeakerById(speakerId);
        if (speaker) {
          const response = await axios.post(
            speaker.apiEndpoint,
            {
              action: muteAlarms ? 'mute' : 'unmute',
              mute_alarms: true,
              preserve_accessibility_audio: true, // Keep wayfinding audio
              device_id: speaker.deviceId,
            },
            {
              headers: {
                Authorization: `Bearer ${speaker.apiKey}`,
              },
              timeout: 5000,
            }
          );

          if (response.status === 200) {
            successCount++;
          }
        }
      }

      return { success: successCount > 0, affectedSpeakers: successCount };
    } catch (error) {
      console.error('Error muting zone:', error);
      return { success: false, affectedSpeakers: 0 };
    }
  }

  /**
   * Play sequential audio across speakers (wayfinding breadcrumb trail)
   */
  async playSpatialAudioSequence(
    waypointSequence: AudioWaypoint[],
    audioFrequencyHz: number,
    audioDurationMs: number,
    intervalMs: number = 2000,
    volumeDb: number = 75
  ): Promise<{ success: boolean; playedWaypoints: number; errors: string[] }> {
    const errors: string[] = [];
    let playedWaypoints = 0;

    for (let i = 0; i < waypointSequence.length; i++) {
      const waypoint = waypointSequence[i];
      const speaker = await this.getSpeakerById(waypoint.speakerId);

      if (!speaker) {
        errors.push(`Speaker ${waypoint.speakerId} not found`);
        continue;
      }

      // Send audio to speaker
      const result = await this.sendAudioToSpeaker(
        speaker,
        audioFrequencyHz,
        audioDurationMs,
        volumeDb
      );

      if (result.success) {
        playedWaypoints++;
      } else {
        errors.push(`Speaker ${speaker.speakerCode}: ${result.error}`);
      }

      // Wait before next speaker (except on last waypoint)
      if (i < waypointSequence.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return {
      success: playedWaypoints > 0,
      playedWaypoints,
      errors,
    };
  }

  /**
   * Test all speakers in a venue
   */
  async testAllSpeakers(venueId: number): Promise<{
    totalSpeakers: number;
    connectedSpeakers: number;
    failedSpeakers: VenueSpeaker[];
  }> {
    const result = await db.query(
      `SELECT * FROM venue_speakers WHERE venue_id = $1 AND is_active = true`,
      [venueId]
    );

    const speakers: VenueSpeaker[] = result.rows;
    const failedSpeakers: VenueSpeaker[] = [];
    let connectedSpeakers = 0;

    for (const speaker of speakers) {
      const testResult = await this.sendAudioToSpeaker(speaker, 1000, 200, 50);
      if (testResult.success) {
        connectedSpeakers++;
        // Update last_tested timestamp
        await db.query(
          `UPDATE venue_speakers SET last_tested = NOW() WHERE id = $1`,
          [speaker.id]
        );
      } else {
        failedSpeakers.push(speaker);
      }
    }

    return { totalSpeakers: speakers.length, connectedSpeakers, failedSpeakers };
  }

  /**
   * Get speaker by ID
   */
  private async getSpeakerById(speakerId: number): Promise<VenueSpeaker | null> {
    const result = await db.query(
      `SELECT * FROM venue_speakers WHERE id = $1`,
      [speakerId]
    );

    return result.rows[0] || null;
  }
}

export const speakerCoordinationService = new SpeakerCoordinationService();