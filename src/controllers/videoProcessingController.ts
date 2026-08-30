/**
 * Video Processing Controller
 * 
 * Handles API endpoints for video processing job management
 */

import { Router, Request, Response } from 'express';
import { videoFaceBlurringService } from '../services/videoFaceBlurringService';
import { authMiddleware } from '../middleware/authMiddleware';
import { db } from '../lib/db';

const router = Router();

/**
 * GET /api/video-processing/:jobId
 * Get video processing job status
 */
router.get('/:jobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await db.query(
      `SELECT * FROM video_processing_jobs WHERE job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    res.json({
      id: job.job_id,
      status: job.status,
      progressPercentage: job.progress_percentage,
      framesProcessed: job.frames_processed,
      totalFrames: job.total_frames,
      facesDetected: job.faces_detected,
      createdAt: job.created_at,
      completedAt: job.processing_completed_at,
      error: job.error_message,
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/video-processing/user/:userId
 * Get all video processing jobs for a user
 */
router.get('/user/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    // Users can only view their own jobs
    if (parseInt(userId) !== requestingUserId && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT job_id, status, progress_percentage, faces_detected, created_at, processing_completed_at
       FROM video_processing_jobs 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      jobs: result.rows.map((job: any) => ({
        id: job.job_id,
        status: job.status,
        progressPercentage: job.progress_percentage,
        facesDetected: job.faces_detected,
        createdAt: job.created_at,
        completedAt: job.processing_completed_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching user jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;