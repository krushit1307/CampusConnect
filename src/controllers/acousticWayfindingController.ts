/**
 * Acoustic Wayfinding Controller
 * 
 * API endpoints for managing acoustic wayfinding routes and testing
 */

import { Router, Request, Response } from 'express';
import { acousticWayfindingService } from '../services/acousticWayfindingService';
import { speakerCoordinationService } from '../services/speakerCoordinationService';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { db } from '../lib/db';

const router = Router();

/**
 * GET /api/acoustic-wayfinding/venues/:venueId/zones
 * Get all acoustic zones in a venue
 */
router.get('/venues/:venueId/zones', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const zones = await acousticWayfindingService.getAccessibleZones(parseInt(venueId));

    res.json({
      venueId,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.zoneName,
        type: z.zoneType,
        isEmergencyExit: z.isEmergencyExit,
        accessibilityNotes: z.accessibilityNotes,
      })),
    });
  } catch (error) {
    console.error('Error fetching acoustic zones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/acoustic-wayfinding/test-route/:routeId
 * Test a wayfinding route (admin only)
 */
router.post('/test-route/:routeId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const result = await acousticWayfindingService.testWayfindingRoute(parseInt(routeId));

    res.json(result);
  } catch (error) {
    console.error('Error testing wayfinding route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/acoustic-wayfinding/test-speakers/:venueId
 * Test all speakers in a venue (admin only)
 */
router.post('/test-speakers/:venueId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const result = await speakerCoordinationService.testAllSpeakers(parseInt(venueId));

    res.json({
      totalSpeakers: result.totalSpeakers,
      connectedSpeakers: result.connectedSpeakers,
      failedSpeakers: result.failedSpeakers.map((s) => ({
        id: s.id,
        code: s.speakerCode,
        name: s.speakerName,
        status: s.connectionStatus,
      })),
    });
  } catch (error) {
    console.error('Error testing speakers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/acoustic-wayfinding/venues/:venueId/speakers
 * Get all speakers in a venue (admin only)
 */
router.get('/venues/:venueId/speakers', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const result = await db.query(
      `SELECT id, speaker_code, speaker_name, zone_id, room_name, connection_status, is_active
       FROM venue_speakers 
       WHERE venue_id = $1
       ORDER BY speaker_code`,
      [venueId]
    );

    res.json({
      venueId,
      speakers: result.rows,
    });
  } catch (error) {
    console.error('Error fetching speakers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/acoustic-wayfinding/venues/:venueId/routes
 * Get all wayfinding routes in a venue (admin only)
 */
router.get('/venues/:venueId/routes', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const result = await db.query(
      `SELECT wr.id, wr.route_name, wr.start_zone_id, wr.end_zone_id, 
              wr.total_duration_seconds, wr.is_active,
              sz.zone_name as start_zone_name, ez.zone_name as end_zone_name
       FROM wayfinding_routes wr
       LEFT JOIN acoustic_zones sz ON wr.start_zone_id = sz.id
       LEFT JOIN acoustic_zones ez ON wr.end_zone_id = ez.id
       WHERE wr.venue_id = $1
       ORDER BY wr.route_name`,
      [venueId]
    );

    res.json({
      venueId,
      routes: result.rows.map((r) => ({
        id: r.id,
        name: r.route_name,
        from: r.start_zone_name,
        to: r.end_zone_name,
        durationSeconds: r.total_duration_seconds,
        isActive: r.is_active,
      })),
    });
  } catch (error) {
    console.error('Error fetching wayfinding routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;